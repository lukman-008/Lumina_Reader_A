import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark as BookmarkIcon,
  ChevronLeft,
  ChevronRight,
  Columns,
  Compass,
  Headphones,
  HelpCircle,
  List,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Share2,
  Sliders,
  Timer,
  Upload,
  Volume2,
  X,
  Zap,
  MessageSquare,
  PlusCircle,
  Trash2,
  Edit3,
  Tag,
  Copy,
  Check,
  ArrowUpDown,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import {
  READING_THEMES,
  FONT_FAMILY_CLASSES,
  HIGHLIGHT_SWATCHES,
} from '../utils/themeTokens';
import {
  summarizeChapterLocally,
  answerBookQuestionLocally,
  lookupWordWise,
  isRtlText,
} from '../services/localIntelligenceEngine';
import { getQuickWordWiseHint } from '../services/multilingualDictionary';
import { ttsService } from '../services/ttsService';
import { VirtualizedPdfEngine, cleanExtractedText } from './VirtualizedPdfEngine';
import { QuoteCardModal } from './QuoteCardModal';
import type {
  Highlight,
  HighlightColor,
  HighlightRect,
  ReadingTheme,
  FontFamilyChoice,
  LayoutMode,
  SoundscapeType,
} from '../types';

export const UnifiedReaderView: React.FC = () => {
  const activeBookMeta = useLuminaStore((s) => s.activeBookMeta);
  const activeBookContent = useLuminaStore((s) => s.activeBookContent);
  const settings = useLuminaStore((s) => s.settings);
  const highlights = useLuminaStore((s) => s.highlights);
  const bookmarks = useLuminaStore((s) => s.bookmarks);
  const vocabulary = useLuminaStore((s) => s.vocabulary);
  const readingSessions = useLuminaStore((s) => s.readingSessions);
  const isZenMode = useLuminaStore((s) => s.isZenMode);
  const locationHistoryStack = useLuminaStore((s) => s.locationHistoryStack);
  const activeJumpTarget = useLuminaStore((s) => s.activeJumpTarget);

  const closeActiveBook = useLuminaStore((s) => s.closeActiveBook);
  const updateActiveLocator = useLuminaStore((s) => s.updateActiveLocator);
  const popLocationHistory = useLuminaStore((s) => s.popLocationHistory);
  const updateSettings = useLuminaStore((s) => s.updateSettings);
  const toggleZenMode = useLuminaStore((s) => s.toggleZenMode);
  const addHighlight = useLuminaStore((s) => s.addHighlight);
  const updateHighlightNote = useLuminaStore((s) => s.updateHighlightNote);
  const deleteHighlight = useLuminaStore((s) => s.deleteHighlight);
  const toggleBookmark = useLuminaStore((s) => s.toggleBookmark);
  const addVocabularyCard = useLuminaStore((s) => s.addVocabularyCard);
  const recordReadingSession = useLuminaStore((s) => s.recordReadingSession);
  const setActiveJumpTarget = useLuminaStore((s) => s.setActiveJumpTarget);

  const palette = READING_THEMES[settings.theme] || READING_THEMES.paper;
  const fontClass =
    settings.fontFamily !== 'custom'
      ? FONT_FAMILY_CLASSES[settings.fontFamily]?.className || 'font-literata'
      : 'font-literata';

  // Active Drawers, Split-Screen Pinning & Sub-Tabs inside Reader
  const [activeDrawer, setActiveDrawer] = useState<
    'none' | 'toc' | 'search' | 'xray' | 'typography' | 'companion'
  >('none');
  const [isDrawerPinned, setIsDrawerPinned] = useState(false);
  const [tocSubTab, setTocSubTab] = useState<'chapters' | 'notes' | 'bookmarks'>('chapters');
  const [xrayTab, setXrayTab] = useState<'characters' | 'terms' | 'themes' | 'passages'>(
    'characters'
  );
  const [inBookSearchQuery, setInBookSearchQuery] = useState('');
  const [isGestureGuideOpen, setIsGestureGuideOpen] = useState(false);

  // Page-Turn Animation State ('next' | 'prev' | null)
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev' | null>(null);

  // Mobile/Tablet Touch Gestures (Swipe-to-Turn-Page, Left-Edge Warmth Swipe & Pinch-to-Scale Font)
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);
  const [fontScaleHud, setFontScaleHud] = useState<string | null>(null);
  const touchGestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isPinch: boolean;
    initialPinchDist: number;
    initialFontSize: number;
    isLeftEdgeWarmthSwipe?: boolean;
    initialWarmth?: number;
  } | null>(null);
  const hudTimeoutRef = useRef<number | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);

  // Selection, Quote Card & Word Wise State
  const [selectedText, setSelectedText] = useState('');
  const [selectedParaIdx, setSelectedParaIdx] = useState<number>(0);
  const [selectedCharRange, setSelectedCharRange] = useState<{
    paraIndex: number;
    start: number;
    end: number;
  } | null>(null);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number | null>(null);
  const [selectedPdfRects, setSelectedPdfRects] = useState<HighlightRect[] | undefined>(undefined);
  const [selectedPdfImageSnippet, setSelectedPdfImageSnippet] = useState<string | undefined>(
    undefined
  );
  const [marginNoteDraft, setMarginNoteDraft] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [copiedSelectionFeedback, setCopiedSelectionFeedback] = useState(false);

  // Responsive Viewport Width & Android / Standalone Safe-Area Detection
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isAndroidOrTouchMobile =
    typeof window !== 'undefined' &&
    (/Android/i.test(navigator.userAgent || '') ||
      /Linux armv|Linux aarch64/i.test(navigator.platform || '') ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 920));

  const safeTopPx =
    typeof settings.safeAreaTopOffset === 'number' && settings.safeAreaTopOffset > 0
      ? settings.safeAreaTopOffset
      : isAndroidOrTouchMobile
      ? 42
      : 0;

  // True 2-Page Book Spread is active whenever 2-Page Spread mode is selected
  const isTwoPageSpreadActive = settings.layoutMode === 'double';
  const effectiveSpreadFontSize = isTwoPageSpreadActive
    ? viewportWidth < 520
      ? Math.min(13, settings.fontSize)
      : viewportWidth < 768
      ? Math.min(15, settings.fontSize)
      : viewportWidth < 1024
      ? Math.min(17, settings.fontSize)
      : settings.fontSize
    : settings.fontSize;

  const isTouchActiveRef = useRef<boolean>(false);
  const [isTouchSelecting, setIsTouchSelecting] = useState<boolean>(false);
  const isTouchSelectingRef = useRef<boolean>(false);
  const longPressTimerRef = useRef<number | null>(null);
  const justFinishedTouchSelectRef = useRef<number>(0);
  const lastPageTurnTimeRef = useRef<number>(0);
  const lastTouchMoveTimeRef = useRef<number>(0);
  const touchSelectionAnchorRef = useRef<{
    paraIndex: number;
    startChar: number;
    endChar: number;
    fullText: string;
    isSingleWord: boolean;
  } | null>(null);
  const mainReaderRef = useRef<HTMLElement | null>(null);

  // Full-Screen Archival Figure Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    caption: string;
  } | null>(null);

  const [quoteCardModalData, setQuoteCardModalData] = useState<{
    quoteText: string;
    chapterOrPageLabel: string;
  } | null>(null);

  // Inline Footnote Popover State
  const [footnotePopover, setFootnotePopover] = useState<{
    marker: string;
    content: string;
  } | null>(null);

  // Spotlight state for jumped-to highlights or passages
  const [spotlightTarget, setSpotlightTarget] = useState<{
    highlightId?: string;
    searchText?: string;
    paragraphIndex?: number;
  } | null>(null);

  // Interactive Highlight & Margin Note Edit Modal State
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [editSelectedText, setEditSelectedText] = useState('');
  const [editNoteText, setEditNoteText] = useState('');
  const [editHighlightColor, setEditHighlightColor] = useState<HighlightColor>('amber');
  const [editTagsInput, setEditTagsInput] = useState('');

  const [wordWiseModal, setWordWiseModal] = useState<{
    word: string;
    phonetic: string;
    partOfSpeech: string;
    definition: string;
    etymology: string;
    contextSentence: string;
    saved?: boolean;
  } | null>(null);

  // Companion Synthesis & Q&A State
  const [chapterSummary, setChapterSummary] = useState<string>('');
  const [companionQuestion, setCompanionQuestion] = useState('');
  const [companionAnswer, setCompanionAnswer] = useState('');

  // TTS, Sleep Timer & RSVP Speed Reader State
  const [isTtsBarOpen, setIsTtsBarOpen] = useState(false);
  const [ttsSentence, setTtsSentence] = useState('');
  const [sleepTimerMinutesLeft, setSleepTimerMinutesLeft] = useState<number | null>(null);
  const [isRsvpOpen, setIsRsvpOpen] = useState(false);
  const [rsvpRunning, setRsvpRunning] = useState(false);
  const [rsvpWordIndex, setRsvpWordIndex] = useState(0);
  const [rsvpWpm, setRsvpWpm] = useState(320);

  // Reading Ruler Y coordinate
  const [rulerY, setRulerY] = useState<number>(260);
  const sessionStartRef = useRef<number>(Date.now());
  const selectionBarRef = useRef<HTMLDivElement | null>(null);

  // Load Custom Uploaded Font via Browser FontFace API
  useEffect(() => {
    if (!settings.customFontDataUrl || !settings.customFontName) return;
    let isMounted = true;
    const loadFont = async () => {
      try {
        const fontFace = new FontFace(
          'LuminaCustomUploadedFont',
          `url(${settings.customFontDataUrl})`
        );
        const loaded = await fontFace.load();
        if (isMounted) {
          document.fonts.add(loaded);
        }
      } catch (err) {
        console.warn('Custom font load note:', err);
      }
    };
    void loadFont();
    return () => {
      isMounted = false;
    };
  }, [settings.customFontDataUrl, settings.customFontName]);

  // Auto-Night Theme Scheduling (19:00 to 06:00 local time)
  useEffect(() => {
    if (!settings.autoNightMode) return;
    const hour = new Date().getHours();
    const isNightHours = hour >= 19 || hour < 6;
    if (isNightHours && settings.theme !== 'nocturne' && settings.theme !== 'dusk') {
      void updateSettings({ theme: 'nocturne' });
    }
  }, [settings.autoNightMode]);

  // Audio Sleep Timer Countdown (Stops TTS & Ambient Soundscapes when timer expires)
  useEffect(() => {
    if (sleepTimerMinutesLeft === null) return;
    if (sleepTimerMinutesLeft <= 0) {
      ttsService.stop();
      setIsTtsBarOpen(false);
      void updateSettings({ soundscape: 'none' });
      setSleepTimerMinutesLeft(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setSleepTimerMinutesLeft((m) => (m !== null ? m - 1 : null));
    }, 60000);
    return () => window.clearTimeout(timer);
  }, [sleepTimerMinutesLeft, settings.soundscapeVolume, updateSettings]);

  // Safe chapter & pagination calculations
  const chapters = activeBookContent?.chapters || [];
  const currentChapterIndex = useMemo(() => {
    if (!activeBookMeta || chapters.length === 0) return 0;
    const raw = activeBookMeta.locator?.chapterIndex || 0;
    return Math.min(Math.max(0, raw), chapters.length - 1);
  }, [activeBookMeta, chapters.length]);

  const currentChapter = useMemo(() => {
    const found = chapters[currentChapterIndex];
    if (found && Array.isArray(found.paragraphs) && found.paragraphs.length > 0) {
      return found;
    }
    const fallbackText = activeBookMeta?.description || activeBookMeta?.title || 'Volume Content';
    return {
      id: 'ch-fallback',
      title: activeBookMeta?.title || 'Chapter 1',
      content: fallbackText,
      paragraphs: [fallbackText],
      wordCount: 50,
      startLocation: 1,
      endLocation: 2,
    };
  }, [chapters, currentChapterIndex, activeBookMeta]);

  const wordsPerPage = useMemo(() => {
    const baseWords = isTwoPageSpreadActive
      ? viewportWidth < 768
        ? 85
        : 120
      : viewportWidth < 640
      ? 92
      : viewportWidth < 1024
      ? 130
      : 155;
    const scaleFactor = 19 / Math.max(14, settings.fontSize || 19);
    return Math.max(55, Math.round(baseWords * scaleFactor));
  }, [settings.fontSize, isTwoPageSpreadActive, viewportWidth]);

  const buildPaginatedChapterPages = (
    paragraphs: string[],
    fallbackContent: string,
    targetWordsPerPage: number
  ): { text: string; paraIndex: number; sliceStartOffset: number }[][] => {
    const pages: { text: string; paraIndex: number; sliceStartOffset: number }[][] = [];
    let currentBucket: { text: string; paraIndex: number; sliceStartOffset: number }[] = [];
    let count = 0;

    (paragraphs || []).forEach((p, idx) => {
      if (!p) return;
      if (p.startsWith('[IMAGE_DATA:')) {
        const imgWeight = 45;
        if (count + imgWeight > targetWordsPerPage && currentBucket.length > 0) {
          pages.push(currentBucket);
          currentBucket = [{ text: p, paraIndex: idx, sliceStartOffset: 0 }];
          count = imgWeight;
        } else {
          currentBucket.push({ text: p, paraIndex: idx, sliceStartOffset: 0 });
          count += imgWeight;
        }
        return;
      }

      const wCount = p.trim().split(/\s+/).filter(Boolean).length;
      // Split extra-long paragraphs cleanly on sentence boundaries so a single paragraph never overflows a phone screen
      if (wCount > targetWordsPerPage * 1.15) {
        const sentenceRegex = /[^.!?।؟]+[.!?।؟]*\s*/g;
        let match: RegExpExecArray | null;
        let sliceStart = 0;
        let sliceText = '';
        let sliceWords = 0;

        while ((match = sentenceRegex.exec(p)) !== null) {
          const seg = match[0];
          const segWords = seg.trim().split(/\s+/).filter(Boolean).length;
          if (sliceWords + segWords > targetWordsPerPage && sliceText.trim().length > 0) {
            const trimmedSlice = sliceText.trimEnd();
            if (count + sliceWords > targetWordsPerPage && currentBucket.length > 0) {
              pages.push(currentBucket);
              currentBucket = [{ text: trimmedSlice, paraIndex: idx, sliceStartOffset: sliceStart }];
              count = sliceWords;
            } else {
              currentBucket.push({
                text: trimmedSlice,
                paraIndex: idx,
                sliceStartOffset: sliceStart,
              });
              count += sliceWords;
            }
            sliceStart = match.index;
            sliceText = seg;
            sliceWords = segWords;
          } else {
            if (!sliceText) sliceStart = match.index;
            sliceText += seg;
            sliceWords += segWords;
          }
        }

        if (sliceText.trim().length > 0) {
          const trimmedSlice = sliceText.trimEnd();
          if (count + sliceWords > targetWordsPerPage && currentBucket.length > 0) {
            pages.push(currentBucket);
            currentBucket = [{ text: trimmedSlice, paraIndex: idx, sliceStartOffset: sliceStart }];
            count = sliceWords;
          } else {
            currentBucket.push({
              text: trimmedSlice,
              paraIndex: idx,
              sliceStartOffset: sliceStart,
            });
            count += sliceWords;
          }
        }
        return;
      }

      if (count + wCount > targetWordsPerPage && currentBucket.length > 0) {
        pages.push(currentBucket);
        currentBucket = [{ text: p, paraIndex: idx, sliceStartOffset: 0 }];
        count = wCount;
      } else {
        currentBucket.push({ text: p, paraIndex: idx, sliceStartOffset: 0 });
        count += wCount;
      }
    });

    if (currentBucket.length > 0) pages.push(currentBucket);
    return pages.length > 0
      ? pages
      : [[{ text: fallbackContent || '', paraIndex: 0, sliceStartOffset: 0 }]];
  };

  const paginatedPages = useMemo(
    () =>
      buildPaginatedChapterPages(
        currentChapter.paragraphs || [],
        currentChapter.content || '',
        wordsPerPage
      ),
    [currentChapter, wordsPerPage]
  );

  const totalPagesInChapter = Math.max(1, paginatedPages.length);
  const rawPageIndex = Math.min(
    Math.max(0, activeBookMeta?.locator?.pageIndex || 0),
    totalPagesInChapter - 1
  );
  // In 2-Page Spread mode on iPad/Desktop, align left-hand leaf to even page index (0, 2, 4...)
  const currentPageIndex =
    isTwoPageSpreadActive && rawPageIndex % 2 === 1
      ? Math.max(0, rawPageIndex - 1)
      : rawPageIndex;
  const currentPageParagraphs = paginatedPages[currentPageIndex] || [];
  const rightSpreadPageParagraphs =
    isTwoPageSpreadActive && currentPageIndex + 1 < totalPagesInChapter
      ? paginatedPages[currentPageIndex + 1]
      : null;

  const activeLocationNumber = useMemo(() => {
    if (!activeBookMeta) return 1;
    const startLoc = Number.isFinite(currentChapter.startLocation)
      ? currentChapter.startLocation
      : 1;
    const endLoc = Number.isFinite(currentChapter.endLocation) ? currentChapter.endLocation : 2;
    const chapterSpan = Math.max(1, endLoc - startLoc);
    const pageRatio = currentPageIndex / Math.max(1, totalPagesInChapter);
    const totalLocs = Math.max(1, activeBookMeta.totalLocations || 1);
    return Math.min(totalLocs, Math.max(1, Math.round(startLoc + chapterSpan * pageRatio)));
  }, [
    activeBookMeta,
    currentChapter.startLocation,
    currentChapter.endLocation,
    currentPageIndex,
    totalPagesInChapter,
  ]);

  const rsvpWords = useMemo(() => {
    const source = selectedText || currentChapter.content || '';
    return source.split(/\s+/).filter(Boolean);
  }, [selectedText, currentChapter.content]);

  // Personalized Live Reading Speed (WPM) & Time-Left-in-Chapter Estimator
  const personalizedReadingStats = useMemo(() => {
    const totalWordsRead = readingSessions.reduce((acc, s) => acc + (s.wordsRead || 0), 0);
    const totalMinsRead = readingSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const userWpm =
      totalMinsRead >= 2
        ? Math.min(450, Math.max(150, Math.round(totalWordsRead / totalMinsRead)))
        : 235;
    const chapterTotalWords = Math.max(
      60,
      currentChapter.wordCount || (currentChapter.content || '').split(/\s+/).length
    );
    const remainingRatio = Math.max(
      0.04,
      (totalPagesInChapter - currentPageIndex) / Math.max(1, totalPagesInChapter)
    );
    const remainingWords = Math.round(chapterTotalWords * remainingRatio);
    const minsLeftInChapter = Math.max(1, Math.round(remainingWords / userWpm));
    return { userWpm, minsLeftInChapter };
  }, [readingSessions, currentChapter.wordCount, currentChapter.content, totalPagesInChapter, currentPageIndex]);

  // Instant In-Book & In-PDF Full-Text Search Across Chapters & Indexed PDF Pages
  const inBookSearchResults = useMemo(() => {
    const q = inBookSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const matches: {
      chapterIndex: number;
      chapterTitle: string;
      paraIndex: number;
      locationNumber: number;
      snippet: string;
      isPdfPage?: boolean;
    }[] = [];

    // 1. Search PDF indexed pages (`ocrByPage`) if book is PDF
    if (activeBookMeta?.format === 'pdf' && activeBookContent?.ocrByPage) {
      const pageEntries = Object.entries(activeBookContent.ocrByPage).sort(
        (a, b) => Number(a[0]) - Number(b[0])
      );
      for (const [pageKey, pageText] of pageEntries) {
        const pageNum = Number(pageKey);
        const text = pageText || '';
        const matchPos = text.toLowerCase().indexOf(q);
        if (matchPos !== -1) {
          const start = Math.max(0, matchPos - 55);
          const end = Math.min(text.length, matchPos + q.length + 75);
          const snippet =
            (start > 0 ? '…' : '') +
            text.slice(start, end).trim() +
            (end < text.length ? '…' : '');
          matches.push({
            chapterIndex: 0,
            chapterTitle: `Page ${pageNum}`,
            paraIndex: 0,
            locationNumber: pageNum,
            snippet,
            isPdfPage: true,
          });
          if (matches.length >= 60) return matches;
        }
      }
      if (matches.length > 0) return matches;
    }

    // 2. Search Reflowable Chapters & Paragraphs
    for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
      const ch = chapters[cIdx];
      const paras = ch.paragraphs || [];
      for (let pIdx = 0; pIdx < paras.length; pIdx++) {
        const pText = paras[pIdx] || '';
        const matchPos = pText.toLowerCase().indexOf(q);
        if (matchPos !== -1) {
          const start = Math.max(0, matchPos - 55);
          const end = Math.min(pText.length, matchPos + q.length + 75);
          const snippet =
            (start > 0 ? '…' : '') +
            pText.slice(start, end).trim() +
            (end < pText.length ? '…' : '');
          const loc = Math.max(
            1,
            (ch.startLocation || 1) +
              Math.floor(
                (pIdx / Math.max(1, paras.length)) *
                  Math.max(1, (ch.endLocation || 2) - (ch.startLocation || 1))
              )
          );
          matches.push({
            chapterIndex: cIdx,
            chapterTitle: ch.title,
            paraIndex: pIdx,
            locationNumber: loc,
            snippet,
          });
          if (matches.length >= 60) return matches;
        }
      }
    }
    return matches;
  }, [chapters, activeBookMeta?.format, activeBookContent?.ocrByPage, inBookSearchQuery]);

  const triggerFontScaleHud = (newSize: number) => {
    const fontLabel =
      settings.fontFamily === 'custom'
        ? settings.customFontName || 'Custom Font'
        : FONT_FAMILY_CLASSES[settings.fontFamily]?.label || 'Literata';
    setFontScaleHud(`${newSize}px · ${fontLabel}`);
    if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = window.setTimeout(() => {
      setFontScaleHud(null);
    }, 950);
  };

  const triggerCustomHud = (message: string) => {
    setFontScaleHud(message);
    if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = window.setTimeout(() => {
      setFontScaleHud(null);
    }, 950);
  };

  // Session lifecycle, TTS listener & Automatic Screen Wake Lock
  useEffect(() => {
    sessionStartRef.current = Date.now();
    const unsub = ttsService.onSentenceChange((s) => setTtsSentence(s));
    const bookId = activeBookMeta?.id;
    const bookTitle = activeBookMeta?.title;

    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Ignore if browser/iframe policy blocks wakeLock
      }
    };
    requestWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsub();
      ttsService.stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release().catch(() => {});
      }
      if (bookId && bookTitle) {
        const elapsedMins = Math.max(
          1,
          Math.round((Date.now() - sessionStartRef.current) / 60000)
        );
        recordReadingSession(bookId, bookTitle, elapsedMins, elapsedMins * 220);
      }
    };
  }, [activeBookMeta?.id]);

  // RSVP timer
  useEffect(() => {
    if (!isRsvpOpen || !rsvpRunning) return;
    const msPerWord = Math.round(60000 / Math.max(100, rsvpWpm));
    const timer = setInterval(() => {
      setRsvpWordIndex((idx) => {
        if (idx + 1 >= rsvpWords.length) {
          setRsvpRunning(false);
          return idx;
        }
        return idx + 1;
      });
    }, msPerWord);
    return () => clearInterval(timer);
  }, [isRsvpOpen, rsvpRunning, rsvpWpm, rsvpWords.length]);

  const triggerPageTurnAnimation = (dir: 'next' | 'prev') => {
    if (settings.pageTurnAnimation === 'instant') return;
    setPageTurnDirection(dir);
    window.setTimeout(() => {
      setPageTurnDirection(null);
    }, 240);
  };

  const navigateToChapterAndPage = (
    nextChIdx: number,
    nextPageIdx: number,
    pushHistory = false
  ) => {
    if (!activeBookMeta) return;
    const targetCh = chapters[nextChIdx];
    if (!targetCh) return;
    const targetChPages = buildPaginatedChapterPages(
      targetCh.paragraphs || [],
      targetCh.content || '',
      wordsPerPage
    );
    const safeTotalPages = Math.max(1, targetChPages.length);
    const clampedPageIdx = Math.min(Math.max(0, nextPageIdx), safeTotalPages - 1);
    const overallProgress = Math.min(
      100,
      Math.max(
        1,
        Math.round(
          ((nextChIdx + (clampedPageIdx + 1) / safeTotalPages) /
            Math.max(1, chapters.length)) *
            100
        )
      )
    );
    const locNum = Math.max(1, (targetCh.startLocation || 1) + clampedPageIdx * 2);
    updateActiveLocator(
      {
        chapterIndex: nextChIdx,
        pageIndex: clampedPageIdx,
        paragraphIndex: targetChPages[clampedPageIdx]?.[0]?.paraIndex ?? 0,
        locationNumber: Math.min(activeBookMeta.totalLocations || 1, locNum),
        percentage: overallProgress,
      },
      pushHistory
    );
    try {
      mainReaderRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      if (mainReaderRef.current) mainReaderRef.current.scrollTop = 0;
    }
  };

  const pageStep = isTwoPageSpreadActive ? 2 : 1;

  const handlePrevPage = () => {
    const now = Date.now();
    if (now - lastPageTurnTimeRef.current < 260) return;
    lastPageTurnTimeRef.current = now;

    if (currentPageIndex > 0) {
      triggerPageTurnAnimation('prev');
      navigateToChapterAndPage(currentChapterIndex, Math.max(0, currentPageIndex - pageStep));
    } else if (currentChapterIndex > 0) {
      triggerPageTurnAnimation('prev');
      const prevCh = chapters[currentChapterIndex - 1];
      const prevPages = buildPaginatedChapterPages(
        prevCh?.paragraphs || [],
        prevCh?.content || '',
        wordsPerPage
      );
      const rawLastIdx = Math.max(0, prevPages.length - 1);
      const targetLastIdx =
        isTwoPageSpreadActive && rawLastIdx % 2 === 1 ? Math.max(0, rawLastIdx - 1) : rawLastIdx;
      navigateToChapterAndPage(currentChapterIndex - 1, targetLastIdx);
    }
  };

  const handleNextPage = () => {
    const now = Date.now();
    if (now - lastPageTurnTimeRef.current < 260) return;
    lastPageTurnTimeRef.current = now;

    if (currentPageIndex + pageStep < totalPagesInChapter) {
      triggerPageTurnAnimation('next');
      navigateToChapterAndPage(currentChapterIndex, currentPageIndex + pageStep);
    } else if (currentChapterIndex < chapters.length - 1) {
      triggerPageTurnAnimation('next');
      navigateToChapterAndPage(currentChapterIndex + 1, 0);
    }
  };

  // Universal Keyboard & Escape Dismissal Handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) {
          setLightboxImage(null);
          return;
        }
        if (quoteCardModalData) {
          setQuoteCardModalData(null);
          return;
        }
        if (footnotePopover) {
          setFootnotePopover(null);
          return;
        }
        if (isGestureGuideOpen) {
          setIsGestureGuideOpen(false);
          return;
        }
        if (editingHighlight) {
          setEditingHighlight(null);
          return;
        }
        if (wordWiseModal) {
          setWordWiseModal(null);
          return;
        }
        if (isRsvpOpen) {
          setRsvpRunning(false);
          setIsRsvpOpen(false);
          return;
        }
        if (selectedText) {
          setSelectedText('');
          setShowNoteInput(false);
          window.getSelection()?.removeAllRanges();
          return;
        }
        if (activeDrawer !== 'none') {
          setActiveDrawer('none');
          return;
        }
        if (isZenMode) {
          toggleZenMode();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveDrawer((d) => (d === 'search' ? 'none' : 'search'));
        return;
      }

      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (
        e.key === 'ArrowRight' ||
        e.key === 'PageDown' ||
        e.key === 'AudioVolumeDown' ||
        e.key === 'VolumeDown' ||
        (e.key === ' ' && !e.shiftKey)
      ) {
        if (settings.layoutMode !== 'scroll') {
          e.preventDefault();
          handleNextPage();
        }
      } else if (
        e.key === 'ArrowLeft' ||
        e.key === 'PageUp' ||
        e.key === 'AudioVolumeUp' ||
        e.key === 'VolumeUp' ||
        (e.key === ' ' && e.shiftKey)
      ) {
        if (settings.layoutMode !== 'scroll') {
          e.preventDefault();
          handlePrevPage();
        }
      } else if (e.key === '/') {
        e.preventDefault();
        setActiveDrawer((d) => (d === 'search' ? 'none' : 'search'));
      } else if (e.key.toLowerCase() === 'z') {
        toggleZenMode();
      } else if (e.key === '?') {
        setIsGestureGuideOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Geometric DOM Range Hit-Tester for Touch Selection (Works with user-select: none so Android OS never shows 'Ask AI / Copy' popup)
  const findWordAtPointInParagraph = (
    paraEl: HTMLElement,
    clientX: number,
    clientY: number
  ): { word: string; startChar: number; endChar: number; fullText: string } | null => {
    const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-lumina-ui-badge="true"], rt, button')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const spans: { node: Text; start: number; end: number }[] = [];
    let fullText = '';
    let cur = walker.nextNode() as Text | null;
    while (cur) {
      const val = cur.nodeValue || '';
      if (val.length > 0) {
        const start = fullText.length;
        fullText += val;
        spans.push({ node: cur, start, end: fullText.length });
      }
      cur = walker.nextNode() as Text | null;
    }

    if (!fullText || spans.length === 0) return null;

    const range = document.createRange();
    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null;
    let bestHit: {
      word: string;
      startChar: number;
      endChar: number;
      dist: number;
    } | null = null;

    while ((match = wordRegex.exec(fullText)) !== null) {
      const rawStart = match.index;
      const rawEnd = rawStart + match[0].length;

      const startSpan = spans.find((s) => rawStart >= s.start && rawStart < s.end);
      const endSpan = spans.find((s) => rawEnd > s.start && rawEnd <= s.end);
      if (!startSpan || !endSpan) continue;

      try {
        range.setStart(startSpan.node, rawStart - startSpan.start);
        range.setEnd(endSpan.node, rawEnd - endSpan.start);
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          if (rect.width === 0 && rect.height === 0) continue;

          const dx =
            clientX < rect.left
              ? rect.left - clientX
              : clientX > rect.right
              ? clientX - rect.right
              : 0;
          const dy =
            clientY < rect.top
              ? rect.top - clientY
              : clientY > rect.bottom
              ? clientY - rect.bottom
              : 0;

          if (dy > 26 || dx > 42) continue;

          const dist = dy * 2.8 + dx;
          if (!bestHit || dist < bestHit.dist) {
            const rawToken = match[0];
            const leadMatch = rawToken.match(/^[^\p{L}\p{M}\p{N}]+/u);
            const trailMatch = rawToken.match(/[^\p{L}\p{M}\p{N}]+$/u);
            const leadLen = leadMatch ? leadMatch[0].length : 0;
            const trailLen = trailMatch ? trailMatch[0].length : 0;
            const cleanStart =
              rawStart + leadLen < rawEnd - trailLen ? rawStart + leadLen : rawStart;
            const cleanEnd = rawEnd - trailLen > cleanStart ? rawEnd - trailLen : rawEnd;

            bestHit = {
              word: fullText.slice(cleanStart, cleanEnd),
              startChar: cleanStart,
              endChar: cleanEnd,
              dist,
            };
          }
        }
        if (bestHit && bestHit.dist === 0) break;
      } catch {
        // ignore range boundary edge cases
      }
    }

    if (!bestHit || !bestHit.word) return null;
    return {
      word: bestHit.word,
      startChar: bestHit.startChar,
      endChar: bestHit.endChar,
      fullText,
    };
  };

  // Compute exact character [start, end] offsets inside the full paragraph from a native DOM Range
  const computeDomRangeOffsetsInParagraph = (
    paraEl: HTMLElement,
    domRange: Range
  ): { start: number; end: number } | null => {
    const sliceOffset = Number(paraEl.getAttribute('data-slice-offset')) || 0;
    const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-lumina-ui-badge="true"], rt, button')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let charCount = 0;
    let startOffset: number | null = null;
    let endOffset: number | null = null;
    let cur = walker.nextNode() as Text | null;

    while (cur) {
      const len = (cur.nodeValue || '').length;
      if (cur === domRange.startContainer) {
        startOffset = charCount + Math.min(len, Math.max(0, domRange.startOffset));
      }
      if (cur === domRange.endContainer) {
        endOffset = charCount + Math.min(len, Math.max(0, domRange.endOffset));
        break;
      }
      charCount += len;
      cur = walker.nextNode() as Text | null;
    }

    if (startOffset !== null && endOffset !== null && endOffset > startOffset) {
      return {
        start: sliceOffset + startOffset,
        end: sliceOffset + endOffset,
      };
    }
    return null;
  };

  // Non-passive touchmove lock when Hold-and-Drag word selection is active on touch screens
  useEffect(() => {
    const el = mainReaderRef.current;
    if (!el) return;
    const onNativeTouchMove = (e: TouchEvent) => {
      if (isTouchSelectingRef.current) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onNativeTouchMove);
  }, [activeBookMeta?.id, activeBookMeta?.format]);

  // Real-time selectionchange listener for Desktop mouse drag and fallback native selection
  useEffect(() => {
    const onSelectionChange = () => {
      if (activeBookMeta?.format === 'pdf') return;
      const selObj = window.getSelection();
      if (!selObj || selObj.rangeCount === 0) return;
      const rawText = selObj.toString() || '';
      const cleaned = cleanExtractedText(rawText);
      if (cleaned.length < 1) return;

      const anchorEl =
        selObj.anchorNode instanceof HTMLElement
          ? selObj.anchorNode
          : selObj.anchorNode?.parentElement;
      const paraEl = anchorEl?.closest?.('[data-para-index]') as HTMLElement | null;
      if (!paraEl) return;

      const pIdx = Number(paraEl.getAttribute('data-para-index'));
      if (Number.isFinite(pIdx)) {
        setSelectedParaIdx(pIdx);
        try {
          const domRange = selObj.getRangeAt(0);
          const exactOffsets = computeDomRangeOffsetsInParagraph(paraEl, domRange);
          if (exactOffsets) {
            setSelectedCharRange({
              paraIndex: pIdx,
              start: exactOffsets.start,
              end: exactOffsets.end,
            });
          }
        } catch {
          // ignore range read error
        }
      }
      setSelectedText(cleaned);

      // On active touch gestures or coarse-pointer mobile devices, immediately collapse native DOM range so Android OS never shows its "Ask AI / Copy" popup
      if (isTouchActiveRef.current || window.matchMedia?.('(pointer: coarse)').matches) {
        try {
          selObj.removeAllRanges();
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [activeBookMeta?.format]);

  // Dismiss Floating Selection Bar cleanly on outside pointerdown without breaking Two-Tap Range Selection
  useEffect(() => {
    if (!selectedText) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (selectionBarRef.current?.contains(target)) return;
      if (target.closest?.('[data-para-index], [data-pdf-interactive="true"]')) return;
      touchSelectionAnchorRef.current = null;
      setSelectedCharRange(null);
      setSelectedText('');
      setSelectedPdfRects(undefined);
      setShowNoteInput(false);
    };
    document.addEventListener('pointerdown', onPointerDownOutside);
    return () => document.removeEventListener('pointerdown', onPointerDownOutside);
  }, [selectedText]);

  // Helper: Find a passage span inside a paragraph (Prioritizes whole-word Unicode boundaries so "to" never matches inside "into" or "today")
  const findTextSpanInParagraph = (
    paragraphText: string,
    rawNeedle: string,
    fromIndex = 0
  ): { start: number; end: number } | null => {
    const needle = (rawNeedle || '').trim();
    if (needle.length < 1 || !paragraphText) return null;

    const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const wordBoundaryRegex = new RegExp(
        `(?<![\\p{L}\\p{M}\\p{N}])${escapedNeedle}(?![\\p{L}\\p{M}\\p{N}])`,
        'iu'
      );
      const slice = paragraphText.slice(fromIndex);
      const wbMatch = wordBoundaryRegex.exec(slice);
      if (wbMatch && wbMatch.index !== undefined) {
        return {
          start: fromIndex + wbMatch.index,
          end: fromIndex + wbMatch.index + wbMatch[0].length,
        };
      }
    } catch {
      // Fallback if environment lacks lookbehind
    }

    const exactIdx = paragraphText.indexOf(needle, fromIndex);
    if (exactIdx !== -1) {
      return { start: exactIdx, end: exactIdx + needle.length };
    }

    const lowerIdx = paragraphText.toLowerCase().indexOf(needle.toLowerCase(), fromIndex);
    if (lowerIdx !== -1) {
      return { start: lowerIdx, end: lowerIdx + needle.length };
    }

    const tokens = needle
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    if (tokens.length > 0) {
      try {
        const pattern = tokens.join('[\\s\\u00A0\\p{P}]*');
        const regex = new RegExp(pattern, 'iu');
        const slice = paragraphText.slice(fromIndex);
        const match = regex.exec(slice);
        if (match && match.index !== undefined && match[0].length > 0) {
          return {
            start: fromIndex + match.index,
            end: fromIndex + match.index + match[0].length,
          };
        }
      } catch {
        // Ignore regex fallback errors
      }
    }
    return null;
  };

  // Resolve exact chapter & page for activeJumpTarget on reflowable books, then trigger spotlight
  useEffect(() => {
    if (!activeJumpTarget || !activeBookMeta || activeBookMeta.format === 'pdf') return;

    const targetChIdx = Math.min(
      Math.max(0, activeJumpTarget.chapterIndex ?? currentChapterIndex),
      Math.max(0, chapters.length - 1)
    );

    if (targetChIdx !== currentChapterIndex) {
      updateActiveLocator({
        chapterIndex: targetChIdx,
        pageIndex: activeJumpTarget.pageIndex ?? 0,
        paragraphIndex: activeJumpTarget.paragraphIndex ?? 0,
        locationNumber: activeJumpTarget.locationNumber ?? activeLocationNumber,
      });
      return;
    }

    const targetHl = activeJumpTarget.highlightId
      ? highlights.find((h) => h.id === activeJumpTarget.highlightId)
      : undefined;
    const needle = (activeJumpTarget.searchText || targetHl?.selectedText || '').trim();
    const targetParaIdx = activeJumpTarget.paragraphIndex ?? targetHl?.paragraphIndex;

    let resolvedPageIdx = -1;
    if (typeof targetParaIdx === 'number' && typeof targetHl?.startOffset === 'number') {
      resolvedPageIdx = paginatedPages.findIndex((pageBucket) =>
        pageBucket.some(
          (p) =>
            p.paraIndex === targetParaIdx &&
            targetHl.startOffset! >= p.sliceStartOffset &&
            targetHl.startOffset! < p.sliceStartOffset + p.text.length
        )
      );
    }
    if (resolvedPageIdx === -1 && typeof targetParaIdx === 'number') {
      resolvedPageIdx = paginatedPages.findIndex((pageBucket) =>
        pageBucket.some((p) => p.paraIndex === targetParaIdx)
      );
    }
    if (resolvedPageIdx === -1 && needle.length >= 2) {
      resolvedPageIdx = paginatedPages.findIndex((pageBucket) =>
        pageBucket.some((p) => findTextSpanInParagraph(p.text, needle) !== null)
      );
    }
    if (resolvedPageIdx === -1 && typeof activeJumpTarget.pageIndex === 'number') {
      resolvedPageIdx = Math.min(
        Math.max(0, activeJumpTarget.pageIndex),
        Math.max(0, paginatedPages.length - 1)
      );
    }

    const alignedResolvedPageIdx =
      isTwoPageSpreadActive && resolvedPageIdx >= 0 && resolvedPageIdx % 2 === 1
        ? Math.max(0, resolvedPageIdx - 1)
        : resolvedPageIdx;

    if (
      settings.layoutMode !== 'scroll' &&
      alignedResolvedPageIdx !== -1 &&
      alignedResolvedPageIdx !== currentPageIndex
    ) {
      navigateToChapterAndPage(targetChIdx, alignedResolvedPageIdx, false);
      return;
    }

    setSpotlightTarget({
      highlightId: activeJumpTarget.highlightId || targetHl?.id,
      searchText: needle || undefined,
      paragraphIndex: targetParaIdx,
    });
    setActiveJumpTarget(null);
  }, [
    activeJumpTarget,
    activeBookMeta,
    currentChapterIndex,
    currentPageIndex,
    paginatedPages,
    highlights,
    chapters.length,
    settings.layoutMode,
    isTwoPageSpreadActive,
  ]);

  // Smoothly scroll spotlighted highlight or passage into center of viewport
  useEffect(() => {
    if (!spotlightTarget) return;
    const scrollTimer = window.setTimeout(() => {
      const selector = spotlightTarget.highlightId
        ? `[data-highlight-id="${spotlightTarget.highlightId}"]`
        : '[data-jump-spotlight="true"]';
      const el =
        document.querySelector(selector) ||
        (typeof spotlightTarget.paragraphIndex === 'number'
          ? document.querySelector(`[data-para-index="${spotlightTarget.paragraphIndex}"]`)
          : null);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 85);

    const clearTimer = window.setTimeout(() => {
      setSpotlightTarget(null);
    }, 4500);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [spotlightTarget, currentPageIndex, currentChapterIndex]);

  if (!activeBookMeta) return null;

  const openEditHighlightModal = (hl: Highlight) => {
    setEditingHighlight(hl);
    setEditSelectedText(hl.selectedText || '');
    setEditNoteText(hl.note || '');
    setEditHighlightColor(hl.color || 'amber');
    setEditTagsInput((hl.tags || []).join(', '));
  };

  const handleWordLookup = async (word: string, sentence: string) => {
    const result = await lookupWordWise(word, sentence);
    setWordWiseModal({
      ...result,
      contextSentence: sentence,
      saved: false,
    });
  };

  const handleCreateHighlight = async (color: HighlightColor, note?: string) => {
    if (!selectedText.trim()) return;
    const isPdf = activeBookMeta.format === 'pdf';
    const targetLoc = isPdf
      ? selectedPdfPage || activeBookMeta.locator?.locationNumber || 1
      : activeLocationNumber;
    const targetChapterTitle = isPdf ? `Page ${targetLoc}` : currentChapter.title;

    const fullParaText = !isPdf ? currentChapter.paragraphs[selectedParaIdx] || '' : '';
    const hasExactCharRange =
      !isPdf &&
      selectedCharRange !== null &&
      selectedCharRange.paraIndex === selectedParaIdx &&
      selectedCharRange.end > selectedCharRange.start;
    const fallbackSpan =
      !isPdf && !hasExactCharRange
        ? findTextSpanInParagraph(fullParaText, selectedText.trim())
        : null;

    const resolvedStartOffset = hasExactCharRange
      ? selectedCharRange!.start
      : fallbackSpan
      ? fallbackSpan.start
      : undefined;
    const resolvedEndOffset = hasExactCharRange
      ? selectedCharRange!.end
      : fallbackSpan
      ? fallbackSpan.end
      : undefined;

    await addHighlight({
      bookId: activeBookMeta.id,
      bookTitle: activeBookMeta.title,
      bookAuthor: activeBookMeta.author,
      chapterIndex: isPdf ? 0 : currentChapterIndex,
      chapterTitle: targetChapterTitle,
      pageIndex: isPdf ? targetLoc : currentPageIndex,
      paragraphIndex: selectedParaIdx,
      startOffset: resolvedStartOffset,
      endOffset: resolvedEndOffset,
      locationNumber: targetLoc,
      selectedText: selectedText.trim(),
      color,
      note: note?.trim() || undefined,
      rects: isPdf ? selectedPdfRects : undefined,
      imageSnippetDataUrl: isPdf ? selectedPdfImageSnippet : undefined,
    });
    touchSelectionAnchorRef.current = null;
    setSelectedCharRange(null);
    setSelectedText('');
    setSelectedPdfPage(null);
    setSelectedPdfRects(undefined);
    setSelectedPdfImageSnippet(undefined);
    setMarginNoteDraft('');
    setShowNoteInput(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleGenerateChapterSynthesis = async () => {
    setChapterSummary(summarizeChapterLocally(currentChapter.title, currentChapter.content));
  };

  const handleAskCompanion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companionQuestion.trim()) return;
    setCompanionAnswer(
      answerBookQuestionLocally(companionQuestion, currentChapter.title, currentChapter.content)
    );
  };

  const handleCustomFontUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const cleanName = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
      await updateSettings({
        fontFamily: 'custom',
        customFontName: cleanName,
        customFontDataUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const isCurrentLocationBookmarked = bookmarks.some(
    (b) =>
      b.bookId === activeBookMeta.id &&
      b.chapterIndex === currentChapterIndex &&
      b.locationNumber === activeLocationNumber
  );

  const bookHighlights = highlights.filter((h) => h.bookId === activeBookMeta.id);
  const chapterHighlights = bookHighlights.filter(
    (h) => h.chapterIndex === currentChapterIndex
  );

  // Render inline footnote markers ([1], [2], *) as interactive popovers
  const decorateInlineFootnotes = (segment: string, keyPrefix: string): React.ReactNode => {
    if (!/\[\d+\]/.test(segment)) return segment;
    const parts = segment.split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      if (/^\[\d+\]$/.test(part)) {
        const num = part.replace(/\D/g, '');
        const footnotePara = (currentChapter.paragraphs || []).find(
          (p) => p.trim().startsWith(`[${num}]`) || p.trim().startsWith(`${num}.`)
        );
        return (
          <button
            key={`${keyPrefix}-fn-${idx}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFootnotePopover({
                marker: part,
                content:
                  footnotePara ||
                  `Editorial Note ${part} in ${currentChapter.title}: Contextual reference marker at Location ${activeLocationNumber}.`,
              });
            }}
            className="inline-flex items-center px-1 mx-0.5 text-[11px] font-sans font-semibold text-amber-600 dark:text-amber-400 underline decoration-dotted cursor-pointer align-super"
            title="View inline footnote"
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  // Render paragraph with Bionic Reading, Footnotes, Clickable Multi-Highlight/Note Marks & Jump Spotlights
  const renderParagraphContent = (
    text: string,
    paraIndex: number,
    sliceStartOffset = 0
  ) => {
    const matchedSpans: {
      hl?: Highlight;
      start: number;
      end: number;
      isSpotlightOnly?: boolean;
    }[] = [];

    const unmatchedParaHighlights: Highlight[] = [];

    chapterHighlights.forEach((hl) => {
      if (!hl.selectedText || hl.selectedText.trim().length < 1) return;
      // STRICT PARAGRAPH SCOPING: A highlight created in paragraph X must NEVER highlight matching words in paragraph Y
      if (typeof hl.paragraphIndex === 'number' && hl.paragraphIndex !== paraIndex) {
        return;
      }

      // 1. Exact Character-Offset Anchoring (Highlights ONLY the exact selected word/range instance!)
      if (
        typeof hl.startOffset === 'number' &&
        typeof hl.endOffset === 'number' &&
        hl.endOffset > hl.startOffset
      ) {
        const localStart = hl.startOffset - sliceStartOffset;
        const localEnd = hl.endOffset - sliceStartOffset;
        if (localEnd > 0 && localStart < text.length) {
          const clampedStart = Math.max(0, localStart);
          const clampedEnd = Math.min(text.length, localEnd);
          if (clampedEnd > clampedStart) {
            matchedSpans.push({ hl, start: clampedStart, end: clampedEnd });
          }
        }
        return;
      }

      // 2. Fallback for legacy highlights without offsets (Scoped to this paragraph only)
      const span = findTextSpanInParagraph(text, hl.selectedText);
      if (span) {
        matchedSpans.push({ hl, start: span.start, end: span.end });
      } else if (hl.paragraphIndex === paraIndex && sliceStartOffset === 0) {
        unmatchedParaHighlights.push(hl);
      }
    });

    if (
      spotlightTarget?.searchText &&
      spotlightTarget.searchText.trim().length >= 2 &&
      (spotlightTarget.paragraphIndex === undefined ||
        spotlightTarget.paragraphIndex === paraIndex)
    ) {
      const spotSpan = findTextSpanInParagraph(text, spotlightTarget.searchText);
      if (
        spotSpan &&
        !matchedSpans.some(
          (m) => !(spotSpan.end <= m.start || spotSpan.start >= m.end)
        )
      ) {
        matchedSpans.push({
          start: spotSpan.start,
          end: spotSpan.end,
          isSpotlightOnly: true,
        });
      }
    }

    // Visual Active Touch Selection Highlight (Uses exact character range relative to sliceStartOffset so duplicate words highlight ONLY the exact tapped word)
    if (
      selectedText &&
      selectedText.trim().length >= 1 &&
      selectedParaIdx === paraIndex
    ) {
      let activeSelSpan: { start: number; end: number } | null = null;
      if (
        selectedCharRange &&
        selectedCharRange.paraIndex === paraIndex &&
        selectedCharRange.end > selectedCharRange.start
      ) {
        const localStart = selectedCharRange.start - sliceStartOffset;
        const localEnd = selectedCharRange.end - sliceStartOffset;
        if (localEnd > 0 && localStart < text.length) {
          activeSelSpan = {
            start: Math.max(0, localStart),
            end: Math.min(text.length, localEnd),
          };
        }
      } else {
        activeSelSpan = findTextSpanInParagraph(text, selectedText);
      }

      if (
        activeSelSpan &&
        activeSelSpan.end > activeSelSpan.start &&
        !matchedSpans.some(
          (m) => !(activeSelSpan!.end <= m.start || activeSelSpan!.start >= m.end)
        )
      ) {
        matchedSpans.push({
          start: activeSelSpan.start,
          end: activeSelSpan.end,
          isSpotlightOnly: true,
        });
      }
    }

    if (matchedSpans.length > 0 || unmatchedParaHighlights.length > 0) {
      const sorted = [...matchedSpans].sort((a, b) => a.start - b.start);
      const nodes: React.ReactNode[] = [];
      let cursor = 0;

      sorted.forEach((item, idx) => {
        if (item.start < cursor) return;
        if (item.start > cursor) {
          nodes.push(
            decorateInlineFootnotes(text.slice(cursor, item.start), `seg-${paraIndex}-${idx}`)
          );
        }

        const sliceText = text.slice(item.start, item.end);
        if (item.hl) {
          const hl = item.hl;
          const swatch = HIGHLIGHT_SWATCHES[hl.color] || HIGHLIGHT_SWATCHES.amber;
          const isSpotlighted =
            spotlightTarget?.highlightId === hl.id ||
            (spotlightTarget?.searchText &&
              findTextSpanInParagraph(sliceText, spotlightTarget.searchText) !== null);
          nodes.push(
            <mark
              key={`${hl.id}-${idx}`}
              data-highlight-id={hl.id}
              data-jump-spotlight={isSpotlighted ? 'true' : undefined}
              onClick={(e) => {
                e.stopPropagation();
                openEditHighlightModal(hl);
              }}
              title="Click to edit highlight or margin note"
              className={`${swatch.markClass} cursor-pointer hover:ring-2 hover:ring-amber-500/60 transition-all ${
                isSpotlighted
                  ? 'ring-2 ring-amber-500 shadow-md animate-pulse rounded-xs'
                  : ''
              }`}
            >
              {sliceText}
              <span
                data-lumina-ui-badge="true"
                className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-sans font-semibold underline opacity-85 select-none"
              >
                <Edit3 className="w-3 h-3 inline" />
                {hl.note ? `Note: ${hl.note}` : 'Edit'}
              </span>
            </mark>
          );
        } else {
          nodes.push(
            <mark
              key={`spotlight-${idx}`}
              data-jump-spotlight="true"
              className="bg-amber-400/55 dark:bg-amber-500/40 text-inherit rounded-xs px-1 py-0.5 ring-2 ring-amber-500 shadow-sm"
            >
              {sliceText}
            </mark>
          );
        }
        cursor = item.end;
      });

      if (cursor < text.length) {
        nodes.push(decorateInlineFootnotes(text.slice(cursor), `tail-${paraIndex}`));
      }

      unmatchedParaHighlights.forEach((hl) => {
        const swatch = HIGHLIGHT_SWATCHES[hl.color] || HIGHLIGHT_SWATCHES.amber;
        const isSpotlighted = spotlightTarget?.highlightId === hl.id;
        nodes.push(
          <mark
            key={`para-hl-${hl.id}`}
            data-lumina-ui-badge="true"
            data-highlight-id={hl.id}
            data-jump-spotlight={isSpotlighted ? 'true' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              openEditHighlightModal(hl);
            }}
            title="Click to edit highlight or margin note"
            className={`ml-2 inline-block ${swatch.markClass} cursor-pointer text-xs px-2 py-0.5 rounded-md select-none ${
              isSpotlighted ? 'ring-2 ring-amber-500 shadow-md animate-pulse' : ''
            }`}
          >
            "{hl.selectedText}"
            <span
              data-lumina-ui-badge="true"
              className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-sans font-semibold underline opacity-85"
            >
              <Edit3 className="w-3 h-3 inline" />
              {hl.note ? `Note: ${hl.note}` : 'Edit'}
            </span>
          </mark>
        );
      });

      return <>{nodes}</>;
    }

    if (settings.liveWordWiseHints) {
      let hintsInPara = 0;
      return text.split(/(\s+)/).map((token, tIdx) => {
        if (/^\s+$/.test(token)) return token;
        const cleanTok = token.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
        if (cleanTok.length >= 4 && hintsInPara < 5) {
          const vocabMatch = vocabulary.find(
            (v) => v.word.toLowerCase() === cleanTok.toLowerCase()
          );
          const hint =
            (vocabMatch
              ? vocabMatch.definition.split(/[.;\n(]/)[0].slice(0, 42).trim()
              : null) || getQuickWordWiseHint(cleanTok);
          if (hint) {
            hintsInPara++;
            return (
              <ruby
                key={`ww-${paraIndex}-${tIdx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleWordLookup(cleanTok, text);
                }}
                title={`${cleanTok}: ${hint} (Click for full Word Wise card)`}
                className="cursor-pointer border-b border-dotted border-amber-500/75 hover:bg-amber-500/10 rounded-xs px-0.5 transition-colors"
              >
                {token}
                <rt
                  data-lumina-ui-badge="true"
                  className="text-[9px] font-sans font-medium text-amber-700 dark:text-amber-400 select-none tracking-normal px-0.5"
                >
                  {hint}
                </rt>
              </ruby>
            );
          }
        }
        return token;
      });
    }

    if (settings.bionicReading && !isRtlText(text)) {
      return text.split(/\s+/).map((word, wIdx) => {
        const mid = Math.ceil(word.length * 0.45);
        return (
          <React.Fragment key={wIdx}>
            <strong className="font-bold">{word.slice(0, mid)}</strong>
            {word.slice(mid)}{' '}
          </React.Fragment>
        );
      });
    }

    return decorateInlineFootnotes(text, `plain-${paraIndex}`);
  };

  const isBookRtl = isRtlText(activeBookMeta.title) || isRtlText(currentChapter.content);

  // Compute CSS transform for swipe + page-turn animation (Slide vs 3D Curl)
  const pageTransformStyle = useMemo(() => {
    if (swipeDeltaX) return `translateX(${swipeDeltaX}px)`;
    if (!pageTurnDirection || settings.pageTurnAnimation === 'instant') return undefined;
    if (settings.pageTurnAnimation === 'curl') {
      return pageTurnDirection === 'next'
        ? 'perspective(1200px) rotateY(-5deg) scale(0.99)'
        : 'perspective(1200px) rotateY(5deg) scale(0.99)';
    }
    return pageTurnDirection === 'next' ? 'translateX(-14px)' : 'translateX(14px)';
  }, [swipeDeltaX, pageTurnDirection, settings.pageTurnAnimation]);

  // Shared Drawer Content JSX (Rendered either inside click-outside overlay OR docked Split-Screen Study View)
  const renderDrawerPanel = () => (
    <aside
      onClick={(e) => e.stopPropagation()}
      className={`w-full sm:w-[400px] max-h-[82dvh] sm:max-h-none sm:h-full rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l shadow-2xl flex flex-col overflow-hidden shrink-0 ${palette.surfaceBg} ${palette.borderHairline} ${palette.textPrimary}`}
    >
      {/* Mobile Drag Handle + Sticky Drawer Header with Split-Screen Pin Toggle */}
      <div className="pt-2 sm:pt-0 px-5 py-3.5 border-b border-current/10 shrink-0">
        <div className="w-10 h-1 rounded-full bg-current/20 mx-auto mb-2.5 sm:hidden" />
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold truncate">
            {activeDrawer === 'toc' && 'Contents, Notes & Bookmarks'}
            {activeDrawer === 'search' && 'Search Inside Book'}
            {activeDrawer === 'xray' && 'Local X-Ray Entity Inventory'}
            {activeDrawer === 'companion' && 'Chapter Synthesis & Concordance'}
            {activeDrawer === 'typography' && 'Typography, Theme & Soundscape'}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsDrawerPinned((p) => !p)}
              className={`hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                isDrawerPinned
                  ? `${palette.accentBg} text-white border-transparent`
                  : `${palette.borderHairline}`
              }`}
              title="Pin Side-by-Side Split-Screen Study View (iPad / Desktop)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{isDrawerPinned ? 'Pinned' : 'Split View'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Close Drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Drawer Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6">
        {/* 0. In-Book & In-PDF Full-Text Search Drawer */}
        {activeDrawer === 'search' && (
          <div className="space-y-4 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="search"
                dir="auto"
                autoFocus
                value={inBookSearchQuery}
                onChange={(e) => setInBookSearchQuery(e.target.value)}
                placeholder="Search any word, phrase, or quote in this book..."
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border outline-none ${palette.elevatedBg} ${palette.borderHairline}`}
              />
            </div>

            {inBookSearchQuery.trim().length < 2 ? (
              <p className={`text-center py-8 ${palette.textMuted}`}>
                Type at least 2 characters to search across{' '}
                {activeBookMeta.format === 'pdf'
                  ? 'indexed PDF pages'
                  : `all ${chapters.length} chapters`}
                .
              </p>
            ) : inBookSearchResults.length === 0 ? (
              <p className={`text-center py-8 ${palette.textMuted}`}>
                No passages found matching "{inBookSearchQuery}".
              </p>
            ) : (
              <div className="space-y-2.5">
                <div className={`text-[11px] font-medium ${palette.textMuted}`}>
                  Found {inBookSearchResults.length} matching passages
                </div>
                {inBookSearchResults.map((hit, i) => (
                  <button
                    key={`${hit.chapterIndex}-${hit.paraIndex}-${hit.locationNumber}-${i}`}
                    type="button"
                    dir="auto"
                    onClick={() => {
                      if (hit.isPdfPage) {
                        updateActiveLocator(
                          {
                            pageIndex: hit.locationNumber,
                            locationNumber: hit.locationNumber,
                          },
                          true
                        );
                        setActiveJumpTarget({
                          pageIndex: hit.locationNumber,
                          locationNumber: hit.locationNumber,
                          searchText: inBookSearchQuery.trim(),
                        });
                      } else {
                        setActiveJumpTarget({
                          chapterIndex: hit.chapterIndex,
                          paragraphIndex: hit.paraIndex,
                          locationNumber: hit.locationNumber,
                          searchText: inBookSearchQuery.trim(),
                        });
                      }
                      if (!isDrawerPinned) setActiveDrawer('none');
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border space-y-1.5 transition-colors hover:border-amber-500/50 cursor-pointer ${palette.elevatedBg} ${palette.borderHairline}`}
                  >
                    <div className="flex items-center justify-between text-[11px] opacity-75">
                      <span className="font-semibold truncate">{hit.chapterTitle}</span>
                      <span className="tabular-nums shrink-0 text-amber-600 dark:text-amber-400 font-medium">
                        Open & Highlight
                      </span>
                    </div>
                    <p className="font-literata leading-relaxed line-clamp-3">{hit.snippet}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 1. TOC, Notes & Bookmarks Drawer */}
        {activeDrawer === 'toc' && (
          <div className="space-y-5">
            <div
              className={`grid grid-cols-3 gap-1 p-1 rounded-lg border text-xs ${palette.elevatedBg} ${palette.borderHairline}`}
            >
              <button
                type="button"
                onClick={() => setTocSubTab('chapters')}
                className={`py-1.5 rounded font-medium cursor-pointer ${
                  tocSubTab === 'chapters' ? `${palette.accentBg} text-white` : palette.textSecondary
                }`}
              >
                Chapters ({chapters.length})
              </button>
              <button
                type="button"
                onClick={() => setTocSubTab('notes')}
                className={`py-1.5 rounded font-medium cursor-pointer ${
                  tocSubTab === 'notes' ? `${palette.accentBg} text-white` : palette.textSecondary
                }`}
              >
                Notes ({bookHighlights.length})
              </button>
              <button
                type="button"
                onClick={() => setTocSubTab('bookmarks')}
                className={`py-1.5 rounded font-medium cursor-pointer ${
                  tocSubTab === 'bookmarks'
                    ? `${palette.accentBg} text-white`
                    : palette.textSecondary
                }`}
              >
                Bookmarks ({bookmarks.filter((b) => b.bookId === activeBookMeta.id).length})
              </button>
            </div>

            {tocSubTab === 'chapters' && (
              <div className="space-y-1.5">
                {chapters.map((ch, idx) => (
                  <button
                    key={ch.id || idx}
                    type="button"
                    dir="auto"
                    onClick={() => {
                      navigateToChapterAndPage(idx, 0, true);
                      if (!isDrawerPinned) setActiveDrawer('none');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer ${
                      idx === currentChapterIndex
                        ? `${palette.accentBg} text-white font-semibold`
                        : `hover:bg-black/5 dark:hover:bg-white/5 ${palette.textPrimary}`
                    }`}
                  >
                    <span className="truncate">{ch.title}</span>
                    <span className="tabular-nums opacity-75 shrink-0">Ch. {idx + 1}</span>
                  </button>
                ))}
              </div>
            )}

            {tocSubTab === 'notes' && (
              <div className="space-y-3">
                {bookHighlights.length === 0 ? (
                  <p className={`text-xs text-center py-6 ${palette.textMuted}`}>
                    Select any text in the book to highlight or attach an editable margin note.
                  </p>
                ) : (
                  bookHighlights.map((hl) => (
                    <div
                      key={hl.id}
                      dir="auto"
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${palette.elevatedBg} ${palette.borderHairline}`}
                    >
                      <div className="flex items-center justify-between text-[11px] opacity-75">
                        <span>
                          {activeBookMeta.format === 'pdf'
                            ? `Page ${hl.locationNumber}`
                            : `${hl.chapterTitle || `Ch. ${hl.chapterIndex + 1}`}${
                                typeof hl.pageIndex === 'number' ? ` · Pg ${hl.pageIndex + 1}` : ''
                              }`}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            HIGHLIGHT_SWATCHES[hl.color]?.dotClass || 'bg-amber-400'
                          }`}
                        />
                      </div>
                      <p className="font-literata italic leading-relaxed">"{hl.selectedText}"</p>
                      {hl.imageSnippetDataUrl && (
                        <img
                          src={hl.imageSnippetDataUrl}
                          alt="Cropped PDF Figure Excerpt"
                          onClick={() =>
                            setLightboxImage({
                              src: hl.imageSnippetDataUrl!,
                              caption: `${hl.bookTitle || 'PDF'} · Page ${hl.locationNumber} Excerpt`,
                            })
                          }
                          className="w-full max-h-28 object-contain rounded-lg border border-black/10 bg-white cursor-zoom-in"
                        />
                      )}
                      {hl.note && (
                        <div
                          className={`p-2 rounded border ${palette.surfaceBg} ${palette.borderHairline}`}
                        >
                          <strong>Note:</strong> {hl.note}
                        </div>
                      )}
                      {hl.tags && hl.tags.length > 0 && (
                        <div className={`text-[11px] ${palette.textMuted}`}>
                          {hl.tags.map((t) => `#${t}`).join(' · ')}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => openEditHighlightModal(hl)}
                            className={`inline-flex items-center gap-1 font-semibold underline cursor-pointer ${palette.accentText}`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{hl.note ? 'Edit' : 'Add Note'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setQuoteCardModalData({
                                quoteText: hl.selectedText,
                                chapterOrPageLabel:
                                  activeBookMeta.format === 'pdf'
                                    ? `Page ${hl.locationNumber}`
                                    : hl.chapterTitle || `Ch. ${hl.chapterIndex + 1}`,
                              })
                            }
                            className={`inline-flex items-center gap-1 cursor-pointer ${palette.textSecondary} hover:underline`}
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Quote Card</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeBookMeta.format === 'pdf') {
                              updateActiveLocator(
                                {
                                  pageIndex: hl.locationNumber,
                                  locationNumber: hl.locationNumber,
                                },
                                true
                              );
                              setActiveJumpTarget({
                                pageIndex: hl.locationNumber,
                                locationNumber: hl.locationNumber,
                                highlightId: hl.id,
                                searchText: hl.selectedText,
                              });
                            } else {
                              setActiveJumpTarget({
                                chapterIndex: hl.chapterIndex,
                                pageIndex: hl.pageIndex,
                                paragraphIndex: hl.paragraphIndex,
                                locationNumber: hl.locationNumber,
                                highlightId: hl.id,
                                searchText: hl.selectedText,
                              });
                            }
                            if (!isDrawerPinned) setActiveDrawer('none');
                          }}
                          className={`font-semibold underline cursor-pointer ${palette.accentText}`}
                        >
                          {activeBookMeta.format === 'pdf'
                            ? `Page ${hl.locationNumber}`
                            : 'View Passage'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tocSubTab === 'bookmarks' && (
              <div className="space-y-2.5">
                {bookmarks
                  .filter((b) => b.bookId === activeBookMeta.id)
                  .map((bm) => (
                    <button
                      key={bm.id}
                      type="button"
                      dir="auto"
                      onClick={() => {
                        navigateToChapterAndPage(bm.chapterIndex, bm.pageIndex, true);
                        if (!isDrawerPinned) setActiveDrawer('none');
                      }}
                      className={`w-full text-left p-3 rounded-lg border text-xs space-y-1 cursor-pointer ${palette.elevatedBg} ${palette.borderHairline}`}
                    >
                      <div className="font-semibold">{bm.label}</div>
                      <div className={`line-clamp-2 ${palette.textMuted}`}>"{bm.snippet}"</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Kindle-Style Local X-Ray Drawer */}
        {activeDrawer === 'xray' && activeBookContent?.xray && (
          <div className="space-y-4">
            <p className={`text-xs ${palette.textMuted}`}>
              100% deterministic local NLP extraction of recurring figures, domain concepts, themes, and aphorisms.
            </p>

            <div
              className={`grid grid-cols-4 gap-1 p-1 rounded-lg border ${palette.elevatedBg} ${palette.borderHairline}`}
            >
              {(['characters', 'terms', 'themes', 'passages'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setXrayTab(t)}
                  className={`py-1.5 text-[11px] font-medium rounded capitalize cursor-pointer ${
                    xrayTab === t ? `${palette.accentBg} text-white` : palette.textSecondary
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {xrayTab === 'passages' ? (
              <div className="space-y-3">
                {activeBookContent.xray.notablePassages.map((np, i) => (
                  <div
                    key={i}
                    dir="auto"
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${palette.elevatedBg} ${palette.borderHairline}`}
                  >
                    <p className="font-literata italic leading-relaxed">"{np.text}"</p>
                    <div className="flex items-center justify-between text-[11px] opacity-80 tabular-nums">
                      <span>{np.chapterTitle}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveJumpTarget({
                            chapterIndex: np.chapterIndex,
                            locationNumber: np.locationNumber,
                            searchText: np.text,
                          });
                          if (!isDrawerPinned) setActiveDrawer('none');
                        }}
                        className={`font-semibold underline cursor-pointer ${palette.accentText}`}
                      >
                        Open & Highlight Passage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(activeBookContent.xray[xrayTab] || []).map((entity) => (
                  <div
                    key={entity.id}
                    dir="auto"
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${palette.elevatedBg} ${palette.borderHairline}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold text-sm">{entity.name}</span>
                      <span className={`text-[11px] tabular-nums ${palette.textMuted}`}>
                        {entity.mentionsCount} mentions
                      </span>
                    </div>
                    <p className={palette.textSecondary}>{entity.roleOrDefinition}</p>
                    {entity.sampleQuote && (
                      <p className={`italic text-[11px] pt-1 ${palette.textMuted}`}>
                        "{entity.sampleQuote}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Chapter Synthesis & Concordance Q&A Drawer */}
        {activeDrawer === 'companion' && (
          <div className="space-y-5 text-xs">
            <div
              dir="auto"
              className={`p-4 rounded-xl border space-y-2 whitespace-pre-wrap leading-relaxed ${palette.elevatedBg} ${palette.borderHairline}`}
            >
              {chapterSummary ||
                summarizeChapterLocally(currentChapter.title, currentChapter.content)}
            </div>

            <form onSubmit={handleAskCompanion} className="space-y-2">
              <label className="block font-semibold">Ask Concordance / Passage Analyzer</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="auto"
                  value={companionQuestion}
                  onChange={(e) => setCompanionQuestion(e.target.value)}
                  placeholder="Search concepts or ask about this chapter..."
                  className={`flex-1 px-3 py-2 rounded-lg border outline-none ${palette.elevatedBg} ${palette.borderHairline}`}
                />
                <button
                  type="submit"
                  className={`px-3 py-2 rounded-lg font-semibold text-white cursor-pointer ${palette.accentBg}`}
                >
                  Analyze
                </button>
              </div>
            </form>

            {companionAnswer && (
              <div
                dir="auto"
                className={`p-4 rounded-xl border whitespace-pre-wrap leading-relaxed ${palette.elevatedBg} ${palette.borderHairline}`}
              >
                {companionAnswer}
              </div>
            )}
          </div>
        )}

        {/* 4. Typography, Themes, Custom Font Upload, Page-Turn Animation & Ambient Soundscapes Drawer */}
        {activeDrawer === 'typography' && (
          <div className="space-y-6 text-xs">
            <div className="space-y-2">
              <label className="font-semibold block">Calibrated Reading Theme</label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(READING_THEMES) as ReadingTheme[]).map((tKey) => {
                  const t = READING_THEMES[tKey];
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => updateSettings({ theme: tKey })}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                        settings.theme === tKey ? 'ring-2 ring-amber-600 font-semibold' : ''
                      } ${t.canvasBg} ${t.textPrimary} ${t.borderHairline}`}
                    >
                      <span>{t.name}</span>
                      <span className="text-[11px] opacity-70">{t.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold block">Book Typeface</label>
                <input
                  ref={customFontInputRef}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleCustomFontUpload(e.target.files[0]);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => customFontInputRef.current?.click()}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold underline cursor-pointer ${palette.accentText}`}
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload .TTF / .OTF</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FONT_FAMILY_CLASSES) as FontFamilyChoice[]).map((fKey) => (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        fontFamily: fKey,
                        dyslexiaFriendlyMode: fKey === 'dyslexic',
                      })
                    }
                    className={`px-3 py-2 rounded-lg border text-left cursor-pointer ${
                      settings.fontFamily === fKey
                        ? `${palette.accentBg} text-white font-semibold`
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    {FONT_FAMILY_CLASSES[fKey].label}
                  </button>
                ))}
                {settings.customFontName && (
                  <button
                    type="button"
                    onClick={() => updateSettings({ fontFamily: 'custom' })}
                    className={`px-3 py-2 rounded-lg border text-left cursor-pointer col-span-2 ${
                      settings.fontFamily === 'custom'
                        ? `${palette.accentBg} text-white font-semibold`
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    Custom Font: {settings.customFontName}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-semibold block">Pagination & Spread (Reflow & PDF)</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'single', label: 'Single Page' },
                    { id: 'double', label: '2-Page Spread' },
                    { id: 'scroll', label: 'Continuous' },
                  ] as { id: LayoutMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        layoutMode: m.id,
                        pdfSpreadMode: m.id === 'double' ? 'spread' : 'single',
                      })
                    }
                    className={`py-2 px-2 rounded-lg border text-center cursor-pointer ${
                      settings.layoutMode === m.id
                        ? `${palette.accentBg} text-white font-semibold`
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {settings.layoutMode === 'double' && viewportWidth < 680 && (
                <p className={`text-[11px] ${palette.textMuted}`}>
                  Rotate device to landscape or view on iPad / Tablet / Desktop (`≥680px`) for side-by-side 2-page spread.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold block">
                  Android / Notch Top Status Bar Clearance
                </label>
                <span className={`tabular-nums ${palette.textMuted}`}>{safeTopPx}px</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { val: 0, label: 'Auto' },
                  { val: 16, label: '16px' },
                  { val: 28, label: '28px (Android)' },
                  { val: 40, label: '40px (Cutout)' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => updateSettings({ safeAreaTopOffset: opt.val })}
                    className={`py-1.5 px-1.5 rounded-lg border text-[11px] text-center cursor-pointer ${
                      (settings.safeAreaTopOffset || 0) === opt.val
                        ? `${palette.accentBg} text-white font-semibold`
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-semibold block">Page-Turn Transition</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'slide', label: 'Smooth Slide' },
                    { id: 'curl', label: '3D Page Curl' },
                    { id: 'instant', label: 'Instant E-Ink' },
                  ] as { id: 'slide' | 'curl' | 'instant'; label: string }[]
                ).map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    onClick={() => updateSettings({ pageTurnAnimation: anim.id })}
                    className={`py-2 px-2 rounded-lg border text-center cursor-pointer ${
                      settings.pageTurnAnimation === anim.id
                        ? `${palette.accentBg} text-white font-semibold`
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    {anim.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between tabular-nums">
                <span className="font-semibold">Font Size</span>
                <span>{settings.fontSize}px</span>
              </div>
              <input
                type="range"
                min={14}
                max={30}
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-full accent-amber-600"
              />

              <div className="flex items-center justify-between tabular-nums">
                <span className="font-semibold">Line Spacing</span>
                <span>{settings.lineHeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={1.3}
                max={2.2}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })}
                className="w-full accent-amber-600"
              />

              <div className="flex items-center justify-between tabular-nums">
                <span className="font-semibold">Circadian Warmth Amber</span>
                <span>{settings.warmth}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={settings.warmth}
                onChange={(e) => updateSettings({ warmth: Number(e.target.value) })}
                className="w-full accent-amber-600"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-current/10">
              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="font-semibold">Live Word Wise Interlinear Hints</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.liveWordWiseHints)}
                  onChange={(e) => updateSettings({ liveWordWiseHints: e.target.checked })}
                  className="accent-amber-600"
                />
              </label>

              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="font-semibold">Bionic Reading Fixation</span>
                <input
                  type="checkbox"
                  checked={settings.bionicReading}
                  onChange={(e) => updateSettings({ bionicReading: e.target.checked })}
                  className="accent-amber-600"
                />
              </label>

              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="font-semibold">Dyslexia-Friendly Spacing Preset</span>
                <input
                  type="checkbox"
                  checked={settings.dyslexiaFriendlyMode}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettings({
                      dyslexiaFriendlyMode: enabled,
                      fontFamily: enabled ? 'dyslexic' : 'literata',
                      lineHeight: enabled ? 1.95 : 1.75,
                      letterSpacing: enabled ? 0.6 : 0,
                    });
                  }}
                  className="accent-amber-600"
                />
              </label>

              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="font-semibold">Auto-Night Theme Scheduling (19:00–06:00)</span>
                <input
                  type="checkbox"
                  checked={settings.autoNightMode}
                  onChange={(e) => updateSettings({ autoNightMode: e.target.checked })}
                  className="accent-amber-600"
                />
              </label>

              <label className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="font-semibold">Reading Ruler Focus Guide</span>
                <input
                  type="checkbox"
                  checked={settings.readingRuler}
                  onChange={(e) => updateSettings({ readingRuler: e.target.checked })}
                  className="accent-amber-600"
                />
              </label>

              {activeBookMeta.format === 'pdf' && (
                <>
                  <label className="flex items-center justify-between py-1.5 cursor-pointer">
                    <span className="font-semibold">Smart Dark / Sepia PDF Canvas Filter</span>
                    <input
                      type="checkbox"
                      checked={settings.pdfThemeFilter}
                      onChange={(e) => updateSettings({ pdfThemeFilter: e.target.checked })}
                      className="accent-amber-600"
                    />
                  </label>
                  <label className="flex items-center justify-between py-1.5 cursor-pointer">
                    <span className="font-semibold">Auto-Crop PDF Margin Whitespace</span>
                    <input
                      type="checkbox"
                      checked={settings.pdfAutoCropMargins}
                      onChange={(e) => updateSettings({ pdfAutoCropMargins: e.target.checked })}
                      className="accent-amber-600"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div
      onMouseMove={(e) => {
        if (settings.readingRuler) setRulerY(e.clientY);
      }}
      className={`fixed inset-0 h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-200 ${palette.canvasBg} ${palette.textPrimary}`}
    >
      {/* Circadian Warmth Overlay */}
      {settings.warmth > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 mix-blend-multiply transition-opacity"
          style={{
            backgroundColor: `rgba(245, 158, 11, ${(settings.warmth / 100) * 0.24})`,
          }}
        />
      )}

      {/* Reading Ruler Focus Guide */}
      {settings.readingRuler && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 right-0 z-30 border-y border-amber-500/40 bg-amber-500/10"
          style={{
            top: rulerY - settings.readingRulerHeight / 2,
            height: settings.readingRulerHeight,
          }}
        />
      )}

      {/* Top Reader Utility Bar (Protected from Android Notification Bar & Camera Cutouts) */}
      {!isZenMode ? (
        <header
          style={{
            paddingTop: `max(0.625rem, calc(env(safe-area-inset-top, 0px) + ${safeTopPx}px))`,
          }}
          className={`z-30 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 pb-2.5 sm:pb-3 border-b shrink-0 ${palette.canvasBg} ${palette.borderHairline}`}
        >
          {/* Far-Left Pinned Back to Library Button (Single Source of Truth, Minimum 40px Touch Hitbox) */}
          <button
            type="button"
            onClick={closeActiveBook}
            aria-label="Back to Library"
            className={`min-h-[40px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${palette.elevatedBg} ${palette.borderHairline} hover:border-amber-500/60`}
          >
            <ArrowLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Library</span>
          </button>

          {/* Center-Left Book Title (Truncates gracefully on narrow screens without affecting Back button) */}
          <div className="min-w-0 flex-1 hidden sm:block px-1" dir="auto">
            <h1 className="font-display text-xs sm:text-sm font-semibold truncate">
              {activeBookMeta.title}
            </h1>
            <p className={`text-[10px] sm:text-[11px] truncate ${palette.textMuted}`}>
              {activeBookMeta.author} · {currentChapter.title}
            </p>
          </div>

          {/* Right: Streamlined Reader Tool Actions (Zero Redundant Controls) */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto min-w-0 max-w-full py-0.5">
            {/* 2-Page Spread Switcher on Tablet/Desktop (Layout is also configurable inside Aa Display Settings) */}
            <button
              type="button"
              onClick={() => {
                const nextIsSpread = settings.layoutMode !== 'double';
                void updateSettings({
                  layoutMode: nextIsSpread ? 'double' : 'single',
                  pdfSpreadMode: nextIsSpread ? 'spread' : 'single',
                });
              }}
              className={`hidden md:inline-flex min-h-[36px] items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                settings.layoutMode === 'double'
                  ? `${palette.accentBg} text-white font-semibold`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Toggle 2-Page Side-by-Side Book Spread"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{settings.layoutMode === 'double' ? '2-Page Spread' : '1-Page'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer(activeDrawer === 'toc' ? 'none' : 'toc')}
              className={`min-h-[38px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'toc'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Contents, Notes & Bookmarks"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Contents</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer(activeDrawer === 'search' ? 'none' : 'search')}
              className={`min-h-[38px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'search'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Search Inside Book (/ or Cmd+F)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Search</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer(activeDrawer === 'xray' ? 'none' : 'xray')}
              className={`min-h-[38px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'xray'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Kindle-Style Local X-Ray"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">X-Ray</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = activeDrawer === 'companion' ? 'none' : 'companion';
                setActiveDrawer(next);
                if (next === 'companion' && !chapterSummary) {
                  handleGenerateChapterSynthesis();
                }
              }}
              className={`min-h-[38px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'companion'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Chapter Synthesis & Concordance Q&A"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Synthesis</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveDrawer(activeDrawer === 'typography' ? 'none' : 'typography')
              }
              className={`min-h-[38px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'typography'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Typography, Themes & Page Layout"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Aa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsTtsBarOpen((v) => !v);
              }}
              className={`min-h-[38px] min-w-[38px] sm:min-h-[36px] sm:min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${
                isTtsBarOpen || settings.soundscape !== 'none'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Read Aloud, Ambient Soundscapes & Sleep Timer"
            >
              <Headphones className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setRsvpWordIndex(0);
                setIsRsvpOpen(true);
              }}
              className={`min-h-[38px] min-w-[38px] sm:min-h-[36px] sm:min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${palette.surfaceBg} ${palette.textSecondary}`}
              title="RSVP Speed Reader"
            >
              <Zap className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                toggleBookmark({
                  bookId: activeBookMeta.id,
                  chapterIndex: currentChapterIndex,
                  pageIndex: currentPageIndex,
                  locationNumber: activeLocationNumber,
                  label: `${currentChapter.title} · Loc ${activeLocationNumber}`,
                  snippet: (currentPageParagraphs[0]?.text || '').slice(0, 110),
                })
              }
              className={`min-h-[38px] min-w-[38px] sm:min-h-[36px] sm:min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${
                isCurrentLocationBookmarked
                  ? 'text-amber-500 bg-amber-500/10'
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Bookmark Location"
            >
              <BookmarkIcon
                className={`w-4 h-4 ${isCurrentLocationBookmarked ? 'fill-current' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setIsGestureGuideOpen(true)}
              className={`min-h-[38px] min-w-[38px] sm:min-h-[36px] sm:min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${palette.surfaceBg} ${palette.textSecondary}`}
              title="Touch Gestures & Keyboard Shortcuts (?)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleZenMode}
              className={`min-h-[38px] min-w-[38px] sm:min-h-[36px] sm:min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${palette.surfaceBg} ${palette.textSecondary}`}
              title="Enter Distraction-Free Zen Mode (Z)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      ) : (
        /* Subtle Low-Contrast Zen Mode Exit Pill — Never overlaps Android Status Bar or Book Prose */
        <div
          style={{
            top: `max(0.625rem, calc(env(safe-area-inset-top, 0px) + ${safeTopPx}px))`,
          }}
          className="fixed right-3 z-50 flex items-center justify-end pointer-events-none"
        >
          <button
            type="button"
            onClick={toggleZenMode}
            title="Exit Zen Mode (Z or Esc)"
            className={`min-h-[34px] pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-xs opacity-45 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer ${palette.surfaceBg} ${palette.borderHairline} ${palette.textSecondary}`}
          >
            <Minimize2 className="w-3 h-3" />
            <span>Exit Zen</span>
          </button>
        </div>
      )}

      {/* Unified Audio Studio: Read-Aloud TTS, Procedural Soundscape & Sleep Timer Bar */}
      {isTtsBarOpen && (
        <div
          className={`z-30 px-3 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          {/* Read-Aloud Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const spreadParas = [
                  ...currentPageParagraphs,
                  ...(rightSpreadPageParagraphs || []),
                ].filter((p) => !p.text.startsWith('[IMAGE_DATA:'));
                ttsService.speakText(spreadParas.map((p) => p.text).join(' '));
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer text-white ${palette.accentBg}`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read Page Aloud</span>
            </button>
            <button
              type="button"
              onClick={() => ttsService.stop()}
              className={`px-2.5 py-1 rounded-lg border font-medium cursor-pointer ${palette.elevatedBg} ${palette.borderHairline}`}
            >
              Stop Voice
            </button>
          </div>

          {/* Ambient Soundscape Pills (Single Source of Truth) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Headphones className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className={`text-[11px] font-medium ${palette.textMuted}`}>Soundscape:</span>
            {(
              [
                { id: 'none', label: 'Off' },
                { id: 'rain', label: 'Rain' },
                { id: 'fireplace', label: 'Hearth' },
                { id: 'library', label: 'Archive' },
                { id: 'vinyl', label: 'Vinyl' },
                { id: 'brown_noise', label: 'Brown Noise' },
              ] as { id: SoundscapeType; label: string }[]
            ).map((snd) => (
              <button
                key={snd.id}
                type="button"
                onClick={() => updateSettings({ soundscape: snd.id })}
                className={`px-2 py-0.5 rounded-md border text-[11px] cursor-pointer transition-colors ${
                  settings.soundscape === snd.id
                    ? `${palette.accentBg} text-white font-semibold border-transparent`
                    : `${palette.elevatedBg} ${palette.borderHairline}`
                }`}
              >
                {snd.label}
              </button>
            ))}
          </div>

          {/* Sleep Timer & Dismiss */}
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 opacity-70" />
            <span className={`text-[11px] ${palette.textMuted}`}>Sleep:</span>
            {([15, 30, 45, 60] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() =>
                  setSleepTimerMinutesLeft((cur) => (cur === mins ? null : mins))
                }
                className={`px-2 py-0.5 rounded border text-[11px] tabular-nums cursor-pointer ${
                  sleepTimerMinutesLeft === mins
                    ? `${palette.accentBg} text-white border-transparent`
                    : palette.borderHairline
                }`}
              >
                {mins}m
              </button>
            ))}
            {sleepTimerMinutesLeft !== null && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                ({sleepTimerMinutesLeft}m)
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsTtsBarOpen(false)}
              className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
              title="Close Audio Studio"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Pinch / Trackpad Typography Scale HUD */}
      {fontScaleHud && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-stone-900/90 text-stone-100 text-xs font-semibold tracking-wide shadow-xl animate-in fade-in duration-150">
          {fontScaleHud}
        </div>
      )}

      {/* Floating Selection Action Bar (Engineered so Android Native System Popup Never Blocks Options) */}
      {selectedText && (
        <div
          ref={selectionBarRef}
          style={
            settings.selectionBarPosition === 'top'
              ? {
                  top: `max(3.75rem, calc(env(safe-area-inset-top, 0px) + ${safeTopPx + 52}px))`,
                }
              : {
                  bottom: `max(4rem, calc(env(safe-area-inset-bottom, 0px) + 3.75rem))`,
                }
          }
          className={`fixed left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-xl rounded-2xl border p-3.5 shadow-2xl space-y-2.5 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          {/* Selected Passage Preview + Cropped PDF Figure Snippet Preview + Position Switcher */}
          <div
            dir="auto"
            className={`text-xs font-literata italic px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2.5 ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {selectedPdfImageSnippet && (
                <img
                  src={selectedPdfImageSnippet}
                  alt="PDF Figure Snippet"
                  className="w-12 h-10 object-contain rounded border border-black/10 bg-white shrink-0"
                />
              )}
              <span className="line-clamp-2">"{selectedText}"</span>
            </div>

            <div className="flex items-center gap-1 shrink-0 font-sans not-italic">
              {activeBookMeta.format !== 'pdf' &&
                currentChapter.paragraphs[selectedParaIdx] &&
                selectedText.length < currentChapter.paragraphs[selectedParaIdx].length && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const rawPara = currentChapter.paragraphs[selectedParaIdx] || '';
                        const fallbackSpan = findTextSpanInParagraph(rawPara, selectedText);
                        const curStart =
                          selectedCharRange && selectedCharRange.paraIndex === selectedParaIdx
                            ? selectedCharRange.start
                            : fallbackSpan
                            ? fallbackSpan.start
                            : 0;
                        const curEnd =
                          selectedCharRange && selectedCharRange.paraIndex === selectedParaIdx
                            ? selectedCharRange.end
                            : fallbackSpan
                            ? fallbackSpan.end
                            : curStart + selectedText.length;

                        const after = rawPara.slice(curEnd);
                        const nextWordsMatch = after.match(/^(\s*\S+){1,4}/);
                        const newEnd = curEnd + (nextWordsMatch ? nextWordsMatch[0].length : 0);
                        const expanded = cleanExtractedText(rawPara.slice(curStart, newEnd));
                        if (expanded) {
                          setSelectedCharRange({
                            paraIndex: selectedParaIdx,
                            start: curStart,
                            end: newEnd,
                          });
                          if (touchSelectionAnchorRef.current) {
                            touchSelectionAnchorRef.current.isSingleWord = false;
                          }
                          setSelectedText(expanded);
                        }
                        window.getSelection()?.removeAllRanges();
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${palette.borderHairline}`}
                      title="Extend selection by 4 words (No handles needed)"
                    >
                      +Words
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const rawPara = currentChapter.paragraphs[selectedParaIdx] || '';
                        const fallbackSpan = findTextSpanInParagraph(rawPara, selectedText);
                        const curStart =
                          selectedCharRange && selectedCharRange.paraIndex === selectedParaIdx
                            ? selectedCharRange.start
                            : fallbackSpan
                            ? fallbackSpan.start
                            : 0;
                        let sentStart = curStart;
                        while (sentStart > 0 && !/[.!?]/.test(rawPara[sentStart - 1])) {
                          sentStart--;
                        }
                        while (sentStart < curStart && /\s/.test(rawPara[sentStart])) {
                          sentStart++;
                        }
                        let sentEnd =
                          selectedCharRange && selectedCharRange.paraIndex === selectedParaIdx
                            ? selectedCharRange.end
                            : fallbackSpan
                            ? fallbackSpan.end
                            : curStart + selectedText.length;
                        while (sentEnd < rawPara.length && !/[.!?]/.test(rawPara[sentEnd])) {
                          sentEnd++;
                        }
                        if (sentEnd < rawPara.length && /[.!?]/.test(rawPara[sentEnd])) {
                          sentEnd++;
                        }
                        const expanded = cleanExtractedText(rawPara.slice(sentStart, sentEnd));
                        if (expanded) {
                          setSelectedCharRange({
                            paraIndex: selectedParaIdx,
                            start: sentStart,
                            end: sentEnd,
                          });
                          if (touchSelectionAnchorRef.current) {
                            touchSelectionAnchorRef.current.isSingleWord = false;
                          }
                          setSelectedText(expanded);
                        }
                        window.getSelection()?.removeAllRanges();
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${palette.borderHairline}`}
                      title="Expand to Complete Sentence"
                    >
                      Sentence
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const rawPara = currentChapter.paragraphs[selectedParaIdx] || '';
                        const fullPara = cleanExtractedText(rawPara);
                        if (fullPara) {
                          setSelectedCharRange({
                            paraIndex: selectedParaIdx,
                            start: 0,
                            end: rawPara.length,
                          });
                          if (touchSelectionAnchorRef.current) {
                            touchSelectionAnchorRef.current.isSingleWord = false;
                          }
                          setSelectedText(fullPara);
                        }
                        window.getSelection()?.removeAllRanges();
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${palette.borderHairline}`}
                      title="Select Full Paragraph"
                    >
                      Full Para
                    </button>
                  </>
                )}

              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    selectionBarPosition:
                      settings.selectionBarPosition === 'top' ? 'bottom' : 'top',
                  })
                }
                className={`p-1 rounded border cursor-pointer ${palette.borderHairline}`}
                title="Move Selection Toolbar Top / Bottom"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* 5 Curatorial Highlight Swatches */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${palette.textMuted}`}>Highlight:</span>
              {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleCreateHighlight(color)}
                  className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full cursor-pointer transition-transform hover:scale-110 ${HIGHLIGHT_SWATCHES[color].dotClass}`}
                  title={HIGHLIGHT_SWATCHES[color].label}
                />
              ))}
            </div>

            {/* Copy, Margin Note, Quote Card, Word Wise & Close */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selectedText);
                    setCopiedSelectionFeedback(true);
                    window.setTimeout(() => setCopiedSelectionFeedback(false), 1400);
                  } catch {
                    // ignore clipboard permission fallback
                  }
                }}
                className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
                title="Copy Selected Text"
              >
                {copiedSelectionFeedback ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSelectionFeedback ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNoteInput((v) => !v)}
                className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Note</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setQuoteCardModalData({
                    quoteText: selectedText,
                    chapterOrPageLabel:
                      activeBookMeta.format === 'pdf'
                        ? `Page ${selectedPdfPage || activeBookMeta.locator?.locationNumber || 1}`
                        : `${currentChapter.title} · Loc ${activeLocationNumber}`,
                  })
                }
                className={`min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
                title="Create Shareable Quote Card"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Quote</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const firstWord = selectedText.trim().split(/\s+/)[0];
                  handleWordLookup(firstWord, selectedText);
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-md text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                Word Wise
              </button>

              <button
                type="button"
                onClick={() => {
                  touchSelectionAnchorRef.current = null;
                  setSelectedCharRange(null);
                  setSelectedText('');
                  setSelectedPdfRects(undefined);
                  setShowNoteInput(false);
                  window.getSelection()?.removeAllRanges();
                }}
                className={`min-h-[34px] min-w-[34px] inline-flex items-center justify-center p-1 cursor-pointer ${palette.textMuted}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showNoteInput && (
            <div className="flex items-center gap-2 pt-2 border-t border-current/10">
              <input
                type="text"
                dir="auto"
                value={marginNoteDraft}
                onChange={(e) => setMarginNoteDraft(e.target.value)}
                placeholder="Write a margin annotation for this passage..."
                autoFocus
                className={`flex-1 text-xs px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
              />
              <button
                type="button"
                onClick={() => handleCreateHighlight('amber', marginNoteDraft)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0 ${palette.accentBg}`}
              >
                Save Note
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Reader Content Viewport (Supports Docked Side-by-Side Split-Screen Study View on iPad/Desktop) */}
      <div
        style={
          isZenMode
            ? {
                paddingTop: `max(2.5rem, calc(env(safe-area-inset-top, 0px) + ${
                  Math.max(safeTopPx, 32) + 8
                }px))`,
              }
            : undefined
        }
        className="flex-1 flex relative overflow-hidden"
      >
        {activeBookMeta.format === 'pdf' ? (
          <div className="w-full h-full flex-1 overflow-hidden">
            <VirtualizedPdfEngine
              book={activeBookMeta}
              hasActiveSelection={Boolean(selectedText)}
              onSelectText={(text, pageNum, rects, imageSnippetDataUrl) => {
                setSelectedText(cleanExtractedText(text));
                setSelectedPdfPage(pageNum);
                setSelectedPdfRects(rects);
                setSelectedPdfImageSnippet(imageSnippetDataUrl);
              }}
              onWordLookup={handleWordLookup}
              onEditHighlight={openEditHighlightModal}
              onToggleImmersion={toggleZenMode}
              onOpenTypographyDrawer={() =>
                setActiveDrawer((d) => (d === 'typography' ? 'none' : 'typography'))
              }
            />
          </div>
        ) : (
          /* Reflowable Reader Viewport with Geometric Touch Selection Engine */
          <main
            ref={mainReaderRef}
            onContextMenu={(e) => {
              // Suppress Android / iOS native floating ActionMode / "Ask AI" contextmenu so Lumina's Selection Bar is never covered
              e.preventDefault();
            }}
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1 : -1;
                const nextFont = Math.min(30, Math.max(14, (settings.fontSize || 19) + delta));
                if (nextFont !== settings.fontSize) {
                  updateSettings({ fontSize: nextFont });
                  triggerFontScaleHud(nextFont);
                }
              }
            }}
            onTouchStart={(e) => {
              isTouchActiveRef.current = true;
              if (longPressTimerRef.current) {
                window.clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (e.touches.length === 2) {
                isTouchSelectingRef.current = false;
                setIsTouchSelecting(false);
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                touchGestureRef.current = {
                  startX: 0,
                  startY: 0,
                  startTime: Date.now(),
                  isPinch: true,
                  initialPinchDist: Math.hypot(dx, dy),
                  initialFontSize: settings.fontSize || 19,
                };
              } else if (e.touches.length === 1) {
                const startX = e.touches[0].clientX;
                const startY = e.touches[0].clientY;
                touchGestureRef.current = {
                  startX,
                  startY,
                  startTime: Date.now(),
                  isPinch: false,
                  initialPinchDist: 0,
                  initialFontSize: settings.fontSize || 19,
                  isLeftEdgeWarmthSwipe: startX <= 28,
                  initialWarmth: settings.warmth || 0,
                };

                // Start 210ms Geometric Hold-and-Drag Word Selection Timer (Faster than Android OS 450ms long-press)
                const targetEl = e.target as HTMLElement;
                const paraEl = targetEl?.closest?.('p[data-para-index]') as HTMLElement | null;
                if (
                  paraEl &&
                  !targetEl.closest('mark, button, a, input, textarea, figure') &&
                  startX > 28
                ) {
                  const pIdx = Number(paraEl.getAttribute('data-para-index'));
                  const sliceOffset = Number(paraEl.getAttribute('data-slice-offset')) || 0;
                  longPressTimerRef.current = window.setTimeout(() => {
                    longPressTimerRef.current = null;
                    const hit = findWordAtPointInParagraph(paraEl, startX, startY);
                    if (hit && Number.isFinite(pIdx)) {
                      const absStart = hit.startChar + sliceOffset;
                      const absEnd = hit.endChar + sliceOffset;
                      const fullParaText = currentChapter.paragraphs[pIdx] || hit.fullText;
                      isTouchSelectingRef.current = true;
                      setIsTouchSelecting(true);
                      touchSelectionAnchorRef.current = {
                        paraIndex: pIdx,
                        startChar: absStart,
                        endChar: absEnd,
                        fullText: fullParaText,
                        isSingleWord: true,
                      };
                      setSelectedParaIdx(pIdx);
                      setSelectedCharRange({
                        paraIndex: pIdx,
                        start: absStart,
                        end: absEnd,
                      });
                      setSelectedText(hit.word);
                      try {
                        navigator.vibrate?.(10);
                      } catch {
                        // ignore
                      }
                    }
                  }, 210);
                }
              }
            }}
            onTouchMove={(e) => {
              const g = touchGestureRef.current;
              if (!g) return;

              if (e.touches.length === 1) {
                const moveDist = Math.hypot(
                  e.touches[0].clientX - g.startX,
                  e.touches[0].clientY - g.startY
                );
                if (moveDist > 10) {
                  lastTouchMoveTimeRef.current = Date.now();
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }
              }

              // Live 60fps Word-by-Word Hold-and-Drag Selection on Touch Devices
              if (
                isTouchSelectingRef.current &&
                touchSelectionAnchorRef.current &&
                e.touches.length === 1
              ) {
                const anchor = touchSelectionAnchorRef.current;
                const paraEl = document.querySelector(
                  `p[data-para-index="${anchor.paraIndex}"]`
                ) as HTMLElement | null;
                if (paraEl) {
                  const sliceOffset = Number(paraEl.getAttribute('data-slice-offset')) || 0;
                  const curHit = findWordAtPointInParagraph(
                    paraEl,
                    e.touches[0].clientX,
                    e.touches[0].clientY
                  );
                  if (curHit) {
                    const curAbsStart = curHit.startChar + sliceOffset;
                    const curAbsEnd = curHit.endChar + sliceOffset;
                    const rangeStart = Math.min(anchor.startChar, curAbsStart);
                    const rangeEnd = Math.max(anchor.endChar, curAbsEnd);
                    anchor.isSingleWord =
                      rangeStart === anchor.startChar && rangeEnd === anchor.endChar;
                    setSelectedCharRange({
                      paraIndex: anchor.paraIndex,
                      start: rangeStart,
                      end: rangeEnd,
                    });
                    const slice = cleanExtractedText(anchor.fullText.slice(rangeStart, rangeEnd));
                    if (slice) setSelectedText(slice);
                  }
                }
                return;
              }

              if (g.isPinch && e.touches.length === 2 && g.initialPinchDist > 20) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const ratio = dist / g.initialPinchDist;
                const nextFont = Math.min(
                  30,
                  Math.max(14, Math.round(g.initialFontSize * ratio))
                );
                if (nextFont !== settings.fontSize) {
                  updateSettings({ fontSize: nextFont });
                  triggerFontScaleHud(nextFont);
                }
                return;
              }

              // Vertical Left-Edge Circadian Warmth / Brightness Swipe Gesture (Mobile & Tablet)
              if (
                !g.isPinch &&
                g.isLeftEdgeWarmthSwipe &&
                e.touches.length === 1 &&
                !window.getSelection()?.toString()
              ) {
                const dy = g.startY - e.touches[0].clientY;
                const dx = Math.abs(e.touches[0].clientX - g.startX);
                if (Math.abs(dy) > 18 && Math.abs(dy) > dx * 1.4) {
                  const deltaWarmth = Math.round(dy / 3.5);
                  const nextWarmth = Math.min(
                    80,
                    Math.max(0, (g.initialWarmth ?? 0) + deltaWarmth)
                  );
                  if (nextWarmth !== settings.warmth) {
                    updateSettings({ warmth: nextWarmth });
                    triggerCustomHud(`Circadian Warmth · ${nextWarmth}%`);
                  }
                  return;
                }
              }

              if (
                !g.isPinch &&
                e.touches.length === 1 &&
                settings.layoutMode !== 'scroll' &&
                !window.getSelection()?.toString()
              ) {
                const dx = e.touches[0].clientX - g.startX;
                const dy = e.touches[0].clientY - g.startY;
                if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.35) {
                  const damped = Math.max(-96, Math.min(96, dx * 0.42));
                  setSwipeDeltaX(damped);
                }
              }
            }}
            onTouchEnd={(e) => {
              isTouchActiveRef.current = false;
              if (longPressTimerRef.current) {
                window.clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (isTouchSelectingRef.current) {
                isTouchSelectingRef.current = false;
                setIsTouchSelecting(false);
                justFinishedTouchSelectRef.current = Date.now();
                touchGestureRef.current = null;
                setSwipeDeltaX(0);
                return;
              }

              const g = touchGestureRef.current;
              touchGestureRef.current = null;
              setSwipeDeltaX(0);

              if (g && !g.isPinch && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - g.startX;
                const dy = e.changedTouches[0].clientY - g.startY;
                const activeSel = window.getSelection()?.toString().trim() || '';

                if (
                  !activeSel &&
                  settings.layoutMode !== 'scroll' &&
                  Math.abs(dx) > 54 &&
                  Math.abs(dx) > Math.abs(dy) * 1.35
                ) {
                  lastTouchMoveTimeRef.current = Date.now();
                  if (dx < 0) {
                    if (isBookRtl) handlePrevPage();
                    else handleNextPage();
                  } else {
                    if (isBookRtl) handleNextPage();
                    else handlePrevPage();
                  }
                  return;
                }
              }
            }}
            onTouchCancel={() => {
              isTouchActiveRef.current = false;
              if (longPressTimerRef.current) {
                window.clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (isTouchSelectingRef.current) {
                isTouchSelectingRef.current = false;
                setIsTouchSelecting(false);
                justFinishedTouchSelectRef.current = Date.now();
              }
              touchGestureRef.current = null;
              setSwipeDeltaX(0);
              try {
                window.getSelection()?.removeAllRanges();
              } catch {
                // ignore
              }
            }}
            onMouseUp={() => {
              if (Date.now() - justFinishedTouchSelectRef.current < 450) return;
              const selection = window.getSelection();
              const sel = cleanExtractedText(selection?.toString() || '');
              if (sel.length > 1 && selection && selection.rangeCount > 0) {
                justFinishedTouchSelectRef.current = Date.now();
                const domRange = selection.getRangeAt(0);
                const anchorEl =
                  domRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
                    ? (domRange.commonAncestorContainer as HTMLElement)
                    : domRange.commonAncestorContainer.parentElement;
                const paraEl = anchorEl?.closest?.('p[data-para-index]') as HTMLElement | null;
                if (paraEl) {
                  const pIdx = Number(paraEl.getAttribute('data-para-index'));
                  const sliceOffset = Number(paraEl.getAttribute('data-slice-offset')) || 0;
                  const exactOffsets = computeDomRangeOffsetsInParagraph(paraEl, domRange);
                  if (Number.isFinite(pIdx)) {
                    setSelectedParaIdx(pIdx);
                    if (exactOffsets) {
                      setSelectedCharRange({
                        paraIndex: pIdx,
                        start: exactOffsets.start + sliceOffset,
                        end: exactOffsets.end + sliceOffset,
                      });
                    }
                  }
                }
                setSelectedText(sel);
              }
            }}
            onClick={(e) => {
              if (
                Date.now() - justFinishedTouchSelectRef.current < 400 ||
                Date.now() - lastTouchMoveTimeRef.current < 400
              ) {
                return;
              }

              if (activeDrawer !== 'none' && !isDrawerPinned) {
                setActiveDrawer('none');
                return;
              }
              const target = e.target as HTMLElement;
              if (target.closest('mark, button, a, input, textarea, figure')) return;

              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / Math.max(1, rect.width);

              // Center reading zone (16%..84%): Support Tap-a-Word & Two-Tap Range Selection on Touch & Desktop
              if (relX >= 0.16 && relX <= 0.84) {
                const paraEl = target.closest?.('p[data-para-index]') as HTMLElement | null;
                const activeNativeSel = cleanExtractedText(
                  window.getSelection()?.toString() || ''
                );

                if (paraEl && !isTtsBarOpen && activeNativeSel.length <= 1) {
                  const pIdx = Number(paraEl.getAttribute('data-para-index'));
                  const sliceOffset = Number(paraEl.getAttribute('data-slice-offset')) || 0;
                  const hit = findWordAtPointInParagraph(paraEl, e.clientX, e.clientY);
                  const prevAnchor = touchSelectionAnchorRef.current;

                  if (hit && Number.isFinite(pIdx)) {
                    const absStart = hit.startChar + sliceOffset;
                    const absEnd = hit.endChar + sliceOffset;
                    const fullParaText = currentChapter.paragraphs[pIdx] || hit.fullText;

                    // Two-Tap Range Selection: Tap 1 anchored a single word, Tap 2 expands to full phrase between Word 1 and Word 2
                    if (
                      selectedText &&
                      prevAnchor &&
                      prevAnchor.paraIndex === pIdx &&
                      prevAnchor.isSingleWord &&
                      absStart !== prevAnchor.startChar
                    ) {
                      const rangeStart = Math.min(prevAnchor.startChar, absStart);
                      const rangeEnd = Math.max(prevAnchor.endChar, absEnd);
                      touchSelectionAnchorRef.current = {
                        ...prevAnchor,
                        fullText: fullParaText,
                        isSingleWord: false,
                      };
                      setSelectedParaIdx(pIdx);
                      setSelectedCharRange({
                        paraIndex: pIdx,
                        start: rangeStart,
                        end: rangeEnd,
                      });
                      setSelectedText(cleanExtractedText(fullParaText.slice(rangeStart, rangeEnd)));
                      return;
                    }

                    // If selection was already active (same word tapped again, or a multi-word range was active), clear selection
                    if (selectedText) {
                      touchSelectionAnchorRef.current = null;
                      setSelectedCharRange(null);
                      setSelectedText('');
                      setShowNoteInput(false);
                      return;
                    }

                    // Tap 1 on a word: Select word & set anchor for optional Tap 2 range expansion
                    touchSelectionAnchorRef.current = {
                      paraIndex: pIdx,
                      startChar: absStart,
                      endChar: absEnd,
                      fullText: fullParaText,
                      isSingleWord: true,
                    };
                    setSelectedParaIdx(pIdx);
                    setSelectedCharRange({
                      paraIndex: pIdx,
                      start: absStart,
                      end: absEnd,
                    });
                    setSelectedText(hit.word);
                    return;
                  }
                }

                if (selectedText && !window.getSelection()?.toString().trim()) {
                  touchSelectionAnchorRef.current = null;
                  setSelectedCharRange(null);
                  setSelectedText('');
                  setShowNoteInput(false);
                }
                return;
              }

              if (selectedText) {
                touchSelectionAnchorRef.current = null;
                setSelectedCharRange(null);
                setSelectedText('');
                setShowNoteInput(false);
                return;
              }

              if (settings.layoutMode !== 'scroll' && relX < 0.16) {
                if (isBookRtl) handleNextPage();
                else handlePrevPage();
              } else if (settings.layoutMode !== 'scroll' && relX > 0.84) {
                if (isBookRtl) handlePrevPage();
                else handleNextPage();
              }
            }}
            style={{
              touchAction: isTouchSelecting ? 'none' : 'pan-y',
            }}
            className="lumina-reader-surface flex-1 h-full overflow-y-auto px-3 sm:px-6 lg:px-10 py-5 sm:py-8 flex flex-col items-center select-text"
          >
            <div
              dir={isBookRtl ? 'rtl' : 'auto'}
              className="w-full transition-all duration-200 ease-out"
              style={{
                maxWidth: isTwoPageSpreadActive ? '1220px' : '720px',
                paddingLeft: `${Math.min(32, Math.max(8, Math.round(settings.marginWidth * 0.45)))}px`,
                paddingRight: `${Math.min(32, Math.max(8, Math.round(settings.marginWidth * 0.45)))}px`,
                transform: pageTransformStyle,
              }}
            >
              {isTwoPageSpreadActive ? (
                /* True Side-by-Side 2-Page Book Spread for iPad (Portrait & Landscape), Tablets & Desktop */
                <div
                  className={`grid grid-cols-2 rounded-2xl border shadow-xl overflow-hidden ${palette.elevatedBg} ${palette.borderHairline}`}
                >
                  {/* Left Page Leaf (Page N) */}
                  <div className="p-3.5 sm:p-7 lg:p-10 flex flex-col justify-between min-h-[68dvh]">
                    <div>
                      <div
                        className={`flex items-center justify-between text-[11px] uppercase tracking-widest pb-3 mb-5 border-b ${palette.borderHairline} ${palette.textMuted}`}
                      >
                        <span className="truncate max-w-[75%]">
                          Ch. {currentChapterIndex + 1} · {currentChapter.title}
                        </span>
                        <span className="tabular-nums font-semibold shrink-0">
                          Page {currentPageIndex + 1}
                        </span>
                      </div>

                      {currentPageIndex === 0 && (
                        <h2
                          dir="auto"
                          className="font-display text-lg sm:text-xl lg:text-2xl font-semibold mb-4"
                        >
                          {currentChapter.title}
                        </h2>
                      )}

                      <div
                        className={`${fontClass} space-y-4 sm:space-y-5`}
                        style={{
                          fontFamily:
                            settings.fontFamily === 'custom' && settings.customFontDataUrl
                              ? "'LuminaCustomUploadedFont', serif"
                              : undefined,
                          fontSize: `${effectiveSpreadFontSize}px`,
                          lineHeight: settings.lineHeight,
                          letterSpacing: isBookRtl ? '0px' : `${settings.letterSpacing}px`,
                          textAlign: isBookRtl ? 'right' : settings.textAlign,
                        }}
                      >
                        {currentPageParagraphs.map(
                          ({ text, paraIndex, sliceStartOffset = 0 }, idx) => {
                            if (text.startsWith('[IMAGE_DATA:')) {
                              const inner = text.slice('[IMAGE_DATA:'.length, -1);
                              const pipeIdx = inner.indexOf('|');
                              const dataUrl = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner;
                              const caption =
                                pipeIdx !== -1
                                  ? inner.slice(pipeIdx + 1)
                                  : 'Embedded Archival Figure';
                              return (
                                <figure
                                  key={`${paraIndex}-${sliceStartOffset}`}
                                  data-para-index={paraIndex}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage({ src: dataUrl, caption });
                                  }}
                                  className={`my-4 p-3 rounded-xl border text-center space-y-2 cursor-zoom-in ${palette.surfaceBg} ${palette.borderHairline}`}
                                >
                                  <img
                                    src={dataUrl}
                                    alt={caption}
                                    className="max-h-64 mx-auto object-contain rounded-lg"
                                  />
                                  <figcaption className={`text-xs font-sans ${palette.textMuted}`}>
                                    {caption}
                                  </figcaption>
                                </figure>
                              );
                            }
                            const paraRtl = isRtlText(text);
                            return (
                              <p
                                key={`${paraIndex}-${sliceStartOffset}`}
                                data-para-index={paraIndex}
                                data-slice-offset={sliceStartOffset}
                                dir={paraRtl ? 'rtl' : 'auto'}
                                onMouseUp={() => setSelectedParaIdx(paraIndex)}
                                onTouchEnd={() => setSelectedParaIdx(paraIndex)}
                                onClick={(e) => {
                                  if (isTtsBarOpen && !window.getSelection()?.toString().trim()) {
                                    e.stopPropagation();
                                    ttsService.speakText(text);
                                  }
                                }}
                                onDoubleClick={() => {
                                  const sel = window.getSelection()?.toString().trim();
                                  if (sel) handleWordLookup(sel, text);
                                }}
                                className={`leading-relaxed ${
                                  !paraRtl &&
                                  idx === 0 &&
                                  currentPageIndex === 0 &&
                                  sliceStartOffset === 0
                                    ? 'first-letter:font-display first-letter:text-4xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:leading-none'
                                    : ''
                                } ${
                                  ttsSentence && text.includes(ttsSentence)
                                    ? 'bg-amber-500/15 rounded px-1'
                                    : ''
                                }`}
                              >
                                {renderParagraphContent(text, paraIndex, sliceStartOffset)}
                              </p>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div
                      className={`pt-4 mt-6 border-t flex items-center justify-between text-[11px] tabular-nums ${palette.borderHairline} ${palette.textMuted}`}
                    >
                      <span>Loc {activeLocationNumber}</span>
                      <span>
                        Page {currentPageIndex + 1} of {totalPagesInChapter}
                      </span>
                    </div>
                  </div>

                  {/* Right Page Leaf (Page N + 1) with Realistic Center Book Spine Crease */}
                  <div
                    className={`p-3.5 sm:p-7 lg:p-10 flex flex-col justify-between min-h-[68dvh] border-l relative ${palette.borderHairline}`}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/[0.06] to-transparent"
                    />
                    <div>
                      <div
                        className={`flex items-center justify-between text-[11px] uppercase tracking-widest pb-3 mb-5 border-b ${palette.borderHairline} ${palette.textMuted}`}
                      >
                        <span className="truncate max-w-[75%]">{activeBookMeta.title}</span>
                        <span className="tabular-nums font-semibold shrink-0">
                          {rightSpreadPageParagraphs
                            ? `Page ${currentPageIndex + 2}`
                            : 'End of Chapter'}
                        </span>
                      </div>

                      {rightSpreadPageParagraphs ? (
                        <div
                          className={`${fontClass} space-y-4 sm:space-y-5`}
                          style={{
                            fontFamily:
                              settings.fontFamily === 'custom' && settings.customFontDataUrl
                                ? "'LuminaCustomUploadedFont', serif"
                                : undefined,
                            fontSize: `${effectiveSpreadFontSize}px`,
                            lineHeight: settings.lineHeight,
                            letterSpacing: isBookRtl ? '0px' : `${settings.letterSpacing}px`,
                            textAlign: isBookRtl ? 'right' : settings.textAlign,
                          }}
                        >
                          {rightSpreadPageParagraphs.map(
                            ({ text, paraIndex, sliceStartOffset = 0 }) => {
                              if (text.startsWith('[IMAGE_DATA:')) {
                                const inner = text.slice('[IMAGE_DATA:'.length, -1);
                                const pipeIdx = inner.indexOf('|');
                                const dataUrl = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner;
                                const caption =
                                  pipeIdx !== -1
                                    ? inner.slice(pipeIdx + 1)
                                    : 'Embedded Archival Figure';
                                return (
                                  <figure
                                    key={`${paraIndex}-${sliceStartOffset}`}
                                    data-para-index={paraIndex}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightboxImage({ src: dataUrl, caption });
                                    }}
                                    className={`my-4 p-3 rounded-xl border text-center space-y-2 cursor-zoom-in ${palette.surfaceBg} ${palette.borderHairline}`}
                                  >
                                    <img
                                      src={dataUrl}
                                      alt={caption}
                                      className="max-h-64 mx-auto object-contain rounded-lg"
                                    />
                                    <figcaption className={`text-xs font-sans ${palette.textMuted}`}>
                                      {caption}
                                    </figcaption>
                                  </figure>
                                );
                              }
                              const paraRtl = isRtlText(text);
                              return (
                                <p
                                  key={`${paraIndex}-${sliceStartOffset}`}
                                  data-para-index={paraIndex}
                                  data-slice-offset={sliceStartOffset}
                                  dir={paraRtl ? 'rtl' : 'auto'}
                                  onMouseUp={() => setSelectedParaIdx(paraIndex)}
                                  onTouchEnd={() => setSelectedParaIdx(paraIndex)}
                                  onClick={(e) => {
                                    if (isTtsBarOpen && !window.getSelection()?.toString().trim()) {
                                      e.stopPropagation();
                                      ttsService.speakText(text);
                                    }
                                  }}
                                  onDoubleClick={() => {
                                    const sel = window.getSelection()?.toString().trim();
                                    if (sel) handleWordLookup(sel, text);
                                  }}
                                  className={`leading-relaxed ${
                                    ttsSentence && text.includes(ttsSentence)
                                      ? 'bg-amber-500/15 rounded px-1'
                                      : ''
                                  }`}
                                >
                                  {renderParagraphContent(text, paraIndex, sliceStartOffset)}
                                </p>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <div
                          className={`h-64 flex flex-col items-center justify-center text-center p-6 space-y-3 ${palette.textMuted}`}
                        >
                          <BookOpen className="w-6 h-6 opacity-40" />
                          <p className="text-xs font-literata italic">
                            End of {currentChapter.title}
                          </p>
                          {currentChapterIndex < chapters.length - 1 && (
                            <button
                              type="button"
                              onClick={handleNextPage}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${palette.surfaceBg} ${palette.borderHairline} ${palette.textPrimary}`}
                            >
                              Continue to Chapter {currentChapterIndex + 2} →
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`pt-4 mt-6 border-t flex items-center justify-between text-[11px] tabular-nums ${palette.borderHairline} ${palette.textMuted}`}
                    >
                      <span>{activeBookMeta.locator.percentage}% Complete</span>
                      <span>
                        {rightSpreadPageParagraphs
                          ? `Page ${currentPageIndex + 2} of ${totalPagesInChapter}`
                          : `Ch. ${currentChapterIndex + 1} Colophon`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Single-Page or Continuous Scroll Editorial Layout */
                <>
                  {/* Chapter Header Kicker */}
                  <div className={`mb-6 sm:mb-8 pb-4 border-b ${palette.borderHairline}`}>
                    <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
                      Chapter {currentChapterIndex + 1} of {Math.max(1, chapters.length)} · Page{' '}
                      {currentPageIndex + 1} of {totalPagesInChapter}
                    </div>
                    <h2
                      dir="auto"
                      className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold mt-1"
                    >
                      {currentChapter.title}
                    </h2>
                  </div>

                  {/* Prose Stream */}
                  <div
                    className={`${fontClass} space-y-5 sm:space-y-6 pb-8`}
                    style={{
                      fontFamily:
                        settings.fontFamily === 'custom' && settings.customFontDataUrl
                          ? "'LuminaCustomUploadedFont', serif"
                          : undefined,
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: settings.lineHeight,
                      letterSpacing: isBookRtl ? '0px' : `${settings.letterSpacing}px`,
                      textAlign: isBookRtl ? 'right' : settings.textAlign,
                    }}
                  >
                    {(settings.layoutMode === 'scroll'
                      ? currentChapter.paragraphs.map((text, idx) => ({
                          text,
                          paraIndex: idx,
                          sliceStartOffset: 0,
                        }))
                      : currentPageParagraphs
                    ).map(({ text, paraIndex, sliceStartOffset = 0 }, idx) => {
                      if (text.startsWith('[IMAGE_DATA:')) {
                        const inner = text.slice('[IMAGE_DATA:'.length, -1);
                        const pipeIdx = inner.indexOf('|');
                        const dataUrl = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner;
                        const caption =
                          pipeIdx !== -1
                            ? inner.slice(pipeIdx + 1)
                            : 'Embedded Archival Figure';
                        return (
                          <figure
                            key={`${paraIndex}-${sliceStartOffset}`}
                            data-para-index={paraIndex}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage({ src: dataUrl, caption });
                            }}
                            className={`my-4 p-3 rounded-xl border text-center space-y-2 cursor-zoom-in transition-transform hover:scale-[1.01] ${palette.surfaceBg} ${palette.borderHairline}`}
                          >
                            <img
                              src={dataUrl}
                              alt={caption}
                              className="max-h-80 mx-auto object-contain rounded-lg"
                            />
                            <figcaption className={`text-xs font-sans ${palette.textMuted}`}>
                              {caption} · <span className="underline">Click to Zoom</span>
                            </figcaption>
                          </figure>
                        );
                      }

                      const paraRtl = isRtlText(text);
                      return (
                        <p
                          key={`${paraIndex}-${sliceStartOffset}`}
                          data-para-index={paraIndex}
                          data-slice-offset={sliceStartOffset}
                          dir={paraRtl ? 'rtl' : 'auto'}
                          onMouseUp={() => setSelectedParaIdx(paraIndex)}
                          onTouchEnd={() => setSelectedParaIdx(paraIndex)}
                          onClick={(e) => {
                            if (isTtsBarOpen && !window.getSelection()?.toString().trim()) {
                              e.stopPropagation();
                              ttsService.speakText(text);
                            }
                          }}
                          onDoubleClick={() => {
                            const sel = window.getSelection()?.toString().trim();
                            if (sel) handleWordLookup(sel, text);
                          }}
                          className={`leading-relaxed ${
                            !paraRtl &&
                            idx === 0 &&
                            currentPageIndex === 0 &&
                            sliceStartOffset === 0
                              ? 'first-letter:font-display first-letter:text-4xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:leading-none'
                              : ''
                          } ${
                            ttsSentence && text.includes(ttsSentence)
                              ? 'bg-amber-500/15 rounded px-1'
                              : ''
                          } ${isTtsBarOpen ? 'cursor-pointer hover:bg-amber-500/5 rounded' : ''}`}
                        >
                          {renderParagraphContent(text, paraIndex, sliceStartOffset)}
                        </p>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </main>
        )}

        {/* Drawer Rendering: Either Docked Split-Screen Study View OR Click-Outside Overlay Drawer */}
        {activeDrawer !== 'none' &&
          (isDrawerPinned ? (
            renderDrawerPanel()
          ) : (
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setActiveDrawer('none');
                }
              }}
              style={{
                paddingTop: `max(0px, calc(env(safe-area-inset-top, 0px) + ${safeTopPx}px))`,
              }}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] flex justify-end items-end sm:items-stretch animate-in fade-in duration-150"
            >
              {renderDrawerPanel()}
            </div>
          ))}
      </div>

      {/* Bottom Kindle-Style Location Telemetry & Page Flip Scrubber (Hidden in Zen Mode, Zero Duplicate Buttons) */}
      {activeBookMeta.format !== 'pdf' && !isZenMode && (
        <footer
          className={`z-20 px-3 sm:px-6 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] border-t flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs tabular-nums shrink-0 ${palette.canvasBg} ${palette.borderHairline}`}
        >
          <div className={`flex flex-wrap items-center gap-1.5 sm:gap-3 ${palette.textMuted}`}>
            <span>
              Loc <strong>{activeLocationNumber}</strong>/
              <strong>{activeBookMeta.totalLocations}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Pg{' '}
              {isTwoPageSpreadActive && rightSpreadPageParagraphs
                ? `${currentPageIndex + 1}–${currentPageIndex + 2}`
                : currentPageIndex + 1}
              /{totalPagesInChapter}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeBookMeta.locator.percentage}%</span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span
              className="hidden sm:inline"
              title="Personalized Reading Speed & Chapter Time Estimator"
            >
              ~{personalizedReadingStats.minsLeftInChapter} min left in Ch. (
              {personalizedReadingStats.userWpm} WPM)
            </span>

            {locationHistoryStack.length > 0 && (
              <button
                type="button"
                onClick={popLocationHistory}
                className={`inline-flex items-center gap-1 font-semibold underline cursor-pointer ${palette.accentText}`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  Return Loc{' '}
                  {locationHistoryStack[locationHistoryStack.length - 1].locationNumber}
                </span>
              </button>
            )}
          </div>

          {settings.layoutMode !== 'scroll' && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentChapterIndex === 0 && currentPageIndex === 0}
                className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer disabled:opacity-30 ${palette.borderHairline}`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <input
                type="range"
                aria-label="Page Flip Scrubber"
                min={0}
                max={Math.max(0, totalPagesInChapter - 1)}
                value={currentPageIndex}
                onChange={(e) =>
                  navigateToChapterAndPage(currentChapterIndex, Number(e.target.value))
                }
                className="w-20 sm:w-40 accent-amber-600"
              />

              <button
                type="button"
                onClick={handleNextPage}
                disabled={
                  currentChapterIndex >= chapters.length - 1 &&
                  currentPageIndex + pageStep >= totalPagesInChapter
                }
                className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer disabled:opacity-30 ${palette.borderHairline}`}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </footer>
      )}

      {/* Inline Footnote Popover Modal (Click-Outside Dismissible) */}
      {footnotePopover && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFootnotePopover(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir="auto"
            className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl border p-5 shadow-2xl space-y-3 text-xs ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-2.5">
              <span className="font-display font-semibold text-sm">
                Inline Footnote {footnotePopover.marker}
              </span>
              <button
                type="button"
                onClick={() => setFootnotePopover(null)}
                className="p-1 cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="font-literata text-sm leading-relaxed">{footnotePopover.content}</p>
          </div>
        </div>
      )}

      {/* Shareable Quote Card Studio Modal */}
      {quoteCardModalData && (
        <QuoteCardModal
          payload={{
            quote: quoteCardModalData.quoteText,
            bookTitle: activeBookMeta.title,
            bookAuthor: activeBookMeta.author,
            locationLabel: quoteCardModalData.chapterOrPageLabel,
          }}
          onClose={() => setQuoteCardModalData(null)}
        />
      )}

      {/* Interactive Highlight & Margin Note Editor Modal (With #Tags & Share Quote Card) */}
      {editingHighlight && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingHighlight(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <h3 className="font-display text-base font-semibold">
                Edit Highlight & Margin Note
              </h3>
              <button
                type="button"
                onClick={() => setEditingHighlight(null)}
                className="p-1 cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold block">Selected Passage</label>
              <textarea
                rows={2}
                dir="auto"
                value={editSelectedText}
                onChange={(e) => setEditSelectedText(e.target.value)}
                className={`w-full p-2.5 rounded-lg border font-literata italic outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className={palette.textMuted}>Swatch Color:</span>
              <div className="flex items-center gap-2">
                {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditHighlightColor(color)}
                    className={`w-5 h-5 rounded-full cursor-pointer ${
                      HIGHLIGHT_SWATCHES[color].dotClass
                    } ${
                      editHighlightColor === color ? 'ring-2 ring-offset-2 ring-current' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold block">Margin Annotation</label>
              <textarea
                rows={3}
                dir="auto"
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                placeholder="Write or update your margin note..."
                autoFocus
                className={`w-full p-3 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>Research Tags (comma-separated)</span>
              </label>
              <input
                type="text"
                dir="auto"
                value={editTagsInput}
                onChange={(e) => setEditTagsInput(e.target.value)}
                placeholder="e.g. philosophy, thesis, chapter-1"
                className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-current/10 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await deleteHighlight(editingHighlight.id);
                    setEditingHighlight(null);
                  }}
                  className="inline-flex items-center gap-1 text-rose-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const text = editSelectedText || editingHighlight.selectedText;
                    const label =
                      activeBookMeta.format === 'pdf'
                        ? `Page ${editingHighlight.locationNumber}`
                        : editingHighlight.chapterTitle || `Ch. ${editingHighlight.chapterIndex + 1}`;
                    setEditingHighlight(null);
                    setQuoteCardModalData({ quoteText: text, chapterOrPageLabel: label });
                  }}
                  className={`inline-flex items-center gap-1 font-medium hover:underline cursor-pointer ${palette.textSecondary}`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Quote Card</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingHighlight(null)}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${palette.borderHairline}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const parsedTags = editTagsInput
                      .split(/[,\s]+/)
                      .map((t) => t.replace(/^#/, '').trim())
                      .filter(Boolean);
                    await updateHighlightNote(
                      editingHighlight.id,
                      editNoteText,
                      editHighlightColor,
                      editSelectedText,
                      parsedTags
                    );
                    setEditingHighlight(null);
                  }}
                  className={`px-4 py-1.5 rounded-lg font-semibold text-white cursor-pointer ${palette.accentBg}`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Word Wise Contextual Lookup Modal */}
      {wordWiseModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWordWiseModal(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir="auto"
            className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest opacity-60">
                  Kindle Word Wise · Local Lexical Engine
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="font-display text-2xl font-bold">{wordWiseModal.word}</h3>
                  <button
                    type="button"
                    onClick={() => ttsService.speakText(wordWiseModal.word)}
                    title="Pronounce Word Aloud"
                    className={`p-1.5 rounded-full border cursor-pointer hover:opacity-85 ${palette.surfaceBg} ${palette.borderHairline}`}
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </div>
                <div className={`text-xs ${palette.textMuted}`}>
                  {wordWiseModal.phonetic} · <em>{wordWiseModal.partOfSpeech}</em>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWordWiseModal(null)}
                className="p-1 cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm leading-relaxed">{wordWiseModal.definition}</p>

            <div
              className={`p-3 rounded-lg border text-xs space-y-1 ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              <div className="font-semibold">Etymology & Morphology</div>
              <p className={palette.textMuted}>{wordWiseModal.etymology}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={wordWiseModal.saved}
                onClick={async () => {
                  const isPdf = activeBookMeta.format === 'pdf';
                  const pdfPage = selectedPdfPage || activeBookMeta.locator?.locationNumber || 1;
                  await addVocabularyCard({
                    word: wordWiseModal.word,
                    phonetic: wordWiseModal.phonetic,
                    partOfSpeech: wordWiseModal.partOfSpeech,
                    definition: wordWiseModal.definition,
                    etymology: wordWiseModal.etymology,
                    contextSentence: wordWiseModal.contextSentence,
                    bookId: activeBookMeta.id,
                    bookTitle: activeBookMeta.title,
                    chapterIndex: isPdf ? 0 : currentChapterIndex,
                    pageIndex: isPdf ? pdfPage : currentPageIndex,
                    locationNumber: isPdf ? pdfPage : activeLocationNumber,
                  });
                  setWordWiseModal({ ...wordWiseModal, saved: true });
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-60 ${palette.accentBg}`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{wordWiseModal.saved ? 'Saved to SRS Deck' : 'Add to SRS Flashcards'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Speed Reader Modal */}
      {isRsvpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRsvpRunning(false);
              setIsRsvpOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl border p-6 shadow-2xl space-y-6 text-center ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <span className="font-display font-semibold text-sm">
                RSVP Speed Reader ({rsvpWpm} WPM)
              </span>
              <button
                type="button"
                onClick={() => {
                  setRsvpRunning(false);
                  setIsRsvpOpen(false);
                }}
                className="p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              dir="auto"
              className={`py-12 rounded-xl border font-mono-reader text-2xl sm:text-3xl font-bold tracking-wide ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              {rsvpWords[rsvpWordIndex] || 'Ready'}
            </div>

            <div className="flex items-center justify-between gap-4 text-xs tabular-nums">
              <span>
                Word {rsvpWordIndex + 1} / {rsvpWords.length}
              </span>
              <input
                type="range"
                min={180}
                max={750}
                step={20}
                value={rsvpWpm}
                onChange={(e) => setRsvpWpm(Number(e.target.value))}
                className="w-36 accent-amber-600"
              />
              <span>{rsvpWpm} WPM</span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRsvpRunning((r) => !r)}
                className={`px-5 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                {rsvpRunning ? 'Pause' : 'Start Speed Reading'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRsvpRunning(false);
                  setRsvpWordIndex(0);
                }}
                className={`px-4 py-2 rounded-lg text-xs border cursor-pointer ${palette.borderHairline}`}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Device Gestures & Keyboard Ergonomics Modal */}
      {isGestureGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGestureGuideOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 text-xs ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Cross-Device Reading Gestures & Shortcuts
                </h3>
                <p className={`text-[11px] ${palette.textMuted}`}>
                  Tailored for iPhone, Android, iPad, and Desktop ergonomics
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGestureGuideOpen(false)}
                className="p-1 cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${palette.surfaceBg} ${palette.borderHairline}`}
              >
                <div className="font-semibold text-amber-600 dark:text-amber-400">
                  iPhone, Android & iPad Touch
                </div>
                <ul className="space-y-1.5 leading-relaxed">
                  <li>
                    <strong>Swipe Left / Right:</strong> Turn page with tactile slide or 3D curl
                  </li>
                  <li>
                    <strong>Left-Edge Vertical Swipe:</strong> Adjust circadian warmth filter
                  </li>
                  <li>
                    <strong>Tap Left / Right Margin:</strong> One-handed thumb page flip
                  </li>
                  <li>
                    <strong>Tap Center of Page:</strong> Toggle Zen Immersion Mode
                  </li>
                  <li>
                    <strong>2-Finger Pinch:</strong> Scale font size (reflow) or zoom (PDF)
                  </li>
                  <li>
                    <strong>Select Any Text:</strong> Highlight, Margin Note, Quote Card, or Word Wise
                  </li>
                </ul>
              </div>

              <div
                className={`p-3.5 rounded-xl border space-y-2 ${palette.surfaceBg} ${palette.borderHairline}`}
              >
                <div className="font-semibold text-amber-600 dark:text-amber-400">
                  Desktop, E-Ink & iPad Keyboard
                </div>
                <ul className="space-y-1.5 leading-relaxed">
                  <li>
                    <strong>← / →, PgUp / PgDn, or Space:</strong> Previous / Next page
                  </li>
                  <li>
                    <strong>E-Ink Volume Up / Down:</strong> Hardware button page turning
                  </li>
                  <li>
                    <strong>/ or Cmd+F:</strong> Instant in-book & in-PDF full-text search
                  </li>
                  <li>
                    <strong>Cmd+K / Ctrl+K:</strong> Global Command Palette & Syntopicon Search
                  </li>
                  <li>
                    <strong>Split View Button:</strong> Pin drawer side-by-side on iPad/Desktop
                  </li>
                  <li>
                    <strong>Ctrl / Cmd + Scroll:</strong> Scale font size or PDF zoom
                  </li>
                  <li>
                    <strong>Double-Click Word:</strong> Multilingual Word Wise Dictionary
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Archival Figure & PDF Excerpt Zoom Lightbox */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxImage(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`max-w-4xl w-full rounded-2xl border p-4 sm:p-6 shadow-2xl space-y-3 text-center ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-2.5">
              <span className="font-display font-semibold text-sm truncate">
                {lightboxImage.caption}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.caption}
              className="max-h-[72dvh] mx-auto object-contain rounded-lg bg-white p-2"
            />
          </div>
        </div>
      )}
    </div>
  );
};
