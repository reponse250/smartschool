# SmartSchool Mubuga app build guide

The Android, iOS, and Windows apps bundle the existing `public/` frontend and
connect to the hosted Express backend at `https://smartschool-o73k.onrender.com`.
Database credentials and other server secrets must stay on the backend; they are
not used by the app.

## Security before packaging

The old backend source contained a MongoDB URI fallback. It has been removed;
the server now requires `MONGODB_URI` from its environment. Treat the previously
embedded MongoDB password as exposed: rotate it in MongoDB Atlas, then update
`MONGODB_URI` in the backend host (for example Render). Also set `SESSION_SECRET`
to a random value of at least 32 characters.

For local backend development, copy `.env.example` to `realtime/.env` and replace
the placeholders. Do not copy real `.env` files into an app or source archive.

The backend permits the packaged app origins `https://localhost`,
`capacitor://localhost`, and `app://localhost` for authenticated API requests.
If you change the app scheme or backend URL, update the corresponding config and
the backend CORS allowlist together.

## Install

Use Node.js 22 or later. From the extracted project directory, run:

```powershell
npm install
```

Generated platform directories and build output are not part of the source ZIP.
The website's 192px and 512px install icons are committed under
`public/assets/`; after changing the logo, regenerate them with:

```powershell
npm run pwa:icons
```

## Install from the website

The website can be installed as a Progressive Web App on phones and computers.
Open `https://mubuga.netlify.app/` in a supported browser while online:

- **Android:** Chrome menu → **Install app** (or use the Install SmartSchool
  button when it appears).
- **Windows/macOS/Linux:** Chrome or Edge install icon in the address bar, or
  browser menu → **Install SmartSchool**.
- **iPhone/iPad:** Safari Share → **Add to Home Screen**.

The website install opens the hosted app and keeps database credentials on the
backend. Attendance entries can queue locally after signing in and loading the
teacher list once online; other modules require an internet connection.

## Android

Install Android Studio and its Android SDK, then run:

```powershell
npm run android:add
npm run app:assets
npm run android:sync
npm run android:open
```

The assets command uses `assets/logo.svg` to generate platform icons and splash
assets after the native project is created.

Build and sign the APK or app bundle from Android Studio.

## Windows desktop

Run the app locally with:

```powershell
npm run desktop
```

Build the Windows installer with:

```powershell
npm run desktop:windows
```

The installer is written to `release/`. Distribute signed builds for production.

## iOS

iOS builds require macOS and Xcode:

```sh
npm run ios:add
npm run app:assets
npm run ios:sync
npm run ios:open
```

Build and sign the app in Xcode.

## Offline behavior and limits

The PWA and packaged attendance page can save attendance entries locally and
sync them after connectivity returns. Other modules still require an internet
connection and the hosted backend. Sign in once while online to cache the
teacher list for offline attendance. Do not treat the local queue as a backup
for the server or clear browser/app storage before queued entries sync.

Native binaries cannot be built on a machine without the platform toolchains.
The source ZIP contains build configuration, not precompiled APK, EXE, or iOS
artifacts.

## Create a safe source ZIP

From Windows PowerShell, run:

```powershell
npm run package:source
```

The archive is written to `release/SmartSchool-Mubuga-source.zip`. It excludes
Git history, dependency folders, generated native projects, build output, and
local `.env` files; the placeholder `.env.example` is included.
