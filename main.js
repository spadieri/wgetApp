const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');

const GITHUB_REPO = 'spadieri/wgetApp';

function getWgetPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'wget.exe');
  }
  return path.join(__dirname, 'resources', 'wget.exe');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    backgroundColor: '#1e1e2e'
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) {
    setTimeout(checkForUpdates, 3000);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

// ============================================================
// Auto-update: event-driven header badge (no modal dialogs)
// NSIS flavor: download + install in-app. Portable flavor: external link.
// ============================================================

const updateState = {
  flavor: null,       // 'nsis' | 'portable' | null
  version: null,      // '1.3.1'
  htmlUrl: null,      // release page (portable only)
  downloading: false, // true while autoUpdater is downloading
  progress: 0,        // 0..100
  downloaded: false   // true when ready to install
};

function sendUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:state', updateState);
  }
}

function isPortable() {
  return !!process.env.PORTABLE_EXECUTABLE_DIR;
}

function isNewerVersion(remote, current) {
  const r = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const c = current.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (c[i] || 0)) return true;
    if ((r[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function checkForUpdates() {
  if (isPortable()) {
    checkForUpdatesPortable();
  } else {
    setupNsisAutoUpdater();
  }
}

function checkForUpdatesPortable() {
  const req = https.get(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: { 'User-Agent': 'WgetApp-Updater', 'Accept': 'application/vnd.github+json' } },
    (res) => {
      if (res.statusCode !== 200) { res.resume(); return; }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          if (!release.tag_name) return;
          if (!isNewerVersion(release.tag_name, app.getVersion())) return;

          updateState.flavor = 'portable';
          updateState.version = release.tag_name.replace(/^v/, '');
          updateState.htmlUrl = release.html_url;
          sendUpdateState();
        } catch (err) {
          console.error('Update check failed:', err);
        }
      });
    }
  );
  req.on('error', (err) => console.error('Update check error:', err));
  req.setTimeout(5000, () => req.destroy());
}

function setupNsisAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    updateState.flavor = 'nsis';
    updateState.version = info.version;
    sendUpdateState();
  });

  autoUpdater.on('download-progress', (p) => {
    updateState.progress = Math.round(p.percent || 0);
    sendUpdateState();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState.downloading = false;
    updateState.downloaded = true;
    updateState.progress = 100;
    updateState.version = info.version;
    sendUpdateState();
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    updateState.downloading = false;
    sendUpdateState();
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('checkForUpdates failed:', err);
  });
}

ipcMain.handle('update:get-state', () => updateState);

ipcMain.handle('update:start-download', async () => {
  if (updateState.flavor !== 'nsis') return;
  if (updateState.downloading || updateState.downloaded) return;
  updateState.downloading = true;
  updateState.progress = 0;
  sendUpdateState();
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.error('downloadUpdate failed:', err);
    updateState.downloading = false;
    sendUpdateState();
  }
});

ipcMain.handle('update:quit-and-install', () => {
  if (!updateState.downloaded) return;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:open-external', () => {
  if (updateState.htmlUrl) shell.openExternal(updateState.htmlUrl);
});

// ============================================================
// Task 6: Registry Detection - Check which software is installed
// ============================================================

function getRegistryInstalledNames() {
  const names = [];
  const registryKeys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ];

  for (const key of registryKeys) {
    try {
      const output = execSync(
        `reg query "${key}" /s /v DisplayName 2>nul`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 15000 }
      );
      const matches = output.match(/DisplayName\s+REG_SZ\s+(.+)/gi);
      if (matches) {
        for (const match of matches) {
          const name = match.replace(/DisplayName\s+REG_SZ\s+/i, '').trim();
          if (name) names.push(name.toLowerCase());
        }
      }
    } catch {
      // Registry key may not exist, ignore
    }
  }

  return names;
}

// Cached list of MSIX/Appx package names (Start Menu apps, Store apps, Electron
// apps using Squirrel-over-MSIX like Claude Desktop). Get-AppxPackage is slow
// (~1-2s) so we cache for the session.
let appxNamesCache = null;
function getAppxInstalledNames() {
  if (appxNamesCache !== null) return appxNamesCache;
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-AppxPackage | ForEach-Object { $_.Name }"',
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 20000 }
    );
    appxNamesCache = output
      .split(/\r?\n/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  } catch (err) {
    console.error('Get-AppxPackage failed:', err.message);
    appxNamesCache = [];
  }
  return appxNamesCache;
}

ipcMain.handle('check-installed', async (_event, softwareList) => {
  const installed = {};

  try {
    const installedNames = [
      ...getRegistryInstalledNames(),
      ...getAppxInstalledNames()
    ];

    for (const software of softwareList) {
      // Check registry DisplayName or Appx package name match
      const regMatch = software.detectRegistry?.some(name =>
        installedNames.some(n => n.includes(name.toLowerCase()))
      ) || false;

      // Check file path existence
      const pathMatch = software.detectPaths?.some(p => {
        const resolved = p.replace(/%USERNAME%/g, process.env.USERNAME || '');
        return fs.existsSync(resolved);
      }) || false;

      installed[software.id] = regMatch || pathMatch;
    }
  } catch (err) {
    console.error('Registry scan error:', err);
  }

  return installed;
});

// ============================================================
// Download URL resolver - supports GitHub API (auto-latest) or static URL
// ============================================================

const urlCache = new Map();
const URL_CACHE_TTL_MS = 60 * 60 * 1000;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'WgetApp',
          'Accept': 'application/vnd.github+json'
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (err) { reject(err); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('GitHub API timeout')));
  });
}

async function resolveDownloadUrl(software) {
  if (software.source !== 'github') {
    return software.downloadUrl;
  }

  const cached = urlCache.get(software.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const release = await fetchJson(
    `https://api.github.com/repos/${software.repo}/releases/latest`
  );
  const pattern = new RegExp(software.assetPattern);
  const asset = (release.assets || []).find((a) => pattern.test(a.name));
  if (!asset) {
    throw new Error(
      `No asset matches /${software.assetPattern}/ in ${software.repo}@${release.tag_name}`
    );
  }

  urlCache.set(software.id, {
    url: asset.browser_download_url,
    expiresAt: Date.now() + URL_CACHE_TTL_MS
  });
  return asset.browser_download_url;
}

// ============================================================
// Task 7: Download Engine - wget download + auto-launch installer
// ============================================================

ipcMain.handle('download-software', async (_event, software) => {
  const downloadsPath = path.join(app.getPath('downloads'), 'WgetApp');

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  const outputPath = path.join(downloadsPath, software.filename);
  const wgetPath = getWgetPath();

  const downloadUrl = await resolveDownloadUrl(software);

  return new Promise((resolve, reject) => {
    const args = [
      downloadUrl,
      '-O', outputPath,
      '--no-check-certificate',
      '-q', '--show-progress'
    ];

    const proc = spawn(wgetPath, args);

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/(\d+)%/);
      if (match && mainWindow) {
        mainWindow.webContents.send('download-progress', {
          id: software.id,
          progress: parseInt(match[1])
        });
      }
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        // Auto-launch the installer (triggers UAC for .exe/.msi)
        shell.openPath(outputPath).then((error) => {
          if (error) {
            console.error('Failed to launch installer:', error);
          }
        });
        resolve({ success: true, path: outputPath });
      } else {
        // Clean up partial download
        try { fs.unlinkSync(outputPath); } catch {}
        reject(new Error(`Download failed (exit code ${code})`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start wget: ${err.message}`));
    });
  });
});

ipcMain.handle('get-downloads-path', () => {
  return path.join(app.getPath('downloads'), 'WgetApp');
});

ipcMain.handle('open-downloads-folder', () => {
  const downloadsPath = path.join(app.getPath('downloads'), 'WgetApp');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  shell.openPath(downloadsPath);
});

ipcMain.handle('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});
