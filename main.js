const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
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

ipcMain.handle('check-installed', async (_event, softwareList) => {
  const installed = {};

  try {
    const registryNames = getRegistryInstalledNames();

    for (const software of softwareList) {
      // Check registry DisplayName match
      const regMatch = software.detectRegistry?.some(name =>
        registryNames.some(regName => regName.includes(name.toLowerCase()))
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
// Task 7: Download Engine - wget download + auto-launch installer
// ============================================================

ipcMain.handle('download-software', async (_event, software) => {
  const downloadsPath = path.join(app.getPath('downloads'), 'WgetApp');

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  const outputPath = path.join(downloadsPath, software.filename);
  const wgetPath = getWgetPath();

  return new Promise((resolve, reject) => {
    const args = [
      software.downloadUrl,
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
