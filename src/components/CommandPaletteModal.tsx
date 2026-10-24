import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  BookOpen,
  NotebookPen,
  Languages,
  Sparkles,
  Sun,
  Upload,
  X,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { db } from '../services/db';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import type { BookContentRecord, ReadingTheme } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const booksMeta = useLuminaStore((s) => s.booksMeta);
  const highlights = useLuminaStore((s) => s.highlights);
  const vocabulary = useLuminaStore((s) => s.vocabulary);
  const theme = useLuminaStore((s) => s.settings.theme);
  const openBook = useLuminaStore((s) => s.openBook);
  const setActiveTab = useLuminaStore((s) => s.setActiveTab);
  const setImporterOpen = useLuminaStore((s) => s.setImporterOpen);
  const updateSettings = useLuminaStore((s) => s.updateSettings);
  const closeActiveBook = useLuminaStore((s) => s.closeActiveBook);

  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  const [query, setQuery] = useState('');
  const [allContents, setAllContents] = useState<BookContentRecord[]>([]);

  // Load Tier 2 BookContents when Command Palette opens for Cross-Library Syntopicon Full-Text Search (#5)
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    db.bookContents
      .toArray()
      .then((records) => {
        if (isMounted) setAllContents(records);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const bookMetaMap = useMemo(() => {
    const map = new Map<string, (typeof booksMeta)[0]>();
    booksMeta.forEach((b) => map.set(b.id, b));
    return map;
  }, [booksMeta]);

  // Cross-Library Syntopicon Full-Text Search Results (#5)
  const syntopiconResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const passageHits: {
      bookId: string;
      bookTitle: string;
      bookAuthor: string;
      chapterIndex: number;
      chapterTitle: string;
      paraIndex?: number;
      pageIndex?: number;
      locationNumber: number;
      snippet: string;
      isPdf?: boolean;
    }[] = [];

    for (const content of allContents) {
      const meta = bookMetaMap.get(content.bookId);
      if (!meta) continue;

      // 1. Search PDF indexed OCR pages
      if (meta.format === 'pdf' && content.ocrByPage) {
        for (const [pageStr, pageText] of Object.entries(content.ocrByPage)) {
          const text = pageText || '';
          const pos = text.toLowerCase().indexOf(q);
          if (pos !== -1) {
            const pageNum = Number(pageStr);
            const start = Math.max(0, pos - 45);
            const end = Math.min(text.length, pos + q.length + 65);
            const snippet =
              (start > 0 ? '…' : '') +
              text.slice(start, end).trim() +
              (end < text.length ? '…' : '');
            passageHits.push({
              bookId: meta.id,
              bookTitle: meta.title,
              bookAuthor: meta.author,
              chapterIndex: 0,
              chapterTitle: `Page ${pageNum}`,
              pageIndex: pageNum,
              locationNumber: pageNum,
              snippet,
              isPdf: true,
            });
            if (passageHits.length >= 24) return passageHits;
          }
        }
      }

      // 2. Search Reflowable Chapters & Paragraphs
      for (let cIdx = 0; cIdx < (content.chapters || []).length; cIdx++) {
        const ch = content.chapters[cIdx];
        const paras = ch.paragraphs || [];
        for (let pIdx = 0; pIdx < paras.length; pIdx++) {
          const pText = paras[pIdx] || '';
          if (pText.startsWith('[IMAGE_DATA:')) continue;
          const pos = pText.toLowerCase().indexOf(q);
          if (pos !== -1) {
            const start = Math.max(0, pos - 45);
            const end = Math.min(pText.length, pos + q.length + 65);
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
            passageHits.push({
              bookId: meta.id,
              bookTitle: meta.title,
              bookAuthor: meta.author,
              chapterIndex: cIdx,
              chapterTitle: ch.title,
              paraIndex: pIdx,
              locationNumber: loc,
              snippet,
            });
            if (passageHits.length >= 24) return passageHits;
          }
        }
      }
    }

    return passageHits;
  }, [query, allContents, bookMetaMap]);

  const matchingBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return booksMeta.slice(0, 5);
    return booksMeta
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, booksMeta]);

  const matchingHighlights = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return highlights
      .filter(
        (h) =>
          h.selectedText.toLowerCase().includes(q) ||
          (h.note || '').toLowerCase().includes(q) ||
          (h.tags || []).some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [query, highlights]);

  const matchingVocab = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return vocabulary
      .filter(
        (v) =>
          v.word.toLowerCase().includes(q) || v.definition.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [query, vocabulary]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette and Syntopicon Search"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-10 sm:pt-20 p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[82dvh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${palette.elevatedBg} ${palette.borderHairline} ${palette.textPrimary}`}
      >
        {/* Search Input Bar */}
        <div className="px-4 py-3.5 border-b border-current/10 flex items-center gap-3 shrink-0">
          <Search className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="search"
            dir="auto"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Syntopicon Search across all books, PDF pages, highlights, vocabulary, or run a command..."
            className="w-full text-xs sm:text-sm bg-transparent outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-xs">
          {/* 1. Cross-Library Syntopicon Full-Text Passages */}
          {query.trim().length >= 2 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider opacity-70">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Syntopicon Cross-Library Full-Text Passages ({syntopiconResults.length})</span>
                </span>
              </div>
              {syntopiconResults.length === 0 ? (
                <p className={`py-2 ${palette.textMuted}`}>
                  No full-text passages found matching "{query}" across {booksMeta.length} volumes.
                </p>
              ) : (
                <div className="space-y-2">
                  {syntopiconResults.map((hit, idx) => (
                    <button
                      key={`${hit.bookId}-${hit.chapterIndex}-${hit.locationNumber}-${idx}`}
                      type="button"
                      dir="auto"
                      onClick={async () => {
                        await openBook(hit.bookId, {
                          chapterIndex: hit.chapterIndex,
                          pageIndex: hit.pageIndex,
                          paragraphIndex: hit.paraIndex,
                          locationNumber: hit.locationNumber,
                          searchText: query.trim(),
                        });
                        onClose();
                      }}
                      className={`w-full text-left p-3 rounded-xl border space-y-1 hover:border-amber-500/60 transition-colors cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
                    >
                      <div className="flex items-center justify-between text-[11px] opacity-80">
                        <span className="font-semibold truncate">
                          {hit.bookTitle} · {hit.chapterTitle}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0 inline-flex items-center gap-1">
                          <span>Open & Highlight</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                      <p className="font-literata italic line-clamp-2 leading-relaxed">
                        {hit.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Matching Highlights & Margin Notes */}
          {matchingHighlights.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                Matching Highlights & Margin Notes ({matchingHighlights.length})
              </div>
              <div className="space-y-2">
                {matchingHighlights.map((hl) => (
                  <button
                    key={hl.id}
                    type="button"
                    dir="auto"
                    onClick={async () => {
                      await openBook(hl.bookId, {
                        chapterIndex: hl.chapterIndex,
                        pageIndex: hl.pageIndex,
                        paragraphIndex: hl.paragraphIndex,
                        locationNumber: hl.locationNumber,
                        highlightId: hl.id,
                        searchText: hl.selectedText,
                      });
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border space-y-1 hover:border-amber-500/60 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
                  >
                    <div className="flex items-center justify-between text-[11px] opacity-75">
                      <span className="font-semibold">{hl.bookTitle}</span>
                      <span>Jump to Annotation</span>
                    </div>
                    <p className="font-literata italic line-clamp-2">"{hl.selectedText}"</p>
                    {hl.note && (
                      <p className={`text-[11px] ${palette.textSecondary}`}>
                        <strong>Note:</strong> {hl.note}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Matching Vocabulary Cards */}
          {matchingVocab.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                Matching Vocabulary Lexicon ({matchingVocab.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchingVocab.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    dir="auto"
                    onClick={() => {
                      closeActiveBook();
                      setActiveTab('vocabulary');
                      onClose();
                    }}
                    className={`p-3 rounded-xl border text-left space-y-1 hover:border-amber-500/60 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
                  >
                    <div className="font-display font-semibold text-sm">{v.word}</div>
                    <p className={`text-[11px] line-clamp-2 ${palette.textMuted}`}>
                      {v.definition}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Volumes in Library */}
          {matchingBooks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                {query.trim() ? 'Matching Volumes' : 'Recent Library Volumes'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchingBooks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    dir="auto"
                    onClick={async () => {
                      await openBook(b.id);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 hover:border-amber-500/60 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
                  >
                    <div className="min-w-0">
                      <div className="font-display font-semibold truncate">{b.title}</div>
                      <div className={`text-[11px] truncate ${palette.textMuted}`}>
                        {b.author} · {b.format.toUpperCase()}
                      </div>
                    </div>
                    <BookOpen className="w-4 h-4 shrink-0 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Quick Workspace & Theme Actions */}
          <div className="space-y-2 pt-2 border-t border-current/10">
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
              Quick Actions & Calibrated Reading Themes
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setImporterOpen(true);
                  onClose();
                }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
              >
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>Import Book / Web Clip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeActiveBook();
                  setActiveTab('notebook');
                  onClose();
                }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
              >
                <NotebookPen className="w-3.5 h-3.5 text-amber-500" />
                <span>Research Notebook</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeActiveBook();
                  setActiveTab('vocabulary');
                  onClose();
                }}
                className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
              >
                <Languages className="w-3.5 h-3.5 text-amber-500" />
                <span>Vocabulary & Cloze Quiz</span>
              </button>

              {(Object.keys(READING_THEMES) as ReadingTheme[]).map((tKey) => (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => {
                    void updateSettings({ theme: tKey });
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
                >
                  <Sun className="w-3.5 h-3.5 opacity-70" />
                  <span>Theme: {READING_THEMES[tKey].name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Shortcut Legend */}
        <div
          className={`px-4 py-2.5 border-t text-[11px] flex items-center justify-between ${palette.surfaceBg} ${palette.borderHairline} ${palette.textMuted}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Syntopicon indexes all EPUB chapters, PDF OCR pages, notes & vocabulary</span>
          </span>
          <span className="font-mono-reader"> Cmd+K / Esc</span>
        </div>
      </div>
    </div>
  );
};
