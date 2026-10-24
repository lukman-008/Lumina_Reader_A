import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Edit3,
  MessageSquarePlus,
  PenTool,
  Undo2,
  Trash2,
  LayoutGrid,
  Columns,
  Crop,
  Moon,
  X,
} from 'lucide-react';
import { db } from '../services/db';
import { useLuminaStore } from '../store/useLuminaStore';
import { isRtlText } from '../services/localIntelligenceEngine';
import { sanitizeAndRepairUnicodeText } from '../services/multilingualDictionary';
import { READING_THEMES, HIGHLIGHT_SWATCHES } from '../utils/themeTokens';
import type {
  BookMeta,
  Highlight,
  HighlightColor,
  HighlightRect,
  PdfInkStroke,
} from '../types';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface PageWordBox {
  id: string;
  wordIndex: number;
  lineIndex: number;
  text: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  isRtl: boolean;
}

/**
 * Merges a list of PageWordBox items by lineIndex into clean, continuous horizontal HighlightRects (%).
 */
function buildMergedLineRects(words: PageWordBox[]): HighlightRect[] {
  if (words.length === 0) return [];
  const byLine = new Map<number, PageWordBox[]>();
  for (const w of words) {
    const arr = byLine.get(w.lineIndex);
    if (arr) arr.push(w);
    else byLine.set(w.lineIndex, [w]);
  }
  const rects: HighlightRect[] = [];
  for (const [, lineWords] of byLine.entries()) {
    let minLeft = 100;
    let minTop = 100;
    let maxRight = 0;
    let maxBottom = 0;
    for (const lw of lineWords) {
      minLeft = Math.min(minLeft, lw.leftPct);
      minTop = Math.min(minTop, lw.topPct);
      maxRight = Math.max(maxRight, lw.leftPct + lw.widthPct);
      maxBottom = Math.max(maxBottom, lw.topPct + lw.heightPct);
    }
    rects.push({
      left: +Math.max(0, minLeft).toFixed(2),
      top: +Math.max(0, minTop).toFixed(2),
      width: +Math.max(1, maxRight - minLeft).toFixed(2),
      height: +Math.max(1.2, maxBottom - minTop).toFixed(2),
    });
  }
  return rects;
}

const INK_STROKE_HEX: Record<HighlightColor, string> = {
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

// Persistent in-memory cache of word bounding boxes per book page
const pageWordBoxCache = new Map<string, PageWordBox[]>();

// Reusable singleton Tesseract worker so WASM & language models load only once
let sharedOcrWorkerPromise: Promise<Tesseract.Worker> | null = null;
function getSharedOcrWorker(): Promise<Tesseract.Worker> {
  if (!sharedOcrWorkerPromise) {
    sharedOcrWorkerPromise = Tesseract.createWorker('eng+ara', 1).catch((err) => {
      sharedOcrWorkerPromise = null;
      throw err;
    });
  }
  return sharedOcrWorkerPromise;
}

/**
 * Normalizes extracted PDF/OCR text so kerning splits (e.g. "T h e  w o r d")
 * and broken hyphenations are collapsed into clean, natural words.
 */
export function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  let text = sanitizeAndRepairUnicodeText(raw)
    .replace(/\u00AD/g, '') // soft hyphens
    .replace(/-\s*\n\s*/g, '') // hyphenated line breaks
    .replace(/\s+/g, ' ')
    .trim();

  // Detect and repair spaced-out single-letter ASCII/Latin kerning runs: e.g. "T h e  b o o k" -> "The book"
  const tokens = text.split(' ');
  const singleAsciiCount = tokens.filter((t) => /^[A-Za-z]$/.test(t)).length;
  if (tokens.length >= 4 && singleAsciiCount / tokens.length >= 0.65) {
    const rebuilt: string[] = [];
    let buffer = '';
    for (const tok of tokens) {
      if (/^[A-Za-z]$/.test(tok)) {
        buffer += tok;
      } else {
        if (buffer) {
          rebuilt.push(buffer);
          buffer = '';
        }
        rebuilt.push(tok);
      }
    }
    if (buffer) rebuilt.push(buffer);
    text = rebuilt.join(' ');
  }

  return sanitizeAndRepairUnicodeText(text);
}

interface PdfThumbnailCardProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNum: number;
  totalPages: number;
  isCurrent: boolean;
  hlCount: number;
  inkCount: number;
  snippet: string;
  filterStyle?: string;
  palette: (typeof READING_THEMES)['paper'];
  onSelectPage: (pageNum: number) => void;
}

const PdfThumbnailCard: React.FC<PdfThumbnailCardProps> = ({
  pdfDoc,
  pageNum,
  totalPages,
  isCurrent,
  hlCount,
  inkCount,
  snippet,
  filterStyle,
  palette,
  onSelectPage,
}) => {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (!pdfDoc || isRendered || !cardRef.current) return;
    let isCancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          void (async () => {
            try {
              const page = await pdfDoc.getPage(pageNum);
              if (isCancelled || !thumbCanvasRef.current) return;
              const vp = page.getViewport({ scale: 0.28 });
              const canvas = thumbCanvasRef.current;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              canvas.width = Math.max(60, Math.round(vp.width));
              canvas.height = Math.max(80, Math.round(vp.height));
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              renderTask = page.render({ canvasContext: ctx, canvas, viewport: vp });
              await renderTask.promise;
              if (!isCancelled) setIsRendered(true);
            } catch {
              // ignore thumbnail cancellation
            }
          })();
        }
      },
      { rootMargin: '140px' }
    );

    observer.observe(cardRef.current);
    return () => {
      isCancelled = true;
      observer.disconnect();
      try {
        renderTask?.cancel();
      } catch {
        // ignore
      }
    };
  }, [pdfDoc, pageNum, isRendered]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onSelectPage(pageNum)}
      className={`group rounded-xl border p-2.5 text-left flex flex-col justify-between aspect-[3/4] transition-all cursor-pointer overflow-hidden ${
        isCurrent
          ? `ring-2 ring-amber-500 ${palette.surfaceBg}`
          : `hover:border-amber-500/50 ${palette.surfaceBg} ${palette.borderHairline}`
      }`}
    >
      <div className="flex items-center justify-between text-[11px] tabular-nums w-full mb-1">
        <span className="font-semibold">Pg {pageNum}</span>
        {(hlCount > 0 || inkCount > 0) && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            {hlCount + inkCount} ★
          </span>
        )}
      </div>

      <div className="relative flex-1 w-full rounded-md overflow-hidden bg-white border border-black/10 flex items-center justify-center">
        <canvas
          ref={thumbCanvasRef}
          style={{ filter: filterStyle }}
          className={`w-full h-full object-contain transition-opacity duration-200 ${
            isRendered ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {!isRendered && (
          <p
            dir="auto"
            className="absolute inset-1.5 text-[9px] line-clamp-4 leading-snug text-stone-500 overflow-hidden"
          >
            {snippet || `Page ${pageNum}`}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] opacity-65 tabular-nums w-full mt-1">
        <span>{isRendered ? 'Visual Sheet' : 'Preview'}</span>
        <span>{Math.round((pageNum / Math.max(1, totalPages)) * 100)}%</span>
      </div>
    </button>
  );
};

interface VirtualizedPdfEngineProps {
  book: BookMeta;
  hasActiveSelection?: boolean;
  onSelectText: (
    text: string,
    pageNumber: number,
    rects?: HighlightRect[],
    imageSnippetDataUrl?: string
  ) => void;
  onWordLookup: (word: string, sentence: string) => void;
  onEditHighlight: (hl: Highlight) => void;
  onToggleImmersion?: () => void;
}

export const VirtualizedPdfEngine: React.FC<VirtualizedPdfEngineProps> = ({
  book,
  hasActiveSelection = false,
  onSelectText,
  onWordLookup,
  onEditHighlight,
  onToggleImmersion,
}) => {
  const settings = useLuminaStore((s) => s.settings);
  const highlights = useLuminaStore((s) => s.highlights);
  const activeBookContent = useLuminaStore((s) => s.activeBookContent);
  const activeJumpTarget = useLuminaStore((s) => s.activeJumpTarget);
  const setActiveJumpTarget = useLuminaStore((s) => s.setActiveJumpTarget);
  const updateActiveLocator = useLuminaStore((s) => s.updateActiveLocator);
  const updateBookTotalLocations = useLuminaStore((s) => s.updateBookTotalLocations);
  const updateSettings = useLuminaStore((s) => s.updateSettings);
  const savePageOcrText = useLuminaStore((s) => s.savePageOcrText);
  const savePageInkStrokes = useLuminaStore((s) => s.savePageInkStrokes);

  const palette = READING_THEMES[settings.theme] || READING_THEMES.paper;

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(Math.max(1, book.totalLocations || 1));
  const [currentPage, setCurrentPage] = useState<number>(
    Math.max(1, book.locator?.pageIndex || book.locator?.locationNumber || 1)
  );
  const [scale, setScale] = useState<number>(1.0);
  const [canvasCssSize, setCanvasCssSize] = useState<{ width: number; height: number }>({
    width: 680,
    height: 920,
  });

  // Geometrically aligned Word Bounding Boxes on the current page
  const [wordBoxes, setWordBoxes] = useState<PageWordBox[]>([]);
  const [isIndexingLiveText, setIsIndexingLiveText] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Geometric Pointer Selection State (Apple Live Text Architecture)
  const [isPointerDragging, setIsPointerDragging] = useState<boolean>(false);
  const [anchorWordIndex, setAnchorWordIndex] = useState<number | null>(null);
  const [focusWordIndex, setFocusWordIndex] = useState<number | null>(null);
  const [isHoveringWord, setIsHoveringWord] = useState<boolean>(false);
  const [spotlightHighlightId, setSpotlightHighlightId] = useState<string | null>(null);
  const [spotlightSearchTerm, setSpotlightSearchTerm] = useState<string | null>(null);

  // Freehand Vector Ink & Apple Pencil Annotation State
  const [isInkMode, setIsInkMode] = useState<boolean>(false);
  const [inkColor, setInkColor] = useState<HighlightColor>('amber');
  const [activeInkPoints, setActiveInkPoints] = useState<{ x: number; y: number }[]>([]);

  // Visual Page Grid & Thumbnail Overview Drawer State
  const [isPageGridOpen, setIsPageGridOpen] = useState<boolean>(false);

  // Fallback Region Crop Box (when dragging across an unindexed diagram or while OCR is still running)
  const [regionStartPx, setRegionStartPx] = useState<{ x: number; y: number } | null>(null);
  const [regionRectPx, setRegionRectPx] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const secondCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const secondRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const ocrAbortRef = useRef<number>(0);

  // Touch & Trackpad Gesture Refs (Swipe to Turn Page + Pinch to Zoom)
  const pointerDownInfoRef = useRef<{
    clientX: number;
    clientY: number;
    xPx: number;
    yPx: number;
    downWordIndex: number | null;
    time: number;
    pointerType: string;
  } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.0);
  const [swipeDeltaX, setSwipeDeltaX] = useState<number>(0);

  // Saved vector ink strokes for the current page
  const pageInkStrokes = useMemo<PdfInkStroke[]>(() => {
    return activeBookContent?.inkByPage?.[currentPage] || [];
  }, [activeBookContent?.inkByPage, currentPage]);

  // Calibrated CSS filter when Smart PDF Theme Filter is enabled
  const pdfCanvasFilterStyle = useMemo(() => {
    if (!settings.pdfThemeFilter) return undefined;
    if (settings.theme === 'nocturne') {
      return 'invert(0.91) hue-rotate(180deg) contrast(1.04)';
    }
    if (settings.theme === 'dusk') {
      return 'invert(0.85) hue-rotate(180deg) sepia(0.16) contrast(0.98)';
    }
    if (settings.theme === 'sepia') {
      return 'sepia(0.28) brightness(0.97) contrast(0.98)';
    }
    return undefined;
  }, [settings.pdfThemeFilter, settings.theme]);

  // Sync page if user jumped via Table of Contents, Notebook, or Bookmarks drawer
  useEffect(() => {
    const locPage = Math.max(1, book.locator?.pageIndex || book.locator?.locationNumber || 1);
    if (locPage !== currentPage && locPage <= totalPages) {
      setCurrentPage(locPage);
    }
  }, [book.locator?.pageIndex, book.locator?.locationNumber, totalPages]);

  // Clear active pointer selection when page changes or when selection bar closes
  useEffect(() => {
    setAnchorWordIndex(null);
    setFocusWordIndex(null);
    setRegionStartPx(null);
    setRegionRectPx(null);
    setIsPointerDragging(false);
    setActiveInkPoints([]);
  }, [currentPage]);

  useEffect(() => {
    if (!hasActiveSelection && !isPointerDragging) {
      setAnchorWordIndex(null);
      setFocusWordIndex(null);
      setRegionRectPx(null);
      setRegionStartPx(null);
    }
  }, [hasActiveSelection, isPointerDragging]);

  // Ensure pointer dragging never stays stuck if pointer is released outside canvas or cancelled by touch scroll
  useEffect(() => {
    if (!isPointerDragging) return;
    const cancelStuckDrag = () => {
      setIsPointerDragging(false);
      pointerDownInfoRef.current = null;
      setSwipeDeltaX(0);
      setActiveInkPoints([]);
    };
    window.addEventListener('pointercancel', cancelStuckDrag);
    return () => window.removeEventListener('pointercancel', cancelStuckDrag);
  }, [isPointerDragging]);

  // 1. Load PDF binary from Tier 3 (`db.bookBinaries`) & background-index embedded text for In-PDF Full-Text Search
  useEffect(() => {
    let isMounted = true;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      try {
        setLoadError(null);
        const binaryRecord = await db.bookBinaries.get(book.id);
        if (!binaryRecord || !binaryRecord.data) {
          setLoadError('Book binary data not found in local storage.');
          return;
        }

        const safeCopy = new Uint8Array(binaryRecord.data.slice(0));
        const loadingTask = pdfjsLib.getDocument({
          data: safeCopy,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
        });

        const doc = await loadingTask.promise;
        if (!isMounted) {
          void (doc as any).destroy?.();
          return;
        }
        loadedDoc = doc;
        const numPages = Math.max(1, doc.numPages);
        setPdfDoc(doc);
        setTotalPages(numPages);
        void updateBookTotalLocations(book.id, numPages);

        // Background index embedded text across pages (up to 80 pages) so In-Book Search works immediately
        const maxIndexPages = Math.min(numPages, 80);
        for (let p = 1; p <= maxIndexPages; p++) {
          if (!isMounted) break;
          if (activeBookContent?.ocrByPage?.[p]) continue;
          try {
            const pdfPage = await doc.getPage(p);
            const tc = await pdfPage.getTextContent();
            const rawPageStr = (tc.items || [])
              .map((it: any) => it.str || '')
              .join(' ');
            const cleanedPageStr = cleanExtractedText(rawPageStr);
            if (cleanedPageStr.length >= 12) {
              await savePageOcrText(book.id, p, cleanedPageStr);
            }
          } catch {
            // ignore background indexing errors
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err?.message || 'Unable to open document.');
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (loadedDoc) {
        void (loadedDoc as any).destroy?.();
      }
    };
  }, [book.id]);

  // 2. Silent Automatic Live Text Engine with True Word Bounding Boxes (`output: { text: true, blocks: true }`)
  const runAutomaticLiveText = useCallback(
    async (page: pdfjsLib.PDFPageProxy, pageNum: number, runToken: number) => {
      const cacheKey = `${book.id}:${pageNum}`;
      const cachedBoxes = pageWordBoxCache.get(cacheKey);
      if (cachedBoxes && cachedBoxes.length > 0) {
        setWordBoxes(cachedBoxes);
        return;
      }

      setIsIndexingLiveText(true);
      try {
        const ocrViewport = page.getViewport({ scale: 1.85 });
        const offscreen = document.createElement('canvas');
        offscreen.width = ocrViewport.width;
        offscreen.height = ocrViewport.height;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
        await page.render({ canvasContext: ctx, canvas: offscreen, viewport: ocrViewport }).promise;
        if (ocrAbortRef.current !== runToken) return;

        const worker = await getSharedOcrWorker();
        if (ocrAbortRef.current !== runToken) return;

        // Request both text AND hierarchical blocks so every word has its exact pixel bbox {x0, y0, x1, y1}
        const result = await worker.recognize(
          offscreen,
          {},
          { text: true, blocks: true }
        );
        if (ocrAbortRef.current !== runToken) return;

        const imgW = Math.max(1, offscreen.width);
        const imgH = Math.max(1, offscreen.height);
        const extractedBoxes: PageWordBox[] = [];
        let wordCounter = 0;
        let lineCounter = 0;

        const blocks = result?.data?.blocks || [];
        for (const block of blocks) {
          for (const para of block.paragraphs || []) {
            for (const line of para.lines || []) {
              const currentLineIdx = lineCounter++;
              for (const w of line.words || []) {
                const cleanedWord = (w.text || '').trim();
                if (!cleanedWord || !w.bbox) continue;
                const leftPct = Math.max(0, Math.min(98, (w.bbox.x0 / imgW) * 100));
                const topPct = Math.max(0, Math.min(98, (w.bbox.y0 / imgH) * 100));
                const widthPct = Math.max(
                  0.8,
                  Math.min(100 - leftPct, ((w.bbox.x1 - w.bbox.x0) / imgW) * 100)
                );
                const heightPct = Math.max(
                  1.0,
                  Math.min(20, ((w.bbox.y1 - w.bbox.y0) / imgH) * 100)
                );
                extractedBoxes.push({
                  id: `ocr-w-${pageNum}-${wordCounter}`,
                  wordIndex: wordCounter++,
                  lineIndex: currentLineIdx,
                  text: cleanedWord,
                  leftPct,
                  topPct,
                  widthPct,
                  heightPct,
                  isRtl: isRtlText(cleanedWord),
                });
              }
            }
          }
        }

        const fullRecognizedText = cleanExtractedText(result?.data?.text || '');
        if (fullRecognizedText.length > 0) {
          await savePageOcrText(book.id, pageNum, fullRecognizedText);
        }

        if (extractedBoxes.length > 0) {
          pageWordBoxCache.set(cacheKey, extractedBoxes);
          setWordBoxes(extractedBoxes);
        }
      } catch (err) {
        console.warn('Background Live Text indexing note:', err);
      } finally {
        if (ocrAbortRef.current === runToken) {
          setIsIndexingLiveText(false);
        }
      }
    },
    [book.id, savePageOcrText]
  );

  // 3. Render Canvas + Build Exact Word-Level Bounding Boxes
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const runToken = ++ocrAbortRef.current;

    const renderPageAndWordLayer = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const safePageNum = Math.max(1, Math.min(pdfDoc.numPages, currentPage));
        const page = await pdfDoc.getPage(safePageNum);
        if (cancelled || !canvasRef.current) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = viewportContainerRef.current?.clientWidth
          ? Math.max(260, viewportContainerRef.current.clientWidth - 28)
          : 740;

        const fitScale = Math.min(1.45, containerWidth / Math.max(1, baseViewport.width));
        const effectiveScale = fitScale * scale;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const cssViewport = page.getViewport({ scale: effectiveScale });
        const hiDpiViewport = page.getViewport({ scale: effectiveScale * dpr });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cssW = Math.round(cssViewport.width);
        const cssH = Math.round(cssViewport.height);
        setCanvasCssSize({ width: cssW, height: cssH });

        canvas.width = hiDpiViewport.width;
        canvas.height = hiDpiViewport.height;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const task = page.render({
          canvasContext: ctx,
          canvas,
          viewport: hiDpiViewport,
        });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;

        // Extract embedded PDF text items and merge kerning fragments into exact Word Bounding Boxes
        const textContent = await page.getTextContent();
        if (cancelled) return;

        const rawItems = (textContent.items || []) as {
          str: string;
          transform?: number[];
          width?: number;
          height?: number;
        }[];

        // Step A: Transform each PDF item into CSS viewport coordinates
        interface PositionedGlyphRun {
          str: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }

        const glyphRuns: PositionedGlyphRun[] = [];
        for (const item of rawItems) {
          if (!item.str || !item.transform) continue;
          if (!item.str.trim()) continue;

          const tx = pdfjsLib.Util.transform(cssViewport.transform, item.transform);
          const x = tx[4];
          const y = tx[5];
          const fontH = Math.max(9, Math.hypot(tx[2], tx[3]));
          const itemW = Math.max(
            fontH * 0.35,
            (item.width || item.str.length * (fontH * 0.48)) * effectiveScale
          );

          glyphRuns.push({
            str: item.str,
            x,
            y,
            width: itemW,
            height: fontH,
          });
        }

        // Step B: Group glyph runs into horizontal lines by baseline Y
        const lines: { y: number; height: number; runs: PositionedGlyphRun[] }[] = [];
        for (const run of glyphRuns) {
          const existingLine = lines.find(
            (ln) => Math.abs(ln.y - run.y) <= Math.max(ln.height, run.height) * 0.45
          );
          if (existingLine) {
            existingLine.runs.push(run);
            existingLine.height = Math.max(existingLine.height, run.height);
          } else {
            lines.push({
              y: run.y,
              height: run.height,
              runs: [run],
            });
          }
        }

        // Sort lines top-to-bottom
        lines.sort((a, b) => a.y - b.y);

        // Step C: Within each line, merge kerning fragments and split on real word boundaries
        const builtWordBoxes: PageWordBox[] = [];
        let globalWordIdx = 0;

        lines.forEach((line, lineIdx) => {
          const lineRtl = isRtlText(line.runs.map((r) => r.str).join(''));
          line.runs.sort((a, b) => a.x - b.x);

          const clusters: { text: string; minX: number; maxX: number; height: number }[] = [];
          for (const run of line.runs) {
            const prev = clusters[clusters.length - 1];
            const startsWithCombiningOrReplacement =
              /^[\p{M}\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963\uFFFD]/u.test(
                run.str.trim()
              );
            if (prev) {
              const gap = run.x - prev.maxX;
              if (
                startsWithCombiningOrReplacement ||
                (gap < line.height * 0.24 && gap >= -line.height * 0.65)
              ) {
                prev.text += run.str;
                prev.maxX = Math.max(prev.maxX, run.x + run.width);
                prev.height = Math.max(prev.height, run.height);
                continue;
              }
            }
            clusters.push({
              text: run.str,
              minX: run.x,
              maxX: run.x + run.width,
              height: run.height,
            });
          }

          const lineWords: PageWordBox[] = [];
          for (const cluster of clusters) {
            const parts = cluster.text.trim().split(/\s+/).filter(Boolean);
            if (parts.length === 0) continue;

            const totalChars = Math.max(
              1,
              parts.reduce((acc, w) => acc + w.length, 0) + (parts.length - 1)
            );
            const clusterWidth = Math.max(4, cluster.maxX - cluster.minX);
            let cursorX = cluster.minX;

            parts.forEach((wordStr, pIdx) => {
              const frac = wordStr.length / totalChars;
              const wordW = Math.max(4, clusterWidth * frac);
              const spaceW = pIdx < parts.length - 1 ? clusterWidth * (1 / totalChars) : 0;

              const topPx = Math.max(0, line.y - cluster.height * 0.88);
              const leftPct = Math.max(0, Math.min(98, (cursorX / Math.max(1, cssW)) * 100));
              const topPct = Math.max(0, Math.min(98, (topPx / Math.max(1, cssH)) * 100));
              const widthPct = Math.max(
                0.6,
                Math.min(100 - leftPct, (wordW / Math.max(1, cssW)) * 100)
              );
              const heightPct = Math.max(
                1.2,
                Math.min(15, ((cluster.height * 1.18) / Math.max(1, cssH)) * 100)
              );

              lineWords.push({
                id: `pdf-w-${safePageNum}-${lineIdx}-${pIdx}-${cursorX.toFixed(0)}`,
                wordIndex: 0,
                lineIndex: lineIdx,
                text: wordStr,
                leftPct,
                topPct,
                widthPct,
                heightPct,
                isRtl: lineRtl || isRtlText(wordStr),
              });

              cursorX += wordW + spaceW;
            });
          }

          if (lineRtl) {
            lineWords.reverse();
          }

          const repairedLineTokens = sanitizeAndRepairUnicodeText(
            lineWords.map((w) => w.text).join(' ')
          )
            .split(/\s+/)
            .filter(Boolean);
          if (repairedLineTokens.length === lineWords.length) {
            lineWords.forEach((lw, idx) => {
              lw.text = repairedLineTokens[idx];
            });
          } else {
            lineWords.forEach((lw) => {
              lw.text = sanitizeAndRepairUnicodeText(lw.text) || lw.text.replace(/\uFFFD/g, '');
            });
          }

          for (const lw of lineWords) {
            if (!lw.text) continue;
            lw.wordIndex = globalWordIdx++;
            builtWordBoxes.push(lw);
          }
        });

        const totalChars = builtWordBoxes.reduce((sum, w) => sum + w.text.length, 0);

        if (totalChars >= 12) {
          setIsIndexingLiveText(false);
          setWordBoxes(builtWordBoxes);
          const fullEmbeddedText = cleanExtractedText(
            builtWordBoxes.map((w) => w.text).join(' ')
          );
          if (fullEmbeddedText.length >= 12 && !activeBookContent?.ocrByPage?.[safePageNum]) {
            void savePageOcrText(book.id, safePageNum, fullEmbeddedText);
          }
        } else {
          // Scanned image page detected -> run automatic Live Text word-box recognition
          setWordBoxes([]);
          await runAutomaticLiveText(page, safePageNum, runToken);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF render note:', err);
        }
      }
    };

    renderPageAndWordLayer();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, scale, runAutomaticLiveText]);

  // 3B. Render Companion Right-Hand Page when 2-Page Spread Mode (`settings.pdfSpreadMode === 'spread'`) is enabled
  useEffect(() => {
    if (!pdfDoc || settings.pdfSpreadMode !== 'spread' || currentPage >= totalPages) return;
    let cancelled = false;

    const renderCompanionSpreadPage = async () => {
      try {
        if (secondRenderTaskRef.current) {
          try {
            secondRenderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }
        const companionPageNum = currentPage + 1;
        if (companionPageNum > pdfDoc.numPages) return;
        const page = await pdfDoc.getPage(companionPageNum);
        if (cancelled || !secondCanvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const baseViewport = page.getViewport({ scale: 1 });
        const effectiveScale = canvasCssSize.width / Math.max(1, baseViewport.width);
        const hiDpiViewport = page.getViewport({ scale: effectiveScale * dpr });

        const canvas = secondCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = hiDpiViewport.width;
        canvas.height = hiDpiViewport.height;
        canvas.style.width = `${canvasCssSize.width}px`;
        canvas.style.height = `${canvasCssSize.height}px`;

        const task = page.render({
          canvasContext: ctx,
          canvas,
          viewport: hiDpiViewport,
        });
        secondRenderTaskRef.current = task;
        await task.promise;
      } catch {
        // ignore companion page render cancellation
      }
    };

    void renderCompanionSpreadPage();
    return () => {
      cancelled = true;
      try {
        secondRenderTaskRef.current?.cancel();
      } catch {
        // ignore
      }
    };
  }, [pdfDoc, currentPage, totalPages, settings.pdfSpreadMode, canvasCssSize.width, canvasCssSize.height]);

  // 4. Geometric Hit-Testing: Find the exact PageWordBox under/nearest to pointer (xPct, yPct)
  const findWordIndexAtPoint = useCallback(
    (xPct: number, yPct: number, maxTolerancePct = 2.6): number | null => {
      if (wordBoxes.length === 0) return null;

      // Pass 1: Direct bounding-box hit
      for (const w of wordBoxes) {
        if (
          xPct >= w.leftPct - 0.6 &&
          xPct <= w.leftPct + w.widthPct + 0.6 &&
          yPct >= w.topPct - 0.4 &&
          yPct <= w.topPct + w.heightPct + 0.4
        ) {
          return w.wordIndex;
        }
      }

      // Pass 2: Closest word center on the same line within tolerance
      let bestIdx: number | null = null;
      let bestDist = Infinity;
      for (const w of wordBoxes) {
        const cx = w.leftPct + w.widthPct / 2;
        const cy = w.topPct + w.heightPct / 2;
        const dist = Math.hypot(xPct - cx, (yPct - cy) * 2.5);
        if (dist < bestDist && dist <= maxTolerancePct * 2.2) {
          bestDist = dist;
          bestIdx = w.wordIndex;
        }
      }
      return bestIdx;
    },
    [wordBoxes]
  );

  // Selected word indices range during or after drag
  const selectedRange = useMemo(() => {
    if (anchorWordIndex === null || focusWordIndex === null) return null;
    return {
      start: Math.min(anchorWordIndex, focusWordIndex),
      end: Math.max(anchorWordIndex, focusWordIndex),
    };
  }, [anchorWordIndex, focusWordIndex]);

  // Page highlights for current page
  const pageHighlights = useMemo(
    () =>
      highlights.filter(
        (h) =>
          h.bookId === book.id &&
          (h.locationNumber === currentPage || h.pageIndex === currentPage)
      ),
    [highlights, book.id, currentPage]
  );

  // Resolve every saved Highlight on this page into exact HighlightRect[]
  const resolvedPageHighlights = useMemo(() => {
    const resolved: { hl: Highlight; rects: HighlightRect[]; matchedWordIndices: number[] }[] = [];
    if (pageHighlights.length === 0) return resolved;

    const normalizeToken = (s: string) =>
      sanitizeAndRepairUnicodeText(s)
        .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '')
        .toLowerCase();

    const pageTokens = wordBoxes.map((w) => normalizeToken(w.text));

    for (const hl of pageHighlights) {
      if (hl.rects && hl.rects.length > 0) {
        const matchedIndices: number[] = [];
        for (const w of wordBoxes) {
          const cx = w.leftPct + w.widthPct / 2;
          const cy = w.topPct + w.heightPct / 2;
          if (
            hl.rects.some(
              (r) =>
                cx >= r.left - 0.5 &&
                cx <= r.left + r.width + 0.5 &&
                cy >= r.top - 0.5 &&
                cy <= r.top + r.height + 0.5
            )
          ) {
            matchedIndices.push(w.wordIndex);
          }
        }
        resolved.push({ hl, rects: hl.rects, matchedWordIndices: matchedIndices });
        continue;
      }

      if (wordBoxes.length > 0) {
        const hlTokens = (hl.selectedText || '')
          .trim()
          .split(/\s+/)
          .map(normalizeToken)
          .filter(Boolean);

        const matchedWords: PageWordBox[] = [];

        if (hlTokens.length > 0 && !(hlTokens.length === 1 && hlTokens[0].length < 2)) {
          for (let i = 0; i <= pageTokens.length - hlTokens.length; i++) {
            let matches = true;
            for (let j = 0; j < hlTokens.length; j++) {
              if (pageTokens[i + j] !== hlTokens[j]) {
                matches = false;
                break;
              }
            }
            if (matches) {
              for (let j = 0; j < hlTokens.length; j++) {
                matchedWords.push(wordBoxes[i + j]);
              }
              break;
            }
          }
        }

        const targetStream = hlTokens.join('');
        if (matchedWords.length === 0 && targetStream.length >= 3) {
          for (let i = 0; i < pageTokens.length; i++) {
            let acc = '';
            const candidate: PageWordBox[] = [];
            for (let j = i; j < pageTokens.length && acc.length < targetStream.length + 12; j++) {
              if (!pageTokens[j]) continue;
              acc += pageTokens[j];
              candidate.push(wordBoxes[j]);
              if (acc === targetStream || (targetStream.length >= 6 && acc.includes(targetStream))) {
                matchedWords.push(...candidate);
                break;
              }
            }
            if (matchedWords.length > 0) break;
          }
        }

        if (matchedWords.length > 0) {
          resolved.push({
            hl,
            rects: buildMergedLineRects(matchedWords),
            matchedWordIndices: matchedWords.map((w) => w.wordIndex),
          });
          continue;
        }
      }

      resolved.push({
        hl,
        rects: [{ left: 8, top: 4, width: 84, height: 3.2 }],
        matchedWordIndices: [],
      });
    }

    return resolved;
  }, [wordBoxes, pageHighlights]);

  // Resolve Search Term Spotlight Rects (when jumping from In-Book Search inside a PDF)
  const searchSpotlightRects = useMemo<HighlightRect[]>(() => {
    if (!spotlightSearchTerm || wordBoxes.length === 0) return [];
    const q = spotlightSearchTerm.trim().toLowerCase();
    if (q.length < 2) return [];
    const matched = wordBoxes.filter((w) => w.text.toLowerCase().includes(q));
    return buildMergedLineRects(matched);
  }, [spotlightSearchTerm, wordBoxes]);

  const highlightedWordMap = useMemo(() => {
    const map = new Map<number, Highlight>();
    for (const item of resolvedPageHighlights) {
      for (const wIdx of item.matchedWordIndices) {
        map.set(wIdx, item.hl);
      }
    }
    return map;
  }, [resolvedPageHighlights]);

  // Spotlight & Smooth Auto-Scroll when jumping from Research Notebook, Notes Drawer, or In-PDF Search
  useEffect(() => {
    if (!activeJumpTarget) return;
    const targetPage = activeJumpTarget.locationNumber || activeJumpTarget.pageIndex;
    if (targetPage && targetPage !== currentPage && targetPage <= totalPages) {
      setCurrentPage(targetPage);
    }
    if (activeJumpTarget.highlightId) {
      setSpotlightHighlightId(activeJumpTarget.highlightId);
      const timer = window.setTimeout(() => {
        const el = document.querySelector(
          `[data-pdf-highlight-id="${activeJumpTarget.highlightId}"]`
        );
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 180);
      const clearTimer = window.setTimeout(() => {
        setSpotlightHighlightId(null);
        setActiveJumpTarget(null);
      }, 3200);
      return () => {
        window.clearTimeout(timer);
        window.clearTimeout(clearTimer);
      };
    } else if (activeJumpTarget.searchText) {
      setSpotlightSearchTerm(activeJumpTarget.searchText);
      const clearTimer = window.setTimeout(() => {
        setSpotlightSearchTerm(null);
        setActiveJumpTarget(null);
      }, 3600);
      return () => window.clearTimeout(clearTimer);
    }
  }, [activeJumpTarget, currentPage, totalPages, setActiveJumpTarget]);

  // Fallback Region Crop OCR (if user drags a box on an image before full-page indexing finishes or over a diagram)
  const cropAndRecognizeRegion = async (rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) => {
    if (!canvasRef.current || !pageWrapperRef.current) return;
    setIsIndexingLiveText(true);
    try {
      const canvas = canvasRef.current;
      const wrapperBounds = pageWrapperRef.current.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, wrapperBounds.width);
      const scaleY = canvas.height / Math.max(1, wrapperBounds.height);

      const normRect: HighlightRect = {
        left: +Math.max(0, Math.min(98, (rect.left / Math.max(1, wrapperBounds.width)) * 100)).toFixed(2),
        top: +Math.max(0, Math.min(98, (rect.top / Math.max(1, wrapperBounds.height)) * 100)).toFixed(2),
        width: +Math.max(2, Math.min(100, (rect.width / Math.max(1, wrapperBounds.width)) * 100)).toFixed(2),
        height: +Math.max(1.5, Math.min(100, (rect.height / Math.max(1, wrapperBounds.height)) * 100)).toFixed(2),
      };

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(48, Math.round(rect.width * scaleX));
      cropCanvas.height = Math.max(28, Math.round(rect.height * scaleY));
      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
        ctx.drawImage(
          canvas,
          rect.left * scaleX,
          rect.top * scaleY,
          rect.width * scaleX,
          rect.height * scaleY,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        );
        const snippetDataUrl = cropCanvas.toDataURL('image/png');
        const worker = await getSharedOcrWorker();
        const res = await worker.recognize(cropCanvas, {}, { text: true });
        const cleaned = cleanExtractedText(res?.data?.text || '');
        onSelectText(
          cleaned || `Page ${currentPage} Figure Excerpt`,
          currentPage,
          [normRect],
          snippetDataUrl
        );
      }
    } catch (err) {
      console.warn('Region recognition note:', err);
    } finally {
      setIsIndexingLiveText(false);
      setRegionRectPx(null);
      setRegionStartPx(null);
    }
  };

  // Pointer Down on Page Image/Canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pageWrapperRef.current || e.button !== 0) return;
    const bounds = pageWrapperRef.current.getBoundingClientRect();
    const xPx = e.clientX - bounds.left;
    const yPx = e.clientY - bounds.top;
    const xPct = +Math.max(0, Math.min(100, (xPx / Math.max(1, bounds.width)) * 100)).toFixed(2);
    const yPct = +Math.max(0, Math.min(100, (yPx / Math.max(1, bounds.height)) * 100)).toFixed(2);

    // If Freehand Vector Ink Mode is active (or Apple Pencil stylus is used while Ink Mode is active)
    if (isInkMode) {
      setIsPointerDragging(true);
      setActiveInkPoints([{ x: xPct, y: yPct }]);
      return;
    }

    const hitWordIdx = findWordIndexAtPoint(xPct, yPct, 2.8);

    pointerDownInfoRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      xPx,
      yPx,
      downWordIndex: hitWordIdx,
      time: Date.now(),
      pointerType: e.pointerType,
    };
    setSwipeDeltaX(0);
    setIsPointerDragging(true);
    setAnchorWordIndex(null);
    setFocusWordIndex(null);
    setRegionStartPx(hitWordIdx === null ? { x: xPx, y: yPx } : null);
    setRegionRectPx(null);
  };

  // Pointer Move on Page Image/Canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pageWrapperRef.current) return;
    const bounds = pageWrapperRef.current.getBoundingClientRect();
    const xPx = e.clientX - bounds.left;
    const yPx = e.clientY - bounds.top;
    const xPct = +Math.max(0, Math.min(100, (xPx / Math.max(1, bounds.width)) * 100)).toFixed(2);
    const yPct = +Math.max(0, Math.min(100, (yPx / Math.max(1, bounds.height)) * 100)).toFixed(2);

    if (isInkMode) {
      if (!isPointerDragging) return;
      setActiveInkPoints((prev) => [...prev, { x: xPct, y: yPct }]);
      return;
    }

    if (!isPointerDragging || !pointerDownInfoRef.current) {
      const hoverIdx = findWordIndexAtPoint(xPct, yPct, 1.5);
      setIsHoveringWord(hoverIdx !== null);
      return;
    }

    const downInfo = pointerDownInfoRef.current;
    const dx = e.clientX - downInfo.clientX;
    const dy = e.clientY - downInfo.clientY;
    const dist = Math.hypot(dx, dy);

    // Require at least 5px of intentional drag movement before showing any selection highlight
    if (dist < 5) return;

    // Check if touch user is doing a fast horizontal page-turn swipe
    if (downInfo.pointerType === 'touch' && scale <= 1.08) {
      const elapsed = Date.now() - downInfo.time;
      if (elapsed < 380 && Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        setAnchorWordIndex(null);
        setFocusWordIndex(null);
        setRegionRectPx(null);
        setSwipeDeltaX(Math.max(-90, Math.min(90, dx * 0.45)));
        return;
      }
    }

    if (downInfo.downWordIndex !== null) {
      if (anchorWordIndex === null) {
        setAnchorWordIndex(downInfo.downWordIndex);
      }
      const curIdx = findWordIndexAtPoint(xPct, yPct, 4.5);
      if (curIdx !== null) {
        setFocusWordIndex(curIdx);
      } else if (focusWordIndex === null) {
        setFocusWordIndex(downInfo.downWordIndex);
      }
    } else if (regionStartPx) {
      setRegionRectPx({
        left: Math.min(regionStartPx.x, xPx),
        top: Math.min(regionStartPx.y, yPx),
        width: Math.abs(xPx - regionStartPx.x),
        height: Math.abs(yPx - regionStartPx.y),
      });
    }
  };

  // Pointer Up: Handle Ink Stroke Save, Mobile Swipe Page-Turn, 3-Zone Edge Tap, or Finalize Word Selection
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInkMode) {
      setIsPointerDragging(false);
      if (activeInkPoints.length >= 2) {
        const newStroke: PdfInkStroke = {
          id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pageNumber: currentPage,
          color: inkColor,
          width: 0.45,
          points: activeInkPoints,
          createdAt: Date.now(),
        };
        void savePageInkStrokes(book.id, currentPage, [...pageInkStrokes, newStroke]);
      }
      setActiveInkPoints([]);
      return;
    }

    const downInfo = pointerDownInfoRef.current;
    pointerDownInfoRef.current = null;
    setSwipeDeltaX(0);

    if (!isPointerDragging) return;
    setIsPointerDragging(false);

    if (downInfo && pageWrapperRef.current) {
      const dx = e.clientX - downInfo.clientX;
      const dy = e.clientY - downInfo.clientY;
      const dist = Math.hypot(dx, dy);
      const elapsed = Date.now() - downInfo.time;
      const bounds = pageWrapperRef.current.getBoundingClientRect();
      const xPct = ((e.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;

      // 1. Fast Horizontal Swipe on Touch Devices -> Turn Page!
      if (
        downInfo.pointerType === 'touch' &&
        scale <= 1.08 &&
        elapsed < 450 &&
        Math.abs(dx) > 58 &&
        Math.abs(dx) > Math.abs(dy) * 1.5
      ) {
        setAnchorWordIndex(null);
        setFocusWordIndex(null);
        setRegionRectPx(null);
        if (dx < 0 && currentPage < totalPages) {
          goToPage(currentPage + 1);
        } else if (dx > 0 && currentPage > 1) {
          goToPage(currentPage - 1);
        }
        return;
      }

      // 2. Single Stationary Tap / Click (dist < 7px)
      if (dist < 7) {
        if (downInfo.downWordIndex !== null && highlightedWordMap.has(downInfo.downWordIndex)) {
          const existingHl = highlightedWordMap.get(downInfo.downWordIndex)!;
          setAnchorWordIndex(null);
          setFocusWordIndex(null);
          onEditHighlight(existingHl);
          return;
        }

        setAnchorWordIndex(null);
        setFocusWordIndex(null);
        setRegionRectPx(null);

        if (xPct <= 14 && currentPage > 1) {
          goToPage(currentPage - 1);
        } else if (xPct >= 86 && currentPage < totalPages) {
          goToPage(currentPage + 1);
        }
        return;
      }
    }

    if (anchorWordIndex !== null && focusWordIndex !== null) {
      const start = Math.min(anchorWordIndex, focusWordIndex);
      const end = Math.max(anchorWordIndex, focusWordIndex);

      const selectedWords = wordBoxes.filter(
        (w) => w.wordIndex >= start && w.wordIndex <= end
      );

      if (selectedWords.length > 0) {
        const phrase = cleanExtractedText(selectedWords.map((w) => w.text).join(' '));
        const rects = buildMergedLineRects(selectedWords);
        if (phrase.length > 0) {
          onSelectText(phrase, currentPage, rects);
        }
      }
      return;
    }

    if (regionRectPx && regionRectPx.width > 16 && regionRectPx.height > 12) {
      if (pageWrapperRef.current && wordBoxes.length > 0) {
        const bounds = pageWrapperRef.current.getBoundingClientRect();
        const rLeftPct = (regionRectPx.left / Math.max(1, bounds.width)) * 100;
        const rRightPct =
          ((regionRectPx.left + regionRectPx.width) / Math.max(1, bounds.width)) * 100;
        const rTopPct = (regionRectPx.top / Math.max(1, bounds.height)) * 100;
        const rBottomPct =
          ((regionRectPx.top + regionRectPx.height) / Math.max(1, bounds.height)) * 100;

        const wordsInsideRect = wordBoxes.filter((w) => {
          const cx = w.leftPct + w.widthPct / 2;
          const cy = w.topPct + w.heightPct / 2;
          return cx >= rLeftPct && cx <= rRightPct && cy >= rTopPct && cy <= rBottomPct;
        });

        if (wordsInsideRect.length > 0) {
          const phrase = cleanExtractedText(wordsInsideRect.map((w) => w.text).join(' '));
          const rects = buildMergedLineRects(wordsInsideRect);
          let snippetDataUrl: string | undefined;
          if (canvasRef.current) {
            try {
              const canvas = canvasRef.current;
              const scaleX = canvas.width / Math.max(1, bounds.width);
              const scaleY = canvas.height / Math.max(1, bounds.height);
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = Math.max(48, Math.round(regionRectPx.width * scaleX));
              cropCanvas.height = Math.max(28, Math.round(regionRectPx.height * scaleY));
              const ctx = cropCanvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
                ctx.drawImage(
                  canvas,
                  regionRectPx.left * scaleX,
                  regionRectPx.top * scaleY,
                  regionRectPx.width * scaleX,
                  regionRectPx.height * scaleY,
                  0,
                  0,
                  cropCanvas.width,
                  cropCanvas.height
                );
                snippetDataUrl = cropCanvas.toDataURL('image/png');
              }
            } catch {
              // ignore crop error
            }
          }
          setRegionRectPx(null);
          setRegionStartPx(null);
          onSelectText(phrase, currentPage, rects, snippetDataUrl);
          return;
        }
      }

      cropAndRecognizeRegion(regionRectPx);
    } else {
      setRegionRectPx(null);
      setRegionStartPx(null);
    }
  };

  // Double-Click on a Word on the Image -> Select that Exact Word & Open Word Wise
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInkMode || !pageWrapperRef.current) return;
    const bounds = pageWrapperRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
    const yPct = ((e.clientY - bounds.top) / Math.max(1, bounds.height)) * 100;

    const hitIdx = findWordIndexAtPoint(xPct, yPct, 2.8);
    if (hitIdx !== null) {
      const targetWord = wordBoxes.find((w) => w.wordIndex === hitIdx);
      if (targetWord) {
        setAnchorWordIndex(hitIdx);
        setFocusWordIndex(hitIdx);
        const lineWords = wordBoxes
          .filter((w) => w.lineIndex === targetWord.lineIndex)
          .map((w) => w.text)
          .join(' ');
        const rects = buildMergedLineRects([targetWord]);
        onSelectText(targetWord.text, currentPage, rects);
        onWordLookup(targetWord.text, lineWords || targetWord.text);
      }
    }
  };

  // Two-Finger Pinch-to-Zoom (iPhone / iPad / Android) & Trackpad Ctrl+Wheel Zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = d;
      pinchStartScaleRef.current = scale;
      setIsPointerDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = d / Math.max(10, pinchStartDistRef.current);
      const nextScale = Math.max(0.65, Math.min(2.3, +(pinchStartScaleRef.current * ratio).toFixed(2)));
      setScale(nextScale);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setScale((s) => Math.max(0.65, Math.min(2.3, +(s + delta).toFixed(2))));
    }
  };

  const goToPage = (target: number) => {
    const clamped = Math.max(1, Math.min(totalPages, target));
    setCurrentPage(clamped);
    const pct = Math.round((clamped / Math.max(1, totalPages)) * 100);
    updateActiveLocator({
      pageIndex: clamped,
      locationNumber: clamped,
      percentage: pct,
    });
  };

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-full w-full overflow-hidden relative"
    >
      {/* Floating Freehand Ink Toolbar (When Ink / Apple Pencil Mode is Active) */}
      {isInkMode && (
        <div
          className={`z-30 mx-auto mt-3 px-3.5 py-2 rounded-xl border shadow-lg flex flex-wrap items-center gap-2.5 text-xs ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <span className="font-semibold">Stylus / Ink:</span>
          <div className="flex items-center gap-1.5">
            {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColor[]).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setInkColor(color)}
                className={`w-5 h-5 rounded-full cursor-pointer ${
                  HIGHLIGHT_SWATCHES[color].dotClass
                } ${inkColor === color ? 'ring-2 ring-offset-1 ring-current' : 'opacity-70'}`}
                title={HIGHLIGHT_SWATCHES[color].label}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={pageInkStrokes.length === 0}
            onClick={() =>
              void savePageInkStrokes(book.id, currentPage, pageInkStrokes.slice(0, -1))
            }
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border cursor-pointer disabled:opacity-35 ${palette.borderHairline}`}
            title="Undo Last Stroke"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            disabled={pageInkStrokes.length === 0}
            onClick={() => void savePageInkStrokes(book.id, currentPage, [])}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-rose-600 cursor-pointer disabled:opacity-35 ${palette.borderHairline}`}
            title="Clear Page Ink"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setIsInkMode(false)}
            className={`px-2.5 py-1 rounded font-semibold text-white cursor-pointer ${palette.accentBg}`}
          >
            Done
          </button>
        </div>
      )}

      {/* Main Unified Page Viewport */}
      <div
        ref={viewportContainerRef}
        className="flex-1 overflow-auto px-2 sm:px-6 py-4 sm:py-6 flex flex-col items-center space-y-5"
      >
        {loadError ? (
          <div className="max-w-md my-auto text-center space-y-3 p-6 rounded-xl border border-current/15">
            <p className="text-sm font-medium">{loadError}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap xl:flex-nowrap items-start justify-center gap-4 max-w-full">
              {/* Interactive Visual Page with Geometric Apple-Live-Text Word Selection, Ink & Swipe Page Turn */}
              <div
              ref={pageWrapperRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                setIsPointerDragging(false);
                pointerDownInfoRef.current = null;
                setSwipeDeltaX(0);
                setActiveInkPoints([]);
              }}
              onDoubleClick={handleDoubleClick}
              style={{
                width: `${canvasCssSize.width}px`,
                height: `${canvasCssSize.height}px`,
                touchAction: isInkMode ? 'none' : 'pan-y',
                transform: swipeDeltaX ? `translateX(${swipeDeltaX}px)` : undefined,
                transition: swipeDeltaX ? 'none' : 'transform 180ms ease-out',
              }}
              className={`relative shadow-xl rounded-lg overflow-hidden border border-black/10 bg-white max-w-full shrink-0 select-none ${
                isInkMode
                  ? 'cursor-crosshair'
                  : isHoveringWord || isPointerDragging
                  ? 'cursor-text'
                  : 'cursor-default'
              }`}
            >
              {/* High-DPI Visual Page Canvas (Supports Smart Theme Filter & Auto-Crop Margins) */}
              <canvas
                ref={canvasRef}
                style={{
                  filter: pdfCanvasFilterStyle,
                  transform: settings.pdfAutoCropMargins ? 'scale(1.11)' : undefined,
                  transformOrigin: 'center center',
                }}
                className="block w-full h-full pointer-events-none transition-transform duration-200"
              />

              {/* Freehand Vector Ink SVG Layer (Normalized 0..100 Coordinates) */}
              {(pageInkStrokes.length > 0 || activeInkPoints.length > 1) && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full z-15 pointer-events-none"
                >
                  {pageInkStrokes.map((stroke) => (
                    <polyline
                      key={stroke.id}
                      fill="none"
                      stroke={INK_STROKE_HEX[stroke.color] || '#f59e0b'}
                      strokeWidth={stroke.width || 0.45}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.78}
                      points={stroke.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                    />
                  ))}
                  {activeInkPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={INK_STROKE_HEX[inkColor] || '#f59e0b'}
                      strokeWidth={0.45}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.85}
                      points={activeInkPoints.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                    />
                  )}
                </svg>
              )}

              {/* Saved Geometric Highlights & Search Spotlights Layer */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                {resolvedPageHighlights.map(({ hl, rects }) => {
                  const swatch = HIGHLIGHT_SWATCHES[hl.color] || HIGHLIGHT_SWATCHES.amber;
                  const isSpotlighted = spotlightHighlightId === hl.id;
                  return rects.map((r, rIdx) => (
                    <div
                      key={`${hl.id}-rect-${rIdx}`}
                      data-pdf-highlight-id={rIdx === 0 ? hl.id : undefined}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditHighlight(hl);
                      }}
                      title={
                        hl.note
                          ? `Note: ${hl.note} (Click to edit)`
                          : `"${hl.selectedText}" (Click to edit)`
                      }
                      style={{
                        left: `${r.left}%`,
                        top: `${r.top}%`,
                        width: `${r.width}%`,
                        height: `${r.height}%`,
                      }}
                      className={`absolute rounded-[3px] pointer-events-auto cursor-pointer transition-all ${
                        swatch.markClass
                      } opacity-50 hover:opacity-70 mix-blend-multiply ${
                        isSpotlighted
                          ? 'ring-3 ring-amber-500 ring-offset-1 opacity-80 animate-pulse'
                          : ''
                      }`}
                    />
                  ));
                })}

                {/* In-PDF Search Term Spotlight Rects */}
                {searchSpotlightRects.map((r, idx) => (
                  <div
                    key={`search-spot-${idx}`}
                    style={{
                      left: `${r.left}%`,
                      top: `${r.top}%`,
                      width: `${r.width}%`,
                      height: `${r.height}%`,
                    }}
                    className="absolute rounded-[3px] bg-amber-400/55 ring-2 ring-amber-500 animate-pulse pointer-events-none"
                  />
                ))}

                {/* Active Drag Word Selection Layer */}
                {selectedRange !== null &&
                  wordBoxes
                    .filter(
                      (w) =>
                        w.wordIndex >= selectedRange.start && w.wordIndex <= selectedRange.end
                    )
                    .map((w) => (
                      <span
                        key={w.id}
                        style={{
                          left: `${w.leftPct}%`,
                          top: `${w.topPct}%`,
                          width: `${w.widthPct}%`,
                          height: `${w.heightPct}%`,
                        }}
                        className="absolute rounded-[2px] bg-amber-500/35 ring-1 ring-amber-500/70 pointer-events-none"
                      />
                    ))}
              </div>

              {/* Region Selection Box */}
              {regionRectPx && (
                <div
                  style={{
                    left: regionRectPx.left,
                    top: regionRectPx.top,
                    width: regionRectPx.width,
                    height: regionRectPx.height,
                  }}
                  className="absolute z-20 border-2 border-amber-500 bg-amber-500/20 rounded pointer-events-none"
                />
              )}

              {/* Subtle Quiet Status Indicator while background Live Text is indexing a scanned page */}
              {isIndexingLiveText && (
                <div className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/80 text-stone-100 text-[11px] backdrop-blur-xs shadow-md pointer-events-none">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  <span>Live Text Indexing...</span>
                </div>
              )}

              {/* Quick Page Note Pin Button in Top-Right Corner */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const firstLineWords = wordBoxes.slice(0, 12);
                  const sampleWords = firstLineWords.map((w) => w.text).join(' ');
                  const rects =
                    firstLineWords.length > 0
                      ? buildMergedLineRects(firstLineWords)
                      : [{ left: 8, top: 4, width: 84, height: 3.2 }];
                  onSelectText(
                    cleanExtractedText(sampleWords) || `Page ${currentPage}`,
                    currentPage,
                    rects
                  );
                }}
                title="Add a margin note to this page"
                className="absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-900/65 hover:bg-stone-900/90 text-white text-[11px] font-medium backdrop-blur-xs shadow transition-opacity opacity-75 hover:opacity-100 cursor-pointer"
              >
                <MessageSquarePlus className="w-3 h-3 text-amber-400" />
                <span>Add Note</span>
              </button>
            </div>

            {/* Companion Right-Hand Page when 2-Page Spread Mode is Enabled on Desktop / iPad Landscape */}
            {settings.pdfSpreadMode === 'spread' && currentPage < totalPages && (
              <div
                onClick={() => goToPage(currentPage + 1)}
                title={`Click to focus Page ${currentPage + 1}`}
                style={{
                  width: `${canvasCssSize.width}px`,
                  height: `${canvasCssSize.height}px`,
                }}
                className="hidden xl:block relative shadow-xl rounded-lg overflow-hidden border border-black/10 bg-white max-w-full shrink-0 cursor-pointer group"
              >
                <canvas
                  ref={secondCanvasRef}
                  style={{
                    filter: pdfCanvasFilterStyle,
                    transform: settings.pdfAutoCropMargins ? 'scale(1.11)' : undefined,
                    transformOrigin: 'center center',
                  }}
                  className="block w-full h-full pointer-events-none transition-transform duration-200"
                />
                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md bg-stone-900/70 text-white text-[11px] font-medium backdrop-blur-xs">
                  Page {currentPage + 1} (Spread)
                </div>
              </div>
            )}
          </div>

            {/* Editable Margin Notes & Highlights on This Page */}
            {pageHighlights.length > 0 && (
              <div
                style={{ width: `${Math.min(720, Math.max(320, canvasCssSize.width))}px` }}
                className="max-w-full space-y-2 pb-4"
              >
                <div className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Page {currentPage} Annotations (Click to Edit)
                </div>
                {pageHighlights.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={() => onEditHighlight(hl)}
                    dir="auto"
                    className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 cursor-pointer hover:ring-1 hover:ring-amber-500/50 transition-all ${
                      spotlightHighlightId === hl.id
                        ? 'ring-2 ring-amber-500 bg-amber-500/10'
                        : `${palette.elevatedBg} ${palette.borderHairline}`
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-literata italic">"{hl.selectedText}"</div>
                      {hl.note && (
                        <div className={`font-medium ${palette.textSecondary}`}>
                          <strong>Note:</strong> {hl.note}
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] shrink-0 font-semibold underline ${palette.accentText}`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* PDF Page Grid & Thumbnail Overview Modal (Click-Outside Dismissible) */}
      {isPageGridOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPageGridOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-4xl max-h-[82dvh] rounded-t-2xl sm:rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="px-5 py-3.5 border-b border-current/10 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Page Overview & Annotations ({totalPages} Pages)
                </h3>
                <p className={`text-[11px] ${palette.textMuted}`}>
                  Jump directly to any page or annotated sheet
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPageGridOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const hlCount = highlights.filter(
                  (h) =>
                    h.bookId === book.id &&
                    (h.locationNumber === pageNum || h.pageIndex === pageNum)
                ).length;
                const inkCount = activeBookContent?.inkByPage?.[pageNum]?.length || 0;
                const snippet = (activeBookContent?.ocrByPage?.[pageNum] || '').slice(0, 75);
                const isCurrent = pageNum === currentPage;

                return (
                  <PdfThumbnailCard
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    totalPages={totalPages}
                    isCurrent={isCurrent}
                    hlCount={hlCount}
                    inkCount={inkCount}
                    snippet={snippet}
                    filterStyle={pdfCanvasFilterStyle}
                    palette={palette}
                    onSelectPage={(target) => {
                      goToPage(target);
                      setIsPageGridOpen(false);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Unified Bottom Page Scrubber, Ink/Crop/Filter Controls & Zoom Footer */}
      <footer
        className={`z-20 px-3 sm:px-6 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs tabular-nums shrink-0 ${palette.canvasBg} ${palette.borderHairline}`}
      >
        <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2.5 ${palette.textMuted}`}>
          <span>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>{Math.round((currentPage / Math.max(1, totalPages)) * 100)}%</span>

          {/* Page Grid, Auto-Crop, Smart Theme Filter & Freehand Ink Toggles */}
          <div className="flex items-center gap-1 ml-1 border-l border-current/15 pl-2">
            <button
              type="button"
              onClick={() => setIsPageGridOpen(true)}
              className={`p-1.5 rounded-md cursor-pointer ${palette.surfaceBg} ${palette.textSecondary}`}
              title="Page Thumbnail Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsInkMode((v) => !v)}
              className={`p-1.5 rounded-md cursor-pointer ${
                isInkMode
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Freehand Stylus / Apple Pencil Ink Annotation"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({ pdfAutoCropMargins: !settings.pdfAutoCropMargins })
              }
              className={`p-1.5 rounded-md cursor-pointer ${
                settings.pdfAutoCropMargins
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Trim PDF Margin Whitespace"
            >
              <Crop className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ pdfThemeFilter: !settings.pdfThemeFilter })}
              className={`p-1.5 rounded-md cursor-pointer ${
                settings.pdfThemeFilter
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Smart Sepia / Dark Theme Canvas Filter"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({
                  pdfSpreadMode: settings.pdfSpreadMode === 'spread' ? 'single' : 'spread',
                })
              }
              className={`hidden xl:inline-flex p-1.5 rounded-md cursor-pointer ${
                settings.pdfSpreadMode === 'spread'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary}`
              }`}
              title="Toggle 2-Page Side-by-Side PDF Book Spread (iPad Landscape & Desktop)"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1 ml-1 border-l border-current/15 pl-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.65, +(s - 0.15).toFixed(2)))}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center font-mono-reader text-[11px]">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.2, +(s + 0.15).toFixed(2)))}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer disabled:opacity-30 ${palette.borderHairline}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <input
            type="range"
            aria-label="Page Scrubber"
            min={1}
            max={Math.max(1, totalPages)}
            value={currentPage}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="w-24 sm:w-40 accent-amber-600"
          />

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer disabled:opacity-30 ${palette.borderHairline}`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
