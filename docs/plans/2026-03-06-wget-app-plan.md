# Wget App - Software Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Electron desktop app that displays ~50 popular software per category (8 tabs), detects already-installed software via Windows Registry, downloads installers with bundled wget.exe, and auto-launches them.

**Architecture:** Electron main process handles wget downloads and registry scanning via IPC. Renderer process is a single-page HTML/CSS/JS app with a sidebar for tabs and a card grid. Software catalog is stored as JSON files per category.

**Tech Stack:** Electron 33+, vanilla HTML/CSS/JS (no framework), child_process for wget, regedit npm package for registry, electron-builder for packaging.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `preload.js`
- Create: `index.html`
- Create: `.gitignore`

**Step 1: Initialize npm project and install dependencies**

Run:
```bash
cd C:/Users/Pd85/Desktop/wgetApp
npm init -y
npm install --save-dev electron
npm install regedit
```

**Step 2: Create package.json scripts**

Update `package.json`:
```json
{
  "name": "wget-app",
  "version": "1.0.0",
  "description": "Software installer using wget",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^33.0.0"
  },
  "dependencies": {
    "regedit": "^5.1.3"
  }
}
```

**Step 3: Create main.js (Electron main process)**

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    backgroundColor: '#1e1e2e'
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
```

**Step 4: Create preload.js (IPC bridge)**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadSoftware: (software) => ipcRenderer.invoke('download-software', software),
  checkInstalled: (softwareList) => ipcRenderer.invoke('check-installed', softwareList),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path')
});
```

**Step 5: Create minimal index.html**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wget App - Software Installer</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <aside id="sidebar"></aside>
    <main id="content"></main>
  </div>
  <script src="renderer.js"></script>
</body>
</html>
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
downloads/
resources/wget.exe
```

**Step 7: Run and verify window opens**

Run: `npm start`
Expected: Empty dark window opens successfully.

**Step 8: Commit**

```bash
git init
git add package.json main.js preload.js index.html .gitignore
git commit -m "feat: scaffold Electron project"
```

---

### Task 2: Bundle wget.exe

**Files:**
- Create: `resources/` directory
- Download: `resources/wget.exe`
- Modify: `main.js` (add wget path helper)

**Step 1: Download portable wget.exe for Windows**

```bash
mkdir -p resources
curl -L -o resources/wget.exe "https://eternallybored.org/misc/wget/1.21.4/64/wget.exe"
```

If curl fails, manually download wget.exe 64-bit from https://eternallybored.org/misc/wget/ and place in `resources/`.

**Step 2: Add wget path utility to main.js**

Add to `main.js` after the requires:
```javascript
function getWgetPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'wget.exe');
  }
  return path.join(__dirname, 'resources', 'wget.exe');
}
```

**Step 3: Verify wget works**

Run in a terminal:
```bash
./resources/wget.exe --version
```
Expected: wget version output.

**Step 4: Commit**

```bash
git add resources/wget.exe main.js
git commit -m "feat: bundle portable wget.exe"
```

---

### Task 3: Software Catalog Data

**Files:**
- Create: `data/browsers.json`
- Create: `data/development.json`
- Create: `data/multimedia.json`
- Create: `data/utilities.json`
- Create: `data/security.json`
- Create: `data/communication.json`
- Create: `data/office.json`
- Create: `data/system.json`
- Create: `data/categories.json`

**Step 1: Create categories.json**

```json
[
  { "id": "browsers", "name": "Browser & Internet", "icon": "globe" },
  { "id": "development", "name": "Sviluppo", "icon": "code" },
  { "id": "multimedia", "name": "Multimedia", "icon": "film" },
  { "id": "utilities", "name": "Utilità", "icon": "tool" },
  { "id": "security", "name": "Sicurezza", "icon": "shield" },
  { "id": "communication", "name": "Comunicazione", "icon": "message-circle" },
  { "id": "office", "name": "Office & Produttività", "icon": "file-text" },
  { "id": "system", "name": "Sistema", "icon": "cpu" }
]
```

**Step 2: Create each category JSON file**

Each file follows this structure (example `data/browsers.json`):
```json
[
  {
    "id": "google-chrome",
    "name": "Google Chrome",
    "description": "Browser web di Google",
    "downloadUrl": "https://dl.google.com/chrome/install/latest/chrome_installer.exe",
    "filename": "chrome_installer.exe",
    "detectRegistry": ["Google Chrome"],
    "detectPaths": ["C:/Program Files/Google/Chrome/Application/chrome.exe"],
    "size": "~90MB"
  }
]
```

Populate each category with ~50 entries using real download URLs where possible. Use direct download links from official sources (GitHub releases, official sites).

**Step 3: Commit**

```bash
git add data/
git commit -m "feat: add software catalog data for all 8 categories"
```

---

### Task 4: Dark Mode UI - Styles

**Files:**
- Create: `styles.css`

**Step 1: Create the full dark mode stylesheet**

Key design tokens:
- Background: `#1e1e2e` (main), `#181825` (sidebar)
- Surface: `#313244` (cards)
- Accent: `#89b4fa` (blue), `#a6e3a1` (green for installed)
- Text: `#cdd6f4` (primary), `#a6adc8` (secondary)
- Font: `Segoe UI` (Windows native)

Layout:
- Sidebar: 220px fixed left
- Cards: CSS Grid, `repeat(auto-fill, minmax(280px, 1fr))`
- Card: rounded corners, hover effect, progress bar overlay
- Installed badge: green checkmark top-right

**Step 2: Verify styles render**

Run: `npm start`
Expected: Dark background with sidebar visible.

**Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: add dark mode styles"
```

---

### Task 5: Renderer - UI Logic

**Files:**
- Create: `renderer.js`

**Step 1: Build the renderer with these features**

1. **loadCategories()** - Read categories.json, render sidebar tabs
2. **loadSoftware(categoryId)** - Load category JSON, render card grid
3. **renderCard(software)** - Create card element with name, description, size, install button
4. **handleDownload(software)** - Call electronAPI.downloadSoftware, show progress
5. **updateInstalledStatus()** - Call electronAPI.checkInstalled, add green checkmarks
6. **Search/filter bar** - Filter cards by name within current category

Key behaviors:
- First tab auto-selected on load
- Cards show download progress (bar + percentage)
- Cards show "Installato" badge with green check when detected
- Click card → confirm dialog → start download
- Download complete → installer launches automatically

**Step 2: Verify UI renders with cards**

Run: `npm start`
Expected: Sidebar with 8 tabs, card grid showing software for selected category.

**Step 3: Commit**

```bash
git add renderer.js
git commit -m "feat: add renderer UI logic"
```

---

### Task 6: Registry Detection (Main Process)

**Files:**
- Modify: `main.js`

**Step 1: Add IPC handler for check-installed**

```javascript
const regedit = require('regedit');
const fs = require('fs');

ipcMain.handle('check-installed', async (event, softwareList) => {
  const installed = {};

  // Method 1: Registry scan
  const registryKeys = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ];

  try {
    const registryEntries = await listRegistryValues(registryKeys);

    for (const software of softwareList) {
      // Check registry DisplayName match
      const regMatch = registryEntries.some(entry =>
        software.detectRegistry.some(name =>
          entry.toLowerCase().includes(name.toLowerCase())
        )
      );

      // Check file path existence
      const pathMatch = software.detectPaths?.some(p => fs.existsSync(p)) || false;

      installed[software.id] = regMatch || pathMatch;
    }
  } catch (err) {
    console.error('Registry scan error:', err);
  }

  return installed;
});
```

**Step 2: Implement registry list helper using regedit**

```javascript
function listRegistryValues(keys) {
  return new Promise((resolve, reject) => {
    regedit.list(keys, (err, result) => {
      if (err) return reject(err);
      const names = [];
      for (const key of Object.values(result)) {
        if (key.keys) {
          names.push(...key.keys);
        }
      }
      resolve(names);
    });
  });
}
```

**Step 3: Verify detection works**

Run: `npm start`, check console for detected software.
Expected: Software like Chrome, VS Code show green checkmarks if installed.

**Step 4: Commit**

```bash
git add main.js
git commit -m "feat: add Windows registry software detection"
```

---

### Task 7: Download Engine (Main Process)

**Files:**
- Modify: `main.js`

**Step 1: Add IPC handler for download-software**

```javascript
const { spawn } = require('child_process');

ipcMain.handle('download-software', async (event, software) => {
  const downloadsPath = path.join(app.getPath('downloads'), 'WgetApp');

  // Ensure downloads directory exists
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  const outputPath = path.join(downloadsPath, software.filename);
  const wgetPath = getWgetPath();

  return new Promise((resolve, reject) => {
    const args = [
      software.downloadUrl,
      '-O', outputPath,
      '--progress=dot:mega',
      '--no-check-certificate',
      '-q', '--show-progress'
    ];

    const proc = spawn(wgetPath, args);

    proc.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/(\d+)%/);
      if (match) {
        mainWindow.webContents.send('download-progress', {
          id: software.id,
          progress: parseInt(match[1])
        });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Auto-launch installer
        const { shell } = require('electron');
        shell.openPath(outputPath);
        resolve({ success: true, path: outputPath });
      } else {
        reject(new Error(`wget exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
});

ipcMain.handle('get-downloads-path', () => {
  return path.join(app.getPath('downloads'), 'WgetApp');
});
```

**Step 2: Test download with a small file**

Run: `npm start`, click on a small software (e.g. 7-Zip ~1.5MB).
Expected: Progress bar fills, file downloads, installer launches with UAC.

**Step 3: Commit**

```bash
git add main.js
git commit -m "feat: add wget download engine with auto-launch"
```

---

### Task 8: Search Bar and Polish

**Files:**
- Modify: `index.html` (add search input)
- Modify: `renderer.js` (add search filtering)
- Modify: `styles.css` (search bar styles)

**Step 1: Add search input to index.html header area**

Add between sidebar and content:
```html
<header id="header">
  <h1 id="category-title"></h1>
  <input type="text" id="search" placeholder="Cerca software...">
</header>
```

**Step 2: Add search filtering to renderer.js**

```javascript
document.getElementById('search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.card').forEach(card => {
    const name = card.dataset.name.toLowerCase();
    card.style.display = name.includes(query) ? '' : 'none';
  });
});
```

**Step 3: Style the search bar**

Add to `styles.css` - dark input with rounded corners, search icon.

**Step 4: Verify search works**

Run: `npm start`, type in search bar.
Expected: Cards filter by name in real-time.

**Step 5: Commit**

```bash
git add index.html renderer.js styles.css
git commit -m "feat: add search bar with live filtering"
```

---

### Task 9: Final Integration and Testing

**Files:**
- All files

**Step 1: End-to-end test flow**

1. Launch app: `npm start`
2. Verify all 8 tabs load
3. Verify cards display correctly
4. Verify installed software shows green check
5. Search filters correctly
6. Download a test software (7-Zip)
7. Verify progress bar works
8. Verify installer auto-launches

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Wget App v1.0"
```
