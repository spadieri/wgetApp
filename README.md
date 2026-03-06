# Wget App - Software Installer

App desktop per Windows che permette di scaricare e installare software popolari con un click. Usa wget come motore di download e rileva automaticamente i software già installati.

## Requisiti

- [Node.js](https://nodejs.org/) 18+
- Windows 10/11

## Installazione

```bash
git clone https://github.com/spadieri/wgetApp.git
cd wgetApp
npm install
```

## Avvio

```bash
npm start
```

## Funzionalità

- 8 categorie di software (Browser, Sviluppo, Multimedia, Utilità, Sicurezza, Comunicazione, Office, Sistema)
- ~50 software per categoria
- Rilevamento automatico software già installati (check verde)
- Download con progress bar tramite wget integrato
- Avvio automatico dell'installer dopo il download
- Barra di ricerca per filtrare i software
- Interfaccia dark mode moderna

## Tech Stack

- Electron
- HTML/CSS/JS (vanilla)
- wget (bundled)
- Windows Registry per il rilevamento software
