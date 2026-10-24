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
  Copy,
  Check,
  FileCode,
  Terminal,
  Tablet,
  ShieldCheck,
  Layers,
  Monitor,
  Info,
  X,
  Sparkles,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import { db } from '../services/db';
import { usePWAInstall } from '../utils/usePWAInstall';
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
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'twa' | 'eink' | 'ios' | 'desktop'>('android');
  const [showReadmeModal, setShowReadmeModal] = useState(false);
  const [showIosGuideModal, setShowIosGuideModal] = useState(false);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

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
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-current/10">
        <div className="space-y-1">
          <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
            Whispersync-Style Snapshot & Native App Distribution
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            Cross-Device Sync & Multi-Platform Packaging
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowReadmeModal(true)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${palette.elevatedBg} ${palette.borderHairline}`}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-500" />
          <span>View Native Build README</span>
        </button>
      </div>

      {statusBanner && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          {statusBanner}
        </div>
      )}

      {/* PWA Quick Install Banner */}
      <section
        className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${palette.surfaceBg} ${palette.borderHairline}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h2 className="font-display text-base sm:text-lg font-semibold">
                Instant PWA Web App Installation
              </h2>
            </div>
            <p className={`text-xs ${palette.textMuted}`}>
              Lumina functions as an installable standalone app with offline storage, full-screen reading mode, and zero app store friction.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                <Check className="w-3.5 h-3.5" />
                App Running in Standalone Mode
              </span>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={install}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer shadow-xs hover:opacity-90 transition-opacity ${palette.accentBg}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install on This Device</span>
              </button>
            ) : isIOS ? (
              <button
                type="button"
                onClick={() => setShowIosGuideModal(true)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${palette.borderHairline}`}
              >
                <Tablet className="w-3.5 h-3.5 text-amber-500" />
                <span>Install on iPhone / iPad</span>
              </button>
            ) : (
              <span className={`text-xs px-3 py-1.5 rounded-lg border ${palette.borderHairline} ${palette.textMuted}`}>
                PWA Ready (Chrome / Edge / Safari / Android)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Native App Packaging Hub */}
      <section
        className={`rounded-2xl border p-5 sm:p-7 space-y-6 ${palette.elevatedBg} ${palette.borderHairline}`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Turnkey Multi-Platform Engine</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold">
            Native App Build & Distribution Hub
          </h2>
          <p className={`text-xs leading-relaxed max-w-2xl ${palette.textMuted}`}>
            Compile Lumina Reader directly into native Android packages (.apk / .aab), iOS apps, or lightweight desktop binaries using the preconfigured templates and commands below.
          </p>
        </div>

        {/* Platform Selection Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 p-1 rounded-xl border overflow-x-auto border-current/10 bg-black/5 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setActivePlatformTab('android')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
              activePlatformTab === 'android'
                ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                : `${palette.textMuted} hover:${palette.textPrimary}`
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Native (Capacitor)</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePlatformTab('twa')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
              activePlatformTab === 'twa'
                ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                : `${palette.textMuted} hover:${palette.textPrimary}`
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Google Play TWA</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePlatformTab('eink')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
              activePlatformTab === 'eink'
                ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                : `${palette.textMuted} hover:${palette.textPrimary}`
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Android E-Ink (Boox/Meebook)</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePlatformTab('ios')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
              activePlatformTab === 'ios'
                ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                : `${palette.textMuted} hover:${palette.textPrimary}`
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>iOS & iPadOS (Xcode)</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePlatformTab('desktop')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
              activePlatformTab === 'desktop'
                ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                : `${palette.textMuted} hover:${palette.textPrimary}`
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop (Tauri / Electron)</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        {activePlatformTab === 'android' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">1. Build Native Android APK & Google Play AAB</h3>
                <p className={`text-xs ${palette.textMuted}`}>
                  Capacitor wraps the React bundle with full hardware acceleration, WakeLock, and local file storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    'npm install @capacitor/core @capacitor/cli @capacitor/android && npm run build && npx cap add android && npx cap sync android',
                    'android-full'
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${palette.borderHairline}`}
              >
                {copiedSnippet === 'android-full' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied Commands!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All Commands</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono-reader text-xs space-y-2 border border-stone-800 overflow-x-auto">
              <div className="text-stone-400"># Step 1: Install Capacitor Native Android Engine</div>
              <div className="text-amber-400">npm install @capacitor/core @capacitor/cli @capacitor/android</div>
              <div className="text-stone-400 mt-2"># Step 2: Build Web Assets and Generate Android Studio Project</div>
              <div className="text-amber-400">npm run build</div>
              <div className="text-amber-400">npx cap add android</div>
              <div className="text-amber-400">npx cap sync android</div>
              <div className="text-stone-400 mt-2"># Step 3: Open in Android Studio or Compile APK via Gradle</div>
              <div className="text-amber-400">npx cap open android</div>
              <div className="text-stone-400 mt-1"># Or generate standalone release APK directly from terminal:</div>
              <div className="text-amber-400">cd android && ./gradlew assembleRelease</div>
            </div>

            <div className={`p-4 rounded-xl border text-xs space-y-2 ${palette.surfaceBg} ${palette.borderHairline}`}>
              <div className="font-semibold flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span>Preconfigured Files Included in Repository</span>
              </div>
              <ul className={`list-disc list-inside space-y-1 ${palette.textMuted}`}>
                <li>
                  <code className="text-stone-800 dark:text-stone-200">capacitor.config.json</code>: App ID set to <code className="text-amber-600">com.luminareader.app</code>.
                </li>
                <li>
                  <code className="text-stone-800 dark:text-stone-200">public/manifest.webmanifest</code>: 192px/512px icon definitions and standalone viewport flags.
                </li>
                <li>
                  <code className="text-stone-800 dark:text-stone-200">index.html</code>: Mobile viewport-fit=cover and iOS apple-mobile-web-app status bar rules.
                </li>
              </ul>
            </div>
          </div>
        )}

        {activePlatformTab === 'twa' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">2. Google Play Store via Trusted Web Activity (Bubblewrap)</h3>
              <p className={`text-xs ${palette.textMuted}`}>
                The official Google Chrome tool to publish your web sanctuary to the Google Play Store with zero Java code.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono-reader text-xs space-y-2 border border-stone-800 overflow-x-auto">
              <div className="text-stone-400"># Install Google Bubblewrap CLI</div>
              <div className="text-amber-400">npm install -g @bubblewrap/cli</div>
              <div className="text-stone-400 mt-2"># Initialize project from your live domain</div>
              <div className="text-amber-400">bubblewrap init --manifest=https://your-domain.com/manifest.webmanifest</div>
              <div className="text-stone-400 mt-2"># Build signed Google Play AAB bundle</div>
              <div className="text-amber-400">bubblewrap build</div>
            </div>
          </div>
        )}

        {activePlatformTab === 'eink' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">3. Android E-Ink Devices (Onyx Boox, Meebook, Kindle Fire)</h3>
              <p className={`text-xs ${palette.textMuted}`}>
                Lumina features dedicated optimizations for electrophoretic monochrome E-Ink displays.
              </p>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs`}>
              <div className={`p-4 rounded-xl border space-y-1.5 ${palette.surfaceBg} ${palette.borderHairline}`}>
                <div className="font-semibold">Monochrome E-Ink Theme</div>
                <p className={palette.textMuted}>
                  Select the Pure E-Ink high-contrast preset (#FFFFFF background, #000000 text) to maximize pixel clarity.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-1.5 ${palette.surfaceBg} ${palette.borderHairline}`}>
                <div className="font-semibold">Paginated Page Turn Mode</div>
                <p className={palette.textMuted}>
                  Eliminates continuous scrolling motion blur on 8Hz - 15Hz E-Ink panels.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-1.5 ${palette.surfaceBg} ${palette.borderHairline}`}>
                <div className="font-semibold">Physical Page Buttons</div>
                <p className={palette.textMuted}>
                  Hardware volume keys on Onyx Boox Leaf/Page/Palma automatically map to Previous & Next page turns.
                </p>
              </div>
            </div>
          </div>
        )}

        {activePlatformTab === 'ios' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">4. iOS & iPadOS App (Capacitor + Xcode)</h3>
              <p className={`text-xs ${palette.textMuted}`}>
                Native iOS wrapper supporting iPad Split View, Apple Pencil in PDF mode, and Safe Area notches.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono-reader text-xs space-y-2 border border-stone-800 overflow-x-auto">
              <div className="text-stone-400"># Install iOS Capacitor Engine</div>
              <div className="text-amber-400">npm install @capacitor/ios</div>
              <div className="text-amber-400">npm run build</div>
              <div className="text-amber-400">npx cap add ios</div>
              <div className="text-amber-400">npx cap sync ios</div>
              <div className="text-stone-400 mt-2"># Open in Xcode for device signing and App Store submission</div>
              <div className="text-amber-400">npx cap open ios</div>
            </div>
          </div>
        )}

        {activePlatformTab === 'desktop' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">5. Desktop Applications (macOS, Windows, Linux)</h3>
              <p className={`text-xs ${palette.textMuted}`}>
                Package with Tauri 2.0 for a lightweight native binary (&lt;10MB installer, &lt;40MB RAM usage).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono-reader text-xs space-y-2 border border-stone-800 overflow-x-auto">
              <div className="text-stone-400"># Method A: Tauri 2.0 (Ultra-lightweight Rust Shell)</div>
              <div className="text-amber-400">npm install -D @tauri-apps/cli</div>
              <div className="text-amber-400">npx tauri init</div>
              <div className="text-amber-400">npx tauri build</div>
              <div className="text-stone-400 mt-2"># Method B: Electron (Full Chromium Binary)</div>
              <div className="text-amber-400">npm install -D electron electron-builder</div>
            </div>
          </div>
        )}
      </section>

      {/* Snapshot Backup / Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            Cross-Platform Offline Storage Guarantees
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <Laptop className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <div className="font-semibold">
                  Split IndexedDB (Dexie 4.x)
                </div>
                <p className={palette.textMuted}>
                  Zero-bloat memory runtime: Book metadata and binary spine blobs are stored in separate tables so querying the library never loads massive 50MB PDF arrays into RAM.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Smartphone className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <div className="font-semibold">
                  100% Client-Side Engine
                </div>
                <p className={palette.textMuted}>
                  OPF EPUB spine parser, PDF.js vector engine, Local X-Ray NLP, and Word Wise dictionary operate completely offline on Android and iOS without internet connection.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIosGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-xl ${palette.surfaceBg} ${palette.borderHairline}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tablet className="w-5 h-5 text-amber-500" />
                <h3 className="font-display text-lg font-semibold">Install on iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuideModal(false)}
                className={`p-1 rounded-lg cursor-pointer ${palette.textMuted}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p>Apple iOS Safari does not show an automatic prompt button. Follow these 2 steps:</p>
              <div className={`p-3 rounded-xl border space-y-2 ${palette.elevatedBg} ${palette.borderHairline}`}>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-500">1.</span>
                  <span>Tap the <strong>Share</strong> icon in the Safari bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-500">2.</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
              </div>
              <p className={palette.textMuted}>
                The app will appear on your home screen with its custom icon and run in standalone mode without Safari browser controls.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuideModal(false)}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* In-App README Viewer Modal */}
      {showReadmeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className={`w-full max-w-3xl max-h-[85vh] rounded-2xl border flex flex-col shadow-2xl ${palette.canvasBg} ${palette.borderHairline}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-current/10 shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-500" />
                <h3 className="font-display text-base font-semibold">
                  README.md — Native Multi-Platform Build Manual
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReadmeModal(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${palette.textMuted}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed font-sans">
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                <div className="font-semibold text-amber-600 dark:text-amber-400">
                  Documentation Location in Project
                </div>
                <p className={palette.textMuted}>
                  This guide is saved in root as <code className="font-mono-reader font-bold">/README.md</code> and <code className="font-mono-reader font-bold">/capacitor.config.json</code>.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-sm">Quick Commands Summary</h4>
                <div className="p-3 rounded-lg bg-stone-950 text-stone-100 font-mono-reader space-y-1 overflow-x-auto">
                  <div>npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                  <div>npm run build</div>
                  <div>npx cap add android</div>
                  <div>npx cap open android</div>
                  <div>cd android && ./gradlew assembleRelease</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-sm">Hardware & Reading Optimizations</h4>
                <p className={palette.textMuted}>
                  • Android WakeLock ensures screens never sleep during long reading intervals.<br />
                  • Hardware volume button listeners on Android E-Ink devices (Onyx Boox, Meebook, Kindle Fire) turn pages without screen taps.<br />
                  • High-contrast pure E-Ink monochrome theme eliminates ghosting.<br />
                  • Split IndexedDB tables keep memory footprint tiny (&lt;40MB) even on lower-spec mobile devices.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-current/10 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([document.querySelector('meta[name="description"]')?.getAttribute('content') || ''], { type: 'text/markdown' });
                  // Direct user to README
                  setShowReadmeModal(false);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${palette.borderHairline}`}
              >
                Close Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCopy(
                    'npm install @capacitor/core @capacitor/cli @capacitor/android && npm run build && npx cap add android && npx cap sync android',
                    'readme-copy'
                  );
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                {copiedSnippet === 'readme-copy' ? 'Copied CLI Command!' : 'Copy Android Setup CLI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

