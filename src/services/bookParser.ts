import JSZip from 'jszip';
import Tesseract from 'tesseract.js';
import type {
  BookMeta,
  BookContentRecord,
  BookBinaryRecord,
  BookChapter,
  TOCItem,
} from '../types';
import { db } from './db';
import { getSeedLibraryData } from './sampleBooks';
import { buildLocalXRayIndex } from './localIntelligenceEngine';
import { sanitizeAndRepairUnicodeText } from './multilingualDictionary';

const COVER_GRADIENTS = [
  'from-stone-800 via-amber-950 to-neutral-950',
  'from-emerald-950 via-teal-900 to-stone-950',
  'from-slate-900 via-indigo-950 to-neutral-950',
  'from-rose-950 via-stone-900 to-neutral-950',
  'from-amber-900 via-stone-900 to-neutral-950',
];

export async function initializeLibraryCatalog(): Promise<BookMeta[]> {
  try {
    const existing = await db.booksMeta.orderBy('addedAt').reverse().toArray();
    if (existing.length > 0) {
      return existing;
    }

    const { metas, contents } = getSeedLibraryData();
    await db.transaction('rw', db.booksMeta, db.bookContents, async () => {
      await db.booksMeta.bulkPut(metas);
      await db.bookContents.bulkPut(contents);
    });
    return metas;
  } catch (err) {
    console.warn('Database seed fallback triggered:', err);
    return getSeedLibraryData().metas;
  }
}

export async function ingestBookFile(file: File): Promise<BookMeta> {
  const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const fallbackTitle = rawName
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
    : 'Imported Volume';
  const coverGradient = COVER_GRADIENTS[Math.floor(Math.random() * COVER_GRADIENTS.length)];
  const bookId = `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const arrayBuffer = await file.arrayBuffer();
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, Math.min(512, arrayBuffer.byteLength)));
  const headerAscii = Array.from(headerBytes)
    .map((b) => String.fromCharCode(b))
    .join('');

  let ext = (file.name.split('.').pop() || '').toLowerCase();
  if (headerAscii.includes('%PDF-') || file.type === 'application/pdf') {
    ext = 'pdf';
  } else if (
    headerBytes[0] === 0x50 &&
    headerBytes[1] === 0x4b &&
    (ext === 'epub' || file.type === 'application/epub+zip' || !ext)
  ) {
    ext = 'epub';
  } else if (
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
  ) {
    return parseAndStoreImageBook(bookId, file, fallbackTitle, coverGradient);
  }

  if (ext === 'epub') {
    return parseAndStoreEpub(bookId, file, arrayBuffer, fallbackTitle, coverGradient);
  }

  if (ext === 'pdf') {
    return parseAndStorePdf(bookId, file, arrayBuffer, fallbackTitle, coverGradient);
  }

  return parseAndStoreTextOrMarkdown(
    bookId,
    file,
    arrayBuffer,
    fallbackTitle,
    ext === 'md' ? 'md' : 'txt',
    coverGradient
  );
}

/**
 * Automatically converts an imported image page (.png, .jpg, .webp) into a selectable, annotatable book
 */
async function parseAndStoreImageBook(
  bookId: string,
  file: File,
  title: string,
  coverGradient: string
): Promise<BookMeta> {
  let extractedText = '';
  try {
    const res = await Tesseract.recognize(file, 'eng+ara');
    extractedText = (res?.data?.text || '').trim();
  } catch {
    // Fallback if offline worker fails
  }

  const paragraphs = extractedText
    ? extractedText
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\n+/g, ' ').trim())
        .filter(Boolean)
    : [title];

  const content = paragraphs.join('\n\n');
  const wordCount = Math.max(1, content.split(/\s+/).filter(Boolean).length);
  const chapters: BookChapter[] = [
    {
      id: 'ch-1',
      title,
      content,
      paragraphs,
      wordCount,
      startLocation: 1,
      endLocation: Math.max(2, Math.ceil(content.length / 150)),
    },
  ];

  const meta: BookMeta = {
    id: bookId,
    title,
    author: 'Visual Edition',
    description: paragraphs[0]?.slice(0, 220) || title,
    format: 'txt',
    coverGradient,
    category: 'Library Volumes',
    totalWords: wordCount,
    totalLocations: chapters[0].endLocation,
    chapterCount: 1,
    addedAt: Date.now(),
    fileSizeBytes: file.size,
    locator: {
      chapterIndex: 0,
      pageIndex: 0,
      paragraphIndex: 0,
      charOffset: 0,
      locationNumber: 1,
      percentage: 1,
      lastReadTimestamp: Date.now(),
    },
  };

  const contentRecord: BookContentRecord = {
    bookId,
    chapters,
    toc: [{ id: 'ch-1', title, chapterIndex: 0, level: 0 }],
    xray: buildLocalXRayIndex(bookId, chapters),
  };

  await db.transaction('rw', db.booksMeta, db.bookContents, async () => {
    await db.booksMeta.put(meta);
    await db.bookContents.put(contentRecord);
  });

  return meta;
}

/**
 * Decodes ArrayBuffer into string supporting UTF-8, UTF-16LE/BE, and Windows-1256 (Arabic).
 */
function decodeTextBufferSafely(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(buffer);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(buffer);
    }
  }
  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
  // Only fall back to windows-1256 if there are no Devanagari/CJK characters and high replacement ratio
  if (
    replacementCount > 10 &&
    replacementCount > utf8Text.length * 0.05 &&
    !/[\u0900-\u097F]/.test(utf8Text)
  ) {
    try {
      return sanitizeAndRepairUnicodeText(new TextDecoder('windows-1256').decode(buffer));
    } catch {
      return sanitizeAndRepairUnicodeText(utf8Text);
    }
  }
  return sanitizeAndRepairUnicodeText(utf8Text);
}

async function parseAndStoreEpub(
  bookId: string,
  file: File,
  arrayBuffer: ArrayBuffer,
  fallbackTitle: string,
  coverGradient: string
): Promise<BookMeta> {
  let title = fallbackTitle;
  let author = 'EPUB Edition';
  let description = `Imported EPUB Edition (${Math.max(1, Math.round(file.size / 1024))} KB)`;
  const rawChapters: { title: string; paragraphs: string[] }[] = [];

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();

    let opfPath = '';
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      const containerXml = await containerFile.async('string');
      const containerDoc = parser.parseFromString(containerXml, 'application/xml');
      const rootfile =
        containerDoc.querySelector('rootfile') ||
        containerDoc.getElementsByTagName('rootfile')[0];
      opfPath = rootfile?.getAttribute('full-path') || '';
    }

    if (!opfPath) {
      const foundOpf = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith('.opf'));
      if (foundOpf) opfPath = foundOpf;
    }

    const opfBaseDir = opfPath.includes('/')
      ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1)
      : '';
    let orderedHrefs: { href: string }[] = [];

    if (opfPath && zip.file(opfPath)) {
      const opfXml = await zip.file(opfPath)!.async('string');
      const opfDoc = parser.parseFromString(opfXml, 'application/xml');

      const dcTitle =
        opfDoc.getElementsByTagName('dc:title')[0]?.textContent ||
        opfDoc.getElementsByTagName('title')[0]?.textContent;
      const dcCreator =
        opfDoc.getElementsByTagName('dc:creator')[0]?.textContent ||
        opfDoc.getElementsByTagName('creator')[0]?.textContent;
      const dcDesc =
        opfDoc.getElementsByTagName('dc:description')[0]?.textContent ||
        opfDoc.getElementsByTagName('description')[0]?.textContent;

      if (dcTitle?.trim()) title = dcTitle.trim();
      if (dcCreator?.trim()) author = dcCreator.trim();
      if (dcDesc?.trim()) {
        const cleanedDesc = dcDesc.replace(/<[^>]+>/g, '').trim();
        if (cleanedDesc.length > 0) description = cleanedDesc.slice(0, 260);
      }

      const manifestMap = new Map<string, string>();
      const allItems = [
        ...Array.from(opfDoc.getElementsByTagName('item')),
        ...Array.from(opfDoc.getElementsByTagName('opf:item')),
      ];
      allItems.forEach((item) => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        if (id && href) {
          try {
            const cleanHref = decodeURIComponent(href.split('#')[0]);
            const resolved = resolveRelativePath(opfBaseDir, cleanHref);
            manifestMap.set(id, resolved);
          } catch {
            manifestMap.set(id, resolveRelativePath(opfBaseDir, href.split('#')[0]));
          }
        }
      });

      const spineRefs = [
        ...Array.from(opfDoc.getElementsByTagName('itemref')),
        ...Array.from(opfDoc.getElementsByTagName('opf:itemref')),
      ];
      spineRefs.forEach((ref) => {
        const idref = ref.getAttribute('idref');
        if (idref && manifestMap.has(idref)) {
          orderedHrefs.push({ href: manifestMap.get(idref)! });
        }
      });
    }

    if (orderedHrefs.length === 0) {
      const htmlKeys = Object.keys(zip.files)
        .filter((name) => /\.(x?html|htm|xml)$/i.test(name) && !/container\.xml$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      orderedHrefs = htmlKeys.map((href) => ({ href }));
    }

    for (let i = 0; i < orderedHrefs.length; i++) {
      const { href } = orderedHrefs[i];
      let zipEntry = zip.file(href);
      if (!zipEntry) {
        try {
          zipEntry = zip.file(decodeURIComponent(href));
        } catch {
          // ignore
        }
      }
      if (!zipEntry) {
        const matchingKey = Object.keys(zip.files).find(
          (k) => k.toLowerCase() === href.toLowerCase() || k.endsWith('/' + href)
        );
        if (matchingKey) zipEntry = zip.file(matchingKey);
      }
      if (!zipEntry) continue;

      const rawBuf = await zipEntry.async('arraybuffer');
      const htmlStr = decodeTextBufferSafely(rawBuf);
      const extracted = extractSemanticParagraphsFromHtml(
        htmlStr,
        `${title} — ${rawChapters.length + 1}`
      );
      if (extracted.paragraphs.length > 0) {
        rawChapters.push(extracted);
      }
    }

    // If the EPUB is a scanned image-only EPUB (0 text chapters extracted), automatically OCR the first few page images
    if (rawChapters.length === 0) {
      const imageKeys = Object.keys(zip.files)
        .filter((k) => /\.(jpe?g|png|webp)$/i.test(k) && !/cover/i.test(k))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .slice(0, 6);

      for (let idx = 0; idx < imageKeys.length; idx++) {
        const imgEntry = zip.file(imageKeys[idx]);
        if (!imgEntry) continue;
        try {
          const blob = await imgEntry.async('blob');
          const res = await Tesseract.recognize(blob, 'eng+ara');
          const text = (res?.data?.text || '').trim();
          if (text.length > 5) {
            rawChapters.push({
              title: `${title} — Page ${idx + 1}`,
              paragraphs: text
                .split(/\n\s*\n/)
                .map((p) => p.replace(/\n+/g, ' ').trim())
                .filter(Boolean),
            });
          }
        } catch {
          // continue
        }
      }
    }
  } catch (err) {
    console.error('EPUB OPF parsing note:', err);
  }

  if (rawChapters.length === 0) {
    rawChapters.push({
      title,
      paragraphs: [
        `Imported EPUB volume "${title}".`,
        'This volume has been indexed in your library.',
      ],
    });
  }

  const runningOffset = { value: 0 };
  const chapters: BookChapter[] = rawChapters.map((rc, idx) => {
    const content = rc.paragraphs.join('\n\n');
    const wordCount = Math.max(1, content.split(/\s+/).filter(Boolean).length);
    const startLocation = Math.max(1, Math.ceil(runningOffset.value / 150));
    runningOffset.value += Math.max(150, content.length);
    const endLocation = Math.max(startLocation, Math.ceil(runningOffset.value / 150));

    return {
      id: `ch-${idx + 1}`,
      title: rc.title || `Section ${idx + 1}`,
      content,
      paragraphs: rc.paragraphs,
      wordCount,
      startLocation,
      endLocation,
    };
  });

  const totalWords = Math.max(1, chapters.reduce((acc, c) => acc + c.wordCount, 0));
  const totalLocations = Math.max(1, chapters[chapters.length - 1]?.endLocation || 1);
  const toc: TOCItem[] = chapters.map((c, idx) => ({
    id: c.id,
    title: c.title,
    chapterIndex: idx,
    level: 0,
  }));

  const xray = buildLocalXRayIndex(bookId, chapters);

  const meta: BookMeta = {
    id: bookId,
    title,
    author,
    description,
    format: 'epub',
    coverGradient,
    category: 'EPUB Editions',
    totalWords,
    totalLocations,
    chapterCount: Math.max(1, chapters.length),
    addedAt: Date.now(),
    fileSizeBytes: file.size,
    locator: {
      chapterIndex: 0,
      pageIndex: 0,
      paragraphIndex: 0,
      charOffset: 0,
      locationNumber: 1,
      percentage: 1,
      lastReadTimestamp: Date.now(),
    },
  };

  const contentRecord: BookContentRecord = {
    bookId,
    chapters,
    toc,
    xray,
  };

  await db.transaction('rw', db.booksMeta, db.bookContents, async () => {
    await db.booksMeta.put(meta);
    await db.bookContents.put(contentRecord);
  });

  return meta;
}

async function parseAndStorePdf(
  bookId: string,
  file: File,
  arrayBuffer: ArrayBuffer,
  title: string,
  coverGradient: string
): Promise<BookMeta> {
  const estimatedLocations = Math.max(10, Math.round(file.size / 4096));
  const placeholderChapter: BookChapter = {
    id: 'pdf-doc-1',
    title: `${title}`,
    content: `${title} (${(file.size / (1024 * 1024)).toFixed(2)} MB). Select any text directly on the page to highlight, add margin notes, or look up definitions.`,
    paragraphs: [
      `${title} (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
      'Select any words directly on the page to highlight or attach a margin note.',
    ],
    wordCount: Math.max(100, estimatedLocations * 25),
    startLocation: 1,
    endLocation: estimatedLocations,
  };

  const meta: BookMeta = {
    id: bookId,
    title,
    author: 'PDF Edition',
    description: `Interactive Live-Text PDF (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
    format: 'pdf',
    coverGradient,
    category: 'PDF Documents',
    totalWords: placeholderChapter.wordCount,
    totalLocations: estimatedLocations,
    chapterCount: 1,
    addedAt: Date.now(),
    fileSizeBytes: file.size,
    locator: {
      chapterIndex: 0,
      pageIndex: 1,
      paragraphIndex: 0,
      charOffset: 0,
      locationNumber: 1,
      percentage: 1,
      lastReadTimestamp: Date.now(),
    },
  };

  const contentRecord: BookContentRecord = {
    bookId,
    chapters: [placeholderChapter],
    toc: [{ id: 'pdf-1', title: 'Page 1', chapterIndex: 0, level: 0 }],
    xray: buildLocalXRayIndex(bookId, [placeholderChapter]),
    ocrByPage: {},
  };

  const binaryRecord: BookBinaryRecord = {
    bookId,
    data: arrayBuffer,
    mimeType: 'application/pdf',
    byteLength: arrayBuffer.byteLength,
  };

  await db.transaction('rw', db.booksMeta, db.bookContents, db.bookBinaries, async () => {
    await db.booksMeta.put(meta);
    await db.bookContents.put(contentRecord);
    await db.bookBinaries.put(binaryRecord);
  });

  return meta;
}

async function parseAndStoreTextOrMarkdown(
  bookId: string,
  file: File,
  arrayBuffer: ArrayBuffer,
  title: string,
  format: 'txt' | 'md',
  coverGradient: string
): Promise<BookMeta> {
  const rawText = decodeTextBufferSafely(arrayBuffer);
  const chapters = splitTextIntoChapters(rawText, title);
  const totalWords = Math.max(1, chapters.reduce((acc, c) => acc + c.wordCount, 0));
  const totalLocations = Math.max(1, chapters[chapters.length - 1]?.endLocation || 1);

  const meta: BookMeta = {
    id: bookId,
    title,
    author: format === 'md' ? 'Markdown Manuscript' : 'Imported Volume',
    description:
      rawText.replace(/[#*_`]/g, '').trim().slice(0, 220) || `Imported ${format.toUpperCase()} book`,
    format,
    coverGradient,
    category: format === 'md' ? 'Manuscripts & Notes' : 'Documents',
    totalWords,
    totalLocations,
    chapterCount: Math.max(1, chapters.length),
    addedAt: Date.now(),
    fileSizeBytes: file.size,
    locator: {
      chapterIndex: 0,
      pageIndex: 0,
      paragraphIndex: 0,
      charOffset: 0,
      locationNumber: 1,
      percentage: 1,
      lastReadTimestamp: Date.now(),
    },
  };

  const contentRecord: BookContentRecord = {
    bookId,
    chapters,
    toc: chapters.map((c, idx) => ({ id: c.id, title: c.title, chapterIndex: idx, level: 0 })),
    xray: buildLocalXRayIndex(bookId, chapters),
  };

  await db.transaction('rw', db.booksMeta, db.bookContents, async () => {
    await db.booksMeta.put(meta);
    await db.bookContents.put(contentRecord);
  });

  return meta;
}

function resolveRelativePath(baseDir: string, relativeHref: string): string {
  const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];
  const parts = relativeHref.split('/');
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function extractSemanticParagraphsFromHtml(
  html: string,
  fallbackTitle: string
): { title: string; paragraphs: string[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, nav, svg, noscript').forEach((el) => el.remove());

  const headingEl = doc.querySelector('h1, h2, h3, title');
  const title = headingEl?.textContent?.replace(/\s+/g, ' ').trim() || fallbackTitle;

  const blockElements = Array.from(
    doc.querySelectorAll('p, div, blockquote, li, h1, h2, h3, h4, pre, article, section')
  );
  const paragraphs: string[] = [];

  if (blockElements.length > 0) {
    blockElements.forEach((el) => {
      if (
        (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'ARTICLE') &&
        el.querySelector('p, div, blockquote, h1, h2, h3')
      ) {
        return;
      }
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 2 && paragraphs[paragraphs.length - 1] !== text) {
        paragraphs.push(text);
      }
    });
  }

  if (paragraphs.length === 0) {
    const rawBody = (doc.body?.textContent || html.replace(/<[^>]+>/g, ' ')).trim();
    rawBody
      .split(/\n\s*\n|\r\n\r\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length >= 2)
      .forEach((p) => paragraphs.push(p));
  }

  return { title, paragraphs };
}

function splitTextIntoChapters(fullText: string, defaultTitle: string): BookChapter[] {
  const normalized = fullText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const rawParagraphs = normalized
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const rawGroups: { title: string; paragraphs: string[] }[] = [];
  let currentTitle = defaultTitle;
  let currentList: string[] = [];
  let wordsAccumulated = 0;

  for (const p of rawParagraphs) {
    const isMdHeader = /^#{1,3}\s+(.+)$/.test(p);
    const isChapterMarker =
      /^(Chapter|Book|Part|Section|الفصل|الباب|الجزء)\s+/i.test(p) && p.length < 110;

    if ((isMdHeader || isChapterMarker || wordsAccumulated > 3200) && currentList.length > 0) {
      rawGroups.push({ title: currentTitle, paragraphs: currentList });
      currentTitle = isMdHeader
        ? p.replace(/^#{1,3}\s+/, '').trim()
        : isChapterMarker
        ? p
        : `${defaultTitle} — ${rawGroups.length + 2}`;
      currentList = isMdHeader ? [] : [p];
      wordsAccumulated = 0;
    } else {
      if (isMdHeader && currentList.length === 0) {
        currentTitle = p.replace(/^#{1,3}\s+/, '').trim();
      } else {
        currentList.push(p);
        wordsAccumulated += Math.max(1, p.split(/\s+/).length);
      }
    }
  }

  if (currentList.length > 0) {
    rawGroups.push({ title: currentTitle, paragraphs: currentList });
  }

  if (rawGroups.length === 0) {
    rawGroups.push({ title: defaultTitle, paragraphs: [fullText || defaultTitle] });
  }

  const runningOffset = { value: 0 };
  return rawGroups.map((g, idx) => {
    const content = g.paragraphs.join('\n\n');
    const wordCount = Math.max(1, content.split(/\s+/).filter(Boolean).length);
    const startLocation = Math.max(1, Math.ceil(runningOffset.value / 150));
    runningOffset.value += Math.max(150, content.length);
    const endLocation = Math.max(startLocation, Math.ceil(runningOffset.value / 150));

    return {
      id: `ch-${idx + 1}`,
      title: g.title || `Section ${idx + 1}`,
      content,
      paragraphs: g.paragraphs,
      wordCount,
      startLocation,
      endLocation,
    };
  });
}
