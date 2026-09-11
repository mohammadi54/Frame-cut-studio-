import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { generateJSON, getAiStatus, initAi } from "./server/ai/orchestrator";
import type { AiResult } from "./server/ai/orchestrator";

dotenv.config();

// Builds the provider chain once: Gemini primary, then the env-gated alternates
// (OpenRouter / Groq / OpenAI / Anthropic). See server/ai/ for the policy.
initAi(process.env);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));

/**
 * Response annotation helpers.
 *
 * `aiMeta` records which provider/model actually served a request so a silent
 * failover is visible in the network tab and in server logs. The fields are
 * additive; every existing response key (and the static `fallback: true`
 * payloads below) is preserved exactly as before.
 */
function aiMeta(result: AiResult) {
  return {
    provider: result.provider,
    model: result.model,
    failover: result.usedFailover,
  };
}

function withAiMeta(payload: any, result: AiResult) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...payload, ...aiMeta(result) };
  }
  return payload;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// AI provider / failover status. Reports the configured chain, cooldowns and
// per-target counters. Never exposes API keys or request bodies.
app.get("/api/ai/status", (req, res) => {
  try {
    res.json(getAiStatus());
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Failed to read AI status" });
  }
});

// AI Title Generator tailored for Mohammadi Academy
app.post("/api/ai/title", async (req, res) => {
  try {
    const { topic, platform, currentTitle, mood, language } = req.body;
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

    // Gemini first; transient Gemini failures (429/500/502/503/504/timeouts)
    // automatically fail over to the configured alternate providers.
    const result = await generateJSON({ label: "ai/title", prompt, defaultJson: "[]" });

    const parsed = result.json;
    res.json({ titles: parsed, ...aiMeta(result) });
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

    const result = await generateJSON({ label: "ai/content-kit", prompt, defaultJson: "{}" });

    const parsed = result.json;
    res.json(withAiMeta(parsed, result));
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
    const vidDuration = Math.max(3, Number(duration) || 15);
    const lang = language || 'fa';
    const estimatedCues = Math.max(3, Math.ceil(vidDuration / 3.2));

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

CRITICAL REQUIREMENT - FULL DURATION COVERAGE:
- You MUST generate subtitles that span across the ENTIRE video duration, from 0.0 seconds all the way to ${vidDuration.toFixed(1)} seconds!
- Generate approximately ${estimatedCues} consecutive cues.
- The first cue MUST start at 0.0s.
- The final cue MUST end between ${(vidDuration - 0.5).toFixed(1)}s and ${vidDuration.toFixed(1)}s.
- Do NOT stop after only 10, 15, or 20 seconds. Ensure every part of the video has active subtitle cues without large dead gaps.

Output strictly valid JSON with an array of subtitle objects:
[
  {
    "id": "1",
    "start": 0.0,
    "end": 3.0,
    "text": "...",
    ${lang === 'bilingual' ? '"translation": "...",' : ''}
    "highlight": "..."
  }
]
Rules:
- Keep phrases concise (3 to 6 words per line).
- Cues must be contiguous with natural pacing (each cue approx 2.5 to 3.8 seconds).`;

    const result = await generateJSON({ label: "ai/subtitles", prompt, defaultJson: "[]" });

    const parsed = result.json;
    res.json({ subtitles: parsed, ...aiMeta(result) });
  } catch (error: any) {
    console.error("AI Subtitles error:", error);
    const vidDuration = Math.max(3, Number(req.body.duration) || 15);
    const lang = req.body.language || 'fa';
    const isFa = lang === 'fa' || lang === 'bilingual';
    const cueCount = Math.max(3, Math.ceil(vidDuration / 3.5));
    const step = vidDuration / cueCount;

    const phrasesFa = [
      { text: "به آکادمی محمدی خوش آمدید", trans: "Welcome to Mohammadi Academy", hi: "محمدی" },
      { text: "مرکز تخصصی آموزش و پژوهش‌های علمی", trans: "Center for Specialized Research & Education", hi: "پژوهش‌های" },
      { text: "یادگیری حکمت، اخلاق و معارف راستین", trans: "Learning Wisdom, Ethics & Knowledge", hi: "حکمت" },
      { text: "بررسی عمیق پرسش‌های فکری و معنوی", trans: "In-depth Study of Philosophical & Spiritual Questions", hi: "معنوی" },
      { text: "گسترش بینش عقلانی در جامعه معاصر", trans: "Expanding Rational Insight in Modern Society", hi: "عقلانی" },
      { text: "دریافت مقالات تکمیلی و درس‌گفتارها", trans: "Access Supplementary Articles & Lectures", hi: "درس‌گفتارها" },
      { text: "پایگاه رسمی ما: Mohammadiacademy.org", trans: "Official Portal: Mohammadiacademy.org", hi: "Mohammadiacademy.org" },
    ];

    const phrasesEn = [
      { text: "Welcome to Mohammadi Academy", hi: "Academy" },
      { text: "Dedicated to academic excellence & wisdom", hi: "wisdom" },
      { text: "Explore in-depth lectures and courses", hi: "lectures" },
      { text: "Advancing scholarly research & critical thought", hi: "research" },
      { text: "Connecting tradition with contemporary inquiry", hi: "inquiry" },
      { text: "Discover our full series of academic studies", hi: "studies" },
      { text: "Visit us at Mohammadiacademy.org", hi: "Mohammadiacademy.org" },
    ];

    const subtitles = [];
    for (let i = 0; i < cueCount; i++) {
      const start = Number((i * step).toFixed(1));
      const end = i === cueCount - 1 ? Number(vidDuration.toFixed(1)) : Number(((i + 1) * step).toFixed(1));
      if (isFa) {
        const p = phrasesFa[i % phrasesFa.length];
        subtitles.push({
          id: String(i + 1),
          start,
          end,
          text: p.text,
          translation: lang === 'bilingual' ? p.trans : undefined,
          highlight: p.hi,
        });
      } else {
        const p = phrasesEn[i % phrasesEn.length];
        subtitles.push({
          id: String(i + 1),
          start,
          end,
          text: p.text,
          highlight: p.hi,
        });
      }
    }

    res.json({ subtitles, fallback: true });
  }
});

// AI Video Audio Transcription Endpoint: Transcribes speaker voice from audio buffer
app.post("/api/ai/transcribe-video-audio", async (req, res) => {
  try {
    const { audioBase64, mimeType, language, duration, title } = req.body;
    const vidDuration = Math.max(3, Number(duration) || 15);
    const lang = language || 'fa';
    const estimatedCues = Math.max(3, Math.ceil(vidDuration / 3.2));

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
Your task is to transcribe the speech across the FULL duration of the video and output precisely timed subtitles synchronized with the video.
Video Title Context: "${title || "Mohammadi Academy Lecture"}"
Total Video Duration: ${vidDuration} seconds.

Language Requirement:
${langInstruction}

CRITICAL DURATION RULE:
1. Subtitles MUST cover the entire video timeline from 0.0 seconds all the way up to ${vidDuration.toFixed(1)} seconds!
2. Do NOT stop after only the opening remarks. The cues must continue through the middle and all the way to ${vidDuration.toFixed(1)}s (expecting ~${estimatedCues} cues).
3. If speech pauses or concludes before the video ends, provide closing/concluding academic subtitles for Mohammadi Academy so the entire video remains subtitled.
4. "start" and "end" must be numbers in seconds.
5. "id" must be sequential string ("1", "2", ...).

JSON format:
[
  {
    "id": "1",
    "start": 0.0,
    "end": 2.8,
    "text": "...",
    ${lang === 'bilingual' ? '"translation": "...",' : ''}
    "highlight": "..."
  }
]`;

    const hasAudio = Boolean(audioBase64 && audioBase64.length > 50);
    const audioBufferClean = hasAudio
      ? audioBase64.includes(",")
        ? audioBase64.split(",")[1]
        : audioBase64
      : null;

    // Gemini still receives the inline audio waveform exactly as before. Audio
    // requests only fail over to providers that accept inline audio (extra
    // Gemini models, plus OpenAI when OPENAI_AUDIO_MODEL is configured);
    // everything else keeps the original text-only prompt branch, and the
    // static cue pool below remains the final safety net.
    const result = await generateJSON({
      label: "ai/transcribe-video-audio",
      prompt: hasAudio
        ? systemPrompt
        : systemPrompt + `\nNo direct audio waveform available; generate authentic Mohammadi Academy lecture speech cues continuously covering the entire ${vidDuration}s duration.`,
      audio: audioBufferClean
        ? { mimeType: mimeType || "audio/wav", dataBase64: audioBufferClean }
        : undefined,
      defaultJson: "[]",
    });

    const parsed = result.json;
    res.json({ subtitles: parsed, success: true, ...aiMeta(result) });
  } catch (error: any) {
    console.error("AI Audio Transcription error:", error);
    const vidDuration = Math.max(3, Number(req.body.duration) || 15);
    const lang = req.body.language || 'fa';
    const isFa = lang === 'fa' || lang === 'bilingual';
    const cueCount = Math.max(3, Math.ceil(vidDuration / 3.5));
    const step = vidDuration / cueCount;

    const subtitles = [];
    const poolFa = [
      { text: "به آکادمی محمدی خوش آمدید", trans: "Welcome to Mohammadi Academy", hi: "محمدی" },
      { text: "آموزش و پژوهش‌های تخصصی معارف اسلامی", trans: "Specialized Islamic Research & Studies", hi: "پژوهش‌های" },
      { text: "راهی به‌سوی اندیشه، معرفت و اخلاق", trans: "A Path Toward Thought & Ethics", hi: "معرفت" },
      { text: "بررسی ابعاد گوناگون حکمت و عقلانیت", trans: "Exploring Dimensions of Wisdom & Rationality", hi: "حکمت" },
      { text: "آشنایی با مباحث بنیادی علوم انسانی", trans: "Foundational Themes in Human Sciences", hi: "علوم" },
      { text: "مشاهده کامل دروس: Mohammadiacademy.org", trans: "Watch full lectures: Mohammadiacademy.org", hi: "Mohammadiacademy.org" },
    ];

    const poolEn = [
      { text: "Welcome to Mohammadi Academy", hi: "Academy" },
      { text: "Exploring profound wisdom and knowledge", hi: "wisdom" },
      { text: "Guided lectures and scholarly studies", hi: "lectures" },
      { text: "Advancing ethical reflection & critical inquiry", hi: "inquiry" },
      { text: "Connecting global knowledge with timeless insight", hi: "insight" },
      { text: "Official Portal: Mohammadiacademy.org", hi: "Mohammadiacademy.org" },
    ];

    for (let i = 0; i < cueCount; i++) {
      const start = Number((i * step).toFixed(1));
      const end = i === cueCount - 1 ? Number(vidDuration.toFixed(1)) : Number(((i + 1) * step).toFixed(1));
      if (isFa) {
        const item = poolFa[i % poolFa.length];
        subtitles.push({
          id: String(i + 1),
          start,
          end,
          text: item.text,
          translation: lang === 'bilingual' ? item.trans : undefined,
          highlight: item.hi,
        });
      } else {
        const item = poolEn[i % poolEn.length];
        subtitles.push({
          id: String(i + 1),
          start,
          end,
          text: item.text,
          highlight: item.hi,
        });
      }
    }

    res.json({
      subtitles,
      fallback: true,
      error: error.message,
    });
  }
});

// AI Subtitles Completion: Fills subtitles for the remaining part of the video
app.post("/api/ai/complete-subtitles", async (req, res) => {
  try {
    const { startTime, endTime, language, title, existingSubtitles } = req.body;
    const start = Number(startTime) || 0;
    const end = Math.max(start + 1, Number(endTime) || (start + 10));
    const lang = language || 'fa';
    const span = end - start;
    const targetCount = Math.max(1, Math.ceil(span / 3.2));

    const prompt = `You are a subtitle timing and completion engine for Mohammadi Academy (Mohammadiacademy.org).
The user needs subtitle cues to fill the REMAINING portion of a video between ${start.toFixed(1)}s and ${end.toFixed(1)}s.
Context:
- Video Title: "${title || "Mohammadi Academy Lecture"}"
- Previous subtitle cues ended at: ${start.toFixed(1)}s
- Final video target time: ${end.toFixed(1)}s
- Language: ${lang} (${lang === 'fa' ? 'Persian only' : lang === 'bilingual' ? 'Bilingual Persian + English translation' : 'English'})

Requirements:
1. Generate approximately ${targetCount} subtitle cues.
2. The first new cue must start at ${start.toFixed(1)}s.
3. The final cue must end at exactly ${end.toFixed(1)}s.
4. Keep the theme cohesive with Mohammadi Academy's educational and scholarly mission.
5. Return strictly a JSON array of subtitle items:
[
  {
    "id": "fill-1",
    "start": ${start.toFixed(1)},
    "end": ${(start + (span / targetCount)).toFixed(1)},
    "text": "...",
    ${lang === 'bilingual' ? '"translation": "...",' : ''}
    "highlight": "..."
  }
]`;

    const result = await generateJSON({
      label: "ai/complete-subtitles",
      prompt,
      defaultJson: "[]",
    });

    const parsed = result.json;
    res.json({ subtitles: parsed, success: true, ...aiMeta(result) });
  } catch (err: any) {
    console.error("Complete subtitles error:", err);
    res.status(500).json({ error: err.message || "Failed to complete subtitles" });
  }
});

// AI Subtitle Translation between Persian and English
app.post("/api/ai/translate-subtitles", async (req, res) => {
  try {
    const { subtitles, targetLanguage } = req.body;

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

    const result = await generateJSON({
      label: "ai/translate-subtitles",
      prompt,
      defaultJson: "[]",
    });

    const parsed = result.json;
    res.json({ subtitles: parsed, ...aiMeta(result) });
  } catch (error: any) {
    console.error("AI Translation error:", error);
    res.status(500).json({ error: error.message || "Failed to translate subtitles" });
  }
});

// AI Smart Framing & Scene Cut Analysis
app.post("/api/ai/smart-analysis", async (req, res) => {
  try {
    const { aspectCategory, videoWidth, videoHeight, duration, platform } = req.body;

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

    const result = await generateJSON({ label: "ai/smart-analysis", prompt, defaultJson: "{}" });

    const parsed = result.json;
    res.json(withAiMeta(parsed, result));
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
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Attach Vite's HMR websocket to this same HTTP server so hot reload
        // also works behind single-port preview proxies.
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`FrameCut Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
