# Lumina Reader — Definitive Cross-Platform Architecture & Implementation Blueprint

> **Lumina Reader** is a next-generation, offline-first digital reading sanctuary engineered with true OPF EPUB spine parsing, virtualized high-DPI PDF rendering, Kindle-style Location indexing, syntopicon cross-library search, interlinear Word Wise glosses, spatial PDF figure snipping, and Leitner/SM-2 spaced repetition vocabulary.

---

## 🚀 Status: Multi-Platform Distribution Hub & Native Build Engine (Active)

### Completed Milestones
1. **Repository Root Native Documentation (`/README.md`)**:
   - Comprehensive multi-platform engineering guide covering:
     - **Android Native (Capacitor APK & Google Play AAB)** with step-by-step setup, permissions (`WAKE_LOCK`, `INTERNET`, `READ_MEDIA_IMAGES`), hardware acceleration, and Gradle compilation commands.
     - **Google Play Trusted Web Activity (TWA via Bubblewrap)**.
     - **Android E-Ink Devices (Onyx Boox, Meebook, Kindle Fire)**: hardware volume key page-turn hooks, monochrome pure E-Ink themes, and paginated screen refresh modes.
     - **iOS & iPadOS (Capacitor + Xcode)**: Safe area insets, Apple Pencil support, and iPad Split View / Stage Manager.
     - **Desktop Native (Tauri 2.0 & Electron)**: Lightweight ~10MB Rust native binaries consuming <40MB RAM.
2. **Capacitor Configuration (`/capacitor.config.json`)**:
   - Out-of-the-box native Android package configuration with app ID `com.luminareader.app` and web dir `dist`.
3. **PWA & Native Distribution Hub in UI (`/src/components/HabitsAndSyncViews.tsx`)**:
   - Interactive platform switcher with 1-click command copying.
   - PWA automatic `beforeinstallprompt` listener and iOS Safari "Add to Home Screen" visual guide modal.
   - Built-in interactive README viewer modal right inside the app.

---

## 📋 12-Feature Roadmap & Execution Plan

| # | Feature | Area | Status |
| :--- | :--- | :--- | :--- |
| **1** | **Live Project Gutenberg Catalog Search (70,000+ Books)** | Library Sanctuary | Next in line |
| **2** | **Library Multi-Criteria Sorting & Reading Status Filters** | Library Sanctuary | Next in line |
| **3** | **Book Metadata & Cover Editor** | Library Sanctuary | Next in line |
| **4** | **Single-Book Annotated Anthology Export (`.MD`)** | Library Sanctuary | Next in line |
| **5** | **Inline Bilingual / Parallel Paragraph Study Mode** | Reflowable Reader | Next in line |
| **6** | **Built-in Pomodoro Reading Focus Timer & Soundscape Mixer** | Reader Header | Next in line |
| **7** | **Hands-Free Teleprompter / Auto-Scroll Mode** | Reader (Scroll Mode) | Next in line |
| **8** | **PDF Sticky Note Pins & Adjustable Ink Stroke Width** | PDF Studio | Next in line |
| **9** | **RTL-Aware Multilingual Quote Studio + PDF Figure Cards** | Quote Card Studio | Next in line |
| **10** | **Convert Highlight to Cloze SRS Flashcard Action** | Research Notebook | Next in line |
| **11** | **Per-Book Time Investment & Reading Speed Trend Charts** | Habits Workspace | Next in line |
| **12** | **Selective Snapshot Restore (Merge vs. Overwrite) & Diff Preview** | Devices / Sync View | Next in line |

---

## 🛡️ Stability & Verification Standards
- Zero compiler or lint errors (`tsc --noEmit` exit code 0).
- Production build verified via `compile_applet`.
- Pinned `← Back to Library` button in reader header preserved with absolute priority across all screen sizes.
