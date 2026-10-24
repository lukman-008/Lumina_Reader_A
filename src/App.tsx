import React, { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useLuminaStore } from './store/useLuminaStore';
import { READING_THEMES } from './utils/themeTokens';
import { TopNavHeader } from './components/TopNavHeader';
import { LibrarySanctuaryView } from './components/LibrarySanctuaryView';
import { UnifiedReaderView } from './components/UnifiedReaderView';
import { NotebookWorkspaceView } from './components/NotebookWorkspaceView';
import { VocabularySrsView } from './components/VocabularySrsView';
import {
  HabitsWorkspaceView,
  SyncAndCrossPlatformView,
} from './components/HabitsAndSyncViews';
import { BatchFileImporterModal } from './components/BatchFileImporterModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const isHydrated = useLuminaStore((s) => s.isHydrated);
  const activeTab = useLuminaStore((s) => s.activeTab);
  const activeBookMeta = useLuminaStore((s) => s.activeBookMeta);
  const theme = useLuminaStore((s) => s.settings.theme);
  const hydrateApp = useLuminaStore((s) => s.hydrateApp);
  const setImporterOpen = useLuminaStore((s) => s.setImporterOpen);
  const closeActiveBook = useLuminaStore((s) => s.closeActiveBook);

  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  useEffect(() => {
    hydrateApp();
  }, [hydrateApp]);

  // Global Cmd+K / Ctrl+K Command Palette & Syntopicon Search Shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Global Drag-and-Drop File Ingestion
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFiles(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDraggingFiles(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFiles(false);
      if (e.dataTransfer?.files?.length) {
        setImporterOpen(true, e.dataTransfer.files);
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [setImporterOpen]);

  if (!isHydrated) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${palette.canvasBg} ${palette.textPrimary}`}
      >
        <div className="text-center space-y-2">
          <div className="font-display text-xl font-semibold">Lumina Reader</div>
          <p className={`text-xs ${palette.textMuted}`}>
            Opening 3-Tier Split Catalog Sanctuary...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${palette.canvasBg} ${palette.textPrimary}`}
    >
      {/* Global Drag Overlay */}
      {isDraggingFiles && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 pointer-events-none">
          <div
            className={`max-w-md w-full rounded-2xl border-2 border-dashed p-10 text-center space-y-3 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <Upload className={`w-10 h-10 mx-auto ${palette.accentText}`} />
            <h2 className="font-display text-xl font-semibold">
              Drop Books to Import into Sanctuary
            </h2>
            <p className={`text-xs ${palette.textMuted}`}>
              EPUB (OPF Spine), PDF (Isolated Binary + Optical OCR), Markdown & TXT
            </p>
          </div>
        </div>
      )}

      {/* Active Reader vs. Workspace Shell wrapped in ErrorBoundary */}
      <ErrorBoundary onReset={closeActiveBook}>
        {activeBookMeta ? (
          <UnifiedReaderView />
        ) : (
          <>
            <TopNavHeader onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
            <main className="flex-1 pb-20 md:pb-0">
              {activeTab === 'library' && <LibrarySanctuaryView />}
              {activeTab === 'notebook' && <NotebookWorkspaceView />}
              {activeTab === 'vocabulary' && <VocabularySrsView />}
              {activeTab === 'habits' && <HabitsWorkspaceView />}
              {activeTab === 'sync' && <SyncAndCrossPlatformView />}
            </main>
          </>
        )}
      </ErrorBoundary>

      <BatchFileImporterModal />
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}

