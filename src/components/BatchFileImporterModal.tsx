import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { ingestBookFile, ingestWebArticleClip } from '../services/bookParser';
import { READING_THEMES } from '../utils/themeTokens';

interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'parsing' | 'done' | 'error';
  message?: string;
}

export const BatchFileImporterModal: React.FC = () => {
  const isOpen = useLuminaStore((s) => s.isImporterOpen);
  const droppedFiles = useLuminaStore((s) => s.droppedFiles);
  const setImporterOpen = useLuminaStore((s) => s.setImporterOpen);
  const refreshCatalog = useLuminaStore((s) => s.refreshCatalog);
  const openBook = useLuminaStore((s) => s.openBook);
  const theme = useLuminaStore((s) => s.settings.theme);
  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  const [mode, setMode] = useState<'files' | 'clipper'>('files');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Web Article / Essay Reader-Mode Clipper State
  const [clipTitle, setClipTitle] = useState('');
  const [clipAuthor, setClipAuthor] = useState('');
  const [clipUrl, setClipUrl] = useState('');
  const [clipContent, setClipContent] = useState('');

  useEffect(() => {
    if (isOpen && droppedFiles && droppedFiles.length > 0) {
      setMode('files');
      enqueueFiles(Array.from(droppedFiles));
    }
  }, [isOpen, droppedFiles]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        setImporterOpen(false, null);
        setQueue([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isProcessing, setImporterOpen]);

  if (!isOpen) return null;

  const closeModal = () => {
    if (isProcessing) return;
    setImporterOpen(false, null);
    setQueue([]);
  };

  const enqueueFiles = async (files: File[]) => {
    const newItems: QueueItem[] = files.map((file, idx) => ({
      id: `q-${Date.now()}-${idx}`,
      file,
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...newItems]);
    setIsProcessing(true);

    let lastImportedBookId: string | null = null;

    for (const item of newItems) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'parsing' } : q))
      );
      try {
        const meta = await ingestBookFile(item.file);
        lastImportedBookId = meta.id;
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'done',
                  message: `Indexed ${meta.chapterCount} sections · ${meta.totalLocations} Locations`,
                }
              : q
          )
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', message: err?.message || 'Failed to parse file' }
              : q
          )
        );
      }
    }

    await refreshCatalog();
    setIsProcessing(false);

    if (newItems.length === 1 && lastImportedBookId) {
      setTimeout(() => {
        setImporterOpen(false, null);
        setQueue([]);
        openBook(lastImportedBookId!);
      }, 350);
    }
  };

  const handleSaveWebClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipContent.trim()) return;
    setIsProcessing(true);
    try {
      const meta = await ingestWebArticleClip({
        title: clipTitle.trim() || 'Clipped Essay',
        author: clipAuthor.trim() || undefined,
        sourceUrl: clipUrl.trim() || undefined,
        rawContent: clipContent,
      });
      await refreshCatalog();
      setClipTitle('');
      setClipAuthor('');
      setClipUrl('');
      setClipContent('');
      setImporterOpen(false, null);
      await openBook(meta.id);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Books or Clip Web Articles into Lumina Sanctuary"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl max-h-[88dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 ${palette.elevatedBg} ${palette.borderHairline} ${palette.textPrimary}`}
      >
        <div className="flex items-center justify-between border-b border-current/10 pb-3.5">
          <div>
            <h2 className="font-display text-lg font-semibold">Add to Your Library</h2>
            <p className={`text-xs ${palette.textMuted}`}>
              Import books or clip long-form web essays into distraction-free reader editions
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className={`p-1.5 rounded-lg cursor-pointer ${palette.textMuted} hover:${palette.textPrimary}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Segmented Switcher */}
        <div
          className={`grid grid-cols-2 gap-1 p-1 rounded-xl border text-xs ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <button
            type="button"
            onClick={() => setMode('files')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium cursor-pointer ${
              mode === 'files'
                ? `${palette.accentBg} text-white font-semibold`
                : palette.textSecondary
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Book Files</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('clipper')}
            className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium cursor-pointer ${
              mode === 'clipper'
                ? `${palette.accentBg} text-white font-semibold`
                : palette.textSecondary
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Article / Essay Clipper</span>
          </button>
        </div>

        {mode === 'files' ? (
          <>
            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-colors ${palette.borderHairline} ${palette.surfaceBg} hover:opacity-90`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".epub,.pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/epub+zip,application/pdf,text/plain,text/markdown,image/*"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    enqueueFiles(Array.from(e.target.files));
                  }
                }}
                className="hidden"
              />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${palette.accentText}`} />
              <p className="text-sm font-semibold">
                Click to choose books or drag & drop anywhere
              </p>
              <p className={`text-xs mt-1 ${palette.textMuted}`}>
                EPUB (with Embedded Figures), PDF, Markdown, Plain Text & Scanned Pages
              </p>
            </div>

            {/* Ingestion Queue */}
            {queue.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs ${palette.surfaceBg} ${palette.borderHairline}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className={`w-4 h-4 shrink-0 ${palette.textMuted}`} />
                      <div className="truncate">
                        <div className="font-medium truncate" dir="auto">
                          {item.file.name}
                        </div>
                        {item.message && <div className={palette.textMuted}>{item.message}</div>}
                      </div>
                    </div>
                    <div className="shrink-0 ml-3">
                      {item.status === 'parsing' && (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      )}
                      {item.status === 'done' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-current/10">
              <button
                type="button"
                disabled={isProcessing}
                onClick={closeModal}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${palette.accentBg}`}
              >
                {isProcessing ? 'Indexing...' : 'Done'}
              </button>
            </div>
          </>
        ) : (
          /* Web Article / Essay Reader-Mode Clipper Form */
          <form onSubmit={handleSaveWebClip} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold block">Article / Essay Title</label>
                <input
                  type="text"
                  dir="auto"
                  required
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  placeholder="e.g. On the Shortness of Life"
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">Author / Publication</label>
                <input
                  type="text"
                  dir="auto"
                  value={clipAuthor}
                  onChange={(e) => setClipAuthor(e.target.value)}
                  placeholder="e.g. Essayist or Journal"
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold block">
                Paste Essay Text, Markdown, or Raw HTML Article
              </label>
              <textarea
                rows={7}
                dir="auto"
                required
                value={clipContent}
                onChange={(e) => setClipContent(e.target.value)}
                placeholder="Paste any long-form web article, research essay, or HTML snippet here — clutter is automatically stripped and X-Ray entities are indexed..."
                className={`w-full p-3 rounded-lg border outline-none font-literata leading-relaxed ${palette.surfaceBg} ${palette.borderHairline}`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-current/10">
              <button
                type="button"
                onClick={closeModal}
                className={`px-3.5 py-2 rounded-lg border cursor-pointer ${palette.borderHairline}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing || !clipContent.trim()}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white cursor-pointer disabled:opacity-45 ${palette.accentBg}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Indexing Clip...' : 'Clip & Open in Reader'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
