# Virgo Printing App — Windows download

This folder is where the built Windows installer is placed for the
restaurant-level Printer Setup download button
(`/downloads/virgo-printing-app-windows.zip`).

## How the download is produced

The app source lives in `print-app/` (Electron + the shared printing logic).
Because the Windows installer must be built on a Windows machine
(electron-builder produces `.exe` installers only there), the build step is:

1. On any Windows 10/11 machine with Node.js 18+: copy the `print-app/` folder
   and run:
   ```
   cd print-app
   npm install
   npm run dist
   ```
2. Take the produced `dist/Virgo Printing App Setup 1.0.0.exe`, zip it, and
   name the archive `virgo-printing-app-windows.zip` in this folder
   (`public/downloads/`).

Once the zip is present, the "Download for Windows" button on the Host
Dashboard's Printer Setup page serves it directly.

## What the installer does

- Installs the app for the current Windows user (no admin rights needed).
- Starts the app after install.
- Registers it to start automatically with Windows (current-user Run key).
- The app runs in the system tray; opening it shows connection status, the
  department checklist, and a Test print button per department.
- Sign-in uses the restaurant's existing Virgo Portal host account. No API
  keys, service-role keys, or technical configuration are involved.
