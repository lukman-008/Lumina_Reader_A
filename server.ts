import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

// Pluggable Optional Cloud AI Client (Lumina Reader works 100% locally without this)
let aiClient: GoogleGenAI | null = null;
function getOptionalAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    localEngineActive: true,
    optionalCloudAiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ),
    time: new Date().toISOString(),
  });
});

// Serve PDF CMap files and standard fonts for international PDF rendering
const publicDir = path.join(process.cwd(), 'public');
app.use('/cmaps', express.static(path.join(publicDir, 'cmaps'), { maxAge: '7d', fallthrough: true }));
app.use('/standard_fonts', express.static(path.join(publicDir, 'standard_fonts'), { maxAge: '7d', fallthrough: true }));
app.use(express.static(publicDir));

// Optional Cloud AI Adapter: Ask the Book
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { question, bookTitle, author, currentChapter, contextText } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    const ai = getOptionalAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Cloud AI provider is not active. Using Local Literary Engine.',
        offlineFallback: true,
      });
    }

    const prompt = `You are Lumina Literary Companion, a spoiler-safe analysis engine for "${bookTitle || 'the current book'}" by ${author || 'the author'}.
Current Section: "${currentChapter || 'Current Chapter'}".
EXCERPT:
"""
${(contextText || '').slice(0, 16000)}
"""
QUESTION: "${question}"
Provide a concise, insightful literary answer grounded strictly in the text above without spoiling later chapters.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    res.json({ answer: response.text || '' });
  } catch (error: any) {
    res.status(503).json({ error: error.message || 'Cloud AI unavailable', offlineFallback: true });
  }
});

// Optional Cloud AI Adapter: Chapter Synthesis
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { chapterTitle, chapterText, bookTitle } = req.body;
    if (!chapterText) {
      return res.status(400).json({ error: 'Chapter text is required' });
    }
    const ai = getOptionalAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Cloud AI provider is not active. Using Local TextRank Engine.',
        offlineFallback: true,
      });
    }

    const prompt = `Synthesize "${chapterTitle || 'Chapter'}" from "${bookTitle || 'the book'}":
"""
${chapterText.slice(0, 18000)}
"""
Format with:
1. **Executive Summary** (2-3 sentences)
2. **Core Arguments & Plot Progression** (bulleted)
3. **Literary Themes & Motifs** (bulleted)
4. **Reader Reflection Prompt**`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    res.json({ summary: response.text || '' });
  } catch (error: any) {
    res.status(503).json({ error: error.message || 'Cloud AI unavailable', offlineFallback: true });
  }
});

// Optional Cloud AI Adapter: Optical Character Recognition (OCR)
app.post('/api/ai/ocr', async (req, res) => {
  try {
    const { imageBase64, prompt: customPrompt } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required for OCR.' });
    }
    const ai = getOptionalAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Cloud Vision OCR is not configured. Using Native PDF.js Geometric Text Reflow.',
        offlineFallback: true,
      });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            customPrompt ||
            'Transcribe all readable text from this scanned book page into clean paragraphs. Output only the transcribed text.',
        },
      ],
    });
    res.json({ text: response.text || '' });
  } catch (error: any) {
    res.status(503).json({ error: error.message || 'Cloud OCR unavailable', offlineFallback: true });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
        watch: isHmrDisabled ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumina Reader server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
