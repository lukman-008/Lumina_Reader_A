import React, { useMemo, useState } from 'react';
import {
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  Volume2,
  Download,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import { lookupWordWise } from '../services/localIntelligenceEngine';
import { ttsService } from '../services/ttsService';

export const VocabularySrsView: React.FC = () => {
  const vocabulary = useLuminaStore((s) => s.vocabulary);
  const theme = useLuminaStore((s) => s.settings.theme);
  const gradeVocabularyCard = useLuminaStore((s) => s.gradeVocabularyCard);
  const addVocabularyCard = useLuminaStore((s) => s.addVocabularyCard);
  const deleteVocabularyCard = useLuminaStore((s) => s.deleteVocabularyCard);
  const openBook = useLuminaStore((s) => s.openBook);
  const setActiveTab = useLuminaStore((s) => s.setActiveTab);

  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<'flashcard' | 'cloze'>('flashcard');
  const [selectedClozeOption, setSelectedClozeOption] = useState<string | null>(null);
  const [customWord, setCustomWord] = useState('');
  const [customContext, setCustomContext] = useState('');

  const currentCard = vocabulary[activeCardIdx] || vocabulary[0];

  // Build masked Cloze Deletion sentence (`[...]`) and 4 choices for Cloze Quiz Mode (#9)
  const clozeChallenge = useMemo(() => {
    if (!currentCard) return { maskedSentence: '', options: [] as string[] };
    const sentence = currentCard.contextSentence || `Contextual usage of ${currentCard.word}.`;
    const escapedWord = currentCard.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedWord, 'giu');
    const maskedSentence = regex.test(sentence)
      ? sentence.replace(regex, '[ …… ]')
      : `${sentence} — Term: [ …… ]`;

    const distractors = vocabulary
      .filter((v) => v.id !== currentCard.id)
      .map((v) => v.word);
    const fallbackPool = ['equanimity', 'hegemonikon', 'ephemeral', 'providence', 'sovereignty'];
    for (const fb of fallbackPool) {
      if (fb.toLowerCase() !== currentCard.word.toLowerCase() && !distractors.includes(fb)) {
        distractors.push(fb);
      }
    }

    const pickedDistractors = distractors.slice(0, 3);
    const allOptions = [currentCard.word, ...pickedDistractors].sort((a, b) =>
      a.localeCompare(b)
    );
    return { maskedSentence, options: allOptions };
  }, [currentCard, vocabulary]);

  const handleQuickAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWord.trim()) return;
    const res = await lookupWordWise(customWord, customContext || customWord);
    await addVocabularyCard({
      word: res.word,
      phonetic: res.phonetic,
      partOfSpeech: res.partOfSpeech,
      definition: res.definition,
      etymology: res.etymology,
      contextSentence: customContext.trim() || `Added to Word Wise Lexicon: "${res.word}"`,
      bookId: 'book-meditations',
      bookTitle: 'Personal Lexicon',
      locationNumber: 1,
    });
    setCustomWord('');
    setCustomContext('');
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

  // Export Vocabulary Deck as Anki .TSV (#11)
  const handleExportAnkiTsv = () => {
    const rows = vocabulary.map((v) => {
      const front = `${v.word} (${v.phonetic} · ${v.partOfSpeech}) — "${(v.contextSentence || '').replace(/\t|\n/g, ' ')}"`;
      const back = `${v.definition.replace(/\t|\n/g, ' ')} | Etymology: ${(v.etymology || '').replace(/\t|\n/g, ' ')}`;
      const tag = (v.bookTitle || 'LuminaLexicon').replace(/\s+/g, '_');
      return `${front}\t${back}\t${tag}`;
    });
    triggerDownload(
      rows.join('\n'),
      `lumina-vocabulary-anki-${Date.now()}.tsv`,
      'text/tab-separated-values;charset=utf-8'
    );
  };

  // Export Vocabulary Deck as .CSV (#11)
  const handleExportCsv = () => {
    const esc = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = [
      'Word',
      'Phonetic',
      'Part of Speech',
      'Definition',
      'Etymology',
      'Context Sentence',
      'Source Book',
      'Leitner Box',
    ].join(',');
    const rows = vocabulary.map((v) =>
      [
        esc(v.word),
        esc(v.phonetic),
        esc(v.partOfSpeech),
        esc(v.definition),
        esc(v.etymology),
        esc(v.contextSentence),
        esc(v.bookTitle),
        String(v.srsBox),
      ].join(',')
    );
    triggerDownload(
      [header, ...rows].join('\n'),
      `lumina-vocabulary-deck-${Date.now()}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-current/10">
        <div className="space-y-1">
          <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
            Kindle Word Wise · 5-Box Leitner Spaced Repetition & Cloze Recall
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            Vocabulary & SRS Flashcards
          </h1>
          <div className={`text-xs tabular-nums ${palette.textSecondary}`}>
            Total Cards: <strong>{vocabulary.length}</strong> · Mastered (Box 4–5):{' '}
            <strong>{vocabulary.filter((v) => v.srsBox >= 4).length}</strong>
          </div>
        </div>

        {/* Mode Switcher (Flashcard Flip vs. Cloze Deletion Quiz) + Deck Export (#9 & #11) */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center p-0.5 rounded-lg border text-xs ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <button
              type="button"
              onClick={() => {
                setStudyMode('flashcard');
                setSelectedClozeOption(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                studyMode === 'flashcard'
                  ? `${palette.accentBg} text-white`
                  : palette.textSecondary
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcard Flip</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStudyMode('cloze');
                setSelectedClozeOption(null);
                setIsFlipped(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                studyMode === 'cloze'
                  ? `${palette.accentBg} text-white`
                  : palette.textSecondary
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Cloze Quiz [...]</span>
            </button>
          </div>

          <button
            type="button"
            disabled={vocabulary.length === 0}
            onClick={handleExportAnkiTsv}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-40 ${palette.elevatedBg} ${palette.borderHairline}`}
            title="Export Tab-Separated Deck for Anki"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Anki .TSV</span>
          </button>

          <button
            type="button"
            disabled={vocabulary.length === 0}
            onClick={handleExportCsv}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-40 ${palette.elevatedBg} ${palette.borderHairline}`}
            title="Export Vocabulary Spreadsheet (.CSV)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .CSV</span>
          </button>
        </div>
      </div>

      {/* Interactive SRS Flashcard / Cloze Quiz Review Stage */}
      {currentCard && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
          <div
            onClick={() => {
              if (studyMode === 'flashcard') setIsFlipped((f) => !f);
            }}
            dir="auto"
            className={`lg:col-span-7 rounded-2xl border p-5 sm:p-8 flex flex-col justify-between min-h-[260px] sm:min-h-[280px] transition-all ${
              studyMode === 'flashcard' ? 'cursor-pointer' : ''
            } ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
              <span>
                Leitner Box {currentCard.srsBox} of 5 · Reviewed {currentCard.reviewCount}x
              </span>
              <span>
                {studyMode === 'flashcard' ? 'Tap card to flip' : 'Cloze Context Recall Quiz'}
              </span>
            </div>

            {studyMode === 'flashcard' ? (
              <div className="my-5 sm:my-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold">
                    {currentCard.word}
                  </h2>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      ttsService.speakText(currentCard.word);
                    }}
                    title="Pronounce Word Aloud"
                    className={`p-1.5 rounded-full border cursor-pointer hover:opacity-85 ${palette.elevatedBg} ${palette.borderHairline}`}
                  >
                    <Volume2 className="w-4 h-4 text-amber-500" />
                  </button>
                </div>
                <div className={`text-xs ${palette.textMuted}`}>
                  {currentCard.phonetic} · <em>{currentCard.partOfSpeech}</em>
                </div>

                {isFlipped ? (
                  <div className="space-y-3 pt-2 border-t border-current/10">
                    <p className="text-sm sm:text-base font-medium leading-relaxed">
                      {currentCard.definition}
                    </p>
                    <p className={`text-xs ${palette.textSecondary}`}>
                      <strong>Etymology:</strong> {currentCard.etymology}
                    </p>
                  </div>
                ) : (
                  <p className="font-literata italic text-sm opacity-85">
                    "{currentCard.contextSentence}"
                  </p>
                )}
              </div>
            ) : (
              /* Cloze Deletion Fill-in-the-Blank Quiz Mode (#9) */
              <div className="my-5 sm:my-6 space-y-4">
                <div className={`text-xs ${palette.textMuted}`}>
                  Fill in the missing term from <strong>{currentCard.bookTitle}</strong> ({currentCard.partOfSpeech}):
                </div>
                <blockquote className="font-literata italic text-base sm:text-lg leading-relaxed p-3.5 rounded-xl border border-current/10">
                  "{clozeChallenge.maskedSentence}"
                </blockquote>
                <div className={`text-xs ${palette.textSecondary}`}>
                  <strong>Clue:</strong> {currentCard.definition}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {clozeChallenge.options.map((opt) => {
                    const isPicked = selectedClozeOption === opt;
                    const isCorrect = opt.toLowerCase() === currentCard.word.toLowerCase();
                    let btnStyle = `${palette.elevatedBg} ${palette.borderHairline}`;
                    if (selectedClozeOption) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-600 text-white border-emerald-600 font-semibold';
                      } else if (isPicked) {
                        btnStyle = 'bg-rose-600 text-white border-rose-600 font-semibold';
                      }
                    }
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setSelectedClozeOption(opt);
                          ttsService.speakText(opt);
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs text-left transition-all cursor-pointer ${btnStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-current/10">
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  await openBook(currentCard.bookId, {
                    chapterIndex: currentCard.chapterIndex ?? 0,
                    pageIndex: currentCard.pageIndex,
                    locationNumber: currentCard.locationNumber,
                    searchText: currentCard.contextSentence || currentCard.word,
                  });
                  setActiveTab('library');
                }}
                className={`inline-flex items-center gap-1.5 text-xs font-medium hover:underline cursor-pointer ${palette.accentText}`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Open in {currentCard.bookTitle}</span>
              </button>
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  onClick={async () => {
                    await gradeVocabularyCard(currentCard.id, false);
                    setIsFlipped(false);
                    setSelectedClozeOption(null);
                    setActiveCardIdx((i) => (i + 1) % Math.max(1, vocabulary.length));
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Review Again (Box 1)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await gradeVocabularyCard(currentCard.id, true);
                    setIsFlipped(false);
                    setSelectedClozeOption(null);
                    setActiveCardIdx((i) => (i + 1) % Math.max(1, vocabulary.length));
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Remembered (Advance Box)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Add Word Wise Entry Directly */}
          <form
            onSubmit={handleQuickAddWord}
            className={`lg:col-span-5 rounded-2xl border p-5 sm:p-6 flex flex-col justify-between space-y-4 ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-75">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Add Word to SRS Deck</span>
              </div>
              <p className={`text-xs ${palette.textMuted}`}>
                Enter any literary or technical word in any language to resolve its phonetic transcription, part of speech, definition, and etymology via our Local Lexical Engine.
              </p>

              <div className="space-y-2 pt-2">
                <input
                  type="text"
                  dir="auto"
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  placeholder="Word (e.g., equanimity, देवता, نور, stratagem)..."
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
                <textarea
                  rows={3}
                  dir="auto"
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  placeholder="Optional sentence context from your reading..."
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
            >
              <Plus className="w-4 h-4" />
              <span>Lookup & Add to Flashcard Deck</span>
            </button>
          </form>
        </div>
      )}

      {/* Full Vocabulary Table (Scrollable on Mobile) */}
      <div
        className={`rounded-xl border overflow-x-auto ${palette.elevatedBg} ${palette.borderHairline}`}
      >
        <table className="w-full min-w-[640px] text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b ${palette.surfaceBg} ${palette.borderHairline} ${palette.textMuted}`}
            >
              <th className="py-3 px-4 font-medium">Word & Phonetics</th>
              <th className="py-3 px-4 font-medium">Definition & Etymology</th>
              <th className="py-3 px-4 font-medium">Source Volume</th>
              <th className="py-3 px-4 font-medium text-right">SRS Box</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-current/10">
            {vocabulary.map((card, idx) => (
              <tr
                key={card.id}
                onClick={() => {
                  setActiveCardIdx(idx);
                  setIsFlipped(true);
                }}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer"
              >
                <td className="py-3.5 px-4" dir="auto">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-semibold text-sm">{card.word}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        ttsService.speakText(card.word);
                      }}
                      title="Pronounce Word"
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                  </div>
                  <div className={palette.textMuted}>
                    {card.phonetic} · {card.partOfSpeech}
                  </div>
                </td>
                <td className="py-3.5 px-4 max-w-md" dir="auto">
                  <div className="font-medium">{card.definition}</div>
                  <div className={`text-[11px] mt-0.5 ${palette.textMuted}`}>{card.etymology}</div>
                </td>
                <td className="py-3.5 px-4" dir="auto">
                  <div>{card.bookTitle}</div>
                  <div className={`tabular-nums ${palette.textMuted}`}>
                    {typeof card.pageIndex === 'number'
                      ? `Page ${card.pageIndex + 1}`
                      : `Ch. ${(card.chapterIndex ?? 0) + 1}`}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right tabular-nums font-semibold">
                  Box {card.srsBox}/5
                </td>
                <td
                  onClick={(e) => e.stopPropagation()}
                  className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap"
                >
                  <button
                    type="button"
                    onClick={async () => {
                      await openBook(card.bookId, {
                        chapterIndex: card.chapterIndex ?? 0,
                        pageIndex: card.pageIndex,
                        locationNumber: card.locationNumber,
                        searchText: card.contextSentence || card.word,
                      });
                      setActiveTab('library');
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${palette.accentText} ${palette.borderHairline}`}
                    title="Open Book & Highlight Context"
                  >
                    <BookOpen className="w-3.5 h-3.5 inline" />
                    <span>Open & Highlight</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteVocabularyCard(card.id)}
                    className={`p-1 cursor-pointer ${palette.textMuted} hover:text-rose-600`}
                    title="Delete Card"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

