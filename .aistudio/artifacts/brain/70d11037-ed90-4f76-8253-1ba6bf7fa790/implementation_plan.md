# Lumina Reader — Definitive Cross-Platform Architecture & Blueprint

This finalized blueprint locks in the **single best-suited architectural choice** for every layer of **Lumina Reader**, cherry-picking the strongest engineering mechanisms from **Apple Books**, **Amazon Kindle**, **Thorium (Readium)**, **Foliate**, and **KOReader**. Every feature—including **X-Ray**, **Word Wise Dictionary**, **Chapter Synthesis**, and **PDF Text Reflow**—is engineered to run **100% locally and offline** with **zero dependency on Google Gemini**, while keeping the pluggable AI adapter layer intact for optional future enhancement.

---

## User Review & Critical Decisions (Locked In)

> [!IMPORTANT]
> **100% Local-First Independence + Pluggable AI Adapter (Nothing Skipped)**
> Per your requirement, **no feature in Lumina Reader depends on Google Gemini to function**:
> - **Local Deterministic Intelligence Engine (Primary — Zero API Key Needed)**: X-Ray character/term/theme extraction, chapter summaries, passage search, PDF text reflow, and Word Wise definitions run 100% locally in the browser/WebView using client-side NLP heuristics (TF-IDF keyphrase scoring, proper-noun entity clustering, TextRank sentence extraction, and an embedded offline lexicon + Free Dictionary API fallback).
> - **Pluggable AI Adapter Layer (Retained & Non-Blocking)**: The AI Companion drawer, OCR pipeline, and server-side `/api/ai/*` routes remain fully built and wired behind a clean provider interface—defaulting seamlessly to the built-in **Local Literary Engine** whenever Gemini is not in scope or offline.

- **1. Cross-Platform Stack (Locked)**: **React 19 + TypeScript + Vite 8 + Zustand + Dexie v4 + PWA (`vite-plugin-pwa`)**, paired with ready-to-build **Tauri v2** (Desktop macOS/Windows/Linux) and **Capacitor** (iOS/Android) configurations.
- **2. Storage Architecture (Locked — Thorium/Kindle 3-Tier Split IndexedDB)**:
  - `booksMeta`: Lightweight catalog metadata (`~1 KB` per book) loaded on startup for instant `< 10ms` Library rendering.
  - `bookContents`: Parsed chapter AST, TOC tree, and local X-Ray index loaded lazily only for the active book.
  - `bookBinaries`: Raw PDF/EPUB `ArrayBuffer` blobs isolated in a separate table so binary data never pollutes UI state or causes memory exhaustion.
- **3. Document Rendering Engine (Locked — Dual Specialized Engines)**:
  - **Reflowable Engine (EPUB, Markdown, TXT)**: Uses **Foliate / Readium's OPF Spine + XML DOM Parser** (`META-INF/container.xml` → `.opf` `<manifest>` & `<spine>` → `toc.ncx` / `<nav>`) paired with **Apple Books' Columnar Pagination** and **Kindle's Fractional Location Indexing (`1 Location = 150 chars` + Paragraph CFI)**.
  - **Fixed-Layout PDF Engine**: Uses a custom **Virtualized `pdfjs-dist` Canvas Engine** with strict **3-Page Windowing** (`currentPage - 1`, `currentPage`, `currentPage + 1`), automatic `RenderTask.cancel()` on fast page turns, cloned `Uint8Array` worker transfers, and **Native PDF.js Text-Layer Reflow** (no AI required to extract and reflow PDF text).

---

## 1. Overview & Core Concept

### Cherry-Picked Mechanisms from the Best Readers

| Source Application | Best-in-Class Mechanism Selected | How It Works Locally Without External AI Dependency |
| :--- | :--- | :--- |
| **Apple Books** | **Tactile Columnar Spread & Quiet Editorial Chrome**: Auto-hiding Zen chrome, two-column book spread with center spine depth, and instant 5-color swatch selection popover. | Pure CSS Multi-Column geometry (`column-width`, `column-gap`) and compositor-only page transitions. |
| **Amazon Kindle** | **Deterministic Location # (`150-char` chunks) + Local X-Ray + Word Wise**: Invariant location numbers, Page Flip history stack, and entity/term breakdowns. | Local NLP entity scanner extracts recurring proper nouns (Characters), high-salience domain terms, and key quotes per chapter automatically on import. |
| **Thorium (Readium)** | **3-Tier Split Persistence & Scoped Typography Tokens**: Strict separation of catalog metadata from chapter text and raw binary blobs. | IndexedDB `Dexie` v4 split tables keep RAM usage flat even with dozens of large PDFs and EPUBs. |
| **Foliate (`foliate-js`)** | **Standards-Compliant OPF Spine & TOC Parser**: Parses `container.xml` and `.opf` spine IDs in exact publisher sequence rather than sorting filenames alphabetically. | Browser-native `DOMParser` (`application/xml` & `application/xhtml+xml`) resolves spine items, internal anchor links, and hierarchical TOCs offline. |
| **KOReader** | **Virtualized PDF Canvas Lifecycle + Native PDF Text Reflow**: Renders only active viewport pages and extracts structured paragraphs from PDF text layers. | Uses `pdfjs-dist` `page.getTextContent()` with geometric line-clustering (`transform[5]` Y-coordinate grouping) to reflow PDF pages into clean reader paragraphs offline, with optional OCR fallback. |

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Zero-Latency Library Sanctuary**:
   - Launches immediately into the **Library View** featuring a **Continue Reading Hero Card** (with live progress bar, exact Kindle-style `Location #`, estimated minutes left in chapter, and one-click resume), **Custom Collections / Shelves**, and live search/sort controls.
   - **Global Drag-and-Drop & Batch Importer**: Drop any combination of `.epub`, `.pdf`, `.txt`, `.md`, or `.lumina` backup files anywhere on the window for non-blocking ingestion and automatic local X-Ray indexing.
2. **Adaptive Reader Viewport (Reflowable & Native PDF)**:
   - **Reflowable Mode (EPUB / MD / TXT)**: Switch effortlessly between **Single Page**, **Two-Column Book Spread**, and **Continuous Scroll**. Includes **Page Flip Scrubber** at the bottom with a "Back to Location X" return button whenever you jump across chapters.
   - **Native PDF Mode**: Crisp vector canvas rendering with fit-to-width / fit-to-page / custom zoom (`50%–300%`), selectable text layer, normalized coordinate highlights, and an instant **Native PDF Reflow Mode** (plus optional Vision OCR drawer).
3. **Local X-Ray, Companion Drawer, Notebook & Vocabulary SRS**:
   - **X-Ray & Companion Drawer**: Works 100% offline via our **Local Literary Engine** (extracting Characters, Key Terms, Themes, Executive Extractive Summaries, and Passage Concordance Search up to your current reading location), while seamlessly supporting optional Gemini cloud enhancement if enabled later.
   - **Notebook Workspace**: Browse, filter, and export all highlights and margin notes across books as **Markdown**, **JSON**, or **Citation Cards**.
   - **Vocabulary Builder (Word Wise + SRS)**: Instant offline definitions, morphology/part-of-speech analysis, book sentence context, and a 5-box **Spaced Repetition Flashcard Deck**.
   - **Reading Habits & Streak Analytics**: Tracks daily reading minutes, WPM velocity, locations completed, and a 365-day activity heatmap.

### Visual Identity & Theme
- **Aesthetic Direction**: **Archival Editorial Sanctuary** — inspired by museum monographs, Penguin Classics typography, and Apple Books.
- **Color Palette & 5 Calibrated Reading Themes**:
  - **Archival Paper (Default)**: `#FBF9F5` canvas, `#F3EFE6` surface, `#1C1917` ink, `#E7E2D8` hairline border, `#B45309` warm bronze accent.
  - **Studio Daylight**: `#FFFFFF` canvas, `#F5F5F4` surface, `#0A0A0A` ink, `#E5E5E5` border, `#1D4ED8` lapis accent.
  - **Kindle Sepia**: `#F4ECD8` canvas, `#EAE0C8` surface, `#2C221E` ink, `#DCD0B8` border, `#9A3412` terracotta accent.
  - **OLED Nocturne**: `#0C0A09` canvas, `#1C1917` surface, `#E7E5E4` ink, `#292524` border, `#F59E0B` amber accent.
  - **Evergreen Dusk**: `#0F1715` canvas, `#16221F` surface, `#D6E4E0` ink, `#233530` border, `#10B981` sage accent.
- **Typography & Hierarchy (Strict 2+1 Font Rule)**:
  - **Display Face**: `Fraunces` (editorial serif for book titles, chapter headers, and initial drop caps).
  - **Reader Body Faces**: User-selectable between `Literata`, `Merriweather`, `Plus Jakarta Sans`, `JetBrains Mono`, and `OpenDyslexic`, constrained to `65ch–72ch` per column with adjustable line-height (`1.4–2.2`), letter spacing, paragraph margins, and **Bionic Reading** bolding.
  - **Monospace Telemetry**: `JetBrains Mono` (`tabular-nums`) for all location counters, percentages, WPM readouts, and timers.
- **Top Bar Contract & Anti-Slop Discipline**:
  - **3-Zone Header**: `[Lumina Reader wordmark] — [Library · Notebook · Vocabulary · Habits · Sync] — [Import Books CTA]`.
  - **Zero Static Pills**: All book metadata (`Author · Format · 42 Locations · 18 mins left`) is rendered as quiet, unboxed inline typography separated by middots (`·`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Local-First Deterministic Intelligence Engine + Pluggable Cloud Adapter**
  - *Chosen Approach*: Build a dedicated client-side `localIntelligenceEngine` (TextRank extractive summarization, proper-noun & frequency-based X-Ray entity extraction, concordance passage Q&A, offline morphological dictionary, and PDF.js geometric text reflow) as the default provider, with the Express `/api/ai/*` Gemini adapter available as an optional secondary provider.
  - *Why*: Guarantees that 100% of features work instantaneously offline with zero dependency on Gemini or external API keys, while preserving the AI architecture for future use.
- **Decision 2: Granular Zustand Store Architecture vs. Monolithic React State**
  - *Chosen Approach*: Four focused Zustand stores (`useLibraryStore`, `useReaderStore`, `useNotebookStore`, `useSettingsStore`) with atomic selector subscriptions.
  - *Why*: Updating reading progress, scroll position, or TTS sentence highlights only re-renders the exact status bar or paragraph node—eliminating full-screen re-renders.
- **Decision 3: Safe PDF.js Canvas Windowing vs. Third-Party `react-pdf` Wrapper**
  - *Chosen Approach*: Direct `pdfjs-dist` integration with a dedicated `PdfPageCanvas` component that mounts canvases only for `activePage ± 1`, clones binary buffers safely (`new Uint8Array(buffer.slice(0))`), and aborts in-flight render tasks on unmount.
  - *Why*: Completely eliminates the `ArrayBuffer` detachment crashes and canvas memory leaks that plagued the original 2,175-line `NativePdfReader.tsx`.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                CROSS-PLATFORM SHELL (Vite 8 PWA + Tauri v2 + Capacitor)           │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────▼─────────────────────────────────────────┐
│                     ATOMIC ZUSTAND STORES (Zero Re-Render Storms)                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │ useLibraryStore  │  │  useReaderStore  │  │ useNotebookStore │  │useSettings│  │
│  │ (Catalog,Shelves)│  │ (Locator,History)│  │ (Highlights,SRS) │  │(Typography│  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └─────┬─────┘  │
└───────────┼─────────────────────┼─────────────────────┼──────────────────┼────────┘
            │                     │                     │                  │
┌───────────▼─────────┐ ┌─────────▼─────────────────────▼────────┐ ┌───────▼────────┐
│  LIBRARY WORKSPACE  │ │       UNIFIED READER ENGINE            │ │ INTELLIGENCE & │
│                     │ │                                        │ │HABIT WORKSPACES│
│ • Continue Reading  │ │ ┌────────────────┐ ┌─────────────────┐ │ │                │
│   Spotlight         │ │ │ Reflow Engine  │ │ Virtualized PDF │ │ │ • Local X-Ray  │
│ • Shelf & Format    │ │ │ (OPF Spine +   │ │ Engine (PDF.js  │ │ │   & Companion  │
│   Segmented Filter  │ │ │ Column Spread  │ │ 3-Page Window + │ │ │ • Notebook &   │
│ • Book Grid / Table │ │ │ + Loc # Index) │ │ Native Reflow)  │ │ │   Export Hub   │
│ • Batch File        │ │ └───────┬────────┘ └────────┬────────┘ │ │ • Word Wise    │
│   Importer Modal    │ │         └─────────┬─────────┘          │ │   SRS Deck     │
│                     │ │         ┌─────────▼─────────┐          │ │ • Habits &     │
│                     │ │         │ Selection, Ruler, │          │ │   Soundscapes  │
│                     │ │         │ TTS, RSVP, Flip   │          │ │ • Sync & Backup│
└───────────┬─────────┘ └─────────┴─────────┬─────────┴──────────┘ └───────┬────────┘
            │                               │                              │
┌───────────▼───────────────────────────────▼──────────────────────────────▼────────┐
│                  3-TIER SPLIT INDEXEDDB PERSISTENCE (Dexie v4)                    │
│  1. booksMeta (Catalog & Locator)   2. bookContents (Chapters, TOC, X-Ray Index)  │
│  3. bookBinaries (Isolated Blobs)   4. highlights, bookmarks, vocab, sessions     │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────▼─────────────────────────────────────────┐
│             DUAL-MODE INTELLIGENCE LAYER (100% Local Default + AI Adapter)        │
│  ┌─────────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │   LOCAL DETERMINISTIC ENGINE (Default)  │  │  OPTIONAL CLOUD AI ADAPTER     │  │
│  │ • TextRank Chapter Summarizer           │  │ • Pluggable `/api/ai/*` routes │  │
│  │ • Proper-Noun & TF-IDF X-Ray Extractor  │  │ • Optional Gemini 3.8 Flash    │  │
│  │ • Offline Lexicon + Concordance Q&A     │  │   enhancement when configured  │  │
│  │ • PDF.js Geometric Line-Cluster Reflow  │  │ • Never blocks offline usage   │  │
│  └─────────────────────────────────────────┘  └────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Split Storage Strategy
- **`BookMeta` (`booksMeta` table)**: Stores `id`, `title`, `author`, `description`, `format` (`epub` | `pdf` | `txt` | `md`), `coverGradient`, `coverImage`, `category`, `shelfId`, `isFavorite`, `totalWords`, `totalLocations`, `chapterCount`, `addedAt`, and `locator` (`chapterIndex`, `pageIndex`, `paragraphIndex`, `locationNumber`, `percentage`, `lastReadTimestamp`).
- **`BookContent` (`bookContents` table)**: Keyed by `bookId`; stores `chapters` (`id`, `title`, `paragraphs[]`, `wordCount`, `startLocation`, `endLocation`), `toc` (`id`, `title`, `chapterIndex`), and `xrayData` (`characters[]`, `terms[]`, `themes[]`, `notablePassages[]` computed deterministically on import).
- **`BookBinary` (`bookBinaries` table)**: Keyed by `bookId`; stores `data: ArrayBuffer` and `byteLength`. Queried strictly when `format === 'pdf'` (or when exporting a full `.lumina` archive).
- **Rich Pre-Seeded Classic Library**: Comes pre-seeded with curated multi-chapter classics (*Meditations* by Marcus Aurelius, *The Art of War* by Sun Tzu, *Walden* by Henry David Thoreau, and *Relativity: The Special and General Theory* by Albert Einstein) complete with pre-computed Location numbers, rich local X-Ray entities, and realistic reading history so every feature works out-of-the-box offline.
