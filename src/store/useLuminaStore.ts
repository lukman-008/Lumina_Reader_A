import { create } from 'zustand';
import type {
  BookMeta,
  BookContentRecord,
  Shelf,
  Highlight,
  HighlightColor,
  Bookmark,
  VocabularyCard,
  ReaderSettings,
  ReadingSession,
  WorkspaceTab,
  LuminaLocator,
  PdfInkStroke,
} from '../types';
import { db, DEFAULT_SETTINGS, loadSavedSettings, saveReaderSettings } from '../services/db';
import { initializeLibraryCatalog } from '../services/bookParser';
import { ambientAudio } from '../services/ambientAudio';

function sanitizeLocator(loc?: Partial<LuminaLocator>, totalLocations = 1): LuminaLocator {
  const rawLocNum =
    Number.isFinite(loc?.locationNumber) && (loc!.locationNumber as number) >= 1
      ? Math.floor(loc!.locationNumber as number)
      : 1;
  const pageIndex =
    Number.isFinite(loc?.pageIndex) && (loc!.pageIndex as number) >= 0
      ? Math.floor(loc!.pageIndex as number)
      : 0;
  const safeTotal = Math.max(
    1,
    Number.isFinite(totalLocations) && totalLocations > 0 ? totalLocations : 1,
    rawLocNum,
    pageIndex
  );
  const chapterIndex =
    Number.isFinite(loc?.chapterIndex) && (loc!.chapterIndex as number) >= 0
      ? Math.floor(loc!.chapterIndex as number)
      : 0;
  const paragraphIndex =
    Number.isFinite(loc?.paragraphIndex) && (loc!.paragraphIndex as number) >= 0
      ? Math.floor(loc!.paragraphIndex as number)
      : 0;
  const locationNumber = Math.min(safeTotal, rawLocNum);
  const percentage =
    Number.isFinite(loc?.percentage) && (loc!.percentage as number) >= 0
      ? Math.min(100, Math.max(0, Math.round(loc!.percentage as number)))
      : 0;

  return {
    chapterIndex,
    pageIndex,
    paragraphIndex,
    charOffset: Number.isFinite(loc?.charOffset) ? (loc!.charOffset as number) : 0,
    locationNumber,
    percentage,
    lastReadTimestamp: Number.isFinite(loc?.lastReadTimestamp)
      ? (loc!.lastReadTimestamp as number)
      : Date.now(),
  };
}

export interface JumpTarget {
  highlightId?: string;
  searchText?: string;
  chapterIndex?: number;
  pageIndex?: number;
  paragraphIndex?: number;
  locationNumber?: number;
  timestamp: number;
}

interface LuminaState {
  isHydrated: boolean;
  activeTab: WorkspaceTab;
  booksMeta: BookMeta[];
  shelves: Shelf[];
  highlights: Highlight[];
  bookmarks: Bookmark[];
  vocabulary: VocabularyCard[];
  readingSessions: ReadingSession[];
  settings: ReaderSettings;

  // Active Reader Session State
  activeBookMeta: BookMeta | null;
  activeBookContent: BookContentRecord | null;
  isLoadingBookContent: boolean;
  isZenMode: boolean;
  locationHistoryStack: LuminaLocator[];
  activeJumpTarget: JumpTarget | null;

  // Global Modals
  isImporterOpen: boolean;
  droppedFiles: FileList | null;

  // Actions
  hydrateApp: () => Promise<void>;
  setActiveTab: (tab: WorkspaceTab) => void;
  setImporterOpen: (open: boolean, files?: FileList | null) => void;
  openBook: (
    bookId: string,
    jumpToLocation?: {
      chapterIndex?: number;
      pageIndex?: number;
      paragraphIndex?: number;
      locationNumber?: number;
      highlightId?: string;
      searchText?: string;
    }
  ) => Promise<void>;
  setActiveJumpTarget: (target: Omit<JumpTarget, 'timestamp'> | null) => void;
  updateBookTotalLocations: (bookId: string, totalLocations: number) => Promise<void>;
  closeActiveBook: () => void;
  updateActiveLocator: (partial: Partial<LuminaLocator>, pushHistory?: boolean) => Promise<void>;
  popLocationHistory: () => Promise<void>;
  updateSettings: (partial: Partial<ReaderSettings>) => Promise<void>;
  toggleZenMode: () => void;
  savePageOcrText: (bookId: string, pageNumber: number, text: string) => Promise<void>;
  savePageInkStrokes: (bookId: string, pageNumber: number, strokes: PdfInkStroke[]) => Promise<void>;

  // Catalog & Shelf Actions
  refreshCatalog: () => Promise<void>;
  toggleFavoriteBook: (bookId: string) => Promise<void>;
  assignBookToShelf: (bookId: string, shelfId?: string) => Promise<void>;
  updateBookMeta: (
    bookId: string,
    partial: Partial<
      Pick<BookMeta, 'title' | 'author' | 'category' | 'description' | 'coverGradient' | 'coverImage'>
    >
  ) => Promise<void>;
  installPublicDomainBook: (meta: BookMeta, content: BookContentRecord) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  createShelf: (name: string) => Promise<void>;
  deleteShelf: (shelfId: string) => Promise<void>;

  // Annotations & Vocabulary Actions
  addHighlight: (hl: Omit<Highlight, 'id' | 'createdAt'>) => Promise<Highlight>;
  updateHighlightNote: (
    id: string,
    note: string,
    color?: HighlightColor,
    selectedText?: string,
    tags?: string[]
  ) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
  toggleBookmark: (bm: Omit<Bookmark, 'id' | 'createdAt'>) => Promise<void>;
  addVocabularyCard: (
    card: Omit<
      VocabularyCard,
      'id' | 'createdAt' | 'srsBox' | 'nextReviewAt' | 'reviewCount'
    >
  ) => Promise<void>;
  gradeVocabularyCard: (id: string, remembered: boolean) => Promise<void>;
  deleteVocabularyCard: (id: string) => Promise<void>;

  // Reading Session Tracking
  recordReadingSession: (
    bookId: string,
    bookTitle: string,
    durationMinutes: number,
    wordsRead: number
  ) => Promise<void>;
}

export const useLuminaStore = create<LuminaState>((set, get) => ({
  isHydrated: false,
  activeTab: 'library',
  booksMeta: [],
  shelves: [],
  highlights: [],
  bookmarks: [],
  vocabulary: [],
  readingSessions: [],
  settings: DEFAULT_SETTINGS,

  activeBookMeta: null,
  activeBookContent: null,
  isLoadingBookContent: false,
  isZenMode: false,
  locationHistoryStack: [],
  activeJumpTarget: null,

  isImporterOpen: false,
  droppedFiles: null,

  hydrateApp: async () => {
    try {
      // Remove any legacy pre-seeded highlights so only user-created highlights exist
      await db.highlights.bulkDelete(['hl-seed-1', 'hl-seed-2']).catch(() => {});

      const [rawMetas, savedSettings, shelves, highlights, bookmarks, vocabulary, sessions] =
        await Promise.all([
          initializeLibraryCatalog(),
          loadSavedSettings(),
          db.shelves.orderBy('createdAt').toArray(),
          db.highlights.orderBy('createdAt').reverse().toArray(),
          db.bookmarks.orderBy('createdAt').reverse().toArray(),
          db.vocabulary.orderBy('createdAt').reverse().toArray(),
          db.readingSessions.orderBy('startTime').reverse().toArray(),
        ]);

      // Sanitize every BookMeta record so corrupted/NaN locators can never crash Library or Reader
      const metas = rawMetas.map((m) => ({
        ...m,
        title: m.title || 'Untitled Volume',
        author: m.author || 'Unknown Author',
        description: m.description || '',
        totalWords: Number.isFinite(m.totalWords) && m.totalWords > 0 ? m.totalWords : 250,
        totalLocations:
          Number.isFinite(m.totalLocations) && m.totalLocations > 0 ? m.totalLocations : 1,
        chapterCount:
          Number.isFinite(m.chapterCount) && m.chapterCount > 0 ? m.chapterCount : 1,
        locator: sanitizeLocator(m.locator, m.totalLocations),
      }));

      let activeShelves = shelves;
      if (activeShelves.length === 0) {
        const defaults: Shelf[] = [
          { id: 'shelf-stoicism', name: 'Philosophy & Wisdom', createdAt: Date.now() - 20000 },
          { id: 'shelf-research', name: 'Science & Strategy', createdAt: Date.now() - 10000 },
        ];
        await db.shelves.bulkPut(defaults);
        activeShelves = defaults;
      }

      const activeHighlights = highlights.filter(
        (h) => h.id !== 'hl-seed-1' && h.id !== 'hl-seed-2'
      );

      let activeVocab = vocabulary;
      if (activeVocab.length === 0) {
        const sampleVocab: VocabularyCard[] = [
          {
            id: 'voc-seed-1',
            word: 'hegemonikon',
            phonetic: '/ˌhɛdʒɪˈmɒnɪkɒn/',
            partOfSpeech: 'noun (Stoic philosophy)',
            definition:
              'The ruling or commanding faculty of the rational soul; the seat of judgment and volition.',
            etymology: 'Ancient Greek ἡγεμονικόν (hēgemonikon), from ἡγεμών (leader, guide).',
            contextSentence:
              'Keep purity of the hegemonikon, the ruling faculty within, untouched by ephemeral praise or blame.',
            bookId: 'book-meditations',
            bookTitle: 'Meditations',
            chapterIndex: 2,
            locationNumber: 12,
            srsBox: 2,
            nextReviewAt: Date.now(),
            reviewCount: 2,
            createdAt: Date.now() - 120000,
          },
          {
            id: 'voc-seed-2',
            word: 'simultaneity',
            phonetic: '/ˌsɪmltəˈneɪɪti/',
            partOfSpeech: 'noun (physics)',
            definition:
              'The property of two events happening at the exact same time within a specific reference frame.',
            etymology: 'Medieval Latin simultaneus, from Latin simul (at the same time).',
            contextSentence:
              'Events which are simultaneous with reference to the embankment are not simultaneous with respect to the train — the relativity of simultaneity.',
            bookId: 'book-relativity',
            bookTitle: 'Relativity: The Special and General Theory',
            chapterIndex: 0,
            locationNumber: 3,
            srsBox: 1,
            nextReviewAt: Date.now(),
            reviewCount: 1,
            createdAt: Date.now() - 60000,
          },
        ];
        await db.vocabulary.bulkPut(sampleVocab);
        activeVocab = sampleVocab;
      }

      let activeSessions = sessions;
      if (activeSessions.length === 0) {
        const today = new Date();
        const seededSessions: ReadingSession[] = [];
        for (let i = 0; i < 14; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          if (i % 3 !== 2) {
            const mins = 18 + ((i * 7) % 32);
            seededSessions.push({
              id: `sess-seed-${i}`,
              bookId: i % 2 === 0 ? 'book-meditations' : 'book-art-of-war',
              bookTitle: i % 2 === 0 ? 'Meditations' : 'The Art of War',
              startTime: d.getTime(),
              endTime: d.getTime() + mins * 60000,
              durationMinutes: mins,
              wordsRead: mins * 235,
              locationsRead: Math.round((mins * 235 * 6) / 150),
              date: dateStr,
            });
          }
        }
        await db.readingSessions.bulkPut(seededSessions);
        activeSessions = seededSessions;
      }

      set({
        isHydrated: true,
        booksMeta: metas,
        shelves: activeShelves,
        highlights: activeHighlights,
        bookmarks,
        vocabulary: activeVocab,
        readingSessions: activeSessions,
        settings: savedSettings,
      });
    } catch (err) {
      console.error('Hydration recovery triggered:', err);
      set({ isHydrated: true });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setImporterOpen: (open, files = null) => set({ isImporterOpen: open, droppedFiles: files }),

  setActiveJumpTarget: (target) =>
    set({
      activeJumpTarget: target ? { ...target, timestamp: Date.now() } : null,
    }),

  updateBookTotalLocations: async (bookId, totalLocations) => {
    const safeTotal = Math.max(1, Math.floor(totalLocations));
    const currentMeta = get().booksMeta.find((b) => b.id === bookId) || get().activeBookMeta;
    if (!currentMeta || currentMeta.totalLocations === safeTotal) return;
    const updatedMeta: BookMeta = {
      ...currentMeta,
      totalLocations: safeTotal,
      locator: sanitizeLocator(currentMeta.locator, safeTotal),
    };
    await db.booksMeta.put(updatedMeta).catch(() => {});
    set((s) => ({
      booksMeta: s.booksMeta.map((b) => (b.id === bookId ? updatedMeta : b)),
      activeBookMeta: s.activeBookMeta?.id === bookId ? updatedMeta : s.activeBookMeta,
    }));
  },

  openBook: async (bookId, jumpToLocation) => {
    try {
      let meta = get().booksMeta.find((b) => b.id === bookId);
      if (!meta) {
        meta = await db.booksMeta.get(bookId);
      }
      if (!meta) return;

      const safeMeta: BookMeta = {
        ...meta,
        locator: sanitizeLocator(meta.locator, meta.totalLocations),
      };

      set({
        isLoadingBookContent: true,
        activeBookMeta: safeMeta,
        isZenMode: false,
        locationHistoryStack: [],
      });

      let content = await db.bookContents.get(bookId);
      if (!content) {
        const seed = (await import('../services/sampleBooks')).getSeedLibraryData();
        content = seed.contents.find((c) => c.bookId === bookId);
      }

      if (jumpToLocation) {
        const targetLocNum = jumpToLocation.locationNumber ?? safeMeta.locator.locationNumber;
        const targetChIdx = jumpToLocation.chapterIndex ?? safeMeta.locator.chapterIndex;
        const targetPageIdx =
          safeMeta.format === 'pdf'
            ? targetLocNum
            : jumpToLocation.pageIndex ?? safeMeta.locator.pageIndex ?? 0;

        const updatedLocator = sanitizeLocator(
          {
            ...safeMeta.locator,
            chapterIndex: targetChIdx,
            pageIndex: targetPageIdx,
            paragraphIndex: jumpToLocation.paragraphIndex ?? safeMeta.locator.paragraphIndex ?? 0,
            locationNumber: targetLocNum,
            lastReadTimestamp: Date.now(),
          },
          Math.max(safeMeta.totalLocations, targetLocNum)
        );
        const updatedMeta = { ...safeMeta, locator: updatedLocator };
        await db.booksMeta.put(updatedMeta);
        set((state) => ({
          activeBookMeta: updatedMeta,
          activeBookContent: content || null,
          isLoadingBookContent: false,
          isZenMode: false,
          activeJumpTarget: {
            highlightId: jumpToLocation.highlightId,
            searchText: jumpToLocation.searchText,
            chapterIndex: targetChIdx,
            pageIndex: targetPageIdx,
            paragraphIndex: jumpToLocation.paragraphIndex,
            locationNumber: targetLocNum,
            timestamp: Date.now(),
          },
          booksMeta: state.booksMeta.map((b) => (b.id === bookId ? updatedMeta : b)),
        }));
      } else {
        set({
          activeBookMeta: safeMeta,
          activeBookContent: content || null,
          isLoadingBookContent: false,
          isZenMode: false,
          activeJumpTarget: null,
        });
      }
    } catch (err) {
      console.error('Failed to open book:', err);
      set({ isLoadingBookContent: false });
    }
  },

  closeActiveBook: () => {
    try {
      ambientAudio.stop();
    } catch {
      // ignore
    }
    set({
      activeBookMeta: null,
      activeBookContent: null,
      isLoadingBookContent: false,
      isZenMode: false,
      locationHistoryStack: [],
      activeJumpTarget: null,
    });
  },

  updateActiveLocator: async (partial, pushHistory = false) => {
    const { activeBookMeta, locationHistoryStack } = get();
    if (!activeBookMeta) return;

    const nextHistory = pushHistory
      ? [...locationHistoryStack.slice(-9), activeBookMeta.locator]
      : locationHistoryStack;

    const nextLocator = sanitizeLocator(
      {
        ...activeBookMeta.locator,
        ...partial,
        lastReadTimestamp: Date.now(),
      },
      activeBookMeta.totalLocations
    );

    const nextMeta: BookMeta = {
      ...activeBookMeta,
      locator: nextLocator,
    };

    set((state) => ({
      activeBookMeta: nextMeta,
      locationHistoryStack: nextHistory,
      booksMeta: state.booksMeta.map((b) => (b.id === nextMeta.id ? nextMeta : b)),
    }));

    try {
      await db.booksMeta.put(nextMeta);
    } catch (err) {
      console.warn('Locator persistence error:', err);
    }
  },

  popLocationHistory: async () => {
    const { activeBookMeta, locationHistoryStack } = get();
    if (!activeBookMeta || locationHistoryStack.length === 0) return;

    const prevLocator = locationHistoryStack[locationHistoryStack.length - 1];
    const remaining = locationHistoryStack.slice(0, -1);
    const nextMeta: BookMeta = {
      ...activeBookMeta,
      locator: sanitizeLocator(
        { ...prevLocator, lastReadTimestamp: Date.now() },
        activeBookMeta.totalLocations
      ),
    };

    set((state) => ({
      activeBookMeta: nextMeta,
      locationHistoryStack: remaining,
      booksMeta: state.booksMeta.map((b) => (b.id === nextMeta.id ? nextMeta : b)),
    }));

    await db.booksMeta.put(nextMeta);
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    if (partial.soundscape !== undefined || partial.soundscapeVolume !== undefined) {
      ambientAudio.setSoundscape(next.soundscape, next.soundscapeVolume);
    }
    await saveReaderSettings(next);
  },

  toggleZenMode: () => set((s) => ({ isZenMode: !s.isZenMode })),

  savePageOcrText: async (bookId, pageNumber, text) => {
    const currentContent = get().activeBookContent || (await db.bookContents.get(bookId));
    if (!currentContent) return;
    const nextOcrByPage = {
      ...(currentContent.ocrByPage || {}),
      [pageNumber]: text,
    };
    const updatedContent: BookContentRecord = {
      ...currentContent,
      ocrByPage: nextOcrByPage,
    };
    await db.bookContents.put(updatedContent);
    if (get().activeBookMeta?.id === bookId) {
      set({ activeBookContent: updatedContent });
    }
  },

  savePageInkStrokes: async (bookId, pageNumber, strokes) => {
    const currentContent = get().activeBookContent || (await db.bookContents.get(bookId));
    if (!currentContent) return;
    const nextInkByPage = {
      ...(currentContent.inkByPage || {}),
      [pageNumber]: strokes,
    };
    const updatedContent: BookContentRecord = {
      ...currentContent,
      inkByPage: nextInkByPage,
    };
    await db.bookContents.put(updatedContent);
    if (get().activeBookMeta?.id === bookId) {
      set({ activeBookContent: updatedContent });
    }
  },

  refreshCatalog: async () => {
    const rawMetas = await db.booksMeta.orderBy('addedAt').reverse().toArray();
    const metas = rawMetas.map((m) => ({
      ...m,
      locator: sanitizeLocator(m.locator, m.totalLocations),
    }));
    set({ booksMeta: metas });
  },

  toggleFavoriteBook: async (bookId) => {
    const target = get().booksMeta.find((b) => b.id === bookId);
    if (!target) return;
    const updated = { ...target, isFavorite: !target.isFavorite };
    await db.booksMeta.put(updated);
    set((s) => ({
      booksMeta: s.booksMeta.map((b) => (b.id === bookId ? updated : b)),
      activeBookMeta: s.activeBookMeta?.id === bookId ? updated : s.activeBookMeta,
    }));
  },

  assignBookToShelf: async (bookId, shelfId) => {
    const target = get().booksMeta.find((b) => b.id === bookId);
    if (!target) return;
    const updated = { ...target, shelfId };
    await db.booksMeta.put(updated);
    set((s) => ({
      booksMeta: s.booksMeta.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  updateBookMeta: async (bookId, partial) => {
    const target = get().booksMeta.find((b) => b.id === bookId);
    if (!target) return;
    const updated: BookMeta = {
      ...target,
      ...partial,
      title: (partial.title ?? target.title).trim() || 'Untitled Volume',
      author: (partial.author ?? target.author).trim() || 'Unknown Author',
    };
    await db.booksMeta.put(updated);
    set((s) => ({
      booksMeta: s.booksMeta.map((b) => (b.id === bookId ? updated : b)),
      activeBookMeta: s.activeBookMeta?.id === bookId ? updated : s.activeBookMeta,
    }));
  },

  installPublicDomainBook: async (meta, content) => {
    const sanitizedMeta: BookMeta = {
      ...meta,
      addedAt: Date.now(),
      locator: sanitizeLocator(meta.locator, meta.totalLocations),
    };
    await db.transaction('rw', [db.booksMeta, db.bookContents], async () => {
      await db.booksMeta.put(sanitizedMeta);
      await db.bookContents.put(content);
    });
    set((s) => {
      const exists = s.booksMeta.some((b) => b.id === sanitizedMeta.id);
      return {
        booksMeta: exists
          ? s.booksMeta.map((b) => (b.id === sanitizedMeta.id ? sanitizedMeta : b))
          : [sanitizedMeta, ...s.booksMeta],
      };
    });
  },

  deleteBook: async (bookId) => {
    await db.transaction(
      'rw',
      [db.booksMeta, db.bookContents, db.bookBinaries, db.highlights, db.bookmarks],
      async () => {
        await db.booksMeta.delete(bookId);
        await db.bookContents.delete(bookId);
        await db.bookBinaries.delete(bookId);
        await db.highlights.where('bookId').equals(bookId).delete();
        await db.bookmarks.where('bookId').equals(bookId).delete();
      }
    );
    set((s) => ({
      booksMeta: s.booksMeta.filter((b) => b.id !== bookId),
      highlights: s.highlights.filter((h) => h.bookId !== bookId),
      bookmarks: s.bookmarks.filter((bm) => bm.bookId !== bookId),
      activeBookMeta: s.activeBookMeta?.id === bookId ? null : s.activeBookMeta,
    }));
  },

  createShelf: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newShelf: Shelf = {
      id: `shelf-${Date.now()}`,
      name: trimmed,
      createdAt: Date.now(),
    };
    await db.shelves.put(newShelf);
    set((s) => ({ shelves: [...s.shelves, newShelf] }));
  },

  deleteShelf: async (shelfId) => {
    await db.shelves.delete(shelfId);
    set((s) => ({
      shelves: s.shelves.filter((sh) => sh.id !== shelfId),
      booksMeta: s.booksMeta.map((b) => (b.shelfId === shelfId ? { ...b, shelfId: undefined } : b)),
    }));
  },

  addHighlight: async (hlInput) => {
    const hl: Highlight = {
      ...hlInput,
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    await db.highlights.put(hl);
    set((s) => ({ highlights: [hl, ...s.highlights] }));
    return hl;
  },

  updateHighlightNote: async (id, note, color, selectedText, tags) => {
    const updates: Partial<Highlight> = { note: note.trim() || undefined };
    if (color) updates.color = color;
    if (typeof selectedText === 'string' && selectedText.trim().length > 0) {
      updates.selectedText = selectedText.trim();
    }
    if (Array.isArray(tags)) {
      updates.tags = tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    }
    await db.highlights.update(id, updates);
    set((s) => ({
      highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    }));
  },

  deleteHighlight: async (id) => {
    await db.highlights.delete(id);
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
  },

  toggleBookmark: async (bmInput) => {
    const existing = get().bookmarks.find(
      (b) =>
        b.bookId === bmInput.bookId &&
        b.chapterIndex === bmInput.chapterIndex &&
        b.locationNumber === bmInput.locationNumber
    );
    if (existing) {
      await db.bookmarks.delete(existing.id);
      set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== existing.id) }));
    } else {
      const bm: Bookmark = {
        ...bmInput,
        id: `bm-${Date.now()}`,
        createdAt: Date.now(),
      };
      await db.bookmarks.put(bm);
      set((s) => ({ bookmarks: [bm, ...s.bookmarks] }));
    }
  },

  addVocabularyCard: async (cardInput) => {
    const existing = get().vocabulary.find(
      (v) => v.word.toLowerCase() === cardInput.word.toLowerCase()
    );
    if (existing) return;

    const card: VocabularyCard = {
      ...cardInput,
      id: `voc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      srsBox: 1,
      nextReviewAt: Date.now(),
      reviewCount: 0,
      createdAt: Date.now(),
    };
    await db.vocabulary.put(card);
    set((s) => ({ vocabulary: [card, ...s.vocabulary] }));
  },

  gradeVocabularyCard: async (id, remembered) => {
    const target = get().vocabulary.find((v) => v.id === id);
    if (!target) return;

    const nextBox = remembered
      ? (Math.min(5, target.srsBox + 1) as 1 | 2 | 3 | 4 | 5)
      : (1 as const);
    const intervalHours = [0, 4, 24, 72, 168, 336][nextBox] || 24;
    const updated: VocabularyCard = {
      ...target,
      srsBox: nextBox,
      reviewCount: target.reviewCount + 1,
      nextReviewAt: Date.now() + intervalHours * 3600_000,
    };
    await db.vocabulary.put(updated);
    set((s) => ({
      vocabulary: s.vocabulary.map((v) => (v.id === id ? updated : v)),
    }));
  },

  deleteVocabularyCard: async (id) => {
    await db.vocabulary.delete(id);
    set((s) => ({ vocabulary: s.vocabulary.filter((v) => v.id !== id) }));
  },

  recordReadingSession: async (bookId, bookTitle, durationMinutes, wordsRead) => {
    if (!bookId || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const sess: ReadingSession = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        bookId,
        bookTitle: bookTitle || 'Volume',
        startTime: Date.now() - durationMinutes * 60000,
        endTime: Date.now(),
        durationMinutes,
        wordsRead: Number.isFinite(wordsRead) ? wordsRead : durationMinutes * 200,
        locationsRead: Math.max(1, Math.round(((wordsRead || 200) * 6) / 150)),
        date: today,
      };
      await db.readingSessions.put(sess);
      set((s) => ({ readingSessions: [sess, ...s.readingSessions] }));
    } catch (err) {
      console.warn('Session recording skipped:', err);
    }
  },
}));
