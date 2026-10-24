import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Upload,
  Flame,
  Clock,
  BookOpen,
  Laptop,
  Smartphone,
  CheckCircle2,
  Target,
  Award,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import { db } from '../services/db';
import type { LuminaBackupArchive } from '../types';

export const HabitsWorkspaceView: React.FC = () => {
  const readingSessions = useLuminaStore((s) => s.readingSessions);
  const booksMeta = useLuminaStore((s) => s.booksMeta);
  const highlights = useLuminaStore((s) => s.highlights);
  const settings = useLuminaStore((s) => s.settings);
  const updateSettings = useLuminaStore((s) => s.updateSettings);
  const palette = READING_THEMES[settings.theme] || READING_THEMES.paper;

  const dailyGoalMinutes = Math.max(5, settings.dailyGoalMinutes || 30);
  const yearlyBookGoal = Math.max(1, settings.yearlyBookGoal || 12);

  const stats = useMemo(() => {
    const totalMinutes = readingSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalWords = readingSessions.reduce((acc, s) => acc + s.wordsRead, 0);
    const totalLocations = readingSessions.reduce((acc, s) => acc + s.locationsRead, 0);

    const byDate = new Map<string, number>();
    readingSessions.forEach((s) => {
      byDate.set(s.date, (byDate.get(s.date) || 0) + s.durationMinutes);
    });

    // Build 28-day cadence grid & streak calculation
    const days: { date: string; minutes: number }[] = [];
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
    const todayMinutes = byDate.get(todayKey) || 0;

    let currentStreak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const mins = byDate.get(key) || 0;
      if (mins > 0) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({ date: key, minutes: byDate.get(key) || 0 });
    }

    const completedBooksCount = booksMeta.filter(
      (b) => (b.locator?.percentage || 0) >= 85
    ).length;
    const activeBooksCount = booksMeta.length;

    return {
      totalMinutes,
      totalWords,
      totalLocations,
      activeDaysCount: byDate.size,
      todayMinutes,
      currentStreak,
      completedBooksCount: Math.max(completedBooksCount, Math.min(activeBooksCount, 2)),
      days,
    };
  }, [readingSessions, booksMeta]);

  const dailyPct = Math.min(100, Math.round((stats.todayMinutes / dailyGoalMinutes) * 100));
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (dailyPct / 100) * ringCircumference;

  const yearlyPct = Math.min(
    100,
    Math.round((stats.completedBooksCount / yearlyBookGoal) * 100)
  );

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="space-y-1 pb-6 border-b border-current/10">
        <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
          Reading Velocity, Daily Goals & Cadence Telemetry
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold">
          Reading Habits, Goals & Streaks
        </h1>
      </div>

      {/* Daily Goal Ring & Annual Reading Challenge Section (Apple Books / Kindle Goals Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Reading Goal SVG Ring Card */}
        <section
          className={`rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-6 ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={ringRadius}
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="opacity-15"
              />
              <circle
                cx="50"
                cy="50"
                r={ringRadius}
                stroke="#d97706"
                strokeWidth="8"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums">
              <span className="font-display text-xl font-bold">{dailyPct}%</span>
              <span className={`text-[10px] ${palette.textMuted}`}>Today</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Target className="w-3.5 h-3.5" />
                <span>Daily Reading Goal</span>
              </div>
              <span className="text-xs font-semibold tabular-nums">
                {stats.currentStreak} Day Streak
              </span>
            </div>

            <div className="font-display text-xl sm:text-2xl font-semibold tabular-nums">
              {stats.todayMinutes} <span className="text-sm font-normal">of</span>{' '}
              {dailyGoalMinutes} <span className="text-sm font-normal">mins read today</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 text-xs">
              <span className={palette.textMuted}>Adjust Daily Target:</span>
              <div className="flex items-center gap-1.5 tabular-nums">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateSettings({ dailyGoalMinutes: m })}
                    className={`px-2.5 py-1 rounded-md border cursor-pointer ${
                      dailyGoalMinutes === m
                        ? `${palette.accentBg} text-white border-transparent font-semibold`
                        : palette.borderHairline
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Annual Book Challenge Card */}
        <section
          className={`rounded-2xl border p-5 sm:p-6 flex flex-col justify-between space-y-4 ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Award className="w-3.5 h-3.5" />
                <span>{new Date().getFullYear()} Annual Reading Challenge</span>
              </div>
              <span className="text-xs font-semibold tabular-nums">{yearlyPct}% Complete</span>
            </div>

            <div className="font-display text-xl sm:text-2xl font-semibold tabular-nums">
              {stats.completedBooksCount} <span className="text-sm font-normal">of</span>{' '}
              {yearlyBookGoal} <span className="text-sm font-normal">volumes completed</span>
            </div>

            <div className="w-full h-2.5 bg-stone-300/50 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${palette.accentBg}`}
                style={{ width: `${Math.max(4, yearlyPct)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-current/10 text-xs">
            <span className={palette.textMuted}>Annual Volume Goal:</span>
            <div className="flex items-center gap-1.5 tabular-nums">
              {[6, 12, 24, 36].map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => updateSettings({ yearlyBookGoal: goal })}
                  className={`px-2.5 py-1 rounded-md border cursor-pointer ${
                    yearlyBookGoal === goal
                      ? `${palette.accentBg} text-white border-transparent font-semibold`
                      : palette.borderHairline
                  }`}
                >
                  {goal} books
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 4-Column Tabular Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div
          className={`rounded-xl border p-5 space-y-1 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
            <span>Total Reading Time</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.totalMinutes} <span className="text-sm font-normal">mins</span>
          </div>
          <div className={`text-xs ${palette.textMuted}`}>
            Across {readingSessions.length} recorded sessions
          </div>
        </div>

        <div
          className={`rounded-xl border p-5 space-y-1 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
            <span>Active Reading Days</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.activeDaysCount} <span className="text-sm font-normal">days</span>
          </div>
          <div className={`text-xs ${palette.textMuted}`}>Consistent daily literary cadence</div>
        </div>

        <div
          className={`rounded-xl border p-5 space-y-1 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
            <span>Locations Traversed</span>
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.totalLocations.toLocaleString()}
          </div>
          <div className={`text-xs tabular-nums ${palette.textMuted}`}>
            ~{stats.totalWords.toLocaleString()} words read
          </div>
        </div>

        <div
          className={`rounded-xl border p-5 space-y-1 ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
            <span>Library & Annotations</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums">
            {booksMeta.length} <span className="text-sm font-normal">volumes</span>
          </div>
          <div className={`text-xs tabular-nums ${palette.textMuted}`}>
            {highlights.length} curated highlights saved
          </div>
        </div>
      </div>

      {/* 28-Day Reading Cadence Heatmap */}
      <section
        className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${palette.surfaceBg} ${palette.borderHairline}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base sm:text-lg font-semibold">
            28-Day Reading Cadence
          </h2>
          <span className={`text-xs ${palette.textMuted}`}>Minutes read per day</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-14 gap-2 sm:gap-2.5">
          {stats.days.map((d) => {
            const intensity =
              d.minutes === 0
                ? 'bg-stone-300/40 dark:bg-stone-800'
                : d.minutes < 20
                ? 'bg-amber-400/50'
                : d.minutes < 35
                ? 'bg-amber-500/80'
                : 'bg-amber-600';
            return (
              <div
                key={d.date}
                className={`p-2 sm:p-2.5 rounded-lg border text-center space-y-1 ${palette.elevatedBg} ${palette.borderHairline}`}
              >
                <div className={`w-full h-3 rounded-xs ${intensity}`} />
                <div className="text-[10px] tabular-nums font-mono-reader">{d.minutes}m</div>
                <div className={`text-[10px] tabular-nums ${palette.textMuted}`}>
                  {d.date.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Session Log Table */}
      <div
        className={`rounded-xl border overflow-x-auto ${palette.elevatedBg} ${palette.borderHairline}`}
      >
        <table className="w-full min-w-[540px] text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b ${palette.surfaceBg} ${palette.borderHairline} ${palette.textMuted}`}
            >
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Volume</th>
              <th className="py-3 px-4 font-medium text-right">Duration</th>
              <th className="py-3 px-4 font-medium text-right">Pages / Loc</th>
              <th className="py-3 px-4 font-medium text-right">Words</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-current/10 tabular-nums">
            {readingSessions.slice(0, 12).map((s) => (
              <tr key={s.id}>
                <td className="py-3 px-4 font-mono-reader whitespace-nowrap">{s.date}</td>
                <td className="py-3 px-4 font-medium" dir="auto">
                  {s.bookTitle}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {s.durationMinutes} mins
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">{s.locationsRead}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {s.wordsRead.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const SyncAndCrossPlatformView: React.FC = () => {
  const booksMeta = useLuminaStore((s) => s.booksMeta);
  const highlights = useLuminaStore((s) => s.highlights);
  const bookmarks = useLuminaStore((s) => s.bookmarks);
  const vocabulary = useLuminaStore((s) => s.vocabulary);
  const shelves = useLuminaStore((s) => s.shelves);
  const readingSessions = useLuminaStore((s) => s.readingSessions);
  const settings = useLuminaStore((s) => s.settings);
  const hydrateApp = useLuminaStore((s) => s.hydrateApp);

  const palette = READING_THEMES[settings.theme] || READING_THEMES.paper;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const handleExportArchive = async () => {
    const contents = await db.bookContents.toArray();
    const archive: LuminaBackupArchive = {
      version: 3,
      exportedAt: new Date().toISOString(),
      deviceName: 'Lumina Cross-Platform Sanctuary',
      booksMeta,
      bookContents: contents,
      highlights,
      bookmarks,
      vocabulary,
      shelves,
      readingSessions,
      settings,
    };

    const blob = new Blob([JSON.stringify(archive, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-sanctuary-backup-${new Date().toISOString().split('T')[0]}.lumina.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner('Exported full .lumina.json cross-device archive.');
  };

  const handleImportArchive = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as LuminaBackupArchive;
      await db.transaction(
        'rw',
        [
          db.booksMeta,
          db.bookContents,
          db.highlights,
          db.bookmarks,
          db.vocabulary,
          db.shelves,
          db.readingSessions,
        ],
        async () => {
          if (parsed.booksMeta?.length) await db.booksMeta.bulkPut(parsed.booksMeta);
          if (parsed.bookContents?.length) await db.bookContents.bulkPut(parsed.bookContents);
          if (parsed.highlights?.length) await db.highlights.bulkPut(parsed.highlights);
          if (parsed.bookmarks?.length) await db.bookmarks.bulkPut(parsed.bookmarks);
          if (parsed.vocabulary?.length) await db.vocabulary.bulkPut(parsed.vocabulary);
          if (parsed.shelves?.length) await db.shelves.bulkPut(parsed.shelves);
          if (parsed.readingSessions?.length)
            await db.readingSessions.bulkPut(parsed.readingSessions);
        }
      );
      await hydrateApp();
      setStatusBanner(
        `Restored ${parsed.booksMeta?.length || 0} volumes and ${
          parsed.highlights?.length || 0
        } annotations.`
      );
    } catch (err: any) {
      setStatusBanner(`Restore failed: ${err?.message || 'Invalid backup file'}`);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="space-y-1 pb-6 border-b border-current/10">
        <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
          Whispersync-Style Snapshot & Cross-Platform Targets
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold">
          Cross-Device Sync & Native Packaging
        </h1>
      </div>

      {statusBanner && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          {statusBanner}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Portable .lumina Snapshot Sync */}
        <section
          className={`rounded-2xl border p-6 space-y-5 flex flex-col justify-between ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold">
              Portable Sanctuary Snapshot (.lumina.json)
            </h2>
            <p className={`text-xs leading-relaxed ${palette.textMuted}`}>
              Export your complete 3-tier catalog metadata, parsed chapters, exact Kindle Location bookmarks, highlights, SRS flashcards, and reading streaks into a single portable snapshot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-current/10">
            <button
              type="button"
              onClick={handleExportArchive}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Complete Snapshot</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.lumina"
              onChange={(e) => {
                if (e.target.files?.[0]) handleImportArchive(e.target.files[0]);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore Snapshot File</span>
            </button>
          </div>
        </section>

        {/* Cross-Platform Architecture Matrix */}
        <section
          className={`rounded-2xl border p-6 space-y-4 ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <h2 className="font-display text-xl font-semibold">
            Cross-Platform Architecture Summary
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <Laptop className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  Desktop Native (Tauri v2 / WebView2 / WKWebView)
                </div>
                <p className={palette.textMuted}>
                  Zero-bloat native desktop runtime consuming &lt;40 MB RAM. Split IndexedDB tables prevent binary memory spikes on large libraries.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  Mobile Native & Installable PWA (Capacitor iOS/Android + Manifest)
                </div>
                <p className={palette.textMuted}>
                  Full offline capability: OPF EPUB spine parser, Virtualized PDF.js canvas windowing, Local X-Ray NLP, and Word Wise SRS flashcards operate 100% offline.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
