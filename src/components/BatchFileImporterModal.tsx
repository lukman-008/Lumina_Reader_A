import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { ingestBookFile } from '../services/bookParser';
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

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && droppedFiles && droppedFiles.length > 0) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Books into Lumina Sanctuary"
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
              Open any book, document, or page image — formatting and language adapt automatically
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
          <p className="text-sm font-semibold">Click to choose books or drag & drop anywhere</p>
          <p className={`text-xs mt-1 ${palette.textMuted}`}>
            EPUB, PDF, Markdown, Plain Text & Scanned Pages
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
                  {item.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
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
      </div>
    </div>
  );
};
