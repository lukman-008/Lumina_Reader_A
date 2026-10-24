import React from 'react';
import {
  Upload,
  BookOpen,
  NotebookPen,
  Languages,
  BarChart3,
  Cloud,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import type { WorkspaceTab } from '../types';

const NAV_ITEMS: {
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'notebook', label: 'Notebook', icon: NotebookPen },
  { id: 'vocabulary', label: 'Vocabulary', icon: Languages },
  { id: 'habits', label: 'Habits', icon: BarChart3 },
  { id: 'sync', label: 'Devices', icon: Cloud },
];

export const TopNavHeader: React.FC = () => {
  const activeTab = useLuminaStore((s) => s.activeTab);
  const setActiveTab = useLuminaStore((s) => s.setActiveTab);
  const setImporterOpen = useLuminaStore((s) => s.setImporterOpen);
  const theme = useLuminaStore((s) => s.settings.theme);
  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  return (
    <>
      {/* Top Header: 3-Zone Editorial Bar on iPad/Desktop, Clean Brand + Action Bar on iPhone/Android */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b transition-colors duration-200 ${palette.canvasBg} ${palette.borderHairline}`}
      >
        {/* Zone 1: Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`text-lg sm:text-xl font-bold tracking-tight font-display whitespace-nowrap shrink-0 cursor-pointer text-left ${palette.textPrimary}`}
        >
          Lumina Reader
        </button>

        {/* Zone 2: Desktop & iPad Navigation Links (Hidden on Mobile Phones where Bottom Tab Bar is used) */}
        <nav
          aria-label="Workspace navigation"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
                  isActive
                    ? `${palette.textPrimary} border-current font-semibold`
                    : `${palette.textMuted} border-transparent hover:${palette.textPrimary}`
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Import Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setImporterOpen(true)}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer ${palette.accentBg}`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Books</span>
          </button>
        </div>
      </header>

      {/* Thumb-Friendly Mobile Bottom Tab Bar (iPhone & Android Ergonomics, Hidden on iPad/Desktop) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-30 border-t px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1 backdrop-blur-md ${palette.surfaceBg} ${palette.borderHairline}`}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors cursor-pointer ${
                isActive ? `${palette.accentText} font-semibold` : palette.textMuted
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
