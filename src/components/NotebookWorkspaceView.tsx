import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  BookOpen,
  Edit3,
  Check,
  X,
  Share2,
  Tag,
  Printer,
  FileText,
  Table,
  Layers,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES, HIGHLIGHT_SWATCHES } from '../utils/themeTokens';
import { QuoteCardModal } from './QuoteCardModal';
import type { HighlightColor } from '../types';

export const NotebookWorkspaceView: React.FC = () => {
  const highlights = useLuminaStore((s) => s.highlights);
  const booksMeta = useLuminaStore((s) => s.booksMeta);
  const theme = useLuminaStore((s) => s.settings.theme);
  const openBook = useLuminaStore((s) => s.openBook);
  const setActiveTab = useLuminaStore((s) => s.setActiveTab);
  const updateHighlightNote = useLuminaStore((s) => s.updateHighlightNote);
  const deleteHighlight = useLuminaStore((s) => s.deleteHighlight);

  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSelectedText, setEditSelectedText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editColor, setEditColor] = useState<HighlightColor>('amber');
  const [editTagsInput, setEditTagsInput] = useState('');

  const [quoteCardTarget, setQuoteCardTarget] = useState<{
    quoteText: string;
    bookTitle: string;
    bookAuthor: string;
    locationLabel: string;
  } | null>(null);

  const bookFormatById = useMemo(() => {
    const map = new Map<string, string>();
    booksMeta.forEach((b) => map.set(b.id, b.format));
    return map;
  }, [booksMeta]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    highlights.forEach((hl) => {
      (hl.tags || []).forEach((t) => {
        if (t.trim()) set.add(t.trim());
      });
    });
    return Array.from(set).sort();
  }, [highlights]);

  const filteredHighlights = useMemo(() => {
    return highlights.filter((hl) => {
      if (selectedBookId !== 'all' && hl.bookId !== selectedBookId) return false;
      if (selectedColor !== 'all' && hl.color !== selectedColor) return false;
      if (selectedTag !== 'all' && !(hl.tags || []).includes(selectedTag)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          hl.selectedText.toLowerCase().includes(q) ||
          (hl.note || '').toLowerCase().includes(q) ||
          (hl.bookTitle || '').toLowerCase().includes(q) ||
          (hl.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [highlights, selectedBookId, selectedColor, selectedTag, query]);

  const getPositionLabel = (hl: (typeof highlights)[0]) => {
    const isPdf =
      bookFormatById.get(hl.bookId) === 'pdf' ||
      Boolean(hl.chapterTitle && /^Page\s+\d+$/i.test(hl.chapterTitle));
    return isPdf
      ? `Page ${hl.locationNumber}`
      : `${hl.chapterTitle || `Ch. ${hl.chapterIndex + 1}`}${
          typeof hl.pageIndex === 'number' ? ` · Pg ${hl.pageIndex + 1}` : ''
        }`;
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const lines = [
      '# Lumina Reader — Research & Annotation Notebook',
      `Exported on ${new Date().toISOString().split('T')[0]}`,
      '',
      ...filteredHighlights.map((hl) => {
        const locLabel = getPositionLabel(hl);
        const tagLine =
          hl.tags && hl.tags.length > 0
            ? `\n**Tags**: ${hl.tags.map((t) => `#${t}`).join(' ')}`
            : '';
        return `### ${hl.bookTitle || 'Volume'} (${locLabel})\n> "${hl.selectedText}"\n${
          hl.note ? `\n**Margin Note**: ${hl.note}` : ''
        }${tagLine}\n`;
      }),
    ];
    triggerDownload(
      lines.join('\n'),
      `lumina-notebook-${Date.now()}.md`,
      'text/markdown;charset=utf-8'
    );
  };

  const handleExportObsidian = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const lines = [
      '---',
      `title: "Lumina Research Citations (${dateStr})"`,
      `date: ${dateStr}`,
      `tags: [lumina-reader, literature-notes, ${allTags.slice(0, 8).join(', ')}]`,
      '---',
      '',
      '# Literature Annotations & Citations',
      '',
      ...filteredHighlights.map((hl) => {
        const locLabel = getPositionLabel(hl);
        const tags = (hl.tags || []).map((t) => `#${t}`).join(' ');
        return [
          `## [[${hl.bookTitle || 'Volume'}]] — ${locLabel}`,
          `- **Author**: [[${hl.bookAuthor || 'Unknown Author'}]]`,
          tags ? `- **Tags**: ${tags}` : '',
          '',
          `> [!quote] Passage`,
          `> "${hl.selectedText}"`,
          hl.note ? `\n- **Annotation**: ${hl.note}` : '',
          '',
          '---',
          '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    ];
    triggerDownload(
      lines.join('\n'),
      `obsidian-literature-notes-${dateStr}.md`,
      'text/markdown;charset=utf-8'
    );
  };

  const handleExportAnkiTsv = () => {
    const rows = filteredHighlights.map((hl) => {
      const front = hl.note
        ? `${hl.note} (${hl.bookTitle || 'Volume'})`
        : `Context & significance of passage from ${hl.bookTitle || 'Volume'} (${getPositionLabel(hl)})`;
      const back = `"${hl.selectedText.replace(/\t|\n/g, ' ')}" — ${hl.bookTitle || 'Volume'} (${getPositionLabel(hl)})`;
      const tags = (hl.tags || []).join(' ');
      return `${front.replace(/\t|\n/g, ' ')}\t${back}\t${tags}`;
    });
    triggerDownload(
      rows.join('\n'),
      `lumina-anki-flashcards-${Date.now()}.tsv`,
      'text/tab-separated-values;charset=utf-8'
    );
  };

  const handleExportCsv = () => {
    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = ['Book Title', 'Author', 'Position', 'Color', 'Highlight Passage', 'Margin Note', 'Tags'].join(',');
    const rows = filteredHighlights.map((hl) =>
      [
        escapeCsv(hl.bookTitle || ''),
        escapeCsv(hl.bookAuthor || ''),
        escapeCsv(getPositionLabel(hl)),
        escapeCsv(hl.color),
        escapeCsv(hl.selectedText),
        escapeCsv(hl.note || ''),
        escapeCsv((hl.tags || []).join('; ')),
      ].join(',')
    );
    triggerDownload(
      [header, ...rows].join('\n'),
      `lumina-annotations-${Date.now()}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-current/10">
        <div className="space-y-1">
          <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
            Curatorial Annotations, Citations & Knowledge Export
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">Research Notebook</h1>
        </div>

        {/* Multi-Format Research Export Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={filteredHighlights.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${palette.accentBg}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Markdown ({filteredHighlights.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportObsidian}
            disabled={filteredHighlights.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${palette.elevatedBg} ${palette.borderHairline}`}
            title="Export Obsidian Vault Note with YAML Frontmatter & [[Wikilinks]]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Obsidian Vault</span>
          </button>

          <button
            type="button"
            onClick={handleExportAnkiTsv}
            disabled={filteredHighlights.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${palette.elevatedBg} ${palette.borderHairline}`}
            title="Export Tab-Separated Deck for Anki Desktop / AnkiMobile"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Anki .TSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredHighlights.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={filteredHighlights.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs outline-none max-w-[240px] truncate ${palette.elevatedBg} ${palette.borderHairline}`}
            >
              <option value="all">All Volumes ({highlights.length})</option>
              {booksMeta.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={() => setSelectedColor('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  selectedColor === 'all' ? `${palette.accentBg} text-white` : palette.surfaceBg
                }`}
              >
                All Swatches
              </button>
              {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-5 h-5 rounded-full cursor-pointer ${
                    HIGHLIGHT_SWATCHES[color].dotClass
                  } ${selectedColor === color ? 'ring-2 ring-offset-2 ring-current' : ''}`}
                  title={HIGHLIGHT_SWATCHES[color].label}
                />
              ))}
            </div>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border w-full sm:w-72 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <Search className={`w-3.5 h-3.5 ${palette.textMuted}`} />
            <input
              type="text"
              dir="auto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search highlights, notes, or #tags..."
              className="w-full text-xs bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Tag Filter Bar (when user has added #tags) */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`inline-flex items-center gap-1 mr-1 ${palette.textMuted}`}>
              <Tag className="w-3 h-3" />
              <span>Tags:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-0.5 rounded-md cursor-pointer ${
                selectedTag === 'all' ? `${palette.accentBg} text-white` : palette.surfaceBg
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag === selectedTag ? 'all' : tag)}
                className={`px-2.5 py-0.5 rounded-md cursor-pointer ${
                  selectedTag === tag ? `${palette.accentBg} text-white` : palette.surfaceBg
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Highlights List */}
      {filteredHighlights.length === 0 ? (
        <div
          className={`rounded-2xl border p-8 sm:p-12 text-center space-y-2 ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <h2 className="font-display text-lg font-semibold">No Highlights or Margin Notes Yet</h2>
          <p className={`text-xs max-w-md mx-auto leading-relaxed ${palette.textMuted}`}>
            Open any book or PDF in your library and drag across any words or image passages to create color-coded highlights, margin annotations, and shareable quote cards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {filteredHighlights.map((hl) => {
            const isPdf =
              bookFormatById.get(hl.bookId) === 'pdf' ||
              Boolean(hl.chapterTitle && /^Page\s+\d+$/i.test(hl.chapterTitle));
            const positionLabel = getPositionLabel(hl);
            const jumpButtonLabel = isPdf
              ? `Open & Highlight · Page ${hl.locationNumber}`
              : `Open & Highlight · ${
                  typeof hl.pageIndex === 'number'
                    ? `Pg ${hl.pageIndex + 1}`
                    : hl.chapterTitle || `Ch. ${hl.chapterIndex + 1}`
                }`;

            return (
              <article
                key={hl.id}
                className={`rounded-xl border p-5 sm:p-6 flex flex-col justify-between space-y-4 ${palette.elevatedBg} ${palette.borderHairline}`}
              >
                <div className="space-y-3">
                  <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
                    <span className="truncate pr-2" dir="auto">
                      {hl.bookTitle || 'Volume'} · {positionLabel}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        HIGHLIGHT_SWATCHES[hl.color]?.dotClass || 'bg-amber-400'
                      }`}
                    />
                  </div>

                  {editingId === hl.id ? (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className={`text-[11px] font-medium block ${palette.textMuted}`}>
                          Selected Passage
                        </label>
                        <textarea
                          rows={2}
                          dir="auto"
                          value={editSelectedText}
                          onChange={(e) => setEditSelectedText(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border font-literata italic text-xs outline-none resize-y ${palette.surfaceBg} ${palette.borderHairline}`}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-medium ${palette.textMuted}`}>
                          Margin Note & Swatch
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(Object.keys(HIGHLIGHT_SWATCHES) as HighlightColor[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`w-4 h-4 rounded-full cursor-pointer ${
                                HIGHLIGHT_SWATCHES[c].dotClass
                              } ${
                                editColor === c
                                  ? 'ring-2 ring-offset-1 ring-current'
                                  : 'opacity-70'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        dir="auto"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write or update margin note..."
                        autoFocus
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none resize-y ${palette.surfaceBg} ${palette.borderHairline}`}
                      />

                      <input
                        type="text"
                        dir="auto"
                        value={editTagsInput}
                        onChange={(e) => setEditTagsInput(e.target.value)}
                        placeholder="Tags (comma-separated, e.g. philosophy, thesis)"
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer ${palette.borderHairline}`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const parsedTags = editTagsInput
                              .split(/[,\s]+/)
                              .map((t) => t.replace(/^#/, '').trim())
                              .filter(Boolean);
                            await updateHighlightNote(
                              hl.id,
                              noteText,
                              editColor,
                              editSelectedText,
                              parsedTags
                            );
                            setEditingId(null);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <blockquote
                        dir="auto"
                        className="font-literata text-sm sm:text-base leading-relaxed italic"
                      >
                        "{hl.selectedText}"
                      </blockquote>

                      {hl.note && (
                        <div
                          dir="auto"
                          onClick={() => {
                            setEditingId(hl.id);
                            setEditSelectedText(hl.selectedText || '');
                            setNoteText(hl.note || '');
                            setEditColor(hl.color || 'amber');
                            setEditTagsInput((hl.tags || []).join(', '));
                          }}
                          title="Click to edit note"
                          className={`p-3 rounded-lg border text-xs cursor-pointer hover:border-current/30 transition-colors ${palette.surfaceBg} ${palette.borderHairline}`}
                        >
                          <span className="font-semibold">Margin Note: </span>
                          {hl.note}
                        </div>
                      )}

                      {hl.tags && hl.tags.length > 0 && (
                        <div className={`text-xs ${palette.textMuted}`}>
                          {hl.tags.map((t) => `#${t}`).join(' · ')}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-3 border-t border-current/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(hl.id);
                        setEditSelectedText(hl.selectedText || '');
                        setNoteText(hl.note || '');
                        setEditColor(hl.color || 'amber');
                        setEditTagsInput((hl.tags || []).join(', '));
                      }}
                      className={`inline-flex items-center gap-1 cursor-pointer ${palette.textSecondary} hover:underline`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{hl.note ? 'Edit Note' : 'Add Note'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setQuoteCardTarget({
                          quoteText: hl.selectedText,
                          bookTitle: hl.bookTitle || 'Volume',
                          bookAuthor: hl.bookAuthor || 'Author',
                          locationLabel: positionLabel,
                        })
                      }
                      className={`inline-flex items-center gap-1 cursor-pointer ${palette.textSecondary} hover:underline`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Quote Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteHighlight(hl.id)}
                      className={`inline-flex items-center gap-1 cursor-pointer ${palette.textMuted} hover:text-rose-600`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await openBook(hl.bookId, {
                        chapterIndex: hl.chapterIndex,
                        pageIndex: hl.pageIndex,
                        paragraphIndex: hl.paragraphIndex,
                        locationNumber: hl.locationNumber,
                        highlightId: hl.id,
                        searchText: hl.selectedText,
                      });
                      setActiveTab('library');
                    }}
                    className={`inline-flex items-center gap-1.5 font-semibold cursor-pointer ${palette.accentText} hover:underline`}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>{jumpButtonLabel}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {quoteCardTarget && (
        <QuoteCardModal
          payload={{
            quote: quoteCardTarget.quoteText,
            bookTitle: quoteCardTarget.bookTitle,
            bookAuthor: quoteCardTarget.bookAuthor,
            locationLabel: quoteCardTarget.locationLabel,
          }}
          onClose={() => setQuoteCardTarget(null)}
        />
      )}
    </div>
  );
};
