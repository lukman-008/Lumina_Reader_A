import Dexie, { type Table } from 'dexie';
import type {
  BookMeta,
  BookContentRecord,
  BookBinaryRecord,
  Highlight,
  Bookmark,
  VocabularyCard,
  Shelf,
  ReadingSession,
  ReaderSettings,
} from '../types';

/**
 * 3-Tier Split IndexedDB Architecture (Thorium / Kindle Model)
 * - Tier 1 (`booksMeta`): Lightweight ~1KB records for instant Library rendering (<10ms).
 * - Tier 2 (`bookContents`): Parsed chapters, paragraphs, TOC, and X-Ray data loaded per active book.
 * - Tier 3 (`bookBinaries`): Isolated raw PDF/EPUB ArrayBuffers loaded strictly when needed.
 */
export class LuminaSplitDatabase extends Dexie {
  booksMeta!: Table<BookMeta, string>;
  bookContents!: Table<BookContentRecord, string>;
  bookBinaries!: Table<BookBinaryRecord, string>;
  highlights!: Table<Highlight, string>;
  bookmarks!: Table<Bookmark, string>;
  vocabulary!: Table<VocabularyCard, string>;
  shelves!: Table<Shelf, string>;
  readingSessions!: Table<ReadingSession, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('LuminaSanctuaryV3DB');

    this.version(1).stores({
      booksMeta: 'id, title, author, format, category, shelfId, isFavorite, addedAt',
      bookContents: 'bookId',
      bookBinaries: 'bookId',
      highlights: 'id, bookId, chapterIndex, locationNumber, createdAt',
      bookmarks: 'id, bookId, chapterIndex, locationNumber, createdAt',
      vocabulary: 'id, word, bookId, srsBox, nextReviewAt, createdAt',
      shelves: 'id, name, createdAt',
      readingSessions: 'id, bookId, date, startTime',
      settings: 'key',
    });
  }
}

export const db = new LuminaSplitDatabase();

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'paper',
  fontFamily: 'literata',
  fontSize: 19,
  lineHeight: 1.75,
  letterSpacing: 0,
  marginWidth: 48,
  layoutMode: 'single',
  textAlign: 'justify',
  bionicReading: false,
  liveWordWiseHints: false,
  readingRuler: false,
  readingRulerHeight: 44,
  readingRulerOpacity: 0.22,
  dyslexiaFriendlyMode: false,
  autoNightMode: false,
  pageTurnAnimation: 'slide',
  pdfThemeFilter: false,
  pdfAutoCropMargins: false,
  pdfSpreadMode: 'single',
  safeAreaTopOffset: 0,
  selectionBarPosition: 'bottom',
  dailyGoalMinutes: 30,
  yearlyBookGoal: 24,
  warmth: 0,
  soundscape: 'none',
  soundscapeVolume: 0.4,
  autoPagingWpm: 250,
  progressDisplayMode: 'location',
};

export async function loadSavedSettings(): Promise<ReaderSettings> {
  try {
    const record = await db.settings.get('reader_settings');
    if (record?.value) {
      return { ...DEFAULT_SETTINGS, ...record.value };
    }
  } catch (err) {
    console.warn('Failed to load settings from IndexedDB, using defaults:', err);
  }
  return DEFAULT_SETTINGS;
}

export async function saveReaderSettings(settings: ReaderSettings): Promise<void> {
  try {
    await db.settings.put({ key: 'reader_settings', value: settings });
  } catch (err) {
    console.error('Failed to persist settings:', err);
  }
}
