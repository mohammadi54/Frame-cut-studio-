/**
 * End-to-end check of the AI failover chain against a running app + mock
 * provider backend. Nothing here is used in production; it exists so the
 * behaviour required by the failover work can be re-verified in one command.
 *
 *   1. npm run mock:ai                                  (port 4100)
 *   2. start the app with the mock env vars              (port 3000)
 *   3. npm run test:e2e
 *
 * Each scenario switches the mock's fault mode at runtime, calls a real
 * endpoint, and asserts which provider served it.
 */

const APP = process.env.APP_URL_E2E || 'http://127.0.0.1:3000';
const MOCK = process.env.MOCK_URL_E2E || 'http://127.0.0.1:4100';

let failures = 0;
let checks = 0;

function check(name, condition, detail = '') {
  checks++;
  if (condition) {
    console.log(`  \u2713 ${name}`);
  } else {
    failures++;
    console.log(`  \u2717 ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function setMode(mode) {
  const res = await fetch(`${MOCK}/__mock/control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, resetFlaky: true }),
  });
  const data = await res.json();
  if (data.mode !== mode) throw new Error(`mock refused mode ${mode}`);
}

async function mockState() {
  const res = await fetch(`${MOCK}/__mock/state`);
  return res.json();
}

/** Sequence cursor: everything logged after the returned mark belongs to one scenario. */
async function markRequests() {
  const state = await mockState();
  return state.lastSeq ?? 0;
}

async function requestsSince(mark) {
  const res = await fetch(`${MOCK}/__mock/requests?after=${mark}`);
  const data = await res.json();
  return data.requests || [];
}

async function call(path, body) {
  const started = Date.now();
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, ms: Date.now() - started };
}

const titleBody = { topic: 'حکمت و اخلاق در اسلام', platform: 'YouTube Shorts', mood: 'scholarly' };
const subtitleBody = { title: 'درس‌گفتار آکادمی محمدی', duration: 18, language: 'bilingual' };
const contentKitBody = { title: 'آکادمی محمدی | حکمت', platform: 'YouTube Shorts', duration: 18 };
const translateBody = {
  subtitles: [{ id: '1', start: 0, end: 3, text: 'Welcome to Mohammadi Academy', highlight: 'Academy' }],
  targetLanguage: 'Persian',
};
const completeBody = { startTime: 6, endTime: 18, duration: 18, language: 'fa', title: 'درس‌گفتار' };
const analysisBody = { aspectCategory: '9:16', videoWidth: 1080, videoHeight: 1920, duration: 18, platform: 'Shorts' };
const audioBody = {
  // Tiny valid-looking WAV header + silence, enough for the endpoint's length check.
  audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  mimeType: 'audio/wav',
  language: 'fa',
  duration: 12,
  title: 'درس‌گفتار آکادمی محمدی',
};

async function main() {
  console.log(`\nE2E failover check\n  app:  ${APP}\n  mock: ${MOCK}\n`);

  const health = await fetch(`${APP}/api/health`).then((r) => r.json());
  check('app health endpoint responds', health.status === 'ok', JSON.stringify(health));

  const status = await fetch(`${APP}/api/ai/status`).then((r) => r.json());
  console.log('\n[1] /api/ai/status');
  check('reports Gemini as the primary provider', status.config?.primary?.id === 'gemini');
  check('primary chain starts with gemini-3.8-flash', /gemini:gemini-3\.8-flash \(primary\)/.test(status.chain?.text?.[0] || ''), status.chain?.text?.[0]);
  check('text chain includes configured fallbacks', (status.chain?.text || []).some((t) => t.startsWith('openrouter:')), JSON.stringify(status.chain?.text));
  check('audio chain excludes text-only providers', (status.chain?.audio || []).every((t) => t.startsWith('gemini:') || t.startsWith('openai:')), JSON.stringify(status.chain?.audio));
  check('unconfigured OpenAI is reported, not hidden', (status.providers || []).some((p) => p.id === 'openai' && p.configured === false));
  check('status never leaks key material', !JSON.stringify(status).includes('mock-gemini-key'));

  console.log('\n[2] healthy -> primary Gemini serves everything');
  await setMode('healthy');
  let r = await call('/api/ai/title', titleBody);
  check('titles served by gemini primary', r.json?.provider === 'gemini' && r.json?.model === 'gemini-3.8-flash' && r.json?.failover === false, JSON.stringify(r.json?.provider));
  check('titles payload intact', Array.isArray(r.json?.titles) && r.json.titles.length === 5, `len=${r.json?.titles?.length}`);
  check('no static fallback flag', r.json?.fallback === undefined);

  r = await call('/api/ai/subtitles', subtitleBody);
  check('subtitles served by gemini primary', r.json?.provider === 'gemini' && r.json?.failover === false);
  check('subtitles payload intact', Array.isArray(r.json?.subtitles) && r.json.subtitles.length > 0);

  r = await call('/api/ai/content-kit', contentKitBody);
  check('content kit keeps its original keys', typeof r.json?.youtubeDescription === 'string' && Array.isArray(r.json?.hashtags), Object.keys(r.json || {}).join(','));
  check('content kit annotated with provider', r.json?.provider === 'gemini');

  r = await call('/api/ai/smart-analysis', analysisBody);
  check('smart analysis keeps its original keys', typeof r.json?.recommendedBorder === 'string' && typeof r.json?.reasoning === 'string');

  r = await call('/api/ai/translate-subtitles', translateBody);
  check('translate returns 200 on the happy path', r.status === 200 && Array.isArray(r.json?.subtitles), `status=${r.status}`);

  r = await call('/api/ai/complete-subtitles', completeBody);
  check('complete-subtitles returns 200 on the happy path', r.status === 200 && r.json?.success === true, `status=${r.status}`);

  console.log('\n[3] gemini-flaky -> retried on the PRIMARY model (no failover needed)');
  await setMode('gemini-flaky');
  r = await call('/api/ai/title', titleBody);
  check('recovered on gemini-3.8-flash after a 429', r.json?.provider === 'gemini' && r.json?.model === 'gemini-3.8-flash', `${r.json?.provider}:${r.json?.model}`);
  check('response is not flagged as failover', r.json?.failover === false);
  check('titles still generated', Array.isArray(r.json?.titles) && r.json.titles.length === 5);

  console.log('\n[4] gemini-rate-limit (429 + Retry-After) -> automatic failover');
  await setMode('gemini-rate-limit');
  r = await call('/api/ai/title', titleBody);
  check('titles served by a fallback provider', r.json?.failover === true && r.json?.provider !== 'gemini', `${r.json?.provider}:${r.json?.model}`);
  check('fallback still returns 5 titles', Array.isArray(r.json?.titles) && r.json.titles.length === 5, `len=${r.json?.titles?.length}`);
  check('no static fallback flag on a successful failover', r.json?.fallback === undefined);

  r = await call('/api/ai/subtitles', subtitleBody);
  check('subtitles fail over too', r.json?.failover === true && Array.isArray(r.json?.subtitles) && r.json.subtitles.length > 0);

  console.log('\n[5] gemini-overload (503) -> failover, both Gemini models tried first');
  await setMode('gemini-overload');
  let mark = await markRequests();
  r = await call('/api/ai/content-kit', contentKitBody);
  check('content kit served by a fallback provider', r.json?.failover === true && r.json?.provider !== 'gemini', `${r.json?.provider}`);
  check('content kit payload shape preserved', typeof r.json?.youtubeDescription === 'string' && Array.isArray(r.json?.hashtags));
  let scenario = await requestsSince(mark);
  const geminiModels = scenario.filter((x) => x.provider === 'gemini').map((x) => x.model);
  check('every Gemini model was attempted before leaving Google', geminiModels.length >= 2 && geminiModels[0] === 'gemini-3.8-flash', JSON.stringify(geminiModels));
  check('Gemini attempts all came before the fallback attempt', scenario.map((x) => x.provider).lastIndexOf('gemini') < scenario.findIndex((x) => x.provider !== 'gemini'), JSON.stringify(scenario.map((x) => x.provider)));

  console.log('\n[6] gemini-bad-key (401, permanent) -> advances immediately, no wasted retries');
  await setMode('gemini-bad-key');
  mark = await markRequests();
  r = await call('/api/ai/translate-subtitles', translateBody);
  scenario = await requestsSince(mark);
  const geminiAuth = scenario.filter((x) => x.provider === 'gemini');
  check('translation now succeeds via a fallback provider (used to be a hard 500)', r.status === 200 && Array.isArray(r.json?.subtitles), `status=${r.status}`);
  check('failover flag set', r.json?.failover === true);
  check(
    'each Gemini model hit exactly once (a 401 is never retried)',
    geminiAuth.length >= 2 && new Set(geminiAuth.map((x) => x.model)).size === geminiAuth.length,
    JSON.stringify(geminiAuth.map((x) => `${x.model}:${x.status}`))
  );
  check('all Gemini failures were 401', geminiAuth.every((x) => x.status === 401));
  check('first fallback provider then served it', scenario.find((x) => x.provider !== 'gemini')?.status === 200);

  console.log('\n[7] gemini-timeout -> per-attempt deadline fires, chain moves on');
  await setMode('gemini-timeout');
  mark = await markRequests();
  r = await call('/api/ai/smart-analysis', analysisBody);
  scenario = await requestsSince(mark);
  check('analysis served after Gemini stalled', r.json?.failover === true && r.json?.provider !== 'gemini', `${r.json?.provider}`);
  check('analysis payload intact', typeof r.json?.recommendedBorder === 'string');
  const stalled = scenario.filter((x) => x.provider === 'gemini');
  check(
    'a stalled model is not retried (advances straight to the next target)',
    new Set(stalled.map((x) => x.model)).size === stalled.length,
    JSON.stringify(stalled.map((x) => x.model))
  );
  check('request returned within the timeout budget', r.ms < 20000, `${r.ms}ms`);

  console.log('\n[8] audio transcription: inline audio stays on audio-capable providers');
  await setMode('gemini-overload');
  mark = await markRequests();
  r = await call('/api/ai/transcribe-video-audio', audioBody);
  scenario = await requestsSince(mark);
  check('only audio-capable providers were attempted', scenario.length > 0 && scenario.every((x) => x.provider === 'gemini'), JSON.stringify(scenario.map((x) => `${x.provider}:${x.model}`)));
  check('text-only providers were never sent the audio', scenario.filter((x) => x.provider !== 'gemini').length === 0);
  check('existing static cue fallback still served the request', r.json?.fallback === true && Array.isArray(r.json?.subtitles) && r.json.subtitles.length > 0, JSON.stringify(Object.keys(r.json || {})));
  check('static cues still cover the video duration', r.json?.subtitles?.[r.json.subtitles.length - 1]?.end >= 11.5, `end=${r.json?.subtitles?.[r.json.subtitles.length - 1]?.end}`);

  console.log('\n[9] all-down -> every provider fails, legacy static fallbacks still run');
  await setMode('all-down');
  r = await call('/api/ai/title', titleBody);
  check('titles fall back to the static Mohammadi Academy set', r.json?.fallback === true && Array.isArray(r.json?.titles) && r.json.titles.length === 5);
  check('static titles are the original ones', (r.json?.titles || []).some((t) => t.title.includes('آکادمی محمدی')));

  r = await call('/api/ai/smart-analysis', analysisBody);
  check('smart analysis static fallback preserved', r.json?.fallback === true && r.json?.recommendedBorder === 'rounded');

  r = await call('/api/ai/subtitles', subtitleBody);
  check('subtitle static fallback preserved', r.json?.fallback === true && Array.isArray(r.json?.subtitles) && r.json.subtitles.length > 0);

  r = await call('/api/ai/complete-subtitles', completeBody);
  check('complete-subtitles still returns its original 500 contract', r.status === 500 && typeof r.json?.error === 'string', `status=${r.status}`);

  r = await call('/api/ai/translate-subtitles', translateBody);
  check('translate-subtitles still returns its original 500 contract', r.status === 500 && typeof r.json?.error === 'string', `status=${r.status}`);

  console.log('\n[10] app still serves the frontend');
  const page = await fetch(`${APP}/`);
  const html = await page.text();
  check('index.html served (200)', page.status === 200 && html.includes('FrameCut Studio'), `status=${page.status}`);
  const module = await fetch(`${APP}/src/main.tsx`);
  check('vite dev pipeline still transforms app code', module.status === 200);

  await setMode('healthy');
  console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nE2E run failed:', err.message);
  process.exit(1);
});
