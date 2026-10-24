import type { BookChapter, XRayData, XRayEntity } from '../types';
import {
  lookupMultilingualWord,
  sanitizeAndRepairUnicodeText,
} from './multilingualDictionary';

/**
 * Detects whether a text string contains Arabic, Persian, Urdu, or Hebrew (RTL) characters.
 */
export function isRtlText(text?: string): boolean {
  if (!text) return false;
  return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    text
  );
}

const STOP_WORDS = new Set([
  'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'from',
  'they', 'say', 'her', 'she', 'will', 'one', 'all', 'would', 'there', 'their', 'what',
  'out', 'about', 'who', 'get', 'which', 'when', 'make', 'can', 'like', 'time', 'just',
  'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
  'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'upon', 'more',
  'such', 'where', 'every', 'through', 'between', 'must', 'should', 'those', 'very', 'much',
  'before', 'great', 'same', 'without', 'against', 'under', 'while', 'himself', 'herself',
  'chapter', 'part', 'book', 'section', 'thus', 'therefore', 'however', 'when', 'where',
  // Arabic stop words
  'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي',
  'كان', 'كانت', 'يكون', 'ما', 'لا', 'لم', 'لن', 'إن', 'أن', 'قد', 'كل', 'بعض', 'أو', 'ثم', 'حتى', 'بعد', 'قبل', 'بين', 'عند', 'هو', 'هي', 'هم', 'نحن', 'أنت', 'أنا',
  // Hindi / Devanagari stop words
  'का', 'की', 'के', 'को', 'में', 'से', 'पर', 'ने', 'है', 'हैं', 'था', 'थी', 'थे', 'और', 'एक', 'यह', 'वह', 'इस', 'उस', 'कि', 'जो', 'तो', 'ही', 'भी', 'नहीं', 'कर', 'किया', 'गया', 'रहा', 'रही', 'रहे', 'हो', 'लिए', 'साथ', 'अपने', 'अपनी', 'कोई', 'कुछ',
]);

const OFFLINE_LEXICON: Record<
  string,
  { phonetic: string; partOfSpeech: string; definition: string; etymology: string }
> = {
  equanimity: {
    phonetic: '/ˌiːkwəˈnɪmɪti/',
    partOfSpeech: 'noun',
    definition: 'Mental calmness, composure, and evenness of temper, especially in a difficult situation.',
    etymology: 'Latin aequanimitas, from aequus (even, level) + animus (mind, spirit).',
  },
  hegemonikon: {
    phonetic: '/ˌhɛdʒɪˈmɒnɪkɒn/',
    partOfSpeech: 'noun (Stoic philosophy)',
    definition: 'The ruling or commanding faculty of the rational soul; the seat of judgment and volition.',
    etymology: 'Ancient Greek ἡγεμονικόν (hēgemonikon), "fit for command," from ἡγεμών (leader).',
  },
  ephemeral: {
    phonetic: '/ɪˈfɛm(ə)r(ə)l/',
    partOfSpeech: 'adjective',
    definition: 'Lasting for a very short span of time; transitory and fleeting.',
    etymology: 'Greek ephēmeros, from epi (on) + hēmera (day) — literally "lasting only a day."',
  },
  stratagem: {
    phonetic: '/ˈstratədʒəm/',
    partOfSpeech: 'noun',
    definition: 'A plan or scheme, especially one used to outwit an opponent or achieve an end.',
    etymology: 'Greek stratēgēma, from stratēgos (general, commander of an army).',
  },
  providence: {
    phonetic: '/ˈprɒvɪd(ə)ns/',
    partOfSpeech: 'noun',
    definition: 'The protective care of nature or cosmic order; timely preparation for future eventualities.',
    etymology: 'Latin providentia, from providere (foresee, attend to), from pro- (before) + videre (see).',
  },
  inexorable: {
    phonetic: '/ɪnˈɛks(ə)rəb(ə)l/',
    partOfSpeech: 'adjective',
    definition: 'Impossible to stop, alter, or prevent; relentless in progression.',
    etymology: 'Latin inexorabilis, from in- (not) + exorare (prevail upon by entreaty).',
  },
  relativity: {
    phonetic: '/ˌrɛləˈtɪvɪti/',
    partOfSpeech: 'noun (physics)',
    definition: 'The principle that physical laws and space-time measurements depend on the observer’s frame of reference.',
    etymology: 'From Latin relativus (having reference or relation to), formalized by Albert Einstein (1905/1915).',
  },
  simultaneity: {
    phonetic: '/ˌsɪmltəˈneɪɪti/',
    partOfSpeech: 'noun',
    definition: 'The property of two events happening at the exact same time in a given reference frame.',
    etymology: 'From Medieval Latin simultaneus, from Latin simul (at the same time).',
  },
  deliberate: {
    phonetic: '/dɪˈlɪb(ə)rət/',
    partOfSpeech: 'adjective',
    definition: 'Done consciously and intentionally; characterized by unhurried, careful consideration.',
    etymology: 'Latin deliberatus, past participle of deliberare, from libra (scales, balance).',
  },
  sovereignty: {
    phonetic: '/ˈsɒvrɪnti/',
    partOfSpeech: 'noun',
    definition: 'Supreme authority or self-governance over one’s own mind, territory, or actions.',
    etymology: 'Old French soverainete, from Vulgar Latin superanus (chief, principal).',
  },
};

/**
 * Splits multilingual text (English, Hindi, Arabic, CJK, European) into clean sentences.
 */
export function splitMultilingualSentences(text: string): string[] {
  if (!text) return [];
  return sanitizeAndRepairUnicodeText(text)
    .split(/(?<=[.!?؟۔।;\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

/**
 * 100% Local Deterministic X-Ray Extractor (Supports English, Arabic/RTL, and Unicode scripts)
 */
export function buildLocalXRayIndex(bookId: string, chapters: BookChapter[]): XRayData {
  try {
    const properNounCounts = new Map<string, { count: number; firstChapter: number; quote: string }>();
    const termCounts = new Map<string, { count: number; firstChapter: number; quote: string }>();
    const notablePassages: XRayData['notablePassages'] = [];

    const themeBuckets: Record<
      string,
      { keywords: string[]; count: number; quote: string; firstChapter: number }
    > = {
      'Rational Mastery & Wisdom': {
        keywords: [
          'reason', 'mind', 'soul', 'judgment', 'virtue', 'nature', 'tranquility', 'thought',
          'عقل', 'حكمة', 'نفس', 'فكر', 'معرفة', 'روح', 'حق',
        ],
        count: 0,
        quote: '',
        firstChapter: 0,
      },
      'Strategy, Action & Leadership': {
        keywords: [
          'enemy', 'victory', 'terrain', 'battle', 'general', 'water', 'force', 'deception',
          'قوة', 'قيادة', 'نصر', 'عمل', 'سلطة', 'نظام',
        ],
        count: 0,
        quote: '',
        firstChapter: 0,
      },
      'Society, Life & Observation': {
        keywords: [
          'woods', 'pond', 'simplicity', 'nature', 'solitude', 'morning', 'life', 'earth',
          'حياة', 'مجتمع', 'إنسان', 'طبيعة', 'عالم', 'أرض',
        ],
        count: 0,
        quote: '',
        firstChapter: 0,
      },
      'Time, History & Transformation': {
        keywords: [
          'time', 'death', 'mortal', 'change', 'universe', 'moment', 'present', 'light', 'space',
          'زمن', 'تاريخ', 'وقت', 'تغيير', 'عصر', 'مستقبل',
        ],
        count: 0,
        quote: '',
        firstChapter: 0,
      },
    };

    chapters.forEach((ch, chIdx) => {
      const content = ch?.content || '';
      const sentences = splitMultilingualSentences(content).filter(
        (s) => s.length >= 25 && s.length <= 320
      );

      if (sentences.length > 0) {
        notablePassages.push({
          text: sentences[0],
          chapterIndex: chIdx,
          chapterTitle: ch.title || `Chapter ${chIdx + 1}`,
          locationNumber: ch.startLocation || 1,
        });
      }

      sentences.slice(0, 120).forEach((sentence) => {
        const lower = sentence.toLowerCase();
        for (const [, bucket] of Object.entries(themeBuckets)) {
          for (const kw of bucket.keywords) {
            if (lower.includes(kw)) {
              bucket.count += 1;
              if (!bucket.quote) {
                bucket.quote = sentence;
                bucket.firstChapter = chIdx;
              }
            }
          }
        }

        const words = sentence.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          const rawToken = words[i].replace(/[^\p{L}\p{M}]/gu, '');
          if (rawToken.length < 4) continue;
          const lowerToken = rawToken.toLowerCase();
          if (STOP_WORDS.has(rawToken) || STOP_WORDS.has(lowerToken)) continue;

          // Latin Capitalized Mid-Sentence Proper Noun
          if (i > 0 && /^[A-Z][a-z]{3,}$/.test(rawToken)) {
            const prev = properNounCounts.get(rawToken);
            if (prev) prev.count += 1;
            else properNounCounts.set(rawToken, { count: 1, firstChapter: chIdx, quote: sentence });
          } else if (rawToken.length >= 5) {
            // Unicode / Arabic / Domain Concept Term
            const prevTerm = termCounts.get(lowerToken);
            if (prevTerm) prevTerm.count += 1;
            else termCounts.set(lowerToken, { count: 1, firstChapter: chIdx, quote: sentence });
          }
        }
      });
    });

    // If non-Latin script (like Arabic) has no uppercase/lowercase distinction, promote top frequent entities to characters/entities
    let characters: XRayEntity[] = Array.from(properNounCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, info], idx) => ({
        id: `char-${idx}`,
        name,
        category: 'character',
        roleOrDefinition: `Key entity referenced across ${info.count} passage${info.count > 1 ? 's' : ''}, first appearing in Section ${info.firstChapter + 1}.`,
        mentionsCount: info.count,
        firstChapterIndex: info.firstChapter,
        sampleQuote: info.quote,
      }));

    const sortedTerms = Array.from(termCounts.entries()).sort((a, b) => b[1].count - a[1].count);

    if (characters.length === 0 && sortedTerms.length > 0) {
      characters = sortedTerms.slice(0, 5).map(([term, info], idx) => ({
        id: `entity-${idx}`,
        name: term,
        category: 'character',
        roleOrDefinition: `Primary recurring subject (${info.count} occurrences), introduced in Section ${info.firstChapter + 1}.`,
        mentionsCount: info.count,
        firstChapterIndex: info.firstChapter,
        sampleQuote: info.quote,
      }));
    }

    const terms: XRayEntity[] = sortedTerms.slice(0, 10).map(([term, info], idx) => ({
      id: `term-${idx}`,
      name: term.charAt(0).toUpperCase() + term.slice(1),
      category: 'term',
      roleOrDefinition:
        OFFLINE_LEXICON[term]?.definition ||
        `Salient concept appearing ${info.count} times across the volume.`,
      mentionsCount: info.count,
      firstChapterIndex: info.firstChapter,
      sampleQuote: info.quote,
    }));

    const themes: XRayEntity[] = Object.entries(themeBuckets)
      .filter(([, b]) => b.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, b], idx) => ({
        id: `theme-${idx}`,
        name,
        category: 'theme',
        roleOrDefinition: `Thematic thread identified in ${b.count} passages starting in Section ${b.firstChapter + 1}.`,
        mentionsCount: b.count,
        firstChapterIndex: b.firstChapter,
        sampleQuote: b.quote,
      }));

    return {
      bookId,
      generatedBy: 'local-nlp',
      characters,
      terms,
      themes,
      notablePassages,
    };
  } catch (err) {
    console.warn('X-Ray fallback returned:', err);
    return {
      bookId,
      generatedBy: 'local-nlp',
      characters: [],
      terms: [],
      themes: [],
      notablePassages: [],
    };
  }
}

/**
 * 100% Local Multilingual TextRank Chapter Summarizer
 */
export function summarizeChapterLocally(chapterTitle: string, chapterText: string): string {
  const sentences = splitMultilingualSentences(chapterText).filter((s) => s.length > 20);
  if (sentences.length === 0) {
    return `**${chapterTitle}**\n${(chapterText || '').slice(0, 320)}`;
  }

  const freq = new Map<string, number>();
  const words = chapterText.toLowerCase().match(/[\p{L}\p{M}]{3,}/gu) || [];
  for (const w of words) {
    if (!STOP_WORDS.has(w)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  const scored = sentences.map((sentence, index) => {
    const sWords = sentence.toLowerCase().match(/[\p{L}\p{M}]{3,}/gu) || [];
    const wordScore =
      sWords.reduce((sum, w) => sum + (freq.get(w) || 0), 0) / Math.max(1, sWords.length);
    const positionBonus = index === 0 || index === sentences.length - 1 ? 1.25 : 1.0;
    return { sentence, index, score: wordScore * positionBonus };
  });

  const topSentences = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(4, sentences.length))
    .sort((a, b) => a.index - b.index);

  const topKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);

  return [
    `**Executive Synthesis (${chapterTitle})**`,
    `${topSentences.slice(0, 2).map((s) => s.sentence).join(' ')}`,
    '',
    '**Key Takeaways**',
    ...topSentences.map((s) => `• ${s.sentence}`),
    '',
    `**Key Concepts**: ${topKeywords.join(' · ') || 'Literary Prose'}`,
  ].join('\n');
}

/**
 * 100% Local Multilingual Concordance & Passage Q&A Engine
 */
export function answerBookQuestionLocally(
  question: string,
  chapterTitle: string,
  contextText: string
): string {
  const queryTerms =
    question
      .toLowerCase()
      .match(/[\p{L}\p{M}\d]{2,}/gu)
      ?.filter((w) => !STOP_WORDS.has(w)) || [];

  const sentences = splitMultilingualSentences(contextText);
  if (sentences.length === 0) {
    return 'No text passages available in the current section to analyze.';
  }

  const matches = sentences
    .map((sentence, idx) => {
      const lower = sentence.toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        if (lower.includes(term)) score += 3;
      }
      if (score === 0 && idx < 2) score = 0.5;
      return { sentence, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return [
    `**Local Concordance — ${chapterTitle}**`,
    `Passages matching *"${question}"*:`,
    '',
    ...matches.map((m, i) => `${i + 1}. "${m.sentence}"`),
  ].join('\n');
}

/**
 * Word Wise Lookup (Supports Hindi, Arabic, English, and Multilingual terms with CMap repair)
 */
export async function lookupWordWise(
  rawWord: string,
  contextSentence: string
): Promise<{
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  etymology: string;
  source: 'local-lexicon' | 'dictionary-api';
}> {
  return lookupMultilingualWord(rawWord, contextSentence);
}
