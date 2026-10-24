import React, { useEffect, useRef, useState } from 'react';
import { Download, Copy, Check, X } from 'lucide-react';
import { READING_THEMES } from '../utils/themeTokens';
import { useLuminaStore } from '../store/useLuminaStore';

export interface QuoteCardPayload {
  quote: string;
  bookTitle: string;
  bookAuthor: string;
  locationLabel: string;
  note?: string;
}

interface QuoteCardModalProps {
  payload: QuoteCardPayload | null;
  onClose: () => void;
}

type CardTemplateId = 'parchment' | 'nocturne' | 'sepia' | 'gallery';

const CARD_TEMPLATES: Record<
  CardTemplateId,
  {
    label: string;
    bg: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  }
> = {
  parchment: {
    label: 'Archival Parchment',
    bg: '#FBF9F5',
    border: '#E7E2D8',
    textPrimary: '#1C1917',
    textSecondary: '#78716C',
    accent: '#B45309',
  },
  nocturne: {
    label: 'Nocturne OLED',
    bg: '#0C0A09',
    border: '#292524',
    textPrimary: '#F5F5F4',
    textSecondary: '#A8A29E',
    accent: '#F59E0B',
  },
  sepia: {
    label: 'Florentine Sepia',
    bg: '#F4ECD8',
    border: '#DEC9A6',
    textPrimary: '#2D2016',
    textSecondary: '#6D543E',
    accent: '#9A3412',
  },
  gallery: {
    label: 'Swiss Gallery',
    bg: '#FFFFFF',
    border: '#E5E5E5',
    textPrimary: '#0A0A0A',
    textSecondary: '#525252',
    accent: '#1E3A8A',
  },
};

export const QuoteCardModal: React.FC<QuoteCardModalProps> = ({ payload, onClose }) => {
  const theme = useLuminaStore((s) => s.settings.theme);
  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  const [templateId, setTemplateId] = useState<CardTemplateId>('parchment');
  const [aspect, setAspect] = useState<'square' | 'portrait'>('square');
  const [includeNote, setIncludeNote] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tpl = CARD_TEMPLATES[templateId];
    const width = 1080;
    const height = aspect === 'square' ? 1080 : 1350;
    canvas.width = width;
    canvas.height = height;

    // 1. Background Fill
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Outer Hairline Frame
    const frameInset = 54;
    ctx.strokeStyle = tpl.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      frameInset,
      frameInset,
      width - frameInset * 2,
      height - frameInset * 2
    );

    // 3. Top Editorial Kicker
    const padX = 112;
    let cursorY = 145;
    ctx.fillStyle = tpl.accent;
    ctx.font = '600 22px sans-serif';
    ctx.fillText('LUMINA ARCHIVE · CURATED PASSAGE', padX, cursorY);

    cursorY += 32;
    ctx.strokeStyle = tpl.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, cursorY);
    ctx.lineTo(width - padX, cursorY);
    ctx.stroke();

    // 4. Word-Wrapped Literary Quote
    cursorY += 86;
    const quoteText = `"${payload.quote.trim()}"`;
    const maxTextWidth = width - padX * 2;
    const fontSize =
      quoteText.length > 380 ? 34 : quoteText.length > 220 ? 42 : 50;
    const lineHeight = Math.round(fontSize * 1.48);

    ctx.fillStyle = tpl.textPrimary;
    ctx.font = `italic 500 ${fontSize}px Georgia, serif`;

    const words = quoteText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const maxLines = aspect === 'square' ? 10 : 14;
    const displayLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      displayLines[maxLines - 1] += '…';
    }

    for (const ln of displayLines) {
      ctx.fillText(ln, padX, cursorY);
      cursorY += lineHeight;
    }

    // 5. Optional Margin Annotation Block
    if (includeNote && payload.note?.trim()) {
      cursorY += 28;
      ctx.fillStyle = tpl.textSecondary;
      ctx.font = '500 26px sans-serif';
      const notePrefix = `Margin Note: ${payload.note.trim()}`;
      const noteWords = notePrefix.split(/\s+/);
      let noteLine = '';
      const noteLines: string[] = [];
      for (const nw of noteWords) {
        const test = noteLine ? `${noteLine} ${nw}` : nw;
        if (ctx.measureText(test).width > maxTextWidth && noteLine) {
          noteLines.push(noteLine);
          noteLine = nw;
        } else {
          noteLine = test;
        }
      }
      if (noteLine) noteLines.push(noteLine);

      for (const nln of noteLines.slice(0, 3)) {
        ctx.fillText(nln, padX, cursorY);
        cursorY += 38;
      }
    }

    // 6. Bottom Attribution Footer
    const footerY = height - 155;
    ctx.strokeStyle = tpl.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, footerY - 48);
    ctx.lineTo(width - padX, footerY - 48);
    ctx.stroke();

    ctx.fillStyle = tpl.textPrimary;
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText(payload.bookTitle.slice(0, 52), padX, footerY);

    ctx.fillStyle = tpl.textSecondary;
    ctx.font = '500 24px sans-serif';
    ctx.fillText(
      `${payload.bookAuthor}  ·  ${payload.locationLabel}`,
      padX,
      footerY + 38
    );
  }, [payload, templateId, aspect, includeNote]);

  if (!payload) return null;

  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-quote-${Date.now()}.png`;
    a.click();
  };

  const handleCopyCitation = async () => {
    const text = `"${payload.quote}"\n— ${payload.bookTitle} by ${payload.bookAuthor} (${payload.locationLabel})${
      includeNote && payload.note ? `\nNote: ${payload.note}` : ''
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-5 text-xs ${palette.elevatedBg} ${palette.borderHairline} ${palette.textPrimary}`}
      >
        <div className="flex items-center justify-between border-b border-current/10 pb-3">
          <div>
            <h3 className="font-display text-base font-semibold">
              Shareable Typographic Quote Card Studio
            </h3>
            <p className={`text-[11px] ${palette.textMuted}`}>
              Export high-resolution archival quote cards or formatted citations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(CARD_TEMPLATES) as CardTemplateId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTemplateId(id)}
                className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer whitespace-nowrap ${
                  templateId === id
                    ? `${palette.accentBg} text-white`
                    : `${palette.surfaceBg} ${palette.borderHairline}`
                }`}
              >
                {CARD_TEMPLATES[id].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAspect(aspect === 'square' ? 'portrait' : 'square')}
              className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              Ratio: {aspect === 'square' ? '1:1 Square' : '4:5 Portrait'}
            </button>
            {payload.note && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNote}
                  onChange={(e) => setIncludeNote(e.target.checked)}
                  className="accent-amber-600"
                />
                <span>Include Note</span>
              </label>
            )}
          </div>
        </div>

        {/* Live High-DPI Canvas Preview */}
        <div className="flex justify-center bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-current/10">
          <canvas
            ref={canvasRef}
            className="max-h-[380px] w-auto rounded-lg shadow-lg border border-black/10"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-current/10">
          <button
            type="button"
            onClick={handleCopyCitation}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border font-medium cursor-pointer ${palette.borderHairline}`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Citation Copied' : 'Copy Formatted Citation'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white cursor-pointer ${palette.accentBg}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download High-Res PNG Card</span>
          </button>
        </div>
      </div>
    </div>
  );
};
