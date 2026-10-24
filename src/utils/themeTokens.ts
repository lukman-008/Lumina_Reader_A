import type { ReadingTheme, FontFamilyChoice, HighlightColor } from '../types';

export interface ThemePalette {
  name: string;
  subtitle: string;
  canvasBg: string;
  surfaceBg: string;
  elevatedBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderHairline: string;
  accentBg: string;
  accentText: string;
  isDark: boolean;
}

export const READING_THEMES: Record<ReadingTheme, ThemePalette> = {
  paper: {
    name: 'Archival Paper',
    subtitle: 'Warm alabaster monograph paper',
    canvasBg: 'bg-[#FBF9F5]',
    surfaceBg: 'bg-[#F3EFE6]',
    elevatedBg: 'bg-white',
    textPrimary: 'text-[#1C1917]',
    textSecondary: 'text-[#44403C]',
    textMuted: 'text-[#78716C]',
    borderHairline: 'border-[#E7E2D8]',
    accentBg: 'bg-[#B45309]',
    accentText: 'text-[#B45309]',
    isDark: false,
  },
  studio: {
    name: 'Studio Daylight',
    subtitle: 'Crisp gallery white',
    canvasBg: 'bg-white',
    surfaceBg: 'bg-[#F5F5F4]',
    elevatedBg: 'bg-white',
    textPrimary: 'text-[#0A0A0A]',
    textSecondary: 'text-[#404040]',
    textMuted: 'text-[#737373]',
    borderHairline: 'border-[#E5E5E5]',
    accentBg: 'bg-[#1D4ED8]',
    accentText: 'text-[#1D4ED8]',
    isDark: false,
  },
  sepia: {
    name: 'Kindle Sepia',
    subtitle: 'Classic warm parchment',
    canvasBg: 'bg-[#F4ECD8]',
    surfaceBg: 'bg-[#EAE0C8]',
    elevatedBg: 'bg-[#F9F3E3]',
    textPrimary: 'text-[#2C221E]',
    textSecondary: 'text-[#52433C]',
    textMuted: 'text-[#7D6B61]',
    borderHairline: 'border-[#DCD0B8]',
    accentBg: 'bg-[#9A3412]',
    accentText: 'text-[#9A3412]',
    isDark: false,
  },
  nocturne: {
    name: 'OLED Nocturne',
    subtitle: 'True pitch-dark reading room',
    canvasBg: 'bg-[#0C0A09]',
    surfaceBg: 'bg-[#1C1917]',
    elevatedBg: 'bg-[#262320]',
    textPrimary: 'text-[#E7E5E4]',
    textSecondary: 'text-[#A8A29E]',
    textMuted: 'text-[#78716C]',
    borderHairline: 'border-[#292524]',
    accentBg: 'bg-[#F59E0B]',
    accentText: 'text-[#F59E0B]',
    isDark: true,
  },
  dusk: {
    name: 'Evergreen Dusk',
    subtitle: 'Low-strain botanical night',
    canvasBg: 'bg-[#0F1715]',
    surfaceBg: 'bg-[#16221F]',
    elevatedBg: 'bg-[#1E2E2A]',
    textPrimary: 'text-[#D6E4E0]',
    textSecondary: 'text-[#99B2AC]',
    textMuted: 'text-[#66827B]',
    borderHairline: 'border-[#233530]',
    accentBg: 'bg-[#10B981]',
    accentText: 'text-[#10B981]',
    isDark: true,
  },
};

export const FONT_FAMILY_CLASSES: Record<FontFamilyChoice, { label: string; className: string }> = {
  literata: { label: 'Literata Book', className: 'font-literata' },
  merriweather: { label: 'Merriweather', className: 'font-merriweather' },
  sans: { label: 'Plus Jakarta Sans', className: 'font-sans-ui' },
  dyslexic: { label: 'Accessible Dyslexic', className: 'font-dyslexic' },
  mono: { label: 'JetBrains Mono', className: 'font-mono-reader' },
};

export const HIGHLIGHT_SWATCHES: Record<
  HighlightColor,
  { label: string; markClass: string; dotClass: string; pdfFill: string }
> = {
  amber: {
    label: 'Warm Amber',
    markClass: 'bg-amber-300/45 dark:bg-amber-500/35 text-current rounded-xs px-0.5',
    dotClass: 'bg-amber-400',
    pdfFill: 'rgba(251, 191, 36, 0.36)',
  },
  emerald: {
    label: 'Botanical Sage',
    markClass: 'bg-emerald-300/45 dark:bg-emerald-500/35 text-current rounded-xs px-0.5',
    dotClass: 'bg-emerald-400',
    pdfFill: 'rgba(52, 211, 153, 0.36)',
  },
  sky: {
    label: 'Lapis Sky',
    markClass: 'bg-sky-300/45 dark:bg-sky-500/35 text-current rounded-xs px-0.5',
    dotClass: 'bg-sky-400',
    pdfFill: 'rgba(56, 189, 248, 0.36)',
  },
  rose: {
    label: 'Crimson Rose',
    markClass: 'bg-rose-300/45 dark:bg-rose-500/35 text-current rounded-xs px-0.5',
    dotClass: 'bg-rose-400',
    pdfFill: 'rgba(251, 113, 133, 0.36)',
  },
  violet: {
    label: 'Imperial Violet',
    markClass: 'bg-violet-300/45 dark:bg-violet-500/35 text-current rounded-xs px-0.5',
    dotClass: 'bg-violet-400',
    pdfFill: 'rgba(167, 139, 250, 0.36)',
  },
};
