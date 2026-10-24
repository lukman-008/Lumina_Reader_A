/**
 * Lumina Reader — Compact Offline & Hybrid Multilingual Dictionary Engine
 * Covers Hindi (Devanagari), Arabic (RTL), English, European & Classical Literary Roots
 * with Unicode CMap repair, IAST/Buckwalter Phonetic Transliteration, Stemming, and Wiktionary/Lexical fallbacks.
 */

export interface LexicalEntry {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  etymology: string;
  source: 'local-lexicon' | 'dictionary-api';
}

// In-memory cache so repeated lookups are 0ms
const lookupCache = new Map<string, LexicalEntry>();

/**
 * Repairs broken PDF CMap replacement characters (\uFFFD / ) in Hindi/Devanagari, Arabic, and Latin text,
 * normalizes Unicode combining marks (NFC), and strips Private Use Area garbage glyphs.
 */
export function sanitizeAndRepairUnicodeText(raw: string): string {
  if (!raw) return '';

  let text = raw.normalize('NFC');

  // 1. Contextual Hindi / Devanagari PDF CMap Replacement Character (\uFFFD) Restoration
  // In many Hindi PDFs (e.g., KrutiDev/Walkman/broken ToUnicode maps), composite matras like ों, में, हैं, नहीं emit \uFFFD ()
  if (/[\u0900-\u097F]/.test(text) && text.includes('\uFFFD')) {
    text = text
      // Common standalone Hindi function words with broken nasalized matras
      .replace(/म\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'में')
      .replace(/ह\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'हैं')
      .replace(/नह\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'नहीं')
      .replace(/कह\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'कहीं')
      .replace(/वह\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'वहीं')
      .replace(/यह\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'यहीं')
      .replace(/किय\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'किये')
      .replace(/लिय\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, 'लिये')
      // Plural oblique noun before Hindi postpositions (का, की, के, को, में, से, पर, ने, तक, द्वारा, लिए, सा, सी, से):
      // e.g. "गुनाह का देवता" -> "गुनाहों का देवता", "आँख में" -> "आँखों में", "बात से" -> "बातों से"
      .replace(
        /([\u0915-\u0939\u0958-\u095F])\uFFFD+(?=\s+(?:का|की|के|को|में|से|पर|ने|तक|द्वारा|लिए|वाली|वाले|वाला)\b)/g,
        '$1ों'
      )
      // Feminine -ियाँ / -ियों plural oblique before postpositions
      .replace(/([\u0915-\u0939])िय\uFFFD+/g, '$1ियों')
      // Remaining Devanagari consonant + \uFFFD at word boundary defaults to oblique plural -ों
      .replace(/([\u0915-\u0939\u0958-\u095F])\uFFFD+(?=\s|$|[।,!?'"”’—-])/g, '$1ों');
  }

  // 2. Strip any remaining unmapped replacement characters (\uFFFD) and Private Use Area glyphs (\uE000-\uF8FF)
  text = text.replace(/[\uFFFD\uE000-\uF8FF\uFFFE\uFFFF]+/g, '');

  // 3. Re-attach any separated Unicode combining marks / Devanagari matras (\p{M}) to their preceding base consonant
  text = text.replace(/\s+([\p{M}\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]+)/gu, '$1');

  return text.normalize('NFC');
}

/**
 * Detects script family of a word
 */
export function detectWordScript(
  word: string
): 'devanagari' | 'arabic' | 'latin' | 'other' {
  if (/[\u0900-\u097F]/.test(word)) return 'devanagari';
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(word)) {
    return 'arabic';
  }
  if (/[A-Za-z\u00C0-\u024F]/.test(word)) return 'latin';
  return 'other';
}

/**
 * Converts Devanagari (Hindi/Sanskrit) word into accurate IAST phonetic pronunciation
 * e.g. "देवता" -> "/devatā/", "गुनाहों" -> "/gunāhoṁ/"
 */
export function transliterateDevanagariToIAST(word: string): string {
  const consonants: Record<string, string> = {
    क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ṅ',
    च: 'c', छ: 'ch', ज: 'j', झ: 'jh', ञ: 'ñ',
    ट: 'ṭ', ठ: 'ṭh', ड: 'ḍ', ढ: 'ḍh', ण: 'ṇ',
    त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
    प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
    य: 'y', र: 'r', ल: 'l', व: 'v',
    श: 'ś', ष: 'ṣ', स: 's', ह: 'h',
    क़: 'q', ख़: 'kh', ग़: 'ġ', ज़: 'z', ड़: 'ṛ', ढ़: 'ṛh', फ़: 'f',
  };
  const independentVowels: Record<string, string> = {
    अ: 'a', आ: 'ā', इ: 'i', ई: 'ī', उ: 'u', ऊ: 'ū',
    ऋ: 'ṛ', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
  };
  const matras: Record<string, string> = {
    'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū',
    'ृ': 'ṛ', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'ṁ', 'ँ': 'ँ', 'ः': 'ḥ',
  };

  let out = '';
  const chars = Array.from(word.normalize('NFC'));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if ( independentVowels[ch] ) {
      out += independentVowels[ch];
    } else if (consonants[ch]) {
      out += consonants[ch];
      // Check if followed by virama (्) or a vowel matra
      if (next === '्') {
        i++; // suppress inherent 'a'
      } else if (next && matras[next] && !['ं', 'ँ', 'ः'].includes(next)) {
        out += matras[next];
        i++;
      } else if (i < chars.length - 1) {
        // Inherent schwa 'a' in medial position
        out += 'a';
      }
    } else if (matras[ch]) {
      out += matras[ch];
    } else {
      out += ch;
    }
  }
  return `/${out || word}/`;
}

/**
 * Converts Arabic word into phonetic Latin pronunciation
 */
export function transliterateArabicToLatin(word: string): string {
  const map: Record<string, string> = {
    ا: 'ā', أ: 'a', إ: 'i', آ: 'ʾā', ب: 'b', ت: 't', ث: 'th', ج: 'j',
    ح: 'ḥ', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh',
    ص: 'ṣ', ض: 'ḍ', ط: 'ṭ', ظ: 'ẓ', ع: 'ʿ', غ: 'gh', ف: 'f', ق: 'q',
    ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ة: 'a', و: 'w/ū', ي: 'y/ī',
    ى: 'ā', ء: 'ʾ', ئ: 'ʾi', ؤ: 'ʾu',
  };
  let out = '';
  for (const ch of word) {
    if (map[ch]) out += map[ch];
  }
  return `/${out || word}/`;
}

/**
 * Compact, High-Frequency Multilingual Dictionary (Hindi, Arabic, English, Literary Classics)
 */
const MULTILINGUAL_LEXICON: Record<
  string,
  { phonetic?: string; partOfSpeech: string; definition: string; etymology: string }
> = {
  // ================= HINDI / SANSKRIT / URDU LITERARY VOCABULARY =================
  देवता: {
    phonetic: '/devatā/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition:
      '1. A deity, god, or celestial being worthy of reverence (देव).\n2. (Figurative / Literary) A person of extraordinary nobility, selflessness, moral purity, and compassion.',
    etymology:
      'Sanskrit देवता (devatā — divinity, deity), from देव (deva, "shining one, heavenly, divine", from PIE root *deywós) + abstract suffix -ता (-tā).',
  },
  देव: {
    phonetic: '/deva/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'A divine being, deity, lord, or luminous spirit; someone revered for noble qualities.',
    etymology: 'Sanskrit देव (deva), from root दिव् (div — to shine, be bright, celestial).',
  },
  गुनाह: {
    phonetic: '/gunāh/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition:
      'A sin, moral transgression, fault, offense, or forbidden act against conscience, love, or divine/social law (पाप, अपराध).',
    etymology:
      'Borrowed from Classical Persian گناه (gunāh, "sin, fault, transgression"), from Middle Persian wināh.',
  },
  गुनाहों: {
    phonetic: '/gunāhoṁ/',
    partOfSpeech: 'संज्ञा · बहुवचन तिर्यक (Noun · Plural Oblique)',
    definition:
      'Of sins, transgressions, or moral faults (plural oblique form of गुनाह — "sin, fault, offense"). Famous from Dharamvir Bharati’s classic novel "गुनाहों का देवता" (The Deity of Sins).',
    etymology:
      'Root गुनाह (Persian گناه gunāh, "sin, transgression") + Hindi plural oblique inflection -ओं (-oṁ).',
  },
  प्रेम: {
    phonetic: '/prem/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Deep affection, selfless love, spiritual devotion, and tender attachment between souls (स्नेह, अनुराग, प्यार).',
    etymology: 'Sanskrit प्रेमन् (preman — love, affection, kindness), from root प्री (prī — to please, delight, love).',
  },
  प्यार: {
    phonetic: '/pyār/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Love, fondness, romantic or familial affection, and warmth of heart.',
    etymology: 'From Prakrit पियार (piyāra), derived from Sanskrit प्रियकार (priyakāra — doing kindness, beloved).',
  },
  आत्मा: {
    phonetic: '/ātmā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine/Masculine)',
    definition: 'The soul, innermost self, conscious spirit, or immortal essence of a living being.',
    etymology: 'Sanskrit आत्मन् (ātman — breath, soul, self, essence).',
  },
  हृदय: {
    phonetic: '/hṛdaya/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'The heart, bosom, core of emotional sensibility, empathy, and inner feelings (दिल, अंतःकरण).',
    etymology: 'Sanskrit हृदय (hṛdaya — heart, mind, center).',
  },
  मन: {
    phonetic: '/man/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'The mind, heart, inner disposition, desire, consciousness, and seat of thoughts and emotions.',
    etymology: 'Sanskrit मनस् (manas — mind, intellect, spirit), from root मन् (man — to think, perceive).',
  },
  जीवन: {
    phonetic: '/jīvan/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Life, existence, vitality, the span of human experience, or mode of living (ज़िंदगी, प्राण).',
    etymology: 'Sanskrit जीवन (jīvana — life, enlivening, water), from root जीव् (jīv — to live, breathe).',
  },
  मृत्यु: {
    phonetic: '/mṛtyu/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Death, mortality, or the final cessation of physical existence (मौत, देहांत).',
    etymology: 'Sanskrit मृत्यु (mṛtyu), from root मृ (mṛ — to die), cognate with Latin mors.',
  },
  सत्य: {
    phonetic: '/satya/',
    partOfSpeech: 'संज्ञा / विशेषण (Noun & Adjective)',
    definition: 'Truth, reality, authenticity, moral integrity, and that which endures unchanged (सच, यथार्थ).',
    etymology: 'Sanskrit सत्य (satya — true, real, genuine), from सत् (sat — being, existing).',
  },
  धर्म: {
    phonetic: '/dharma/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Righteousness, moral duty, cosmic law, ethical conduct, nature, or spiritual path.',
    etymology: 'Sanskrit धर्म (dharma — that which upholds or sustains), from root धृ (dhṛ — to hold, support).',
  },
  कर्म: {
    phonetic: '/karma/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Action, deed, work, moral responsibility, and the causal law linking deeds to their consequences.',
    etymology: 'Sanskrit कर्मन् (karman — act, deed, work), from root कृ (kṛ — to do, make).',
  },
  पाप: {
    phonetic: '/pāp/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Sin, vice, moral wrong, or an unethical deed that harms others or violates conscience.',
    etymology: 'Sanskrit पाप (pāpa — evil, sin, wicked, misfortune).',
  },
  पुण्य: {
    phonetic: '/puṇya/',
    partOfSpeech: 'संज्ञा / विशेषण (Noun & Adjective)',
    definition: 'Virtue, moral merit, sacred or benevolent action that brings spiritual purity and good fortune.',
    etymology: 'Sanskrit पुण्य (puṇya — auspicious, virtuous, pure, sacred).',
  },
  संवेदना: {
    phonetic: '/saṁvedanā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Deep empathy, emotional sensitivity, compassion, perception, and shared human feeling.',
    etymology: 'Sanskrit संवेदना (saṁvedanā), from सम्- (together) + विद् (vid — to feel, know, experience).',
  },
  भावना: {
    phonetic: '/bhāvanā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Emotion, sentiment, inner feeling, devotion, or mental conception (एहसास, विचार).',
    etymology: 'Sanskrit भावना (bhāvanā — feeling, reflection, manifestation), from भू (bhū — to become, exist).',
  },
  वेदना: {
    phonetic: '/vedanā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Deep inner anguish, emotional pain, poignant sorrow, or acute sensation (पीड़ा, व्यथा).',
    etymology: 'Sanskrit वेदना (vedanā — perception, pain, agony), from root विद् (vid — to feel, experience).',
  },
  पीड़ा: {
    phonetic: '/pīṛā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Pain, suffering, distress, anguish of body or heart, or compassion for another’s hurt.',
    etymology: 'Sanskrit पीडा (pīḍā — pain, pressure, affliction, suffering).',
  },
  स्मृति: {
    phonetic: '/smṛti/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Memory, remembrance, recollection of the past, or traditional canon (याद, सुधि).',
    etymology: 'Sanskrit स्मृति (smṛti — remembrance), from root स्मृ (smṛ — to remember, recollect).',
  },
  कल्पना: {
    phonetic: '/kalpanā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Imagination, creative vision, mental imagery, or poetic fancy.',
    etymology: 'Sanskrit कल्पना (kalpanā — forming, fashioning in the mind), from कृप् (kḷp — to arrange, create).',
  },
  सौंदर्य: {
    phonetic: '/saundarya/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Beauty, aesthetic grace, elegance, and harmony of form or spirit (सुंदरता, लावण्य).',
    etymology: 'Sanskrit सौन्दर्य (saundarya), abstract noun from सुन्दर (sundara — beautiful, noble).',
  },
  करुणा: {
    phonetic: '/karuṇā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Compassion, tender mercy, and deep sympathetic sorrow for the suffering of others (दया, रहम).',
    etymology: 'Sanskrit करुणा (karuṇā — compassion, pity, tenderness).',
  },
  स्वतंत्रता: {
    phonetic: '/svatantratā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Freedom, independence, autonomy, and self-determination (आज़ादी, स्वाधीनता).',
    etymology: 'Sanskrit स्वतन्त्र (svatantra — self-reliant, free: स्व "self" + तन्त्र "system/loom") + -ता (-tā).',
  },
  अस्तित्व: {
    phonetic: '/astitva/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Existence, being, identity, presence, or ontological reality (वजूद, सत्ता).',
    etymology: 'Sanskrit अस्तित्व (astitva), from अस्ति (asti — "it is, exists") + abstract suffix -त्व (-tva).',
  },
  समाज: {
    phonetic: '/samāj/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Society, community, collective social order, or assembly of people.',
    etymology: 'Sanskrit समाज (samāja — assembly, society), from सम्- (together) + अज् (to drive, come together).',
  },
  साहित्य: {
    phonetic: '/sāhitya/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Literature, letters, poetic and prose compositions that unite word and meaning for human welfare.',
    etymology: 'Sanskrit साहित्य (sāhitya — harmony, association, literature), from सहित (sahita — united together).',
  },
  विश्वास: {
    phonetic: '/viśvās/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Trust, faith, confidence, conviction, and inner assurance (भरोसा, यक़ीन).',
    etymology: 'Sanskrit विश्वास (viśvāsa — trust, confidence), from वि- + श्वस् (śvas — to breathe freely).',
  },
  अधिकार: {
    phonetic: '/adhikār/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Right, entitlement, authority, moral claim, or jurisdiction (हक़, सत्ता).',
    etymology: 'Sanskrit अधिकार (adhikāra — authority, right, office), from अधि- + कृ (kṛ).',
  },
  कर्तव्य: {
    phonetic: '/kartavya/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Duty, moral obligation, responsibility, that which ought to be done (फ़र्ज़, दायित्व).',
    etymology: 'Sanskrit कर्तव्य (kartavya — to be done), future passive participle of कृ (kṛ — to do).',
  },
  प्रकृति: {
    phonetic: '/prakṛti/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Nature, the natural world, innate disposition, or primal creative energy (कुदरत, स्वभाव).',
    etymology: 'Sanskrit प्रकृति (prakṛti — original form, nature), from प्र- + कृ (kṛ — to make).',
  },
  संघर्ष: {
    phonetic: '/saṅgharṣ/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Struggle, conflict, perseverance against adversity, or clash of forces.',
    etymology: 'Sanskrit संघर्ष (saṅgharṣa — friction, rivalry, struggle), from सम्- + घृष् (ghṛṣ — to rub, contend).',
  },
  शांति: {
    phonetic: '/śānti/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Peace, tranquility, serenity of mind, and cessation of turmoil (सुकून, अमन).',
    etymology: 'Sanskrit शान्ति (śānti — peace, calmness), from root शम् (śam — to be calm, appease).',
  },
  आँसू: {
    phonetic: '/ā̃sū/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'Tears wept in sorrow, compassion, or overwhelming emotion (अश्रु, अश्क).',
    etymology: 'From Prakrit अंसु (aṁsu), derived from Sanskrit अश्रु (aśru — tear).',
  },
  सपना: {
    phonetic: '/sapnā/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'A dream, vision seen in sleep, or cherished aspiration for the future (स्वप्न, ख़्वाब).',
    etymology: 'From Prakrit सिविण (siviṇa), derived from Sanskrit स्वप्न (svapna — sleep, dream).',
  },
  दुनिया: {
    phonetic: '/duniyā/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'The world, earthly life, human society, and the universe of experience (संसार, जगत).',
    etymology: 'Borrowed from Arabic دُنْيَا (dunyā — the closer/present world).',
  },
  इंसान: {
    phonetic: '/insān/',
    partOfSpeech: 'संज्ञा (Noun · Masculine)',
    definition: 'A human being, person, mortal endowed with conscience and humanity (मनुष्य, मानव).',
    etymology: 'Borrowed from Arabic إِنْسَان (ʾinsān — human being, person).',
  },
  मोहब्बत: {
    phonetic: '/mohabbat/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Deep love, passionate devotion, and heartfelt affection (प्रेम, इश्क़).',
    etymology: 'From Persian محبت (muhabbat), from Arabic مَحَبَّة (maḥabba — love, affection), root ح-ب-ب.',
  },
  ख़ामोशी: {
    phonetic: '/khāmośī/',
    partOfSpeech: 'संज्ञा (Noun · Feminine)',
    definition: 'Silence, stillness, unspoken quietude, or reticence (मौन, नीरवता).',
    etymology: 'From Classical Persian خاموشی (khāmūshī — silence, stillness).',
  },
  मौन: {
    phonetic: '/maun/',
    partOfSpeech: 'संज्ञा / विशेषण (Noun & Adjective)',
    definition: 'Profound silence, contemplative stillness, or wordless expression of the heart.',
    etymology: 'Sanskrit मौन (mauna — state of a muni/sage, silence).',
  },

  // ================= ARABIC LITERARY & PHILOSOPHICAL VOCABULARY =================
  حكمة: {
    phonetic: '/ḥikma/',
    partOfSpeech: 'اسم (Noun · Feminine)',
    definition: 'Wisdom, sagacity, philosophy, sound judgment, and deep understanding of truth (Wisdom & Philosophy).',
    etymology: 'Arabic triliteral root ح-ك-م (ḥ-k-m — to judge wisely, restrain, master).',
  },
  معرفة: {
    phonetic: '/maʿrifa/',
    partOfSpeech: 'اسم (Noun · Feminine)',
    definition: 'Knowledge, cognition, gnosis, and experiential insight into reality.',
    etymology: 'Arabic triliteral root ع-ر-ف (ʿ-r-f — to know, recognize, perceive).',
  },
  حرية: {
    phonetic: '/ḥurriyya/',
    partOfSpeech: 'اسم (Noun · Feminine)',
    definition: 'Freedom, liberty, autonomy, and emancipation of thought and will.',
    etymology: 'Arabic root ح-ر-ر (ḥ-r-r — to be free, noble, emancipated).',
  },
  عدالة: {
    phonetic: '/ʿadāla/',
    partOfSpeech: 'اسم (Noun · Feminine)',
    definition: 'Justice, equity, fairness, and moral balance in human affairs.',
    etymology: 'Arabic root ع-د-ل (ʿ-d-l — to act justly, balance, straighten).',
  },
  وجود: {
    phonetic: '/wujūd/',
    partOfSpeech: 'اسم (Noun · Masculine)',
    definition: 'Existence, being, presence, and ontological reality.',
    etymology: 'Arabic root و-ج-د (w-j-d — to find, exist, experience deeply).',
  },
  روح: {
    phonetic: '/rūḥ/',
    partOfSpeech: 'اسم (Noun)',
    definition: 'Spirit, soul, breath of life, and innermost essence.',
    etymology: 'Arabic triliteral root ر-و-ح (r-w-ḥ — breath, wind, spirit).',
  },
  عقل: {
    phonetic: '/ʿaql/',
    partOfSpeech: 'اسم (Noun · Masculine)',
    definition: 'Intellect, reason, rational faculty, comprehension, and discernment.',
    etymology: 'Arabic root ع-ق-ل (ʿ-q-l — to bind, understand, reason).',
  },
  قلب: {
    phonetic: '/qalb/',
    partOfSpeech: 'اسم (Noun · Masculine)',
    definition: 'The heart, core, center of emotion, spiritual intuition, and transformation.',
    etymology: 'Arabic root ق-ل-ب (q-l-b — to turn, transform, heart).',
  },
  حياة: {
    phonetic: '/ḥayāh/',
    partOfSpeech: 'اسم (Noun · Feminine)',
    definition: 'Life, vitality, living existence, and animation.',
    etymology: 'Arabic root ح-ي-ي (ḥ-y-y — to live).',
  },
  سلام: {
    phonetic: '/salām/',
    partOfSpeech: 'اسم (Noun · Masculine)',
    definition: 'Peace, harmony, safety, wholeness, and salutation of goodwill.',
    etymology: 'Arabic triliteral root س-ل-م (s-l-m — to be safe, whole, at peace).',
  },
  حب: {
    phonetic: '/ḥubb/',
    partOfSpeech: 'اسم (Noun · Masculine)',
    definition: 'Love, deep affection, devotion, and attachment.',
    etymology: 'Arabic root ح-ب-ب (ḥ-b-b — to love, cherish, seed/core).',
  },
  كتاب: {
    phonetic: '/kitāb/',
    partOfSpeech: 'اسم (Noun · Masculine)',
    definition: 'Book, volume, written scripture, or epistle.',
    etymology: 'Arabic triliteral root ك-ت-ب (k-t-b — to write, gather).',
  },

  // ================= ENGLISH LITERARY & PHILOSOPHICAL VOCABULARY =================
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
 * Stems inflected Hindi / Devanagari words to their base dictionary lemma
 * e.g. "गुनाहों" -> "गुनाह", "देवताओं" -> "देवता", "भावनाओं" -> "भावना"
 */
function stemHindiWord(word: string): { stem: string; inflectionNote?: string } {
  if (MULTILINGUAL_LEXICON[word]) return { stem: word };

  const rules: { suffix: string; replace: string; note: string }[] = [
    { suffix: 'ओं', replace: '', note: 'Plural oblique inflection (-ओं) of ' },
    { suffix: 'ओं', replace: 'ा', note: 'Plural oblique inflection (-ओं) of ' },
    { suffix: 'यों', replace: 'ी', note: 'Plural oblique inflection (-यों) of ' },
    { suffix: 'ियाँ', replace: 'ी', note: 'Feminine plural (-ियाँ) of ' },
    { suffix: 'ें', replace: '', note: 'Plural / oblique inflection (-ें) of ' },
    { suffix: 'ें', replace: 'ा', note: 'Masculine plural/oblique (-ें) of ' },
    { suffix: 'ता', replace: '', note: 'Abstract noun suffix (-ता, "-ness / state of") from ' },
    { suffix: 'त्व', replace: '', note: 'Abstract essence suffix (-त्व, "-hood / essence of") from ' },
    { suffix: 'पन', replace: '', note: 'Quality/condition suffix (-पन) from ' },
    { suffix: 'शाली', replace: '', note: 'Possessive adjective (-शाली, "endowed with") from ' },
    { suffix: 'हीन', replace: '', note: 'Privative adjective (-हीन, "devoid of") from ' },
    { suffix: 'मय', replace: '', note: 'Adjectival suffix (-मय, "filled with / composed of") from ' },
  ];

  for (const r of rules) {
    if (word.endsWith(r.suffix) && word.length > r.suffix.length + 1) {
      const candidate = word.slice(0, word.length - r.suffix.length) + r.replace;
      if (MULTILINGUAL_LEXICON[candidate]) {
        return { stem: candidate, inflectionNote: `${r.note}"${candidate}"` };
      }
    }
  }

  return { stem: word };
}

/**
 * Stems Arabic definite articles and common prefixes/suffixes to find base entry or root
 */
function stemArabicWord(word: string): { stem: string; rootChars: string } {
  // Strip tashkeel (diacritics)
  let clean = word.replace(/[\u064B-\u065F\u0670]/g, '');
  if (MULTILINGUAL_LEXICON[clean]) {
    return { stem: clean, rootChars: clean };
  }
  // Strip prefixes: وال, فال, بال, كال, لل, ال
  const prefixes = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل'];
  for (const p of prefixes) {
    if (clean.startsWith(p) && clean.length - p.length >= 3) {
      const stripped = clean.slice(p.length);
      if (MULTILINGUAL_LEXICON[stripped]) {
        return { stem: stripped, rootChars: stripped };
      }
      clean = stripped;
      break;
    }
  }
  // Strip suffixes: ات, ون, ين, ه, ها, هم, كم, نا, ية
  const suffixes = ['ات', 'ون', 'ين', 'ها', 'هم', 'كم', 'نا', 'ية', 'ة', 'ه', 'ي'];
  for (const s of suffixes) {
    if (clean.endsWith(s) && clean.length - s.length >= 3) {
      const stripped = clean.slice(0, clean.length - s.length);
      if (MULTILINGUAL_LEXICON[stripped]) {
        return { stem: stripped, rootChars: stripped };
      }
    }
  }
  const consonantal = clean.replace(/[اويىة]/g, '');
  const rootTri = (consonantal.length >= 3 ? consonantal.slice(0, 3) : clean.slice(0, 3))
    .split('')
    .join('-');
  return { stem: clean, rootChars: rootTri };
}

/**
 * Offline morphological analyzer for Hindi/Sanskrit words not in the static dictionary
 */
function analyzeDevanagariMorphology(word: string, contextSentence: string): LexicalEntry {
  const phonetic = transliterateDevanagariToIAST(word);
  let pos = 'संज्ञा / विशेषण (Hindi / Sanskrit Term)';
  const notes: string[] = [];

  if (word.endsWith('ता')) {
    pos = 'भाववाचक संज्ञा (Abstract Noun · Feminine)';
    notes.push(`Formed with Sanskrit abstract suffix "-ता" (-tā, denoting quality or state) from base "${word.slice(0, -2)}".`);
  } else if (word.endsWith('त्व')) {
    pos = 'भाववाचक संज्ञा (Abstract Noun · Masculine)';
    notes.push(`Formed with Sanskrit suffix "-त्व" (-tva, denoting essence or nature) from base "${word.slice(0, -3)}".`);
  } else if (word.endsWith('ओं') || word.endsWith('यों')) {
    pos = 'संज्ञा · बहुवचन तिर्यक (Noun · Plural Oblique)';
    notes.push(`Plural oblique case inflection (-ओं/-यों) used before a Hindi postposition.`);
  } else if (word.endsWith('ना') || word.endsWith('नी') || word.endsWith('ने')) {
    pos = 'क्रिया / क्रियार्थक संज्ञा (Verb / Verbal Noun)';
    notes.push(`Infinitive or participial verbal form (-ना/-ने).`);
  } else if (word.endsWith('िक') || word.endsWith('ीय') || word.endsWith('ित')) {
    pos = 'विशेषण (Adjective)';
    notes.push(`Adjectival derivative formed with suffix "${word.slice(-2)}".`);
  }

  return {
    word,
    phonetic,
    partOfSpeech: pos,
    definition:
      notes.length > 0
        ? `${notes.join(' ')}\n• Passage context: "${contextSentence.slice(0, 140)}"`
        : `Literary Hindi/Devanagari term (${phonetic}) used in context: "${contextSentence.slice(0, 140)}"`,
    etymology: `Indo-Aryan / Sanskrit-Hindustani lexical stem (${word} · ${phonetic}).`,
    source: 'local-lexicon',
  };
}

/**
 * Universal Multilingual Word Wise Lookup
 * 1. Cleans & repairs any broken PDF CMap characters (\uFFFD) in both word and contextSentence
 * 2. Checks Offline Multilingual Lexicon + Morphological Stemmers (0ms offline)
 * 3. Queries Wiktionary REST API / Native Wiktionary / Free Dictionary API / MyMemory Bilingual Gloss when online
 */
export async function lookupMultilingualWord(
  rawWord: string,
  rawContextSentence: string
): Promise<LexicalEntry> {
  const repairedWord = sanitizeAndRepairUnicodeText(rawWord)
    .trim()
    .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
  const repairedContext = sanitizeAndRepairUnicodeText(rawContextSentence).trim();

  if (!repairedWord) {
    return {
      word: rawWord || 'Term',
      phonetic: '/—/',
      partOfSpeech: 'term',
      definition: 'Select a valid word to view its definition, pronunciation, and etymology.',
      etymology: 'Lexical Engine',
      source: 'local-lexicon',
    };
  }

  const normalizedKey = repairedWord.toLowerCase();
  if (lookupCache.has(normalizedKey)) {
    return lookupCache.get(normalizedKey)!;
  }

  const script = detectWordScript(repairedWord);

  // 1. Direct or Stemmed Offline Multilingual Dictionary Hit
  if (MULTILINGUAL_LEXICON[normalizedKey] || MULTILINGUAL_LEXICON[repairedWord]) {
    const hit = MULTILINGUAL_LEXICON[normalizedKey] || MULTILINGUAL_LEXICON[repairedWord];
    const result: LexicalEntry = {
      word: repairedWord,
      phonetic:
        hit.phonetic ||
        (script === 'devanagari'
          ? transliterateDevanagariToIAST(repairedWord)
          : script === 'arabic'
          ? transliterateArabicToLatin(repairedWord)
          : `/${repairedWord}/`),
      partOfSpeech: hit.partOfSpeech,
      definition: hit.definition,
      etymology: hit.etymology,
      source: 'local-lexicon',
    };
    lookupCache.set(normalizedKey, result);
    return result;
  }

  if (script === 'devanagari') {
    const { stem, inflectionNote } = stemHindiWord(repairedWord);
    if (MULTILINGUAL_LEXICON[stem]) {
      const hit = MULTILINGUAL_LEXICON[stem];
      const result: LexicalEntry = {
        word: repairedWord,
        phonetic: transliterateDevanagariToIAST(repairedWord),
        partOfSpeech: hit.partOfSpeech,
        definition: `${inflectionNote ? `[${inflectionNote}] ` : ''}${hit.definition}`,
        etymology: hit.etymology,
        source: 'local-lexicon',
      };
      lookupCache.set(normalizedKey, result);
      return result;
    }
  }

  if (script === 'arabic') {
    const { stem, rootChars } = stemArabicWord(repairedWord);
    if (MULTILINGUAL_LEXICON[stem]) {
      const hit = MULTILINGUAL_LEXICON[stem];
      const result: LexicalEntry = {
        word: repairedWord,
        phonetic: transliterateArabicToLatin(repairedWord),
        partOfSpeech: hit.partOfSpeech,
        definition: hit.definition,
        etymology: `${hit.etymology} (Inflected from ${stem})`,
        source: 'local-lexicon',
      };
      lookupCache.set(normalizedKey, result);
      return result;
    }
    // Keep rootChars for fallback
    void rootChars;
  }

  // 2. Online Zero-Key Multilingual Dictionary Lookup (Wiktionary REST API + DictionaryAPI + Bilingual Gloss)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    // 2A. Try Wiktionary REST API (Supports 1,000+ languages including Hindi, Arabic, English, French, Spanish, German, Sanskrit)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2200);
      const wikRes = await fetch(
        `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(repairedWord)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (wikRes.ok) {
        const wikData = await wikRes.json();
        // Prefer Hindi ('hi') or Sanskrit ('sa') for Devanagari, Arabic ('ar') for Arabic, English ('en') or first available language
        const langSections: any[] =
          wikData.hi ||
          wikData.sa ||
          wikData.ur ||
          wikData.ar ||
          wikData.en ||
          Object.values(wikData)[0];

        if (Array.isArray(langSections) && langSections.length > 0) {
          const firstSection = langSections[0];
          const rawDefs = (firstSection.definitions || [])
            .map((d: any) =>
              (d.definition || '')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim()
            )
            .filter((d: string) => d.length > 2)
            .slice(0, 2);

          if (rawDefs.length > 0) {
            const phonetic =
              script === 'devanagari'
                ? transliterateDevanagariToIAST(repairedWord)
                : script === 'arabic'
                ? transliterateArabicToLatin(repairedWord)
                : `/${repairedWord}/`;

            const result: LexicalEntry = {
              word: repairedWord,
              phonetic,
              partOfSpeech: `${firstSection.partOfSpeech || 'Term'} (${firstSection.language || 'Multilingual'})`,
              definition: rawDefs.join('\n• '),
              etymology: `Lexical entry (${firstSection.language || 'Wiktionary'}) · Context: "${repairedContext.slice(0, 110)}"`,
              source: 'dictionary-api',
            };
            lookupCache.set(normalizedKey, result);
            return result;
          }
        }
      }
    } catch {
      // Continue to next lexical source
    }

    // 2B. For English / Latin script words, try Free Dictionary API
    if (script === 'latin') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalizedKey)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          const first = data?.[0];
          const meaning = first?.meanings?.[0];
          const def = meaning?.definitions?.[0]?.definition;
          if (def) {
            const result: LexicalEntry = {
              word: first.word || repairedWord,
              phonetic: first.phonetic || first.phonetics?.[0]?.text || `/${normalizedKey}/`,
              partOfSpeech: meaning.partOfSpeech || 'noun',
              definition: def,
              etymology:
                first.origin || `Contextual usage in "${repairedContext.slice(0, 110)}"`,
              source: 'dictionary-api',
            };
            lookupCache.set(normalizedKey, result);
            return result;
          }
        }
      } catch {
        // Continue
      }
    }

    // 2C. For Hindi / Arabic / Non-English words not found in Wiktionary EN, query bilingual gloss + native morphology
    if (script === 'devanagari' || script === 'arabic') {
      try {
        const srcLang = script === 'devanagari' ? 'hi' : 'ar';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const glossRes = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(repairedWord)}&langpair=${srcLang}|en`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (glossRes.ok) {
          const glossData = await glossRes.json();
          const translated = (glossData?.responseData?.translatedText || '').trim();
          if (translated && translated.toLowerCase() !== repairedWord.toLowerCase()) {
            const phonetic =
              script === 'devanagari'
                ? transliterateDevanagariToIAST(repairedWord)
                : transliterateArabicToLatin(repairedWord);
            const morph =
              script === 'devanagari'
                ? analyzeDevanagariMorphology(repairedWord, repairedContext)
                : null;
            const result: LexicalEntry = {
              word: repairedWord,
              phonetic,
              partOfSpeech: morph?.partOfSpeech || (script === 'arabic' ? 'اسم / مصطلح (Arabic Term)' : 'शब्द (Hindi Term)'),
              definition: `Meaning: ${translated}\n${morph ? morph.definition : `Used in passage: "${repairedContext.slice(0, 120)}"`}`,
              etymology:
                script === 'devanagari'
                  ? `Hindi / Sanskrit lexical entry (${repairedWord} · ${phonetic})`
                  : `Arabic triliteral root (${stemArabicWord(repairedWord).rootChars})`,
              source: 'dictionary-api',
            };
            lookupCache.set(normalizedKey, result);
            return result;
          }
        }
      } catch {
        // Fall through to pure offline morphological analyzer
      }
    }
  }

  // 3. 100% Offline Morphological & Contextual Fallback
  if (script === 'devanagari') {
    const res = analyzeDevanagariMorphology(repairedWord, repairedContext);
    lookupCache.set(normalizedKey, res);
    return res;
  }

  if (script === 'arabic') {
    const { stem, rootChars } = stemArabicWord(repairedWord);
    const phonetic = transliterateArabicToLatin(repairedWord);
    const res: LexicalEntry = {
      word: repairedWord,
      phonetic,
      partOfSpeech: 'مفردة عربية (Arabic Lexical Term)',
      definition: `Arabic stem "${stem}" (Root: ${rootChars}).\n• Passage context: "${repairedContext.slice(0, 140)}"`,
      etymology: `Arabic triliteral root analysis: جذر (${rootChars}) · Stem: ${stem}`,
      source: 'local-lexicon',
    };
    lookupCache.set(normalizedKey, res);
    return res;
  }

  return {
    word: repairedWord,
    phonetic: `/${normalizedKey}/`,
    partOfSpeech: 'literary term',
    definition: `Contextual usage in passage: "${repairedContext.slice(0, 150)}"`,
    etymology: 'Local morphological & contextual concordance analysis.',
    source: 'local-lexicon',
  };
}

/**
 * Synchronous 0ms lookup for Live Word Wise Interlinear Hints in the Reader.
 * Returns a concise 2-5 word gloss if the word (or its stem) exists in the curated lexicon.
 */
export function getQuickWordWiseHint(rawWord: string): string | null {
  const cleaned = sanitizeAndRepairUnicodeText(rawWord || '')
    .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '')
    .trim();
  if (cleaned.length < 3) return null;
  const lower = cleaned.toLowerCase();
  const direct = MULTILINGUAL_LEXICON[lower] || MULTILINGUAL_LEXICON[cleaned] || lookupCache.get(lower);
  if (direct) {
    return direct.definition.split(/[.;\n(]/)[0].slice(0, 44).trim();
  }
  const script = detectWordScript(cleaned);
  if (script === 'devanagari') {
    const { stem } = stemHindiWord(cleaned);
    if (MULTILINGUAL_LEXICON[stem]) {
      return MULTILINGUAL_LEXICON[stem].definition.split(/[.;\n(]/)[0].slice(0, 44).trim();
    }
  } else if (script === 'arabic') {
    const { stem } = stemArabicWord(cleaned);
    if (MULTILINGUAL_LEXICON[stem]) {
      return MULTILINGUAL_LEXICON[stem].definition.split(/[.;\n(]/)[0].slice(0, 44).trim();
    }
  }
  return null;
}

