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

  // Mobile/Tablet Touch Gestures (Swipe-to-Turn-Page & Pinch-to-Scale Font)
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);
  const [fontScaleHud, setFontScaleHud] = useState<string | null>(null);
  const touchGestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isPinch: boolean;
    initialPinchDist: number;
    initialFontSize: number;
  } | null>(null);
  const hudTimeoutRef = useRef<number | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);

  // Selection, Quote Card & Word Wise State
  const [selectedText, setSelectedText] = useState('');
  const [selectedParaIdx, setSelectedParaIdx] = useState<number>(0);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number | null>(null);
  const [selectedPdfRects, setSelectedPdfRects] = useState<HighlightRect[] | undefined>(undefined);
  const [marginNoteDraft, setMarginNoteDraft] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

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
    const baseWords = settings.layoutMode === 'double' ? 420 : 240;
    const scaleFactor = 19 / Math.max(14, settings.fontSize || 19);
    return Math.max(90, Math.round(baseWords * scaleFactor));
  }, [settings.layoutMode, settings.fontSize]);

  const paginatedPages = useMemo(() => {
    const pages: { text: string; paraIndex: number }[][] = [];
    let currentBucket: { text: string; paraIndex: number }[] = [];
    let count = 0;

    (currentChapter.paragraphs || []).forEach((p, idx) => {
      if (!p) return;
      const wCount = p.split(/\s+/).length;
      if (count + wCount > wordsPerPage && currentBucket.length > 0) {
        pages.push(currentBucket);
        currentBucket = [{ text: p, paraIndex: idx }];
        count = wCount;
      } else {
        currentBucket.push({ text: p, paraIndex: idx });
        count += wCount;
      }
    });
    if (currentBucket.length > 0) pages.push(currentBucket);
    return pages.length > 0 ? pages : [[{ text: currentChapter.content || '', paraIndex: 0 }]];
  }, [currentChapter, wordsPerPage]);

  const totalPagesInChapter = Math.max(1, paginatedPages.length);
  const currentPageIndex = Math.min(
    Math.max(0, activeBookMeta?.locator?.pageIndex || 0),
    totalPagesInChapter - 1
  );
  const currentPageParagraphs = paginatedPages[currentPageIndex] || [];

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
    const overallProgress = Math.min(
      100,
      Math.max(
        1,
        Math.round(
          ((nextChIdx + (nextPageIdx + 1) / Math.max(1, totalPagesInChapter)) /
            Math.max(1, chapters.length)) *
            100
        )
      )
    );
    const locNum = Math.max(1, (targetCh.startLocation || 1) + nextPageIdx * 2);
    updateActiveLocator(
      {
        chapterIndex: nextChIdx,
        pageIndex: nextPageIdx,
        paragraphIndex: 0,
        locationNumber: Math.min(activeBookMeta.totalLocations || 1, locNum),
        percentage: overallProgress,
      },
      pushHistory
    );
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      triggerPageTurnAnimation('prev');
      navigateToChapterAndPage(currentChapterIndex, currentPageIndex - 1);
    } else if (currentChapterIndex > 0) {
      triggerPageTurnAnimation('prev');
      navigateToChapterAndPage(currentChapterIndex - 1, 0);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < totalPagesInChapter - 1) {
      triggerPageTurnAnimation('next');
      navigateToChapterAndPage(currentChapterIndex, currentPageIndex + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      triggerPageTurnAnimation('next');
      navigateToChapterAndPage(currentChapterIndex + 1, 0);
    }
  };

  // Universal Keyboard & Escape Dismissal Handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

      if (e.key === 'ArrowRight' || (e.key === ' ' && !e.shiftKey)) {
        if (settings.layoutMode !== 'scroll') {
          e.preventDefault();
          handleNextPage();
        }
      } else if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey)) {
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

  // Dismiss Floating Selection Bar cleanly on outside pointerdown without racing pointerup
  useEffect(() => {
    if (!selectedText) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (selectionBarRef.current?.contains(target)) return;
      setSelectedText('');
      setSelectedPdfRects(undefined);
      setShowNoteInput(false);
    };
    document.addEventListener('pointerdown', onPointerDownOutside);
    return () => document.removeEventListener('pointerdown', onPointerDownOutside);
  }, [selectedText]);

  // Helper: Find a passage span inside a paragraph
  const findTextSpanInParagraph = (
    paragraphText: string,
    rawNeedle: string,
    fromIndex = 0
  ): { start: number; end: number } | null => {
    const needle = (rawNeedle || '').trim();
    if (needle.length < 2 || !paragraphText) return null;

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
    if (needle.length >= 2) {
      resolvedPageIdx = paginatedPages.findIndex((pageBucket) =>
        pageBucket.some((p) => findTextSpanInParagraph(p.text, needle) !== null)
      );
    }
    if (resolvedPageIdx === -1 && typeof targetParaIdx === 'number') {
      resolvedPageIdx = paginatedPages.findIndex((pageBucket) =>
        pageBucket.some((p) => p.paraIndex === targetParaIdx)
      );
    }
    if (resolvedPageIdx === -1 && typeof activeJumpTarget.pageIndex === 'number') {
      resolvedPageIdx = Math.min(
        Math.max(0, activeJumpTarget.pageIndex),
        Math.max(0, paginatedPages.length - 1)
      );
    }

    if (
      settings.layoutMode !== 'scroll' &&
      resolvedPageIdx !== -1 &&
      resolvedPageIdx !== currentPageIndex
    ) {
      navigateToChapterAndPage(targetChIdx, resolvedPageIdx, false);
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

    await addHighlight({
      bookId: activeBookMeta.id,
      bookTitle: activeBookMeta.title,
      bookAuthor: activeBookMeta.author,
      chapterIndex: isPdf ? 0 : currentChapterIndex,
      chapterTitle: targetChapterTitle,
      pageIndex: isPdf ? targetLoc : currentPageIndex,
      paragraphIndex: selectedParaIdx,
      locationNumber: targetLoc,
      selectedText: selectedText.trim(),
      color,
      note: note?.trim() || undefined,
      rects: isPdf ? selectedPdfRects : undefined,
    });
    setSelectedText('');
    setSelectedPdfPage(null);
    setSelectedPdfRects(undefined);
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
  const renderParagraphContent = (text: string, paraIndex: number) => {
    const matchedSpans: {
      hl?: Highlight;
      start: number;
      end: number;
      isSpotlightOnly?: boolean;
    }[] = [];

    const unmatchedParaHighlights: Highlight[] = [];

    chapterHighlights.forEach((hl) => {
      if (!hl.selectedText || hl.selectedText.trim().length < 2) return;
      const span = findTextSpanInParagraph(text, hl.selectedText);
      if (span) {
        matchedSpans.push({ hl, start: span.start, end: span.end });
      } else if (hl.paragraphIndex === paraIndex) {
        unmatchedParaHighlights.push(hl);
      }
    });

    if (spotlightTarget?.searchText && spotlightTarget.searchText.trim().length >= 2) {
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
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-sans font-semibold underline opacity-85 select-none">
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
              className="bg-amber-400/55 dark:bg-amber-500/40 text-inherit rounded-xs px-1 py-0.5 ring-2 ring-amber-500 shadow-sm animate-pulse"
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
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-sans font-semibold underline opacity-85">
              <Edit3 className="w-3 h-3 inline" />
              {hl.note ? `Note: ${hl.note}` : 'Edit'}
            </span>
          </mark>
        );
      });

      return <>{nodes}</>;
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
              <label className="font-semibold block">Pagination & Spread</label>
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
                    onClick={() => updateSettings({ layoutMode: m.id })}
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

            <div className="space-y-2 pt-2 border-t border-current/10">
              <label className="font-semibold flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5" />
                <span>Procedural Ambient Soundscape</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'none', label: 'Silence' },
                    { id: 'rain', label: 'Soft Rain' },
                    { id: 'fireplace', label: 'Warm Hearth' },
                    { id: 'library', label: 'Archive Hall' },
                    { id: 'vinyl', label: 'Vinyl Study' },
                    { id: 'brown_noise', label: 'Deep Brown Noise' },
                  ] as { id: SoundscapeType; label: string }[]
                ).map((snd) => (
                  <button
                    key={snd.id}
                    type="button"
                    onClick={() => updateSettings({ soundscape: snd.id })}
                    className={`px-3 py-1.5 rounded-lg border text-left cursor-pointer ${
                      settings.soundscape === snd.id
                        ? `${palette.accentBg} text-white font-semibold`
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    {snd.label}
                  </button>
                ))}
              </div>
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
      className={`h-[100dvh] w-full flex flex-col relative overflow-hidden transition-colors duration-200 ${palette.canvasBg} ${palette.textPrimary}`}
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

      {/* Top Reader Utility Bar */}
      {!isZenMode ? (
        <header
          className={`z-30 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 border-b shrink-0 ${palette.canvasBg} ${palette.borderHairline}`}
        >
          {/* Left: Back to Library + Book Title */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={closeActiveBook}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${palette.borderHairline} hover:bg-black/5 dark:hover:bg-white/5`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Library</span>
            </button>
            <div className="min-w-0" dir="auto">
              <h1 className="font-display text-xs sm:text-sm font-semibold truncate">
                {activeBookMeta.title}
              </h1>
              <p className={`text-[10px] sm:text-[11px] truncate ${palette.textMuted}`}>
                {activeBookMeta.author} · {currentChapter.title}
              </p>
            </div>
          </div>

          {/* Right: Reader Tool Drawers */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto shrink-0 py-0.5">
            <button
              type="button"
              onClick={() => setActiveDrawer(activeDrawer === 'toc' ? 'none' : 'toc')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'toc'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Contents, Notes & Bookmarks"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Contents & Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDrawer(activeDrawer === 'search' ? 'none' : 'search')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                activeDrawer === 'typography'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Typography, Themes & Soundscapes"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Aa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsTtsBarOpen((v) => !v);
                if (!isTtsBarOpen) {
                  ttsService.speakText(
                    currentPageParagraphs.map((p) => p.text).join(' ')
                  );
                } else {
                  ttsService.stop();
                }
              }}
              className={`p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${
                isTtsBarOpen
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Read Aloud & Sleep Timer"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setRsvpWordIndex(0);
                setIsRsvpOpen(true);
              }}
              className={`p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${palette.surfaceBg} ${palette.textSecondary}`}
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
              className={`p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${
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
              className={`p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${palette.surfaceBg} ${palette.textSecondary}`}
              title="Touch Gestures & Keyboard Shortcuts (?)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleZenMode}
              className={`p-1.5 rounded-lg text-xs cursor-pointer shrink-0 ${palette.surfaceBg} ${palette.textSecondary}`}
              title="Enter Distraction-Free Zen Mode (Z or Tap Center)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      ) : (
        <button
          type="button"
          onClick={toggleZenMode}
          className={`fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shadow-md opacity-45 hover:opacity-100 transition-opacity cursor-pointer ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Exit Zen</span>
        </button>
      )}

      {/* Read-Aloud & Audio Sleep Timer Controller Bar */}
      {isTtsBarOpen && (
        <div
          className={`z-30 px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">
              Read-Aloud Active · Tap any paragraph below to read from that line
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 opacity-70" />
            <span className={palette.textMuted}>Sleep Timer:</span>
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
                ({sleepTimerMinutesLeft}m left)
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                ttsService.stop();
                setIsTtsBarOpen(false);
              }}
              className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
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

      {/* Floating Selection Action Bar (Apple Books + Kindle Word Wise + Quote Card Studio) */}
      {selectedText && (
        <div
          ref={selectionBarRef}
          className={`fixed bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-xl rounded-2xl border p-3.5 shadow-2xl space-y-2.5 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          {/* Selected Passage Preview */}
          <div
            dir="auto"
            className={`text-xs font-literata italic line-clamp-2 px-2.5 py-1.5 rounded-lg border ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            "{selectedText}"
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
                  className={`w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 ${HIGHLIGHT_SWATCHES[color].dotClass}`}
                  title={HIGHLIGHT_SWATCHES[color].label}
                />
              ))}
            </div>

            {/* Word Wise, Quote Card, Margin Note & Close */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowNoteInput((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Add Note</span>
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
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
                title="Create Shareable Quote Card"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Quote Card</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const firstWord = selectedText.trim().split(/\s+/)[0];
                  handleWordLookup(firstWord, selectedText);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                Word Wise
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedText('');
                  setSelectedPdfRects(undefined);
                  setShowNoteInput(false);
                  window.getSelection()?.removeAllRanges();
                }}
                className={`p-1 cursor-pointer ${palette.textMuted}`}
              >
                <X className="w-3.5 h-3.5" />
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
                className={`flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
              />
              <button
                type="button"
                onClick={() => handleCreateHighlight('amber', marginNoteDraft)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0 ${palette.accentBg}`}
              >
                Save Note
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Reader Content Viewport (Supports Docked Side-by-Side Split-Screen Study View on iPad/Desktop) */}
      <div className="flex-1 flex relative overflow-hidden">
        {activeBookMeta.format === 'pdf' ? (
          <div className="w-full h-full flex-1 overflow-hidden">
            <VirtualizedPdfEngine
              book={activeBookMeta}
              hasActiveSelection={Boolean(selectedText)}
              onSelectText={(text, pageNum, rects) => {
                setSelectedText(cleanExtractedText(text));
                setSelectedPdfPage(pageNum);
                setSelectedPdfRects(rects);
              }}
              onWordLookup={handleWordLookup}
              onEditHighlight={openEditHighlightModal}
              onToggleImmersion={toggleZenMode}
            />
          </div>
        ) : (
          /* Reflowable Reader Viewport */
          <main
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
              if (e.touches.length === 2) {
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
                touchGestureRef.current = {
                  startX: e.touches[0].clientX,
                  startY: e.touches[0].clientY,
                  startTime: Date.now(),
                  isPinch: false,
                  initialPinchDist: 0,
                  initialFontSize: settings.fontSize || 19,
                };
              }
            }}
            onTouchMove={(e) => {
              const g = touchGestureRef.current;
              if (!g) return;

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

              if (
                !g.isPinch &&
                e.touches.length === 1 &&
                settings.layoutMode !== 'scroll' &&
                !window.getSelection()?.toString()
              ) {
                const dx = e.touches[0].clientX - g.startX;
                const dy = e.touches[0].clientY - g.startY;
                if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.25) {
                  const damped = Math.max(-110, Math.min(110, dx * 0.45));
                  setSwipeDeltaX(damped);
                }
              }
            }}
            onTouchEnd={(e) => {
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
                  Math.abs(dx) > 48 &&
                  Math.abs(dx) > Math.abs(dy) * 1.25
                ) {
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

              setTimeout(() => {
                const sel = cleanExtractedText(window.getSelection()?.toString() || '');
                if (sel.length > 1) {
                  setSelectedText(sel);
                }
              }, 80);
            }}
            onMouseUp={() => {
              const sel = cleanExtractedText(window.getSelection()?.toString() || '');
              if (sel.length > 1) {
                setSelectedText(sel);
              }
            }}
            onClick={(e) => {
              if (activeDrawer !== 'none' && !isDrawerPinned) {
                setActiveDrawer('none');
                return;
              }
              const currentSelection = window.getSelection()?.toString().trim() || '';
              if (currentSelection.length > 0 || selectedText) return;
              const target = e.target as HTMLElement;
              if (target.closest('mark, button, a, input, textarea')) return;

              const rect = e.currentTarget.getBoundingClientRect();
              const relX = (e.clientX - rect.left) / Math.max(1, rect.width);

              if (settings.layoutMode !== 'scroll' && relX < 0.16) {
                if (isBookRtl) handleNextPage();
                else handlePrevPage();
              } else if (settings.layoutMode !== 'scroll' && relX > 0.84) {
                if (isBookRtl) handlePrevPage();
                else handleNextPage();
              } else if (relX >= 0.25 && relX <= 0.75) {
                toggleZenMode();
              }
            }}
            className="flex-1 h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-12 flex flex-col items-center select-text"
          >
            <div
              dir={isBookRtl ? 'rtl' : 'auto'}
              className="w-full transition-all duration-200 ease-out"
              style={{
                maxWidth: settings.layoutMode === 'double' ? '1120px' : '700px',
                paddingLeft: `${Math.min(32, Math.max(8, Math.round(settings.marginWidth * 0.5)))}px`,
                paddingRight: `${Math.min(32, Math.max(8, Math.round(settings.marginWidth * 0.5)))}px`,
                transform: pageTransformStyle,
              }}
            >
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

              {/* Prose Columns */}
              <div
                className={`${fontClass} ${
                  settings.layoutMode === 'double'
                    ? 'lg:columns-2 lg:gap-14 lg:[column-rule:1px_solid_rgba(120,113,108,0.18)]'
                    : ''
                } space-y-5 sm:space-y-6 pb-8`}
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
                  ? currentChapter.paragraphs.map((text, idx) => ({ text, paraIndex: idx }))
                  : currentPageParagraphs
                ).map(({ text, paraIndex }, idx) => {
                  const paraRtl = isRtlText(text);
                  return (
                    <p
                      key={paraIndex}
                      data-para-index={paraIndex}
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
                      className={`break-inside-avoid-column leading-relaxed ${
                        !paraRtl && idx === 0 && currentPageIndex === 0
                          ? 'first-letter:font-display first-letter:text-4xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:leading-none'
                          : ''
                      } ${
                        ttsSentence && text.includes(ttsSentence)
                          ? 'bg-amber-500/15 rounded px-1'
                          : ''
                      } ${isTtsBarOpen ? 'cursor-pointer hover:bg-amber-500/5 rounded' : ''}`}
                    >
                      {renderParagraphContent(text, paraIndex)}
                    </p>
                  );
                })}
              </div>
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
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] flex justify-end items-end sm:items-stretch animate-in fade-in duration-150"
            >
              {renderDrawerPanel()}
            </div>
          ))}
      </div>

      {/* Bottom Kindle-Style Location Telemetry & Page Flip Scrubber */}
      {activeBookMeta.format !== 'pdf' && (
        <footer
          className={`z-20 px-3 sm:px-6 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs tabular-nums shrink-0 ${palette.canvasBg} ${palette.borderHairline}`}
        >
          <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${palette.textMuted}`}>
            <span>
              Loc <strong>{activeLocationNumber}</strong>/
              <strong>{activeBookMeta.totalLocations}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Pg {currentPageIndex + 1}/{totalPagesInChapter}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeBookMeta.locator.percentage}%</span>

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
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer disabled:opacity-30 ${palette.borderHairline}`}
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
                  currentPageIndex >= totalPagesInChapter - 1
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer disabled:opacity-30 ${palette.borderHairline}`}
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
                <h3 className="font-display text-2xl font-bold mt-0.5">{wordWiseModal.word}</h3>
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
                  Desktop & iPad Keyboard
                </div>
                <ul className="space-y-1.5 leading-relaxed">
                  <li>
                    <strong>← / → or Space:</strong> Previous / Next page
                  </li>
                  <li>
                    <strong>/ or Cmd+F:</strong> Instant in-book & in-PDF full-text search
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
    </div>
  );
};
