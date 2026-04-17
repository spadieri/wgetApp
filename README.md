# Wget App - Software Installer

Windows desktop app to download and install popular software with a single click. Uses wget as the download engine and automatically detects already-installed software.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- Windows 10/11

## Installation

```bash
git clone https://github.com/spadieri/wgetApp.git
cd wgetApp
npm install
```

## Usage

```bash
npm start
```

## Features

- 8 software categories (Browsers, Development, Multimedia, Utilities, Security, Communication, Office, System)
- ~50 software per category
- Automatic detection of already-installed software (green checkmark)
- Download with progress bar via bundled wget
- Automatic installer launch after download
- Search bar to filter software
- Modern dark mode UI

## Tech Stack

- Electron
- HTML/CSS/JS (vanilla)
- wget (bundled)
- Windows Registry for software detection
