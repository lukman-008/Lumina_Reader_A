import React, { useState } from 'react';
import { Check, RotateCcw, Plus, Trash2, Sparkles, BookOpen } from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import { lookupWordWise } from '../services/localIntelligenceEngine';

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
  const [customWord, setCustomWord] = useState('');
  const [customContext, setCustomContext] = useState('');

  const currentCard = vocabulary[activeCardIdx] || vocabulary[0];

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

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-current/10">
        <div className="space-y-1">
          <div className={`text-xs uppercase tracking-widest ${palette.textMuted}`}>
            Kindle Word Wise · 5-Box Leitner Spaced Repetition
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            Vocabulary & SRS Flashcards
          </h1>
        </div>
        <div className={`text-xs tabular-nums ${palette.textSecondary}`}>
          Total Cards: <strong>{vocabulary.length}</strong> · Mastered (Box 4–5):{' '}
          <strong>{vocabulary.filter((v) => v.srsBox >= 4).length}</strong>
        </div>
      </div>

      {/* Interactive SRS Flashcard Review Stage */}
      {currentCard && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
          <div
            onClick={() => setIsFlipped((f) => !f)}
            dir="auto"
            className={`lg:col-span-7 rounded-2xl border p-5 sm:p-8 flex flex-col justify-between min-h-[260px] sm:min-h-[280px] cursor-pointer transition-all ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <div className={`flex items-center justify-between text-xs ${palette.textMuted}`}>
              <span>
                Leitner Box {currentCard.srsBox} of 5 · Reviewed {currentCard.reviewCount}x
              </span>
              <span>Tap card to flip</span>
            </div>

            <div className="my-5 sm:my-6 space-y-3">
              <h2 className="font-display text-2xl sm:text-3xl font-bold">{currentCard.word}</h2>
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
                  <div className="font-display font-semibold text-sm">{card.word}</div>
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
