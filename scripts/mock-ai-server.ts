/**
 * Development-only mock AI backend used to exercise the failover chain without
 * spending real API quota (and without needing any provider key at all).
 *
 *   npm run mock:ai                 # listens on 127.0.0.1:4100
 *
 * Point the app at it with:
 *   GEMINI_API_KEY=mock GEMINI_BASE_URL=http://127.0.0.1:4100 \
 *   OPENROUTER_API_KEY=mock OPENROUTER_BASE_URL=http://127.0.0.1:4100/openrouter/v1 \
 *   GROQ_API_KEY=mock GROQ_BASE_URL=http://127.0.0.1:4100/groq/v1 \
 *   ANTHROPIC_API_KEY=mock ANTHROPIC_BASE_URL=http://127.0.0.1:4100/anthropic \
 *   npm run dev
 *
 * Fault modes are switched at runtime, so the app never needs a restart:
 *   curl -X POST localhost:4100/__mock/control -H 'content-type: application/json' \
 *        -d '{"mode":"gemini-overload"}'
 *   curl localhost:4100/__mock/state
 *
 *   healthy          every provider answers correctly
 *   gemini-rate-limit Gemini always 429 (+Retry-After) -> alternates serve
 *   gemini-overload  Gemini always 503                 -> alternates serve
 *   gemini-timeout   Gemini stalls                     -> per-attempt timeout fires
 *   gemini-bad-key   Gemini 401 (permanent)            -> immediate advance
 *   gemini-flaky     Gemini 429 once per model, then 200 (retry-on-primary path)
 *   all-down         every provider 503                -> server.ts static fallback
 *
 * Responses are prompt aware, so the UI receives plausible Mohammadi Academy
 * titles, subtitle cues and content kits instead of empty payloads.
 */
import http from 'http';

type Mode =
  | 'healthy'
  | 'gemini-rate-limit'
  | 'gemini-overload'
  | 'gemini-timeout'
  | 'gemini-bad-key'
  | 'gemini-flaky'
  | 'all-down';

const PORT = Number(process.env.MOCK_AI_PORT) || 4100;
const HOST = process.env.MOCK_AI_HOST || '0.0.0.0';

let mode: Mode = (process.env.MOCK_MODE as Mode) || 'healthy';
const flakySeen = new Set<string>();
interface LogEntry {
  seq: number;
  at: string;
  provider: string;
  model: string;
  mode: Mode;
  status: number;
}
const log: LogEntry[] = [];
let seq = 0;
const record = (provider: string, model: string, status: number) => {
  log.push({ seq: ++seq, at: new Date().toISOString(), provider, model, mode, status });
  if (log.length > 400) log.shift();
};

// ---------------------------------------------------------------------------
// Prompt aware payloads (mirrors the shapes server.ts expects)
// ---------------------------------------------------------------------------

function cues(count: number, durationSec: number, persian: boolean) {
  const step = Math.max(1.5, durationSec / Math.max(1, count));
  const fa = [
    { text: 'به آکادمی محمدی خوش آمدید', trans: 'Welcome to Mohammadi Academy', hi: 'محمدی' },
    { text: 'در این درس‌گفتار به بررسی حکمت می‌پردازیم', trans: 'In this lecture we examine wisdom', hi: 'حکمت' },
    { text: 'معرفت و اخلاق دو بال پژوهش‌اند', trans: 'Knowledge and ethics are the two wings of research', hi: 'معرفت' },
    { text: 'منابع تکمیلی در پایگاه رسمی موجود است', trans: 'Supplementary sources are on the official portal', hi: 'پایگاه' },
  ];
  const en = [
    { text: 'Welcome to Mohammadi Academy', hi: 'Academy' },
    { text: 'Today we examine scholarly wisdom', hi: 'wisdom' },
    { text: 'Ethics and knowledge advance together', hi: 'Ethics' },
    { text: 'Full lectures at Mohammadiacademy.org', hi: 'Mohammadiacademy.org' },
  ];
  return Array.from({ length: count }, (_, i) => {
    const start = Number((i * step).toFixed(1));
    const end = i === count - 1 ? Number(durationSec.toFixed(1)) : Number(((i + 1) * step).toFixed(1));
    if (persian) {
      const item = fa[i % fa.length];
      return { id: String(i + 1), start, end, text: item.text, translation: item.trans, highlight: item.hi };
    }
    const item = en[i % en.length];
    return { id: String(i + 1), start, end, text: item.text, highlight: item.hi };
  });
}

function payloadFor(prompt: string, provider: string): unknown {
  const p = prompt.toLowerCase();
  const durationMatch = prompt.match(/(\d+(?:\.\d+)?)\s*seconds|duration\s*(\d+(?:\.\d+)?)/i);
  const duration = Number(durationMatch?.[1] || durationMatch?.[2] || 15);
  const persian = /فارسی|persian|bilingual/i.test(prompt);
  const tag = `[${provider}]`;

  if (p.includes('subtitle timing and completion engine')) {
    return cues(4, Math.max(4, duration), persian);
  }
  if (p.includes('transcription engine') || p.includes('subtitle transcription')) {
    return cues(Math.max(4, Math.ceil(duration / 3.2)), duration, persian);
  }
  if (p.includes('expert translator')) {
    return cues(4, 12, persian);
  }
  if (p.includes('video title variations')) {
    return [
      { title: `${tag} آکادمی محمدی | درس‌گفتار تخصصی`, style: 'Scholarly Persian' },
      { title: `${tag} Mohammadi Academy • Wisdom & Research`, style: 'English Academic' },
      { title: `${tag} حکمت و اخلاق اسلامی | Mohammadiacademy.org`, style: 'Islamic Ethics' },
      { title: `${tag} تدبر در معارف قرآن کریم`, style: 'Quranic Reflection' },
      { title: `${tag} Mohammadi Academy | علم و معرفت`, style: 'Bilingual Official' },
    ];
  }
  if (p.includes('posting kit')) {
    return {
      youtubeDescription: `${tag} 🏛️ پایگاه رسمی آکادمی محمدی\n\n🌐 https://Mohammadiacademy.org\n\n#آکادمی_محمدی #MohammadiAcademy`,
      facebookCaption: `${tag} ✨ گزیده‌ای از درس‌گفتارهای آکادمی محمدی (Mohammadiacademy.org).`,
      hashtags: ['#MohammadiAcademy', '#آکادمی_محمدی', '#Mohammadiacademy_org', '#حکمت_و_معرفت'],
    };
  }
  if (p.includes('framing and cut settings')) {
    return {
      recommendedBorder: 'glass',
      recommendedBackground: 'blur-video',
      suggestedScale: 0.86,
      suggestedOffsetY: 0,
      silenceMarkers: [],
      sceneCuts: [Number((duration / 2).toFixed(1))],
      reasoning: `${tag} Framed with a glass border over a blurred backdrop to keep scholarly focus on the speaker.`,
    };
  }
  return { ok: true, provider: tag };
}

// ---------------------------------------------------------------------------
// Wire formats
// ---------------------------------------------------------------------------

function envelope(provider: string, model: string, payload: unknown): string {
  const text = JSON.stringify(payload);
  if (provider === 'gemini') {
    return JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
      modelVersion: model,
    });
  }
  if (provider === 'anthropic') {
    return JSON.stringify({
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
    });
  }
  return JSON.stringify({
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
  });
}

function promptOf(provider: string, body: any): string {
  if (provider === 'gemini') {
    const contents = Array.isArray(body?.contents) ? body.contents : [];
    return contents
      .map((c: any) => (Array.isArray(c?.parts) ? c.parts.map((p: any) => p?.text || '').join('\n') : ''))
      .join('\n');
  }
  if (provider === 'anthropic') {
    return [body?.system || '', ...(Array.isArray(body?.messages) ? body.messages : []).map((m: any) => m?.content || '')].join('\n');
  }
  return (Array.isArray(body?.messages) ? body.messages : []).map((m: any) => m?.content || '').join('\n');
}

/** Decide the HTTP outcome for a target under the current fault mode. */
function outcomeFor(provider: string, model: string): { status: number; retryAfter?: string; stall?: boolean } {
  const isGemini = provider === 'gemini';
  switch (mode) {
    case 'gemini-rate-limit':
      return isGemini ? { status: 429, retryAfter: '1' } : { status: 200 };
    case 'gemini-overload':
      return isGemini ? { status: 503 } : { status: 200 };
    case 'gemini-timeout':
      return isGemini ? { status: 200, stall: true } : { status: 200 };
    case 'gemini-bad-key':
      return isGemini ? { status: 401 } : { status: 200 };
    case 'gemini-flaky': {
      const key = `${provider}:${model}`;
      if (isGemini && !flakySeen.has(key)) {
        flakySeen.add(key);
        return { status: 429, retryAfter: '1' };
      }
      return { status: 200 };
    }
    case 'all-down':
      return { status: 503 };
    case 'healthy':
    default:
      return { status: 200 };
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // ---- control plane ---------------------------------------------------
  if (url.startsWith('/__mock/')) {
    if (url.startsWith('/__mock/control') && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(raw || '{}');
          if (parsed.mode) mode = parsed.mode as Mode;
          if (parsed.resetFlaky) flakySeen.clear();
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, mode }));
        } catch (err: any) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }
    if (url.startsWith('/__mock/reset')) {
      mode = 'healthy';
      flakySeen.clear();
      log.length = 0;
      seq = 0;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode }));
      return;
    }
    // `/__mock/requests?after=N` lets the E2E harness diff exactly the requests
    // a single scenario produced (the old "last 25" window lost entries).
    if (url.startsWith('/__mock/requests')) {
      const after = Number(new URL(url, 'http://localhost').searchParams.get('after') || 0);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode, lastSeq: seq, requests: log.filter((e) => e.seq > after) }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode, port: PORT, lastSeq: seq, recentRequests: log.slice(-25) }));
    return;
  }

  // ---- provider plane --------------------------------------------------
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = {};
    }

    let provider = 'unknown';
    let model = 'unknown';
    const geminiMatch = url.match(/\/models\/([^/]+):generateContent$/);
    if (geminiMatch) {
      provider = 'gemini';
      model = decodeURIComponent(geminiMatch[1]);
    } else if (url.endsWith('/chat/completions')) {
      provider = url.includes('/groq') ? 'groq' : url.includes('/openai') ? 'openai' : 'openrouter';
      model = String(body?.model || 'unknown');
    } else if (url.endsWith('/v1/messages')) {
      provider = 'anthropic';
      model = String(body?.model || 'unknown');
    }

    const outcome = outcomeFor(provider, model);
    const finish = (status: number, payloadText: string, headers: Record<string, string> = {}) => {
      record(provider, model, status);
      console.log(`[mock-ai] ${provider}:${model} mode=${mode} -> ${status}`);
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(payloadText);
    };

    if (outcome.stall) {
      // Never responds in time: forces the orchestrator's per-attempt timeout.
      console.log(`[mock-ai] ${provider}:${model} mode=${mode} -> stalling (no response)`);
      record(provider, model, 0);
      return;
    }

    if (outcome.status !== 200) {
      const errorBody =
        provider === 'anthropic'
          ? JSON.stringify({ type: 'error', error: { type: outcome.status === 429 ? 'rate_limit_error' : 'overloaded_error', message: `mock ${outcome.status}` } })
          : JSON.stringify({
              error: {
                code: outcome.status,
                message:
                  outcome.status === 429
                    ? 'You exceeded your current quota. Please check your plan and billing details.'
                    : outcome.status === 401
                      ? 'API key not valid. Please pass a valid API key.'
                      : 'The model is overloaded. Please try again later.',
                status: outcome.status === 429 ? 'RESOURCE_EXHAUSTED' : outcome.status === 503 ? 'UNAVAILABLE' : 'ERROR',
              },
            });
      finish(outcome.status, errorBody, outcome.retryAfter ? { 'retry-after': outcome.retryAfter } : {});
      return;
    }

    finish(200, envelope(provider, model, payloadFor(promptOf(provider, body), provider)));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-ai] listening on http://${HOST}:${PORT} (mode=${mode})`);
  console.log('[mock-ai] switch faults: curl -X POST localhost:%d/__mock/control -d \'{"mode":"gemini-overload"}\'', PORT);
});
