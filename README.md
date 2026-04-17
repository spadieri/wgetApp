# Wget App - Software Installer

Windows desktop app to download and install popular software with a single click. Uses wget as the download engine and automatically detects already-installed software.

## Download

Grab the latest release from the [Releases page](https://github.com/spadieri/wgetApp/releases):

- **`WgetApp-Setup-x.y.z.exe`** — standard installer (recommended). Creates desktop/start menu shortcuts and auto-updates in the background.
- **`WgetApp-x.y.z-portable.exe`** — single-file executable, no installation. Notifies you when a new version is released but won't self-update.

Both require **Windows 10 or 11 (x64)**. No runtime (Node.js, .NET, etc.) needs to be installed.

## Features

- 8 software categories (Browsers, Development, Multimedia, Utilities, Security, Communication, Office, System)
- ~50 software per category
- Automatic detection of already-installed software (green checkmark)
- Download with progress bar via bundled wget
- Automatic installer launch after download
- Search bar to filter software
- Language toggle (Italian / English)
- Modern dark mode UI
- Auto-update from GitHub Releases

## Build from source

Requires [Node.js](https://nodejs.org/) 18+ and Windows 10/11.

```bash
git clone https://github.com/spadieri/wgetApp.git
cd wgetApp
npm install
npm start                # run in dev mode
npm run build            # build both installer + portable (output in dist/)
npm run build:installer  # NSIS installer only
npm run build:portable   # portable .exe only
```

## Tech Stack

- Electron
- electron-builder (NSIS installer + portable)
- electron-updater (auto-update from GitHub Releases)
- HTML/CSS/JS (vanilla)
- wget (bundled)
- Windows Registry for software detection

## License

ISC
