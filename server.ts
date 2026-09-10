import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Lazy Google Gen AI helper with required telemetry headers
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// AI Title Generator tailored for Mohammadi Academy
app.post("/api/ai/title", async (req, res) => {
  try {
    const { topic, platform, currentTitle, mood, language } = req.body;
    const ai = getAI();
    const langPrompt = language === 'fa' 
      ? 'Generate the titles in fluent, scholarly Persian (فارسی) suitable for Mohammadi Academy.'
      : language === 'bilingual'
      ? 'Generate bilingual titles (Persian | English) for Mohammadi Academy.'
      : 'Generate high-impact titles in English or bilingual with Persian for Mohammadi Academy.';

    const prompt = `You are an expert educational and scholarly media strategist for Mohammadi Academy (Mohammadiacademy.org).
Create 5 high-converting, dignified video title variations for a ${platform || "Shorts/Reels/YouTube"} video published on Mohammadi Academy.
Topic / Lecture Context: ${topic || currentTitle || "Mohammadi Academy specialized lecture & research"}
Tone / Mood: ${mood || "scholarly, inspiring, engaging, educational, authentic"}
${langPrompt}
Include branding references to "آکادمی محمدی" or "Mohammadiacademy.org" or "Mohammadi Academy" where fitting.
Output strictly valid JSON with an array of objects:
[
  { "title": "...", "style": "Scholarly / Quranic Insight / Moral Wisdom / Educational / Hook" }
]
Keep each title concise (3 to 12 words), formatted for video header banners.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ titles: parsed });
  } catch (error: any) {
    console.error("AI Title error:", error);
    // Graceful fallback titles dedicated to Mohammadi Academy
    res.json({
      titles: [
        { title: "آکادمی محمدی | درس‌گفتار تخصصی و پژوهشی", style: "Scholarly Persian" },
        { title: "Mohammadi Academy • Key Insights & Wisdom", style: "English Academic" },
        { title: "سلسله مباحث حکمت و اخلاق اسلامی • Mohammadiacademy.org", style: "Islamic Ethics" },
        { title: "شرح و تدبر در معارف قرآن کریم | آکادمی محمدی", style: "Quranic Reflection" },
        { title: "Mohammadi Academy | علم، معرفت و پژوهش", style: "Bilingual Official" },
      ],
      fallback: true,
      error: error.message,
    });
  }
});

// AI Platform Description / Captions for Mohammadi Academy
app.post("/api/ai/content-kit", async (req, res) => {
  try {
    const { title, platform, duration, summary } = req.body;
    const ai = getAI();

    const prompt = `You are a social media copywriter for Mohammadi Academy (Mohammadiacademy.org).
Generate an official posting kit for this video:
- Title: "${title || "آکادمی محمدی | Mohammadi Academy"}"
- Target Platform: "${platform || "YouTube Shorts"}"
- Video Duration: ${duration ? `${duration} seconds` : "short video"}
- Additional Context: ${summary || "Official educational and scholarly video produced for Mohammadiacademy.org"}

Produce JSON in this format:
{
  "youtubeDescription": "Full YouTube description in Persian and English with scholarly overview, official website links to Mohammadiacademy.org, key takeaways, and tags #MohammadiAcademy #آکادمی_محمدی",
  "facebookCaption": "Engaging, respectful Facebook post with an inspirational hook, line breaks, Persian/English call to action, and link to Mohammadiacademy.org",
  "hashtags": ["#MohammadiAcademy", "#آکادمی_محمدی", "#Mohammadiacademy_org", "#آموزش_اسلامی", "#حکمت_و_معرفت", "#IslamicStudies"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Content Kit error:", error);
    res.json({
      youtubeDescription: `🏛️ پایگاه رسمی آکادمی محمدی (Mohammadi Academy)\n\n📌 موضوع: ${req.body.title || "درس‌گفتار تخصصی آکادمی محمدی"}\n\nجهت دسترسی به دوره‌های آموزشی کامل، مقالات و منابع پژوهشی به وب‌سایت رسمی ما مراجعه نمایید:\n🌐 https://Mohammadiacademy.org\n\n✨ نشر این ویدیو در ترویج علم و آگاهی سهیم خواهد بود.\n\n#آکادمی_محمدی #MohammadiAcademy #Mohammadiacademy_org #معارف_اسلامی`,
      facebookCaption: `✨ گزیده‌ای از مباحث و درس‌گفتارهای تخصصی آکادمی محمدی (Mohammadiacademy.org).\n\n💬 نظرات و دیدگاه‌های خود را با ما در میان بگذارید.\n🌐 پایگاه رسمی: Mohammadiacademy.org`,
      hashtags: ["#MohammadiAcademy", "#آکادمی_محمدی", "#Mohammadiacademy_org", "#آموزش_تخصصی", "#معارف_اسلامی"],
      fallback: true,
    });
  }
});

// AI Auto Subtitles Generator (English, Persian & Bilingual for Mohammadi Academy)
app.post("/api/ai/subtitles", async (req, res) => {
  try {
    const { title, duration, transcriptDraft, language } = req.body;
    const ai = getAI();
    const vidDuration = Math.max(3, Math.min(180, Number(duration) || 12));
    const lang = language || 'fa';

    let languageInstructions = "";
    if (lang === 'fa') {
      languageInstructions = `Generate all subtitle cues strictly in natural, grammatically correct Persian (فارسی) for Mohammadi Academy.
The text field must be in Persian (e.g. "به نام خداوند بخشنده و مهربان", "در این بخش از مباحث آکادمی محمدی").
The highlight field should be an impactful Persian word from the phrase (e.g. "مهربان", "آکادمی", "حکمت").`;
    } else if (lang === 'bilingual') {
      languageInstructions = `Generate bilingual subtitles with Persian as the primary text and English as the translation field:
- "text": Persian text (فارسی)
- "translation": English translation
- "highlight": Key emphasized word in Persian`;
    } else {
      languageInstructions = `Generate subtitle cues in English for Mohammadi Academy.
The text field must be in English.
The highlight field should be a punchy keyword.`;
    }

    const prompt = `You are an automated video subtitle transcription and timing engine for Mohammadi Academy (Mohammadiacademy.org).
Generate timed subtitles for a video with duration ${vidDuration} seconds.
Video Title/Context: "${title || "درس‌گفتار آکادمی محمدی | Mohammadi Academy"}"
${transcriptDraft ? `User's transcript / spoken notes: "${transcriptDraft}"` : "Create realistic, high-quality scholarly/educational speech subtitles matching Mohammadi Academy's mission of knowledge, research, and ethics."}

Language requirement:
${languageInstructions}

Output strictly valid JSON with an array of subtitle objects:
[
  {
    "id": "1",
    "start": 0.0,
    "end": 2.5,
    "text": "...",
    ${lang === 'bilingual' ? '"translation": "...",' : ''}
    "highlight": "..."
  }
]
Rules:
- Keep phrases concise (3 to 6 words per line).
- Subtitle intervals must fit logically within [0.0, ${vidDuration}].
- Timestamp gaps must be small and natural for continuous speech pacing.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ subtitles: parsed });
  } catch (error: any) {
    console.error("AI Subtitles error:", error);
    const vidDuration = Math.max(5, Number(req.body.duration) || 10);
    const step = vidDuration / 4;
    const isFa = req.body.language === 'fa' || req.body.language === 'bilingual';

    if (isFa) {
      res.json({
        subtitles: [
          { 
            id: "1", 
            start: 0, 
            end: Number((step * 0.9).toFixed(1)), 
            text: "به آکادمی محمدی خوش آمدید", 
            translation: "Welcome to Mohammadi Academy",
            highlight: "محمدی" 
          },
          { 
            id: "2", 
            start: Number(step.toFixed(1)), 
            end: Number((step * 1.9).toFixed(1)), 
            text: "مرکز تخصصی آموزش و پژوهش‌های علمی", 
            translation: "Center for Specialized Research & Education",
            highlight: "پژوهش‌های" 
          },
          { 
            id: "3", 
            start: Number((step * 2).toFixed(1)), 
            end: Number((step * 2.9).toFixed(1)), 
            text: "یادگیری حکمت، اخلاق و معارف راستین", 
            translation: "Learning Wisdom, Ethics & Knowledge",
            highlight: "حکمت" 
          },
          { 
            id: "4", 
            start: Number((step * 3).toFixed(1)), 
            end: Number((vidDuration - 0.2).toFixed(1)), 
            text: "پایگاه رسمی ما: Mohammadiacademy.org", 
            translation: "Official Portal: Mohammadiacademy.org",
            highlight: "Mohammadiacademy.org" 
          },
        ],
        fallback: true,
      });
    } else {
      res.json({
        subtitles: [
          { id: "1", start: 0, end: Number((step * 0.9).toFixed(1)), text: "Welcome to Mohammadi Academy", highlight: "Academy" },
          { id: "2", start: Number(step.toFixed(1)), end: Number((step * 1.9).toFixed(1)), text: "Dedicated to academic excellence & wisdom", highlight: "wisdom" },
          { id: "3", start: Number((step * 2).toFixed(1)), end: Number((step * 2.9).toFixed(1)), text: "Explore in-depth lectures and courses", highlight: "lectures" },
          { id: "4", start: Number((step * 3).toFixed(1)), end: Number((vidDuration - 0.2).toFixed(1)), text: "Visit us at Mohammadiacademy.org", highlight: "Mohammadiacademy.org" },
        ],
        fallback: true,
      });
    }
  }
});

// AI Video Audio Transcription Endpoint: Transcribes speaker voice from audio buffer
app.post("/api/ai/transcribe-video-audio", async (req, res) => {
  try {
    const { audioBase64, mimeType, language, duration, title } = req.body;
    const ai = getAI();
    const vidDuration = Math.max(3, Math.min(180, Number(duration) || 15));
    const lang = language || 'fa';

    let langInstruction = "";
    if (lang === 'fa') {
      langInstruction = `Transcribe the speech strictly in Persian (فارسی). 
Capture the exact spoken words with accurate timestamps [start, end] in seconds.
Provide a "highlight" Persian keyword for each segment.`;
    } else if (lang === 'bilingual') {
      langInstruction = `Transcribe the speech with both Persian and English:
Provide "text" in Persian (فارسی), and "translation" in English.
Provide timestamps [start, end] in seconds and an active "highlight" keyword.`;
    } else {
      langInstruction = `Transcribe the speech in English. If the speaker spoke in Persian/Arabic, translate directly into clear English subtitles with timestamps.
Provide "text" in English, timestamps [start, end], and a "highlight" keyword.`;
    }

    const systemPrompt = `You are an automated speech transcription engine for Mohammadi Academy (Mohammadiacademy.org).
Your task is to listen to the speaker's voice in the provided video audio and output precisely timed subtitles synchronized with when the speaker speaks.
Video Title Context: "${title || "Mohammadi Academy Lecture"}"
Max Duration: ${vidDuration} seconds.

Language Requirement:
${langInstruction}

Rules:
1. Return strictly JSON with an array of subtitles.
2. Group spoken words into clean, readable subtitle cues (3 to 6 words per cue).
3. "start" and "end" must be numbers in seconds, reflecting when the speaker speaks.
4. "id" must be sequential string ("1", "2", ...).

JSON format:
[
  {
    "id": "1",
    "start": 0.0,
    "end": 2.4,
    "text": "...",
    ${lang === 'bilingual' ? '"translation": "...",' : ''}
    "highlight": "..."
  }
]`;

    let response;

    if (audioBase64 && audioBase64.length > 50) {
      // Audio provided: pass to multimodal Gemini 2.5/3.8 Flash!
      const audioBufferClean = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/wav",
              data: audioBufferClean,
            },
          },
          {
            text: systemPrompt,
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });
    } else {
      // Fallback text-based timed generator based on title and duration
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: systemPrompt + `\nNo direct audio waveform available; generate authentic Mohammadi Academy lecture speech cues matching duration ${vidDuration}s.`,
        config: {
          responseMimeType: "application/json",
        },
      });
    }

    const parsed = JSON.parse(response.text || "[]");
    res.json({ subtitles: parsed, success: true });
  } catch (error: any) {
    console.error("AI Audio Transcription error:", error);
    const vidDuration = Math.max(5, Number(req.body.duration) || 12);
    const step = vidDuration / 4;
    const isFa = req.body.language === 'fa' || req.body.language === 'bilingual';

    res.json({
      subtitles: isFa
        ? [
            { id: "1", start: 0, end: Number((step * 0.9).toFixed(1)), text: "به آکادمی محمدی خوش آمدید", translation: "Welcome to Mohammadi Academy", highlight: "محمدی" },
            { id: "2", start: Number(step.toFixed(1)), end: Number((step * 1.9).toFixed(1)), text: "آموزش و پژوهش‌های تخصصی معارف اسلامی", translation: "Specialized Islamic Research & Studies", highlight: "پژوهش‌های" },
            { id: "3", start: Number((step * 2).toFixed(1)), end: Number((step * 2.9).toFixed(1)), text: "راهی به‌سوی اندیشه، معرفت و اخلاق", translation: "A Path Toward Thought & Ethics", highlight: "معرفت" },
            { id: "4", start: Number((step * 3).toFixed(1)), end: Number((vidDuration - 0.2).toFixed(1)), text: "مشاهده کامل دروس: Mohammadiacademy.org", translation: "Watch full lectures: Mohammadiacademy.org", highlight: "Mohammadiacademy.org" },
          ]
        : [
            { id: "1", start: 0, end: Number((step * 0.9).toFixed(1)), text: "Welcome to Mohammadi Academy", highlight: "Academy" },
            { id: "2", start: Number(step.toFixed(1)), end: Number((step * 1.9).toFixed(1)), text: "Exploring profound wisdom and knowledge", highlight: "wisdom" },
            { id: "3", start: Number((step * 2).toFixed(1)), end: Number((step * 2.9).toFixed(1)), text: "Guided lectures and scholarly studies", highlight: "lectures" },
            { id: "4", start: Number((step * 3).toFixed(1)), end: Number((vidDuration - 0.2).toFixed(1)), text: "Official Portal: Mohammadiacademy.org", highlight: "Mohammadiacademy.org" },
          ],
      fallback: true,
      error: error.message,
    });
  }
});

// AI Subtitle Translation between Persian and English
app.post("/api/ai/translate-subtitles", async (req, res) => {
  try {
    const { subtitles, targetLanguage } = req.body;
    const ai = getAI();

    const target = targetLanguage === 'Persian' || targetLanguage === 'fa' || targetLanguage === 'Farsi'
      ? 'Persian (فارسی)'
      : targetLanguage === 'English' || targetLanguage === 'en'
      ? 'English'
      : targetLanguage || 'Persian (فارسی)';

    const prompt = `You are an expert translator for Mohammadi Academy (Mohammadiacademy.org).
Translate the following video subtitle cues into ${target}.
Retain the exact "id", "start", and "end" timestamps.
Translate the "text" naturally and with high scholarly fluency.
Select a suitable "highlight" word from the translated text.
If target is Persian, write in authentic, elegant Persian orthography.

Input subtitles:
${JSON.stringify(subtitles)}

Output strictly valid JSON:
[
  { "id": "...", "start": 0.0, "end": 1.5, "text": "...", "highlight": "..." }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ subtitles: parsed });
  } catch (error: any) {
    console.error("AI Translation error:", error);
    res.status(500).json({ error: error.message || "Failed to translate subtitles" });
  }
});

// AI Smart Framing & Scene Cut Analysis
app.post("/api/ai/smart-analysis", async (req, res) => {
  try {
    const { aspectCategory, videoWidth, videoHeight, duration, platform } = req.body;
    const ai = getAI();

    const prompt = `You are an AI video editor recommending framing and cut settings.
Video dimensions: ${videoWidth}x${videoHeight} (Aspect: ${aspectCategory})
Duration: ${duration}s
Target Platform: ${platform}

Analyze and provide recommendations in JSON:
{
  "recommendedBorder": "rounded" | "glass" | "film" | "neon" | "clean",
  "recommendedBackground": "gradient-cyber" | "blur-video" | "gradient-sunset" | "studio-dark",
  "suggestedScale": 0.85,
  "suggestedOffsetY": 0,
  "silenceMarkers": [2.4, 7.8],
  "sceneCuts": [3.5, 8.2],
  "reasoning": "A concise explanation of why this framing maximizes engagement on this platform."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Analysis error:", error);
    res.json({
      recommendedBorder: "rounded",
      recommendedBackground: "blur-video",
      suggestedScale: 0.85,
      suggestedOffsetY: 0,
      silenceMarkers: [],
      sceneCuts: [],
      reasoning: "Auto-detected aspect ratio framed with blurred video backdrop for optimal social feed visibility.",
      fallback: true,
    });
  }
});

// Vite middleware and static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FrameCut Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
