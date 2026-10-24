export type BookFormat = 'epub' | 'pdf' | 'txt' | 'md';

export type ReadingTheme = 'paper' | 'studio' | 'sepia' | 'nocturne' | 'dusk';

export type FontFamilyChoice = 'literata' | 'merriweather' | 'sans' | 'dyslexic' | 'mono';

export type LayoutMode = 'single' | 'double' | 'scroll';

export type TextAlignment = 'left' | 'justify';

export type SoundscapeType = 'none' | 'rain' | 'fireplace' | 'library' | 'vinyl' | 'brown_noise';

export type HighlightColor = 'amber' | 'emerald' | 'sky' | 'rose' | 'violet';

export type WorkspaceTab = 'library' | 'notebook' | 'vocabulary' | 'habits' | 'sync';

export interface LuminaLocator {
  chapterIndex: number;
  pageIndex: number;
  paragraphIndex: number;
  charOffset: number;
  locationNumber: number; // Kindle-style deterministic 150-char location token
  percentage: number;
  lastReadTimestamp: number;
}

export interface BookChapter {
  id: string;
  title: string;
  content: string;
  paragraphs: string[];
  wordCount: number;
  startLocation: number;
  endLocation: number;
}

export interface TOCItem {
  id: string;
  title: string;
  chapterIndex: number;
  level: number;
}

export interface XRayEntity {
  id: string;
  name: string;
  category: 'character' | 'term' | 'theme';
  roleOrDefinition: string;
  mentionsCount: number;
  firstChapterIndex: number;
  sampleQuote: string;
}

export interface XRayData {
  bookId: string;
  generatedBy: 'local-nlp' | 'cloud-ai';
  characters: XRayEntity[];
  terms: XRayEntity[];
  themes: XRayEntity[];
  notablePassages: {
    text: string;
    chapterIndex: number;
    chapterTitle: string;
    locationNumber: number;
  }[];
}

/**
 * Tier 1 Storage: Lightweight Catalog Metadata (~1KB per book)
 * Loaded immediately on startup without pulling heavy chapters or binary blobs.
 */
export interface BookMeta {
  id: string;
  title: string;
  author: string;
  description: string;
  format: BookFormat;
  coverGradient: string;
  coverImage?: string;
  category: string;
  shelfId?: string;
  isFavorite?: boolean;
  totalWords: number;
  totalLocations: number;
  chapterCount: number;
  addedAt: number;
  fileSizeBytes?: number;
  locator: LuminaLocator;
}

export interface PdfInkStroke {
  id: string;
  pageNumber: number;
  color: HighlightColor;
  width: number;
  points: { x: number; y: number }[]; // Normalized 0-100% coordinates
  createdAt: number;
}

/**
 * Tier 2 Storage: Lazily Loaded Book Content & X-Ray Index
 */
export interface BookContentRecord {
  bookId: string;
  chapters: BookChapter[];
  toc: TOCItem[];
  xray: XRayData;
  ocrByPage?: Record<number, string>;
  inkByPage?: Record<number, PdfInkStroke[]>;
}

/**
 * Tier 3 Storage: Isolated Raw Binary Blobs (PDF / EPUB ArrayBuffers)
 * Never loaded into Library catalog memory.
 */
export interface BookBinaryRecord {
  bookId: string;
  data: ArrayBuffer;
  mimeType: string;
  byteLength: number;
}

export interface Shelf {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  bookTitle?: string;
  bookAuthor?: string;
  chapterIndex: number;
  chapterTitle?: string;
  pageIndex?: number;
  paragraphIndex?: number;
  locationNumber: number;
  selectedText: string;
  color: HighlightColor;
  note?: string;
  tags?: string[];
  imageSnippetDataUrl?: string; // Cropped figure/diagram snapshot from PDF canvas
  rects?: HighlightRect[]; // Normalized % rects for PDF canvas overlays
  createdAt: number;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  pageIndex: number;
  locationNumber: number;
  label: string;
  snippet: string;
  createdAt: number;
}

export interface VocabularyCard {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  etymology: string;
  contextSentence: string;
  bookId: string;
  bookTitle: string;
  chapterIndex?: number;
  pageIndex?: number;
  locationNumber: number;
  srsBox: 1 | 2 | 3 | 4 | 5; // Leitner Spaced Repetition System box
  nextReviewAt: number;
  reviewCount: number;
  createdAt: number;
}

export interface ReaderSettings {
  theme: ReadingTheme;
  fontFamily: FontFamilyChoice | 'custom';
  customFontName?: string;
  customFontDataUrl?: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  marginWidth: number;
  layoutMode: LayoutMode;
  textAlign: TextAlignment;
  bionicReading: boolean;
  liveWordWiseHints?: boolean;
  readingRuler: boolean;
  readingRulerHeight: number;
  readingRulerOpacity: number;
  dyslexiaFriendlyMode?: boolean;
  autoNightMode?: boolean;
  pageTurnAnimation?: 'slide' | 'curl' | 'instant';
  pdfThemeFilter?: boolean;
  pdfAutoCropMargins?: boolean;
  pdfSpreadMode?: 'single' | 'spread';
  dailyGoalMinutes?: number;
  yearlyBookGoal?: number;
  warmth: number;
  soundscape: SoundscapeType;
  soundscapeVolume: number;
  autoPagingWpm: number;
  progressDisplayMode: 'location' | 'percentage' | 'time';
}

export interface ReadingSession {
  id: string;
  bookId: string;
  bookTitle: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  wordsRead: number;
  locationsRead: number;
  date: string; // YYYY-MM-DD
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  todayMinutes: number;
  dailyGoalMinutes: number;
  totalMinutes: number;
  totalWordsRead: number;
  totalLocationsRead: number;
  averageWpm: number;
  heatMapData: { date: string; minutes: number; level: 0 | 1 | 2 | 3 | 4 }[];
}

export interface LuminaBackupArchive {
  version: number;
  exportedAt: string;
  deviceName: string;
  booksMeta: BookMeta[];
  bookContents: BookContentRecord[];
  highlights: Highlight[];
  bookmarks: Bookmark[];
  vocabulary: VocabularyCard[];
  shelves: Shelf[];
  readingSessions: ReadingSession[];
  settings: ReaderSettings;
}
