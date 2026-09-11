/**
 * AI provider adapters + registry.
 *
 *   gemini     -> primary, via @google/genai (same client options as before:
 *                 apiKey from GEMINI_API_KEY and the "aistudio-build"
 *                 User-Agent telemetry header).
 *   openrouter -> OpenAI-compatible /chat/completions
 *   groq       -> OpenAI-compatible /chat/completions
 *   openai     -> OpenAI-compatible /chat/completions (+ opt-in inline audio)
 *   anthropic  -> /v1/messages
 *
 * Adapters only translate a request into provider wire format and return the
 * raw text. Retries, classification, cooldowns and ordering live in
 * orchestrator.ts. Providers without an API key are inert: they are reported as
 * unconfigured and never attempted, so the app keeps working with only
 * GEMINI_API_KEY present.
 */
import { GoogleGenAI } from '@google/genai';
import { AiConfig, DEFAULT_FALLBACK_ORDER, ProviderConfig, openAiAudioModel } from './config';
import { ProviderError, providerErrorFromResponse } from './errors';

export type AiCapability = 'text' | 'audio';

export interface AiRequest {
  /** Endpoint name, used in logs (e.g. 'ai/title'). */
  label: string;
  /** Instruction text. Kept byte-identical to the prompts already in server.ts. */
  prompt: string;
  /** Optional system instruction (today's endpoints inline everything). */
  systemPrompt?: string;
  /** Inline audio for the transcription endpoint. */
  audio?: { mimeType: string; dataBase64: string };
  /** Ask for structured JSON output. Defaults to true. */
  json?: boolean;
  /** Legacy `JSON.parse(response.text || defaultJson)` behaviour. */
  defaultJson?: string;
  /** Per-attempt deadline override. */
  timeoutMs?: number;
}

export interface AiProvider {
  readonly id: string;
  readonly config: ProviderConfig;
  /** Models this provider can serve for the given capability. */
  modelsFor(capability: AiCapability): string[];
  /** Returns raw model text. Throws ProviderError on failure. */
  generate(model: string, request: AiRequest, signal: AbortSignal): Promise<string>;
}

/** One provider+model pair in the failover chain. */
export interface PlanTarget {
  provider: AiProvider;
  model: string;
  /** True only for the very first Gemini model in the chain. */
  primary: boolean;
}

const JSON_SUFFIX = '\n\nRespond with strictly valid JSON only. No markdown fences, no commentary.';

async function readBodySnippet(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Gemini (primary)
// ---------------------------------------------------------------------------

export class GeminiProvider implements AiProvider {
  readonly id = 'gemini';
  readonly config: ProviderConfig;
  private client: GoogleGenAI | null = null;
  /** Optional SDK-level timeout; the orchestrator also arms an AbortSignal. */
  private readonly timeoutMs?: number;

  constructor(config: ProviderConfig, options: { timeoutMs?: number } = {}) {
    this.config = config;
    this.timeoutMs = options.timeoutMs;
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: this.config.apiKey,
        httpOptions: {
          baseUrl: this.config.baseUrl,
          // Preserved from the original server.ts client (required telemetry).
          headers: { 'User-Agent': 'aistudio-build' },
          ...(this.timeoutMs ? { timeout: this.timeoutMs } : {}),
        },
      });
    }
    return this.client;
  }

  modelsFor(_capability: AiCapability): string[] {
    // Gemini handles inline audio natively on the same flash models, so the
    // full cascade is available for text and audio requests alike.
    return this.config.enabled ? this.config.models : [];
  }

  async generate(model: string, request: AiRequest, signal: AbortSignal): Promise<string> {
    if (!this.config.enabled) {
      throw new ProviderError('GEMINI_API_KEY is not configured', { provider: this.id, model });
    }

    // Exactly the two content shapes the original endpoint used.
    const contents: any = request.audio
      ? [
          {
            inlineData: {
              mimeType: request.audio.mimeType,
              data: request.audio.dataBase64,
            },
          },
          { text: request.prompt },
        ]
      : request.prompt;

    const wantsJson = request.json !== false;

    try {
      const response = await this.getClient().models.generateContent({
        model,
        contents,
        config: {
          ...(wantsJson ? { responseMimeType: 'application/json' } : {}),
          ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
          abortSignal: signal,
        },
      });
      return response.text ?? '';
    } catch (err: any) {
      // Normalise SDK errors so the classifier has provider/model context.
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(err?.message || 'Gemini request failed', {
        status: err?.status ?? null,
        provider: this.id,
        model,
        cause: err,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible (OpenRouter / Groq / OpenAI)
// ---------------------------------------------------------------------------

export class OpenAiCompatProvider implements AiProvider {
  readonly id: string;
  readonly config: ProviderConfig;
  private readonly audioModel: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: ProviderConfig, options: { audioModel?: string; appUrl?: string } = {}) {
    this.id = config.id;
    this.config = config;
    this.audioModel = options.audioModel || '';
    this.extraHeaders = {};
    if (config.id === 'openrouter' && options.appUrl) {
      // Optional attribution headers recommended by OpenRouter.
      this.extraHeaders['HTTP-Referer'] = options.appUrl;
      this.extraHeaders['X-Title'] = 'FrameCut Studio';
    }
  }

  modelsFor(capability: AiCapability): string[] {
    if (!this.config.enabled) return [];
    if (capability === 'audio') {
      return this.config.supportsAudio && this.audioModel ? [this.audioModel] : [];
    }
    return this.config.models;
  }

  async generate(model: string, request: AiRequest, signal: AbortSignal): Promise<string> {
    if (!this.config.enabled) {
      throw new ProviderError(`${this.id.toUpperCase()}_API_KEY is not configured`, {
        provider: this.id,
        model,
      });
    }

    const wantsJson = request.json !== false;
    const messages: any[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    if (request.audio && this.config.supportsAudio) {
      const format = /wav/i.test(request.audio.mimeType) ? 'wav' : /mp3|mpeg/i.test(request.audio.mimeType) ? 'mp3' : 'wav';
      messages.push({
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: request.audio.dataBase64, format } },
          { type: 'text', text: request.prompt },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: wantsJson ? `${request.prompt}${JSON_SUFFIX}` : request.prompt,
      });
    }

    const body: Record<string, unknown> = { model, messages };
    if (wantsJson) body.response_format = { type: 'json_object' };

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: any) {
      if (signal.aborted) {
        throw new ProviderError(`${this.id} request timed out`, { provider: this.id, model, cause: err });
      }
      throw new ProviderError(err?.message || `${this.id} network error`, {
        provider: this.id,
        model,
        cause: err,
      });
    }

    if (!res.ok) throw await providerErrorFromResponse(res, { provider: this.id, model });

    let data: any;
    try {
      data = await res.json();
    } catch (err) {
      throw new ProviderError(`${this.id} returned a non-JSON response`, {
        provider: this.id,
        model,
        cause: err,
      });
    }

    const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
    if (typeof text !== 'string') {
      throw new ProviderError(`${this.id} returned an unexpected payload shape`, {
        provider: this.id,
        model,
        bodySnippet: JSON.stringify(data).slice(0, 200),
      });
    }
    return text;
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  modelsFor(capability: AiCapability): string[] {
    if (!this.config.enabled) return [];
    return capability === 'audio' ? [] : this.config.models; // no inline audio support
  }

  async generate(model: string, request: AiRequest, signal: AbortSignal): Promise<string> {
    if (!this.config.enabled) {
      throw new ProviderError('ANTHROPIC_API_KEY is not configured', { provider: this.id, model });
    }
    const wantsJson = request.json !== false;
    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: wantsJson ? `${request.prompt}${JSON_SUFFIX}` : request.prompt },
      ],
    };
    if (request.systemPrompt) body.system = request.systemPrompt;

    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: any) {
      if (signal.aborted) {
        throw new ProviderError('anthropic request timed out', { provider: this.id, model, cause: err });
      }
      throw new ProviderError(err?.message || 'anthropic network error', {
        provider: this.id,
        model,
        cause: err,
      });
    }

    if (!res.ok) {
      // Anthropic reports overload as { type: 'error', error: { type: 'overloaded_error' } }
      const snippet = await readBodySnippet(res);
      let status = res.status;
      if (/overloaded_error/i.test(snippet)) status = 529;
      throw new ProviderError(snippet || res.statusText || `HTTP ${res.status}`, {
        status,
        retryAfterMs: null,
        provider: this.id,
        model,
        bodySnippet: snippet,
      });
    }

    const data: any = await res.json().catch(() => null);
    const text = Array.isArray(data?.content)
      ? data.content.map((block: any) => (block?.type === 'text' ? block.text : '')).join('')
      : '';
    return typeof text === 'string' ? text : '';
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ProviderRegistry {
  readonly config: AiConfig;
  private readonly providers: AiProvider[];

  constructor(config: AiConfig, env: NodeJS.ProcessEnv = process.env) {
    this.config = config;
    const appUrl = typeof env['APP_URL'] === 'string' ? (env['APP_URL'] as string).trim() : '';

    const byId: Record<string, AiProvider> = {
      gemini: new GeminiProvider(config.gemini, { timeoutMs: config.timeouts.audioMs }),
    };
    // Adapters are built for every known provider, including unconfigured ones,
    // so /api/ai/status can report what is missing. Unconfigured providers
    // return no models from modelsFor(), so they never enter a plan.
    // Order: the configured failover order first, then any known provider that
    // was left out of it (reporting only).
    const orderedIds = Array.from(
      new Set([
        ...config.failoverOrder,
        ...DEFAULT_FALLBACK_ORDER.filter((id) => !config.failoverOrder.includes(id)),
      ])
    );
    for (const id of orderedIds) {
      const providerConfig = config.allProviders[id];
      if (!providerConfig) continue;
      byId[id] =
        id === 'anthropic'
          ? new AnthropicProvider(providerConfig)
          : new OpenAiCompatProvider(providerConfig, {
              audioModel: id === 'openai' ? openAiAudioModel(env) : '',
              appUrl,
            });
    }
    this.providers = [byId.gemini, ...orderedIds.map((id) => byId[id]).filter(Boolean)];
  }

  /** Full ordered chain for a capability, primary first. */
  plan(capability: AiCapability): PlanTarget[] {
    const targets: PlanTarget[] = [];
    const pushProvider = (provider: AiProvider) => {
      for (const model of provider.modelsFor(capability)) {
        targets.push({ provider, model, primary: false });
      }
    };

    pushProvider(this.providers[0]); // Gemini first, always.

    if (this.config.failoverDisabled) {
      // Escape hatch: exactly the legacy behaviour - one Gemini model, no
      // cascade, no alternate providers.
      return targets.slice(0, 1).map((target, index) => ({ ...target, primary: index === 0 }));
    }

    for (const provider of this.providers.slice(1)) pushProvider(provider);

    if (targets.length > 0) targets[0].primary = true;
    return targets;
  }

  getProvider(id: string): AiProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /** All providers, configured or not (for /api/ai/status). */
  snapshot() {
    return this.providers.map((provider) => ({
      id: provider.id,
      label: provider.config.label,
      configured: provider.config.enabled,
      models: provider.config.models,
      supportsAudio: provider.config.supportsAudio,
      textModels: provider.modelsFor('text'),
      audioModels: provider.modelsFor('audio'),
    }));
  }
}
