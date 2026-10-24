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
  Quote,
  Network,
  LayoutGrid,
  Copy,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES, HIGHLIGHT_SWATCHES } from '../utils/themeTokens';
import { QuoteCardModal } from './QuoteCardModal';
import type { Highlight, HighlightColor } from '../types';

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

  // View Mode: Cards vs. Interactive Knowledge Graph / Mind-Map (#6)
  const [viewMode, setViewMode] = useState<'cards' | 'graph'>('cards');

  // Academic Citation Generator Modal State (#4)
  const [citationTarget, setCitationTarget] = useState<Highlight | null>(null);
  const [citationStyle, setCitationStyle] = useState<'apa' | 'mla' | 'chicago' | 'bibtex'>('apa');
  const [copiedCitation, setCopiedCitation] = useState(false);

  // Lightbox for Cropped PDF Figure Snippets (#3)
  const [zoomSnippet, setZoomSnippet] = useState<{ src: string; label: string } | null>(null);

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

  // Format Academic Citations (APA 7th, MLA 9th, Chicago 17th, BibTeX)
  const formatAcademicCitation = (
    hl: Highlight,
    style: 'apa' | 'mla' | 'chicago' | 'bibtex'
  ): string => {
    const author = (hl.bookAuthor || 'Unknown Author').trim();
    const title = (hl.bookTitle || 'Untitled Volume').trim();
    const year = new Date(hl.createdAt || Date.now()).getFullYear();
    const loc = getPositionLabel(hl);
    const authorPart = (author.split(/\s+/).pop() || 'author')
      .replace(/[^A-Za-z]/g, '')
      .toLowerCase();
    const titlePart = (title.split(/\s+/)[0] || 'work')
      .replace(/[^A-Za-z]/g, '')
      .toLowerCase();
    const citeKey = `${authorPart}${year}${titlePart}`;

    if (style === 'apa') {
      return `${author} (${year}). ${title} (${loc}). Lumina Digital Sanctuary.\n\nIn-text quote: "${hl.selectedText}" (${author}, ${year}, ${loc}).`;
    }
    if (style === 'mla') {
      return `${author}. "${title}." Lumina Digital Edition, ${year}, ${loc}.\n\nIn-text quote: "${hl.selectedText}" (${author}, ${loc}).`;
    }
    if (style === 'chicago') {
      return `${author}, ${title} (Lumina Digital Sanctuary, ${year}), ${loc}: "${hl.selectedText}".`;
    }
    return `@book{${citeKey || 'lumina2025'},\n  author = {${author}},\n  title = {${title}},\n  year = {${year}},\n  note = {${loc}: "${hl.selectedText.replace(/"/g, "''")}"}\n}`;
  };

  // Build Interactive Concept Mind-Map / Knowledge Graph Nodes & Edges (#6)
  const knowledgeGraph = useMemo(() => {
    const nodes: {
      id: string;
      label: string;
      type: 'book' | 'tag' | 'highlight';
      x: number;
      y: number;
      color: string;
      hl?: Highlight;
      bookId?: string;
      tag?: string;
    }[] = [];
    const edges: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];

    const centerX = 480;
    const centerY = 270;

    // 1. Book Nodes in inner ring
    const bookIds = Array.from(new Set(filteredHighlights.map((h) => h.bookId)));
    const bookNodeMap = new Map<string, { x: number; y: number }>();

    bookIds.forEach((bId, idx) => {
      const angle = (idx / Math.max(1, bookIds.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = bookIds.length === 1 ? 0 : 105;
      const x = Math.round(centerX + Math.cos(angle) * radius);
      const y = Math.round(centerY + Math.sin(angle) * radius);
      const bookTitle =
        booksMeta.find((b) => b.id === bId)?.title ||
        filteredHighlights.find((h) => h.bookId === bId)?.bookTitle ||
        'Volume';
      bookNodeMap.set(bId, { x, y });
      nodes.push({
        id: `book-${bId}`,
        label: bookTitle.slice(0, 26),
        type: 'book',
        x,
        y,
        color: '#d97706',
        bookId: bId,
      });
    });

    // 2. Tag Nodes in middle ring
    const tagSet = new Set<string>();
    filteredHighlights.forEach((h) => (h.tags || []).forEach((t) => tagSet.add(t)));
    const tagList = Array.from(tagSet).slice(0, 12);
    const tagNodeMap = new Map<string, { x: number; y: number }>();

    tagList.forEach((tag, idx) => {
      const angle = (idx / Math.max(1, tagList.length)) * Math.PI * 2;
      const x = Math.round(centerX + Math.cos(angle) * 185);
      const y = Math.round(centerY + Math.sin(angle) * 165);
      tagNodeMap.set(tag, { x, y });
      nodes.push({
        id: `tag-${tag}`,
        label: `#${tag}`,
        type: 'tag',
        x,
        y,
        color: '#0ea5e9',
        tag,
      });
    });

    // 3. Highlight Nodes in outer ring (up to 18 nodes for crisp legibility)
    const sampleHighlights = filteredHighlights.slice(0, 18);
    const swatchHex: Record<HighlightColor, string> = {
      amber: '#f59e0b',
      emerald: '#10b981',
      sky: '#0ea5e9',
      rose: '#f43f5e',
      violet: '#8b5cf6',
    };

    sampleHighlights.forEach((hl, idx) => {
      const angle = (idx / Math.max(1, sampleHighlights.length)) * Math.PI * 2 - Math.PI / 4;
      const x = Math.round(centerX + Math.cos(angle) * 330);
      const y = Math.round(centerY + Math.sin(angle) * 215);
      const snippet =
        (hl.note || hl.selectedText || 'Passage').slice(0, 28).trim() +
        ((hl.note || hl.selectedText || '').length > 28 ? '…' : '');
      nodes.push({
        id: `hl-${hl.id}`,
        label: snippet,
        type: 'highlight',
        x,
        y,
        color: swatchHex[hl.color] || '#f59e0b',
        hl,
      });

      const bPos = bookNodeMap.get(hl.bookId);
      if (bPos) {
        edges.push({
          id: `e-b-${hl.id}`,
          x1: bPos.x,
          y1: bPos.y,
          x2: x,
          y2: y,
        });
      }
      (hl.tags || []).forEach((t) => {
        const tPos = tagNodeMap.get(t);
        if (tPos) {
          edges.push({
            id: `e-t-${hl.id}-${t}`,
            x1: tPos.x,
            y1: tPos.y,
            x2: x,
            y2: y,
          });
        }
      });
    });

    return { nodes, edges };
  }, [filteredHighlights, booksMeta]);

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

          {/* Cards vs. Knowledge Graph Switcher */}
          <div
            className={`inline-flex items-center p-0.5 rounded-lg border text-xs ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium cursor-pointer ${
                viewMode === 'cards' ? `${palette.accentBg} text-white` : palette.textSecondary
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium cursor-pointer ${
                viewMode === 'graph' ? `${palette.accentBg} text-white` : palette.textSecondary
              }`}
              title="Interactive Concept Mind-Map & Knowledge Graph"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Knowledge Graph</span>
            </button>
          </div>
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

      {/* Highlights List or Interactive Concept Knowledge Graph */}
      {filteredHighlights.length === 0 ? (
        <div
          className={`rounded-2xl border p-8 sm:p-12 text-center space-y-2 ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <h2 className="font-display text-lg font-semibold">No Highlights or Margin Notes Yet</h2>
          <p className={`text-xs max-w-md mx-auto leading-relaxed ${palette.textMuted}`}>
            Open any book or PDF in your library and drag across any words or image passages to create color-coded highlights, margin annotations, and shareable quote cards.
          </p>
        </div>
      ) : viewMode === 'graph' ? (
        <div
          className={`rounded-2xl border p-4 sm:p-6 space-y-4 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <h2 className="font-display text-base font-semibold">
                Syntopicon Concept Mind-Map & Knowledge Graph
              </h2>
              <p className={palette.textMuted}>
                Click any Volume node to filter by book, #tag node to filter by concept, or Passage node to jump directly to the highlighted text.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Volume
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> #Tag Concept
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Highlight Passage
              </span>
            </div>
          </div>

          <div
            className={`w-full overflow-x-auto rounded-xl border p-2 ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <svg
              viewBox="0 0 960 540"
              className="w-full min-w-[680px] h-[440px] sm:h-[500px] select-none"
            >
              {/* Connecting Edges */}
              {knowledgeGraph.edges.map((e) => (
                <line
                  key={e.id}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="currentColor"
                  strokeOpacity={0.18}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              ))}

              {/* Graph Nodes */}
              {knowledgeGraph.nodes.map((node) => (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={async () => {
                    if (node.type === 'book' && node.bookId) {
                      setSelectedBookId((prev) => (prev === node.bookId ? 'all' : node.bookId!));
                    } else if (node.type === 'tag' && node.tag) {
                      setSelectedTag((prev) => (prev === node.tag ? 'all' : node.tag!));
                    } else if (node.type === 'highlight' && node.hl) {
                      await openBook(node.hl.bookId, {
                        chapterIndex: node.hl.chapterIndex,
                        pageIndex: node.hl.pageIndex,
                        paragraphIndex: node.hl.paragraphIndex,
                        locationNumber: node.hl.locationNumber,
                        highlightId: node.hl.id,
                        searchText: node.hl.selectedText,
                      });
                      setActiveTab('library');
                    }
                  }}
                  className="cursor-pointer group"
                >
                  <circle
                    r={node.type === 'book' ? 22 : node.type === 'tag' ? 16 : 11}
                    fill={node.color}
                    fillOpacity={0.9}
                    className="transition-transform duration-150 group-hover:scale-125"
                  />
                  <rect
                    x={-84}
                    y={node.type === 'book' ? 26 : 18}
                    width={168}
                    height={20}
                    rx={6}
                    fill="currentColor"
                    fillOpacity={0.08}
                  />
                  <text
                    y={node.type === 'book' ? 39 : 31}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize={node.type === 'book' ? 11 : 10}
                    fontWeight={node.type === 'book' ? 700 : 500}
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
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

                      {/* Cropped PDF Figure / Diagram Excerpt (#3) */}
                      {hl.imageSnippetDataUrl && (
                        <div className="pt-1">
                          <img
                            src={hl.imageSnippetDataUrl}
                            alt="Cropped PDF Figure Excerpt"
                            onClick={() =>
                              setZoomSnippet({
                                src: hl.imageSnippetDataUrl!,
                                label: `${hl.bookTitle || 'PDF'} · ${positionLabel}`,
                              })
                            }
                            title="Click to enlarge cropped PDF figure"
                            className="max-h-36 w-auto rounded-lg border border-black/15 bg-white p-1.5 object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                          />
                        </div>
                      )}

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
                  <div className="flex flex-wrap items-center gap-3">
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
                      onClick={() => {
                        setCitationTarget(hl);
                        setCopiedCitation(false);
                      }}
                      className={`inline-flex items-center gap-1 cursor-pointer ${palette.textSecondary} hover:underline`}
                      title="Generate Academic Citation (APA, MLA, Chicago, BibTeX)"
                    >
                      <Quote className="w-3.5 h-3.5" />
                      <span>Cite</span>
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

      {/* Academic Citation Generator Modal (APA / MLA / Chicago / BibTeX) */}
      {citationTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCitationTarget(null);
          }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 text-xs ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Academic Citation Formatter
                </h3>
                <p className={`text-[11px] ${palette.textMuted}`}>
                  1-Click Bibliographic & In-Text Citation Export
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCitationTarget(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`grid grid-cols-4 gap-1 p-1 rounded-xl border ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              {(
                [
                  { id: 'apa', label: 'APA 7th' },
                  { id: 'mla', label: 'MLA 9th' },
                  { id: 'chicago', label: 'Chicago' },
                  { id: 'bibtex', label: 'BibTeX' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setCitationStyle(st.id);
                    setCopiedCitation(false);
                  }}
                  className={`py-1.5 rounded-lg font-semibold cursor-pointer ${
                    citationStyle === st.id
                      ? `${palette.accentBg} text-white`
                      : palette.textSecondary
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <pre
              dir="auto"
              className={`p-3.5 rounded-xl border font-mono-reader text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              {formatAcademicCitation(citationTarget, citationStyle)}
            </pre>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  const formatted = formatAcademicCitation(citationTarget, citationStyle);
                  await navigator.clipboard?.writeText(formatted);
                  setCopiedCitation(true);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                {copiedCitation ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCitation ? 'Copied to Clipboard' : 'Copy Citation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Lightbox for Cropped PDF Figure Snippets */}
      {zoomSnippet && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoomSnippet(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`max-w-3xl w-full rounded-2xl border p-4 sm:p-6 shadow-2xl space-y-3 text-center ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-2.5">
              <span className="font-display font-semibold text-sm">{zoomSnippet.label}</span>
              <button
                type="button"
                onClick={() => setZoomSnippet(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={zoomSnippet.src}
              alt={zoomSnippet.label}
              className="max-h-[70dvh] mx-auto object-contain rounded-lg bg-white p-2"
            />
          </div>
        </div>
      )}
    </div>
  );
};
