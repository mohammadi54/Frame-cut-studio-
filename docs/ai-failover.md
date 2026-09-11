# AI generation & automatic failover

Gemini is the primary provider for every AI feature in FrameCut Studio. When Gemini
returns a **rate limit, overload, timeout or temporary server error**, the request is
retried and then handed automatically to the next configured provider — with no user
interaction and no change to the UI. The pre-existing static Mohammadi Academy content
in `server.ts` remains the final safety net.

```
POST /api/ai/*  ->  orchestrator
                     1. gemini:gemini-3.8-flash          (primary, GEMINI_MODEL)
                     2. gemini:gemini-3.7-flash          (GEMINI_FALLBACK_MODELS)
                     3. gemini:gemini-3.5-flash
                     4. gemini:gemini-2.5-flash
                     5. openrouter:<model>               (needs OPENROUTER_API_KEY)
                     6. groq:<model>                     (needs GROQ_API_KEY)
                     7. openai:<model>                   (needs OPENAI_API_KEY)
                     8. anthropic:<model>                (needs ANTHROPIC_API_KEY)
                     9. throw AiChainExhaustedError  ->  endpoint catch
                                                        -> static fallback content
                                                           (unchanged, `fallback: true`)
```

## Files

| Path | Role |
| --- | --- |
| `server/ai/orchestrator.ts` | Chain execution: ordering, retries, backoff, deadlines, cooldown, stats. Exposes `generateJSON()` used by every endpoint. |
| `server/ai/errors.ts` | `classifyError()` — decides *retry* vs *advance*; `ProviderError`, `AiChainExhaustedError`, Retry-After parsing. |
| `server/ai/providers.ts` | Adapters: `GeminiProvider` (`@google/genai`), `OpenAiCompatProvider` (OpenRouter/Groq/OpenAI), `AnthropicProvider`, plus `ProviderRegistry.plan()`. |
| `server/ai/config.ts` | Env parsing and defaults; `describeConfig()` for the status endpoint. |
| `server/ai/json.ts` | `parseJsonLoose()` — tolerates markdown fences / surrounding prose from non-Google models. |
| `server.ts` | Endpoints call `generateJSON(...)` instead of `ai.models.generateContent(...)`; adds `GET /api/ai/status`. Prompts and static fallbacks untouched. |
| `scripts/mock-ai-server.ts` | Dev-only mock of all four wire formats with runtime fault injection. |
| `scripts/e2e-failover.mjs` | End-to-end scenario runner (`npm run test:e2e`). |

## Failure classification

| Condition | Class | Action |
| --- | --- | --- |
| 429, `RESOURCE_EXHAUSTED`, "quota exceeded", "too many requests" | transient | retry same target (backoff), then advance |
| 500 / 502 / 503 / 504 / 509 / 529, "overloaded", "unavailable", "try again later" | transient | retry same target (backoff), then advance |
| Per-attempt deadline, `AbortError`, `ETIMEDOUT`, "deadline exceeded" | transient | **advance immediately** (a stalled target rarely recovers within the request) |
| `ECONNRESET`, `EAI_AGAIN`, "socket hang up", "fetch failed", undici socket errors | transient | retry same target, then advance |
| 401 / 403, "API key not valid" | permanent | advance immediately, never retried |
| 404, "model … is not found" | permanent | advance immediately |
| 400 / 413 / 422, unsupported modality, safety block | permanent | advance immediately |
| Output is not usable JSON | permanent | advance immediately (see `parseJsonLoose`) |

Retry-After is honoured when a provider exposes it (the OpenAI-compatible and Anthropic
adapters read the header). The Google SDK does not surface response headers, so Gemini
falls back to the configured backoff curve. Parsed values are capped at 8s and never
sleep past the request budget.

## Timing policy

| Setting | Default | Meaning |
| --- | --- | --- |
| `AI_MAX_RETRIES_PER_TARGET` | `1` | Retries on the same provider+model before advancing |
| `AI_RETRY_BASE_MS` / `AI_RETRY_MAX_MS` | `400` / `4000` | Exponential backoff bounds |
| `AI_RETRY_JITTER` | `true` | Full-ish jitter (0.5–1.0×) to avoid thundering herds |
| `AI_REQUEST_TIMEOUT_MS` | `45000` | Per text attempt deadline (`AbortSignal.timeout`) |
| `AI_AUDIO_TIMEOUT_MS` | `120000` | Per transcription attempt deadline |
| `AI_TOTAL_BUDGET_MS` | `120000` | Whole chain, text endpoints |
| `AI_AUDIO_TOTAL_BUDGET_MS` | `240000` | Whole chain, transcription |
| `AI_COOLDOWN_THRESHOLD` / `AI_COOLDOWN_MS` | `3` / `30000` | Park a target after N consecutive transient failures |

The cooldown is a small in-memory circuit breaker: an overloaded provider stops being
hammered on every request. If *every* target is parked, cooldowns are ignored rather
than failing the request. State is per process and resets on restart.

## Audio (transcription)

`/api/ai/transcribe-video-audio` sends the extracted WAV as `inlineData`. Only
audio-capable providers are planned for that request:

* all Gemini models (native inline audio), and
* OpenAI **only** when `OPENAI_AUDIO_MODEL` is set (sent as an `input_audio` part).

OpenRouter/Groq/Anthropic text models are skipped instead of being handed audio they
would reject. If no audio-capable target succeeds, the endpoint's original static cue
pool is returned with `fallback: true`, exactly as before.

## Configuration

Only `GEMINI_API_KEY` is required. Every alternate provider is activated by its key
alone; without one it is reported as unconfigured and never attempted. See
`.env.example` for the full list, including model cascades:

```bash
GEMINI_API_KEY=...                  # primary
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODELS=gemini-3.7-flash,gemini-3.5-flash,gemini-2.5-flash

OPENROUTER_API_KEY=...              # optional, one key for many models
GROQ_API_KEY=...                    # optional, fast text
OPENAI_API_KEY=...                  # optional (+ OPENAI_AUDIO_MODEL for audio)
ANTHROPIC_API_KEY=...               # optional

AI_FALLBACK_PROVIDER_ORDER=openrouter,groq,openai,anthropic
DISABLE_AI_FAILOVER=false           # true = legacy single-model behaviour
```

Base URLs are overridable per provider (`*_BASE_URL`), which is how the mock backend and
any gateway/proxy are wired in.

## Observability

`GET /api/ai/status` returns the resolved chain, which providers are configured, active
cooldowns and per-target counters (`served`, `transientFailures`, `timeouts`, …). It never
includes key material or request bodies.

Every response now carries three additive fields so a failover is visible without logs:

```json
{ "titles": [...], "provider": "groq", "model": "llama-3.3-70b-versatile", "failover": true }
```

`failover: false` means the primary Gemini model answered. `fallback: true` still means
the static content path ran (no provider could serve the request).

Server logs are single-line and greppable:

```
[ai:ai/title] chain#7 gemini:gemini-3.8-flash attempt 1 -> rate-limit [429] (transient) in 41ms
[ai:ai/title] chain#7 served by groq:llama-3.3-70b-versatile (failover) after 4 failed attempt(s) in 612ms
```

## Compatibility notes

* Response shapes are unchanged; `provider`/`model`/`failover` are additions the UI ignores.
* The two endpoints that returned HTTP 500 when Gemini failed (`complete-subtitles`,
  `translate-subtitles`) still do so **only after** the whole chain has failed. With a
  fallback provider configured they now succeed instead of erroring.
* Prompts, model defaults, the `aistudio-build` User-Agent header and all static
  fallback payloads are byte-identical to the previous implementation.
* No new runtime dependencies: alternates use Node's built-in `fetch`.

## Testing

```bash
npm test           # 36 unit + integration tests (mock wire formats, no network)
npm run lint       # tsc --noEmit
npm run build      # vite build + esbuild server bundle
```

Live end-to-end run against the real HTTP stack:

```bash
npm run mock:ai    # terminal 1: mock providers on 127.0.0.1:4100

# terminal 2: app pointed at the mock
GEMINI_API_KEY=mock GEMINI_BASE_URL=http://127.0.0.1:4100 \
OPENROUTER_API_KEY=mock OPENROUTER_BASE_URL=http://127.0.0.1:4100/openrouter/v1 \
GROQ_API_KEY=mock GROQ_BASE_URL=http://127.0.0.1:4100/groq/v1 \
ANTHROPIC_API_KEY=mock ANTHROPIC_BASE_URL=http://127.0.0.1:4100/anthropic \
npm run dev

npm run test:e2e   # terminal 3: 49 assertions across every fault mode
```

Fault modes switch at runtime, so the app never restarts:

```bash
curl -X POST localhost:4100/__mock/control -H 'content-type: application/json' \
     -d '{"mode":"gemini-overload"}'
curl localhost:4100/__mock/state
```

`healthy` · `gemini-rate-limit` · `gemini-overload` · `gemini-timeout` ·
`gemini-bad-key` · `gemini-flaky` · `all-down`
