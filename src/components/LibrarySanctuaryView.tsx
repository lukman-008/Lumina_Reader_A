import React, { useMemo, useState } from 'react';
import {
  Search,
  BookOpen,
  Star,
  Trash2,
  FolderPlus,
  LayoutGrid,
  List,
  ArrowUpRight,
  Upload,
  Globe,
  Edit3,
  Check,
  X,
  Download,
} from 'lucide-react';
import { useLuminaStore } from '../store/useLuminaStore';
import { READING_THEMES } from '../utils/themeTokens';
import { buildLocalXRayIndex } from '../services/localIntelligenceEngine';
import type { BookFormat, BookMeta, BookChapter, BookContentRecord } from '../types';

interface PublicDomainClassic {
  title: string;
  author: string;
  language: string;
  category: string;
  description: string;
  coverGradient: string;
  chapters: { title: string; paragraphs: string[] }[];
}

const PUBLIC_DOMAIN_CATALOG: PublicDomainClassic[] = [
  {
    title: 'Letters from a Stoic (Epistulae Morales)',
    author: 'Lucius Annaeus Seneca',
    language: 'English',
    category: 'Stoic Philosophy',
    description:
      'Timeless epistles to Lucilius on time, mortality, tranquility of mind, and the disciplined art of living.',
    coverGradient: 'from-amber-900 via-stone-900 to-stone-950',
    chapters: [
      {
        title: 'Letter I — On Saving Time',
        paragraphs: [
          'Continue to act thus, my dear Lucilius — set yourself free for your own sake; gather and save your time, which till lately has been forced from you, or filched away, or has merely slipped from your hands. [1]',
          'Make yourself believe the truth of my words, that certain moments are torn from us, that some are gently removed, and that others glide beyond our reach. The most disgraceful loss, however, is that which occurs through carelessness.',
          'Hold every hour in your grasp. Lay hold of to-day’s task, and you will not need to depend so much upon to-morrow’s. While we are postponing, life speeds by. Nothing, Lucilius, is ours, except time.',
        ],
      },
      {
        title: 'Letter II — On Discursiveness in Reading',
        paragraphs: [
          'Judging by what you write me, and by what I hear, I am forming a good opinion regarding your future. You do not run hither and thither and distract yourself by changing your abode; for such restlessness is the sign of a disordered spirit.',
          'Be careful, however, lest this reading of many authors and books of every sort may tend to make you discursive and unsteady. You must linger among a limited number of master-thinkers, and digest their works, if you would derive ideas which shall win firm hold in your mind.',
        ],
      },
    ],
  },
  {
    title: 'المقدمة — Muqaddimah (Prolegomena to History)',
    author: 'ابن خلدون (Ibn Khaldun)',
    language: 'العربية (Arabic)',
    category: 'تاريخ وفلسفة العمران',
    description:
      'تأسيس علم العمران البشري والاجتماع الإنساني، وتحليل قيام الدول والحضارات وأثر العصبية والعلوم.',
    coverGradient: 'from-emerald-900 via-teal-950 to-stone-950',
    chapters: [
      {
        title: 'الفصل الأول — في فضل علم التاريخ وتحقيق مذاهبه',
        paragraphs: [
          'اعلم أن فن التاريخ فن عزيز المذهب شريف الغاية، إذ هو يوقفنا على أحوال الماضين من الأمم في أخلاقهم، والأنبياء في سيرهم، والملوك في دولهم وسياساتهم.',
          'فهو محتاج إلى مآخذ متعددة ومعارف متنوعة وحسن نظر وتثبت يفضيان بصاحبهما إلى الحق وينكبان به عن المزلات والمغالط، لأن الأخبار إذا اعتمد فيها على مجرد النقل ولم تحكم أصول العادة وقواعد السياسة وطبيعة العمران لم يؤمن فيها من العثور.',
        ],
      },
      {
        title: 'الفصل الثاني — في طبيعة العمران البشري والعصبية',
        paragraphs: [
          'إن الاجتماع الإنساني ضروري، ويعبر الحكماء عن هذا بقولهم إن الإنسان مدني بالطبع، أي لا بد له من الاجتماع الذي هو المدينة في اصطلاحهم وهو معنى العمران.',
          'والعلوم إنما تكثر حيث يكثر العمران وتعظم الحضارة، فتزدهر الصنائع وتدون الكتب وتنتقل الحكمة بين الأجيال.',
        ],
      },
    ],
  },
  {
    title: 'गीतांजलि एवं साहित्य चिंतन (Gitanjali & Poetic Reflections)',
    author: 'रवीन्द्रनाथ ठाकुर (Rabindranath Tagore)',
    language: 'हिन्दी / संस्कृत (Hindi)',
    category: 'काव्य एवं दर्शन',
    description:
      'भारतीय साहित्य, प्रकृति, स्वतंत्रता और मानवीय चेतना के अमर काव्यात्मक सूत्र।',
    coverGradient: 'from-rose-900 via-stone-900 to-stone-950',
    chapters: [
      {
        title: 'अध्याय १ — जहाँ मन भय से मुक्त हो',
        paragraphs: [
          'जहाँ मन भय से मुक्त हो और मस्तक सम्मान से उठा हो, जहाँ ज्ञान स्वतंत्र हो, और जहाँ संसार को संकीर्ण दीवारों में न बाँटा गया हो।',
          'जहाँ शब्द सत्य की गहराई से निकलते हों, और जहाँ अनथक प्रयास अपनी भुजाएँ पूर्णता की ओर फैलाता हो; हे पिता, उस स्वतंत्रता के स्वर्ग में मेरे देश को जागृत कर।',
        ],
      },
      {
        title: 'अध्याय २ — अनंत यात्रा और संगीत',
        paragraphs: [
          'तुमने मुझे अनंत बनाया है, यही तुम्हारी लीला है। इस मिट्टी के छोटे से पात्र को तुमने बार-बार खाली किया है और सदा नए जीवन से भर दिया है।',
          'साहित्य और दर्शन मनुष्य के अंतरतम के देवता को जगाने का माध्यम हैं, जहाँ करुणा, प्रेम और विवेक का संगम होता है।',
        ],
      },
    ],
  },
  {
    title: 'The Art of War (Critical Bilingual Treatise)',
    author: 'Sun Tzu (Translated by Lionel Giles)',
    language: 'English',
    category: 'Strategy & Classics',
    description:
      'The foundational classic on strategic preparation, terrain, discipline, and achieving victory without conflict.',
    coverGradient: 'from-sky-900 via-slate-900 to-stone-950',
    chapters: [
      {
        title: 'I. Laying Plans',
        paragraphs: [
          'Sun Tzu said: The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected. [1]',
          'The art of war, then, is governed by five constant factors, to be taken into account in one’s deliberations, when seeking to determine the conditions obtaining in the field. These are: The Moral Law; Heaven; Earth; The Commander; Method and discipline.',
        ],
      },
      {
        title: 'III. Attack by Stratagem',
        paragraphs: [
          'Supreme excellence consists in breaking the enemy’s resistance without fighting. Thus the highest form of generalship is to balk the enemy’s plans; the next best is to prevent the junction of the enemy’s forces.',
          'If you know the enemy and know yourself, you need not fear the result of a hundred battles.',
        ],
      },
    ],
  },
];

const COVER_GRADIENT_PRESETS = [
  { label: 'Obsidian Monograph', value: 'from-stone-800 via-stone-900 to-stone-950' },
  { label: 'Florentine Amber', value: 'from-amber-900 via-stone-900 to-stone-950' },
  { label: 'Andalusian Emerald', value: 'from-emerald-900 via-teal-950 to-stone-950' },
  { label: 'Burgundy Archive', value: 'from-rose-900 via-stone-900 to-stone-950' },
  { label: 'Oxford Navy', value: 'from-sky-900 via-slate-900 to-stone-950' },
  { label: 'Byzantine Violet', value: 'from-violet-900 via-stone-900 to-stone-950' },
];

export const LibrarySanctuaryView: React.FC = () => {
  const booksMeta = useLuminaStore((s) => s.booksMeta);
  const shelves = useLuminaStore((s) => s.shelves);
  const theme = useLuminaStore((s) => s.settings.theme);
  const openBook = useLuminaStore((s) => s.openBook);
  const toggleFavoriteBook = useLuminaStore((s) => s.toggleFavoriteBook);
  const assignBookToShelf = useLuminaStore((s) => s.assignBookToShelf);
  const deleteBook = useLuminaStore((s) => s.deleteBook);
  const createShelf = useLuminaStore((s) => s.createShelf);
  const deleteShelf = useLuminaStore((s) => s.deleteShelf);
  const setImporterOpen = useLuminaStore((s) => s.setImporterOpen);
  const updateBookMeta = useLuminaStore((s) => s.updateBookMeta);
  const installPublicDomainBook = useLuminaStore((s) => s.installPublicDomainBook);

  const palette = READING_THEMES[theme] || READING_THEMES.paper;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<BookFormat | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [newShelfName, setNewShelfName] = useState('');
  const [isCreatingShelf, setIsCreatingShelf] = useState(false);

  // Public Domain OPDS Catalog Modal State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [installingTitle, setInstallingTitle] = useState<string | null>(null);

  // Metadata & Cover Art Editor Modal State
  const [editingBook, setEditingBook] = useState<BookMeta | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGradient, setEditGradient] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');

  // Most recently read book for the Continue Reading Hero Spotlight
  const spotlightBook = useMemo(() => {
    if (!Array.isArray(booksMeta) || booksMeta.length === 0) return null;
    return [...booksMeta].sort(
      (a, b) => (b.locator?.lastReadTimestamp || 0) - (a.locator?.lastReadTimestamp || 0)
    )[0];
  }, [booksMeta]);

  const filteredBooks = useMemo(() => {
    if (!Array.isArray(booksMeta)) return [];
    return booksMeta.filter((book) => {
      if (!book) return false;
      if (selectedShelfId === 'favorites' && !book.isFavorite) return false;
      if (
        selectedShelfId !== 'all' &&
        selectedShelfId !== 'favorites' &&
        book.shelfId !== selectedShelfId
      ) {
        return false;
      }
      if (selectedFormat !== 'all' && book.format !== selectedFormat) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (book.title || '').toLowerCase().includes(q) ||
          (book.author || '').toLowerCase().includes(q) ||
          (book.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [booksMeta, selectedShelfId, selectedFormat, searchQuery]);

  const handleAddShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName.trim()) return;
    await createShelf(newShelfName);
    setNewShelfName('');
    setIsCreatingShelf(false);
  };

  const openEditBookModal = (book: BookMeta) => {
    setEditingBook(book);
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditCategory(book.category || 'Literature');
    setEditDescription(book.description || '');
    setEditGradient(book.coverGradient || 'from-stone-800 via-stone-900 to-stone-950');
    setEditCoverUrl(book.coverImage || '');
  };

  const spotlightLocNum = spotlightBook?.locator?.locationNumber ?? 1;
  const spotlightTotalLocs = Math.max(1, spotlightBook?.totalLocations || 1);
  const spotlightPct = Math.min(100, Math.max(0, spotlightBook?.locator?.percentage ?? 0));
  const spotlightChIdx = spotlightBook?.locator?.chapterIndex ?? 0;

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
      {/* 1. Continue Reading Editorial Hero Spotlight */}
      {spotlightBook && (
        <section
          aria-label="Continue Reading Spotlight"
          className={`rounded-2xl border p-5 sm:p-6 lg:p-8 transition-colors ${palette.surfaceBg} ${palette.borderHairline}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Book Spine / Monograph Cover */}
            <div className="lg:col-span-3 flex">
              <div
                onClick={() => openBook(spotlightBook.id)}
                style={
                  spotlightBook.coverImage
                    ? {
                        backgroundImage: `linear-gradient(to bottom, rgba(12,10,9,0.55), rgba(12,10,9,0.88)), url(${spotlightBook.coverImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
                className={`w-full min-h-[200px] sm:min-h-[220px] rounded-xl bg-gradient-to-br ${
                  spotlightBook.coverGradient || 'from-stone-800 via-stone-900 to-stone-950'
                } p-5 sm:p-6 flex flex-col justify-between text-stone-100 shadow-md cursor-pointer relative overflow-hidden group`}
              >
                <div className="absolute inset-y-0 left-0 w-3 bg-black/25" />
                <div className="pl-2 text-[11px] tracking-widest uppercase text-stone-300/90 font-sans">
                  {(spotlightBook.format || 'epub').toUpperCase()} EDITION
                </div>
                <div className="pl-2 space-y-1.5 my-4" dir="auto">
                  <h3 className="font-display text-lg sm:text-xl font-semibold leading-snug text-white group-hover:underline line-clamp-3">
                    {spotlightBook.title}
                  </h3>
                  <p className="text-xs text-stone-300 truncate">{spotlightBook.author}</p>
                </div>
                <div className="pl-2 flex items-center justify-between text-[11px] text-stone-300/80 tabular-nums border-t border-white/15 pt-3">
                  <span>
                    Loc {spotlightLocNum} of {spotlightTotalLocs}
                  </span>
                  <span>{spotlightPct}%</span>
                </div>
              </div>
            </div>

            {/* Editorial Reading Telemetry & Resume Controls */}
            <div className="lg:col-span-9 flex flex-col justify-between space-y-5 sm:space-y-6">
              <div className="space-y-2.5 sm:space-y-3">
                <div className={`flex flex-wrap items-center gap-2 text-xs ${palette.textMuted}`}>
                  <span className="uppercase tracking-widest font-semibold">
                    Current Reading Sanctuary
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{spotlightBook.category || 'General Literature'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {Math.max(1, spotlightBook.chapterCount || 1)}{' '}
                    {(spotlightBook.chapterCount || 1) === 1 ? 'Section' : 'Chapters'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    ~{Math.max(1, Math.round((spotlightBook.totalWords || 250) / 230))} min total read
                  </span>
                </div>

                <h1
                  dir="auto"
                  className={`font-display text-xl sm:text-2xl lg:text-4xl font-semibold tracking-tight ${palette.textPrimary}`}
                  style={{ textWrap: 'balance' }}
                >
                  {spotlightBook.title}
                </h1>

                <p dir="auto" className={`text-sm font-medium ${palette.textSecondary}`}>
                  By {spotlightBook.author}
                </p>

                <p
                  dir="auto"
                  className={`text-xs sm:text-sm leading-relaxed max-w-2xl line-clamp-3 ${palette.textMuted}`}
                >
                  {spotlightBook.description}
                </p>
              </div>

              <div className="space-y-4 pt-2 border-t border-current/10">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-xs tabular-nums">
                  <div
                    className={`flex flex-wrap items-center gap-2 sm:gap-3 ${palette.textSecondary}`}
                  >
                    <span>
                      Location <strong>{spotlightLocNum}</strong> of{' '}
                      <strong>{spotlightTotalLocs}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Chapter {spotlightChIdx + 1} of{' '}
                      {Math.max(1, spotlightBook.chapterCount || 1)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{spotlightPct}% completed</span>
                  </div>
                  <span className={`hidden sm:inline ${palette.textMuted}`}>
                    Instant Local X-Ray & Word Wise Ready
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-stone-300/50 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${palette.accentBg}`}
                    style={{ width: `${Math.max(3, spotlightPct)}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => openBook(spotlightBook.id)}
                    className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0 ${palette.accentBg}`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Resume at Location {spotlightLocNum}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImporterOpen(true)}
                    className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${palette.borderHairline} ${palette.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import EPUB / PDF / Markdown</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCatalogOpen(true)}
                    className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${palette.borderHairline} ${palette.textPrimary} hover:bg-black/5 dark:hover:bg-white/5`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public Domain Classics</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Curated Collections, Format Filter & Live Search Toolbar */}
      <section className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-current/10">
          {/* Interactive Shelf Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedShelfId('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedShelfId === 'all'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary} hover:opacity-80`
              }`}
            >
              All Volumes ({booksMeta.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedShelfId('favorites')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedShelfId === 'favorites'
                  ? `${palette.accentBg} text-white`
                  : `${palette.surfaceBg} ${palette.textSecondary} hover:opacity-80`
              }`}
            >
              Starred ({booksMeta.filter((b) => b?.isFavorite).length})
            </button>

            {shelves.map((shelf) => (
              <div key={shelf.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedShelfId(shelf.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedShelfId === shelf.id
                      ? `${palette.accentBg} text-white`
                      : `${palette.surfaceBg} ${palette.textSecondary} hover:opacity-80`
                  }`}
                >
                  {shelf.name}
                </button>
                {selectedShelfId === shelf.id && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteShelf(shelf.id);
                      setSelectedShelfId('all');
                    }}
                    title="Delete Shelf"
                    className="ml-1 p-1 text-rose-500 hover:opacity-80 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {isCreatingShelf ? (
              <form onSubmit={handleAddShelf} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  value={newShelfName}
                  onChange={(e) => setNewShelfName(e.target.value)}
                  placeholder="Shelf name..."
                  autoFocus
                  className={`px-2.5 py-1 text-xs rounded-lg border outline-none ${palette.elevatedBg} ${palette.borderHairline} ${palette.textPrimary}`}
                />
                <button
                  type="submit"
                  className={`px-2.5 py-1 text-xs font-medium text-white rounded-lg cursor-pointer ${palette.accentBg}`}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingShelf(false)}
                  className={`px-2 py-1 text-xs cursor-pointer ${palette.textMuted}`}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingShelf(true)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${palette.borderHairline} ${palette.textMuted} hover:${palette.textPrimary}`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Shelf</span>
              </button>
            )}
          </div>

          {/* Right Controls: Format Filter, Search, and View Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div
              className={`inline-flex items-center p-0.5 rounded-lg border overflow-x-auto max-w-full ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              {(['all', 'epub', 'pdf', 'md', 'txt'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedFormat === fmt
                      ? `${palette.elevatedBg} ${palette.textPrimary} shadow-2xs`
                      : `${palette.textMuted} hover:${palette.textPrimary}`
                  }`}
                >
                  {fmt === 'all' ? 'All' : fmt.toUpperCase()}
                </button>
              ))}
            </div>

            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border flex-1 sm:flex-initial sm:w-60 ${palette.elevatedBg} ${palette.borderHairline}`}
            >
              <Search className={`w-3.5 h-3.5 shrink-0 ${palette.textMuted}`} />
              <input
                type="text"
                dir="auto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, author..."
                className={`w-full text-xs bg-transparent outline-none ${palette.textPrimary}`}
              />
            </div>

            <div
              className={`inline-flex items-center p-0.5 rounded-lg border ${palette.surfaceBg} ${palette.borderHairline}`}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Catalog Grid View"
                className={`p-1.5 rounded-md cursor-pointer ${
                  viewMode === 'grid'
                    ? `${palette.elevatedBg} ${palette.textPrimary}`
                    : palette.textMuted
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="High-Density Table View"
                className={`p-1.5 rounded-md cursor-pointer ${
                  viewMode === 'table'
                    ? `${palette.elevatedBg} ${palette.textPrimary}`
                    : palette.textMuted
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Catalog Grid or High-Density Table */}
        {filteredBooks.length === 0 ? (
          <div
            className={`rounded-2xl border p-8 sm:p-12 text-center space-y-4 ${palette.surfaceBg} ${palette.borderHairline}`}
          >
            <BookOpen className={`w-8 h-8 mx-auto ${palette.textMuted}`} />
            <div className="space-y-1">
              <h3 className={`font-display text-lg font-semibold ${palette.textPrimary}`}>
                No matching volumes in this view
              </h3>
              <p className={`text-xs max-w-md mx-auto ${palette.textMuted}`}>
                Import an EPUB, PDF, Markdown, or plain-text book, or install a classic from the Public Domain catalog.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setImporterOpen(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Book Files</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border cursor-pointer ${palette.borderHairline}`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Browse Public Domain Classics</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {filteredBooks.map((book) => {
              const locNum = book.locator?.locationNumber ?? 1;
              const totalLocs = Math.max(1, book.totalLocations || 1);
              const pct = Math.min(100, Math.max(0, book.locator?.percentage ?? 0));
              return (
                <article
                  key={book.id}
                  className={`group rounded-xl border p-5 flex flex-col justify-between transition-colors ${palette.elevatedBg} ${palette.borderHairline}`}
                >
                  <div className="space-y-4">
                    {/* Book Cover Spine */}
                    <div
                      onClick={() => openBook(book.id)}
                      style={
                        book.coverImage
                          ? {
                              backgroundImage: `linear-gradient(to bottom, rgba(12,10,9,0.5), rgba(12,10,9,0.86)), url(${book.coverImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : undefined
                      }
                      className={`h-44 rounded-lg bg-gradient-to-br ${
                        book.coverGradient || 'from-stone-800 via-stone-900 to-stone-950'
                      } p-4 flex flex-col justify-between text-stone-100 cursor-pointer relative overflow-hidden shadow-xs`}
                    >
                      <div className="absolute inset-y-0 left-0 w-2.5 bg-black/25" />
                      <div className="pl-2 flex items-center justify-between text-[11px] text-stone-300">
                        <span className="uppercase tracking-wider">{book.format || 'epub'}</span>
                        <span className="tabular-nums">
                          Loc {locNum}/{totalLocs}
                        </span>
                      </div>
                      <div className="pl-2 space-y-1" dir="auto">
                        <h3 className="font-display text-base font-semibold leading-snug text-white line-clamp-2 group-hover:underline">
                          {book.title}
                        </h3>
                        <p className="text-xs text-stone-300 truncate">{book.author}</p>
                      </div>
                    </div>

                    {/* Quiet Unboxed Metadata */}
                    <div className="space-y-1.5">
                      <div className={`flex items-center gap-1.5 text-xs ${palette.textMuted}`}>
                        <span className="truncate">{book.category || 'Literature'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{pct}%</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {Math.max(1, Math.round((book.totalWords || 250) / 230))}m
                        </span>
                      </div>

                      <h2
                        dir="auto"
                        onClick={() => openBook(book.id)}
                        className={`font-display text-base font-semibold cursor-pointer hover:underline line-clamp-1 ${palette.textPrimary}`}
                      >
                        {book.title}
                      </h2>

                      <p
                        dir="auto"
                        className={`text-xs line-clamp-2 leading-relaxed ${palette.textMuted}`}
                      >
                        {book.description}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-4 mt-4 border-t border-current/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleFavoriteBook(book.id)}
                        title={book.isFavorite ? 'Remove from Starred' : 'Add to Starred'}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          book.isFavorite
                            ? 'text-amber-500'
                            : `${palette.textMuted} hover:${palette.textPrimary}`
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${book.isFavorite ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditBookModal(book)}
                        title="Edit Metadata & Cover"
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${palette.textMuted} hover:${palette.textPrimary}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <select
                        aria-label="Assign shelf"
                        value={book.shelfId || ''}
                        onChange={(e) => assignBookToShelf(book.id, e.target.value || undefined)}
                        className={`text-[11px] bg-transparent outline-none cursor-pointer max-w-[95px] truncate ${palette.textMuted}`}
                      >
                        <option value="">No Shelf</option>
                        {shelves.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => deleteBook(book.id)}
                        title="Delete Volume"
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${palette.textMuted} hover:text-rose-600`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openBook(book.id)}
                      className={`inline-flex items-center gap-1 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${palette.accentText} hover:underline`}
                    >
                      <span>Open</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* High-Density Table View */
          <div
            className={`rounded-xl border overflow-x-auto ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <table className="w-full min-w-[540px] text-left border-collapse">
              <thead>
                <tr
                  className={`border-b text-xs ${palette.surfaceBg} ${palette.borderHairline} ${palette.textMuted}`}
                >
                  <th className="py-3 px-4 font-medium">Title & Author</th>
                  <th className="py-3 px-4 font-medium">Format</th>
                  <th className="py-3 px-4 font-medium text-right">Locations</th>
                  <th className="py-3 px-4 font-medium text-right">Progress</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-current/10 text-xs">
                {filteredBooks.map((book) => {
                  const locNum = book.locator?.locationNumber ?? 1;
                  const totalLocs = Math.max(1, book.totalLocations || 1);
                  const pct = Math.min(100, Math.max(0, book.locator?.percentage ?? 0));
                  return (
                    <tr
                      key={book.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4" dir="auto">
                        <button
                          type="button"
                          onClick={() => openBook(book.id)}
                          className={`font-display font-semibold text-sm hover:underline cursor-pointer text-left ${palette.textPrimary}`}
                        >
                          {book.title}
                        </button>
                        <div className={palette.textMuted}>
                          {book.author} · {book.category}
                        </div>
                      </td>
                      <td className={`py-3 px-4 uppercase ${palette.textSecondary}`}>
                        {book.format}
                      </td>
                      <td className={`py-3 px-4 text-right tabular-nums ${palette.textSecondary}`}>
                        Loc {locNum} / {totalLocs}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-medium ${palette.textPrimary}`}
                      >
                        {pct}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditBookModal(book)}
                            className={`p-1 cursor-pointer ${palette.textMuted} hover:${palette.textPrimary}`}
                            title="Edit Metadata"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openBook(book.id)}
                            className={`px-3 py-1 rounded-md font-semibold text-white cursor-pointer ${palette.accentBg}`}
                          >
                            Read
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBook(book.id)}
                            className={`p-1 cursor-pointer ${palette.textMuted} hover:text-rose-600`}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Public Domain & OPDS Multilingual Classics Browser Modal */}
      {isCatalogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCatalogOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl max-h-[85dvh] rounded-t-2xl sm:rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="px-5 py-4 border-b border-current/10 flex items-center justify-between">
              <div>
                <div className={`text-[11px] uppercase tracking-widest ${palette.textMuted}`}>
                  OPDS & Project Gutenberg Curated Feed
                </div>
                <h3 className="font-display text-lg font-semibold">
                  Public Domain World Classics (Instant Offline Install)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {PUBLIC_DOMAIN_CATALOG.map((item) => {
                const alreadyInstalled = booksMeta.some((b) => b.title === item.title);
                return (
                  <div
                    key={item.title}
                    dir="auto"
                    className={`rounded-xl border p-4 flex flex-col justify-between space-y-4 ${palette.surfaceBg} ${palette.borderHairline}`}
                  >
                    <div className="space-y-2">
                      <div className={`text-[11px] ${palette.textMuted}`}>
                        {item.language} · {item.category}
                      </div>
                      <h4 className="font-display text-base font-semibold">{item.title}</h4>
                      <div className={`text-xs font-medium ${palette.textSecondary}`}>
                        {item.author}
                      </div>
                      <p className={`text-xs leading-relaxed ${palette.textMuted}`}>
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={installingTitle === item.title}
                      onClick={async () => {
                        const existing = booksMeta.find((b) => b.title === item.title);
                        if (existing) {
                          setIsCatalogOpen(false);
                          await openBook(existing.id);
                          return;
                        }
                        setInstallingTitle(item.title);
                        const bookId = `pd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                        let runningLoc = 1;
                        let totalWords = 0;
                        const builtChapters: BookChapter[] = item.chapters.map((ch, idx) => {
                          const content = ch.paragraphs.join('\n\n');
                          const wCount = content.split(/\s+/).filter(Boolean).length;
                          totalWords += wCount;
                          const span = Math.max(2, Math.ceil(content.length / 150));
                          const startLocation = runningLoc;
                          const endLocation = runningLoc + span;
                          runningLoc = endLocation + 1;
                          return {
                            id: `${bookId}-ch-${idx + 1}`,
                            title: ch.title,
                            content,
                            paragraphs: ch.paragraphs,
                            wordCount: wCount,
                            startLocation,
                            endLocation,
                          };
                        });
                        const totalLocations = Math.max(1, runningLoc - 1);
                        const meta: BookMeta = {
                          id: bookId,
                          title: item.title,
                          author: item.author,
                          description: item.description,
                          format: 'epub',
                          coverGradient: item.coverGradient,
                          category: item.category,
                          totalWords,
                          totalLocations,
                          chapterCount: builtChapters.length,
                          addedAt: Date.now(),
                          locator: {
                            chapterIndex: 0,
                            pageIndex: 0,
                            paragraphIndex: 0,
                            charOffset: 0,
                            locationNumber: 1,
                            percentage: 0,
                            lastReadTimestamp: Date.now(),
                          },
                        };
                        const contentRec: BookContentRecord = {
                          bookId,
                          chapters: builtChapters,
                          toc: builtChapters.map((c, idx) => ({
                            id: `toc-${idx}`,
                            title: c.title,
                            chapterIndex: idx,
                            level: 1,
                          })),
                          xray: buildLocalXRayIndex(bookId, builtChapters),
                        };
                        await installPublicDomainBook(meta, contentRec);
                        setInstallingTitle(null);
                        setIsCatalogOpen(false);
                        await openBook(bookId);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold text-white cursor-pointer ${palette.accentBg}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {alreadyInstalled
                          ? 'Open in Reader'
                          : installingTitle === item.title
                          ? 'Indexing X-Ray & Installing...'
                          : 'Install & Open Immediately'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Cover Art & Metadata Editor Modal */}
      {editingBook && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingBook(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 text-xs ${palette.elevatedBg} ${palette.borderHairline}`}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-3">
              <h3 className="font-display text-base font-semibold">
                Edit Volume Metadata & Cover Spine
              </h3>
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="p-1 cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold block">Book Title</label>
                <input
                  type="text"
                  dir="auto"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">Author</label>
                <input
                  type="text"
                  dir="auto"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold block">Category / Genre</label>
                <input
                  type="text"
                  dir="auto"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">Custom Cover Image URL (Optional)</label>
                <input
                  type="url"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold block">Editorial Synopsis</label>
              <textarea
                rows={3}
                dir="auto"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border outline-none ${palette.surfaceBg} ${palette.borderHairline}`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold block">Cloth Spine Gradient Preset</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COVER_GRADIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setEditGradient(preset.value)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 cursor-pointer ${
                      editGradient === preset.value
                        ? 'ring-2 ring-amber-500 font-semibold'
                        : palette.borderHairline
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-gradient-to-br ${preset.value} shrink-0`}
                    />
                    <span className="truncate text-[11px]">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-current/10">
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer ${palette.borderHairline}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await updateBookMeta(editingBook.id, {
                    title: editTitle.trim() || editingBook.title,
                    author: editAuthor.trim() || editingBook.author,
                    category: editCategory.trim() || 'Literature',
                    description: editDescription.trim(),
                    coverGradient: editGradient,
                    coverImage: editCoverUrl.trim() || undefined,
                  });
                  setEditingBook(null);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-white cursor-pointer ${palette.accentBg}`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Metadata</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
