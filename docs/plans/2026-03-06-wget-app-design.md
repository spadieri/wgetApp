# Wget App - Software Installer

## Overview
Electron desktop app for Windows that provides a curated catalog of ~50 popular software per category. Users click a card to download (via wget) and auto-launch the installer. Already-installed software is detected and marked with a green check.

## Tech Stack
- **Electron** + HTML/CSS/JS
- **UI**: Dark mode modern (VS Code-like)
- **Download engine**: wget (bundled with app)
- **Installer detection**: Windows Registry scan + known paths

## Categories (Tabs)
1. **Browser & Internet** (~50 apps)
2. **Sviluppo / Development** (~50 apps)
3. **Multimedia** (~50 apps)
4. **Utilita / Utilities** (~50 apps)
5. **Sicurezza / Security** (~50 apps)
6. **Comunicazione / Communication** (~50 apps)
7. **Office & Produttivita** (~50 apps)
8. **Sistema / System** (~50 apps)

## UI Flow
1. Sidebar with category tabs (icons + labels)
2. Main area shows grid of software cards
3. Each card: icon, name, version, short description
4. Green checkmark overlay on already-installed software
5. Click card → download starts (progress bar on card)
6. Download complete → auto-launch installer (UAC prompt appears)
7. User completes installation via standard Windows installer

## Software Detection
- Scan `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
- Scan `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`
- Check common paths: `Program Files`, `Program Files (x86)`, `AppData\Local`
- Match by DisplayName or known executable paths

## Data Model
Each software entry:
```json
{
  "id": "vscode",
  "name": "Visual Studio Code",
  "description": "Code editor by Microsoft",
  "category": "development",
  "icon": "vscode.png",
  "downloadUrl": "https://...",
  "filename": "VSCodeSetup.exe",
  "detectRegistry": "Microsoft Visual Studio Code",
  "detectPaths": ["C:/Program Files/Microsoft VS Code/Code.exe"],
  "version": "latest",
  "size": "~95MB",
  "silent": "/VERYSILENT /NORESTART"
}
```

## Key Features
- **Card grid** with search/filter
- **Progress bar** per-card during download
- **Auto-launch** installer after download
- **Installed detection** with green checkmark
- **Bundled wget.exe** (no external dependency)
- **Download queue** for multiple selections
