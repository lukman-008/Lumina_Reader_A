# 📖 Lumina Reader — Architecture & Multi-Platform Native Build Guide

> **Lumina Reader** is a next-generation, offline-first digital reading sanctuary engineered with true OPF EPUB spine parsing, virtualized high-DPI PDF rendering, Kindle-style Location indexing, syntopicon cross-library search, interlinear Word Wise glosses, spatial PDF figure snipping, and Leitner/SM-2 spaced repetition vocabulary.

This repository is built with **React 19 + TypeScript + Vite + Tailwind CSS v4**. It is architected from the ground up to deploy as a **zero-compromise Progressive Web App (PWA)**, a **Native Android App (APK / AAB)**, an **iOS / iPadOS App**, and a **Desktop App (macOS / Windows / Linux)**.

---

## 📑 Table of Contents
1. [Core Features & Architecture](#1-core-features--architecture)
2. [Cross-Device & Cross-OS Engineering Architecture](#2-cross-device--cross-os-engineering-architecture)
3. [Local Web Development & Clean Dependency Verification](#3-local-web-development--clean-dependency-verification)
4. [Building the Android App (Method 1: Capacitor Native APK & Play Store AAB)](#4-building-the-android-app-method-1-capacitor-native-apk--play-store-aab)
5. [Building the Android App (Method 2: Google Play TWA with Bubblewrap)](#5-building-the-android-app-method-2-google-play-twa-with-bubblewrap)
6. [Optimizations for Android E-Ink Devices (Onyx Boox, Meebook, Kindle Fire)](#6-optimizations-for-android-e-ink-devices)
7. [Building the iOS & iPadOS App (Capacitor + Xcode)](#7-building-the-ios--ipados-app-capacitor--xcode)
8. [Building Desktop Apps (Tauri 2.0 & Electron)](#8-building-desktop-apps-tauri-20--electron)
9. [Cross-Platform Storage & Performance Architecture](#9-cross-platform-storage--performance-architecture)

---

## 1. Core Features & Architecture

- **Split IndexedDB Storage (`Dexie.js`)**: Keeps metadata, reading progress, and annotations in a fast-index table while storing heavy EPUB/PDF binary blobs in a dedicated secondary store. Library shelves load instantly even with thousands of volumes.
- **True OPF Spine EPUB Parser (`JSZip` + DOMParser)**: Unpacks EPUB 2/3 container XML, spine itemrefs, and stylesheets. Rewrites relative `src` paths of embedded figures, tables, and typography to live Object URLs.
- **Virtualized High-DPI PDF Engine (`PDF.js` v6)**: Renders vector crispness at device pixel ratio, supports single-page and 2-page side-by-side spreads, miniature canvas page thumbnails with `IntersectionObserver`, and text layer selection.
- **Spatial PDF Snipping Tool**: Allows dragging a crosshair selection box over any chart, formula, or figure to crop it into a high-res image and pin it directly into the Research Notebook.
- **Kindle-Style Location Indexing**: Standardizes reading position across arbitrary screen sizes and font resizes using 150-character normalized text offsets.
- **Multilingual Word Wise Engine**: Local morphology lookup and interlinear `<ruby>` glosses for English, Hindi, Sanskrit, Arabic, French, and Spanish without external API roundtrips.
- **Cloze Deletion Vocabulary SRS**: Leitner & SuperMemo SM-2 spaced repetition flashcards with fill-in-the-blank context recall and native Web Speech TTS audio pronunciation.
- **Global Syntopicon Command Palette (`Cmd+K` / `Ctrl+K`)**: Cross-book full-text search across all imported books and OCR-indexed PDF pages.
- **Citation Generator**: Instant 1-click academic citations in APA 7th, MLA 9th, Chicago 17th, and BibTeX.

---

## 2. Cross-Device & Cross-OS Engineering Architecture

Lumina Reader is engineered to run identically across **Android phones (Samsung OneUI, Pixel, Xiaomi HyperOS, OnePlus OxygenOS), iPhones (Dynamic Island), iPads (Portrait, Landscape, Split-View, Stage Manager), Android tablets/foldables, E-Ink readers, and Desktop monitors**.

### 2.1 Android Notification Bar, Hole-Punch Camera & Safe-Area Protection
Many Android WebViews and fullscreen PWAs report `env(safe-area-inset-top)` as `0px` even when the Android status/notification bar or hole-punch camera overlaps the top `28px–48px` of the screen. Lumina prevents top buttons (`Back`, `TOC`, `Aa`, `Search`) from ever being hidden:
- **Multi-Signal Android & Touch Detection**: Detects Android via User-Agent (`/Android/i`), Linux ARM WebViews (`/Linux armv|Linux aarch64/i`), standalone PWA modes, and coarse-pointer viewports, applying an automatic **`36px–42px` top status-bar clearance (`--lumina-safe-top`)**.
- **User-Adjustable Safe-Area Offset Presets**: Inside the Reader Appearance (`Aa`) drawer, users can fine-tune top clearance between **Auto (`0px`), Standard (`16px`), Deep Cutout (`32px`), and Max (`48px`)**—persisted in `localStorage`.
- **Thumb-Zone Redundancy (Bottom Bar)**: Both the Reflowable Reader and PDF Engine include dedicated **`Library` (Back)** and **`Aa` (Options)** controls in the bottom thumb-zone footer so every core action is reachable one-handed even if the top HUD is hidden.

### 2.2 Zero-Conflict Geometric Touch Selection Engine (No Android "Ask AI / Copy" OS Popup)
On Android 13/14/15, native browser text selection (`::selection`) triggers an intrusive OS context menu (*"Copy | Share | Select All | Ask AI | Web Search"*) that covers the application's own toolbar.
- **Native Callout Suppression on Touch (`@media (pointer: coarse)`)**: On touch screens, `.lumina-reader-surface` enforces `-webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important;` and intercepts `contextmenu` and `selectstart`. Android OS never sees a native selection event and never spawns its system popup. Desktop mouse selection (`@media (pointer: fine)`) remains 100% native.
- **60fps DOM Range Geometric Hit-Testing (`findWordAtPointInParagraph`)**: Uses `document.createTreeWalker` + `Range.getClientRects()` to map touch `(clientX, clientY)` coordinates to exact character offsets inside the original paragraph without wrapping words in thousands of `<span>` nodes.
- **4 Seamless Touch Selection Modes**:
  1. **Tap Any Word**: Tap any word in the center reading zone (`16%–84%` width) to highlight it and open Lumina's floating dictionary/highlight toolbar.
  2. **Two-Tap Range Selection**: Tap the first word, then tap the last word of any phrase or sentence—Lumina automatically highlights the entire span between them.
  3. **Hold & Drag (210ms)**: Press and hold for 210ms (with soft haptic feedback) and slide your finger across lines to scrub-select any passage at 60fps with non-passive `touchmove` scroll lock.
  4. **1-Tap Smart Expanders**: Once a word is selected, tap **`+Words`**, **`Sentence`**, or **`Full Para`** in the Lumina floating bar to expand the selection to exact sentence or paragraph boundaries.

### 2.3 Universal 2-Page Book Spread (iPad, Tablets, Foldables & Desktop)
- **Reflowable EPUB/Text Spread**: When **2-Page Spread** is enabled (`viewMode: 'dual'`), Lumina renders an open-book two-leaf spread with a realistic center spine shadow, synchronized word-budget pagination (`145` words per leaf), automatic font scaling on mid-sized viewports (`560px–960px`), and two-page step turns (`±2` pages per turn).
- **PDF Dual-Page Spread**: Renders `Page N` (left leaf) and `Page N + 1` (right leaf) side-by-side at native device pixel ratio, automatically resizing each leaf to fit the spread container. When a document ends on an odd page, the right leaf renders an archival colophon endpaper so the spread geometry never collapses.

---

## 3. Local Web Development & Clean Dependency Verification

### Prerequisites
- **Node.js**: v18.x, v20.x, or v22.x+
- **Package Manager**: `npm` (v9 / v10+) — installs cleanly with **zero peer-dependency conflicts (`ERESOLVE`)** and **no `-f` / `--force` flag required**.

### Verified Dependency Compatibility Matrix
All dependencies in `package.json` are strictly version-aligned so `npm install` succeeds out of the box without `--force` or `--legacy-peer-deps`:
- `react` & `react-dom`: `^19.3.1`
- `vite`: `^8.3.0` + `esbuild`: `^0.28.0` (aligned with Vite 8's `peerOptional esbuild@"^0.27.0 || ^0.28.0"`)
- `@tailwindcss/vite` & `tailwindcss`: `^4.1.14`
- `pdfjs-dist`: `^6.1.0` + `tesseract.js`: `^7.0.0`
- `dexie`: `^4.3.0` + `jszip`: `^3.10.1` + `zustand`: `^5.0.12`

### Commands
```bash
# Install dependencies cleanly (no -f or --force needed)
npm install

# Start local full-stack development server (Express + Vite on port 3000)
npm run dev

# Typecheck and lint codebase
npm run lint

# Compile production web assets
npm run build
```

---

## 4. Building the Android App (Method 1: Capacitor Native APK & Play Store AAB)

[Capacitor](https://capacitorjs.com/) is the recommended method to produce a fully native Android package (`.apk` for sideloading/direct installation and `.aab` for Google Play Store publication) with full native hardware access, offline storage persistence, and immersive reading UI.

### Step 4.1: Install Capacitor Dependencies
Inside the project root:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 4.2: Verify Capacitor Configuration (`capacitor.config.json`)
This repository already includes a preconfigured `/capacitor.config.json` at the root directory (or you can regenerate it via `npx cap init "Lumina Reader" "com.luminareader.app" --web-dir dist`):

```json
{
  "appId": "com.luminareader.app",
  "appName": "Lumina Reader",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": false
  },
  "android": {
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": true
  },
  "ios": {
    "contentInset": "always",
    "allowsLinkPreview": false
  },
  "plugins": {
    "CapacitorCookies": {
      "enabled": true
    },
    "CapacitorHttp": {
      "enabled": true
    }
  }
}
```

### Step 4.3: Build Web Assets and Add Android Native Project
```bash
# 1. Build the production bundle
npm run build

# 2. Add the Android platform (creates the /android directory with Gradle configuration)
npx cap add android

# 3. Synchronize plugins, web assets, and configs to the Android project
npx cap sync android
```

### Step 4.4: Configure Android Permissions & Immersive Reader Mode
Open `android/app/src/main/AndroidManifest.xml` and ensure the following permissions and flags are set inside `<manifest>`:

```xml
<!-- Network for optional Gutenberg search / online dictionary -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Keep screen awake during long reading sessions without dimming -->
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Storage access for importing local EPUB and PDF files from Downloads -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/AppTheme"
    android:hardwareAccelerated="true"
    android:largeHeap="true">
    
    <activity
        android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
        android:name=".MainActivity"
        android:label="@string/title_activity_main"
        android:theme="@style/AppTheme.NoActionBarLaunch"
        android:launchMode="singleTask"
        android:exported="true"
        android:windowSoftInputMode="adjustResize">
        
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>

        <!-- Handle Opening .epub and .pdf files directly from Android File Managers -->
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="content" />
            <data android:mimeType="application/epub+zip" />
            <data android:mimeType="application/pdf" />
        </intent-filter>
    </activity>
</application>
```

### Step 4.5: Run on an Android Device / Emulator
Ensure you have **Android Studio** (Koala / Ladybug / Iguana) and **JDK 17 or 21** installed:
```bash
# Open the project directly in Android Studio
npx cap open android

# Or launch directly on a connected Android phone via ADB:
npx cap run android
```

### Step 4.6: Build Standalone Release APK & Google Play AAB Bundle
Inside the `android/` directory:

```bash
cd android

# Generate unsigned debug APK for testing
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Generate release APK (for sideloading / GitHub Releases)
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk

# Generate release Android App Bundle (for Google Play Store upload)
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

#### Signing the Release APK / AAB
To generate your release signing key:
```bash
keytool -genkey -v -keystore lumina-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lumina-key
```
Then sign the APK:
```bash
zipalign -v -p 4 app-release-unsigned.apk lumina-aligned.apk
apksigner sign --ks lumina-release-key.jks --out lumina-reader-signed.apk lumina-aligned.apk
```

---

## 5. Building the Android App (Method 2: Google Play TWA with Bubblewrap)

If you already host Lumina Reader on HTTPS (e.g., your custom domain or Firebase/Cloud Run hosting), you can package it into a 100% Google Play compliant Android app using **Google Chrome Bubblewrap** without writing any native Java/Kotlin code.

### Step 5.1: Install Bubblewrap CLI
```bash
npm install -g @bubblewrap/cli
```

### Step 5.2: Initialize and Generate Android Project
```bash
bubblewrap init --manifest=https://your-domain.com/manifest.webmanifest
```
Bubblewrap will automatically parse `public/manifest.webmanifest`, download icons, configure colors, and generate the Gradle project.

### Step 5.3: Build Signed AAB
```bash
bubblewrap build
```

### Step 5.4: Digital Asset Links (Enable Fullscreen without Browser Address Bar)
Upload the generated SHA-256 fingerprint into `/.well-known/assetlinks.json` on your web host:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.luminareader.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT_HERE"]
  }
}]
```

---

## 6. Optimizations for Android E-Ink Devices

Lumina Reader runs exceptionally well on Android-based E-Ink readers (**Onyx Boox, Meebook, Bigme, Boyue Likebook, Supernote, and Amazon Fire** sideloaded):

1. **Monochrome High-Contrast Mode**: In the Reader appearance drawer, select the **High Contrast Pure E-Ink** theme (`#000000` text on `#FFFFFF` with pure vector glyphs and zero color tints).
2. **Paginated Turn Mode**: Toggle layout to **Paginated (Page-by-Page)** to eliminate continuous scrolling ghosting on E-Ink displays with slow refresh rates.
3. **Hardware Volume Key Page Turning**: On Android devices with physical page-turn buttons (e.g., Onyx Boox Leaf/Page/Palma), the app listens to `KeyDown` events for `VolumeUp` (Previous Page) and `VolumeDown` (Next Page).
4. **Disabling Animations**: Turn on "Reduce Motion" in settings to skip CSS transition transforms, allowing instant 1-bit screen refreshes.

---

## 7. Building the iOS & iPadOS App (Capacitor + Xcode)

### Prerequisites
- macOS machine with **Xcode 15+** installed
- Apple Developer Account (for device deployment and App Store submission)

### Step 7.1: Add iOS Platform
```bash
npm install @capacitor/ios
npm run build
npx cap add ios
npx cap sync ios
```

### Step 7.2: Open in Xcode
```bash
npx cap open ios
```

### Step 7.3: Xcode Settings & Capabilities
1. **Signing & Capabilities**: Select your Team and set a unique Bundle Identifier (`com.luminareader.app`).
2. **Safe Area & Status Bar**: In `Info.plist`, ensure `UIViewControllerBasedStatusBarAppearance` is set to `true`.
3. **iPad Multitasking**: Enable `Requires Full Screen: NO` so Lumina supports iPad Split View, Slide Over, and Stage Manager.
4. **Apple Pencil**: In the PDF view, Apple Pencil stylus events are automatically mapped to low-latency HTML5 canvas drawing without interfering with two-finger zoom gestures.

---

## 8. Building Desktop Apps (Tauri 2.0 & Electron)

### Option A: Tauri 2.0 (Ultra-lightweight ~10MB native binary)
Tauri uses the operating system's native WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) and produces tiny, blazingly fast executables.

```bash
# 1. Install Tauri CLI
npm install -D @tauri-apps/cli

# 2. Initialize Tauri configuration
npx tauri init

# 3. Develop locally with hot reload
npx tauri dev

# 4. Compile native desktop installer (.dmg for macOS, .msi/.exe for Windows, .deb/.AppImage for Linux)
npx tauri build
```

### Option B: Electron
If you prefer a self-contained Chromium runtime:
```bash
npm install -D electron electron-builder
```
Create a simple `electron/main.js`:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
```

---

## 9. Cross-Platform Storage & Performance Architecture

### Persistent Storage Guarantee
By default, mobile browsers may evict IndexedDB under storage pressure. Lumina requests persistent storage automatically on boot:
```typescript
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((isPersisted) => {
    console.log(`Persistent storage granted: ${isPersisted}`);
  });
}
```

### Universal Offline Capability
- All parsing logic (`bookParser.ts`) runs client-side in Web Workers and the main thread.
- Dictionary definitions and Word Wise glosses (`multilingualDictionary.ts`) are stored in pure memory-efficient trie/map data structures bundled directly with the application.
- Full backup and restore is available under **Sync & Backups** via standard `.lumina.json` encrypted snapshots, allowing seamless library transfer between an Android phone, iPad, and Desktop computer without cloud dependency.

---

## 🛡️ License & Attributions
Engineered with love for readers, researchers, and polyglots. All rights reserved.
