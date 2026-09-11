/**
 * Fault-injecting mock of every provider wire format used by the app.
 *
 *   GET/POST  {url}/v1beta/models/{model}:generateContent   -> Gemini
 *   POST      {url}/openai/v1/chat/completions              -> OpenRouter/Groq/OpenAI
 *   POST      {url}/anthropic/v1/messages                   -> Anthropic
 *
 * Each target is addressed as `${providerId}:${model}` and can be given a queue
 * of canned responses, which is how the tests reproduce rate limits, overload,
 * timeouts and malformed payloads deterministically.
 */
import http from 'http';
import { AddressInfo } from 'net';

export interface MockSpec {
  /** HTTP status to return. */
  status?: number;
  /** Model text to embed in the provider-appropriate success envelope. */
  text?: string;
  /** Raw body override (sent verbatim). */
  body?: string;
  /** Retry-After header value (seconds or HTTP-date). */
  retryAfter?: string | number;
  /** Delay before responding, used to trigger per-attempt timeouts. */
  delayMs?: number;
  /** Extra headers. */
  headers?: Record<string, string>;
}

export interface MockRequest {
  key: string;
  provider: string;
  model: string;
  path: string;
  method: string;
  hasInlineAudio: boolean;
  hasInputAudio: boolean;
  headers: http.IncomingHttpHeaders;
  body: any;
  at: number;
}

export interface MockAiServer {
  url: string;
  port: number;
  /** Queue canned responses for a `provider:model` target. */
  queue(key: string, specs: MockSpec[]): void;
  /** Default response used when a target has no queued specs left. */
  setDefault(spec: MockSpec): void;
  requests: MockRequest[];
  requestsFor(key: string): MockRequest[];
  reset(): void;
  close(): Promise<void>;
}

const GEMINI_OK: MockSpec = { status: 200, text: '{"ok":true}' };

function envelopeFor(provider: string, model: string, text: string): string {
  if (provider === 'gemini') {
    return JSON.stringify({
      candidates: [
        {
          content: { role: 'model', parts: [{ text }] },
          finishReason: 'STOP',
          index: 0,
        },
      ],
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
  // OpenAI-compatible
  return JSON.stringify({
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
  });
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({ __raw: raw });
      }
    });
    req.on('error', () => resolve({}));
  });
}

export async function startMockAiServer(): Promise<MockAiServer> {
  const queues = new Map<string, MockSpec[]>();
  const requests: MockRequest[] = [];
  let defaultSpec: MockSpec = GEMINI_OK;

  const server = http.createServer(async (req, res) => {
    const path = req.url || '/';
    const body = await readJson(req);

    let provider = 'unknown';
    let model = 'unknown';

    const geminiMatch = path.match(/^\/(?:[^/]*\/)?models\/([^/]+):generateContent$/);
    if (geminiMatch) {
      provider = 'gemini';
      model = decodeURIComponent(geminiMatch[1]);
    } else if (path.endsWith('/chat/completions')) {
      // Tests give each OpenAI-compatible provider its own base path so the
      // adapter under test is unambiguous.
      provider = path.includes('/groq') ? 'groq' : path.includes('/openai') ? 'openai' : 'openrouter';
      model = String(body?.model || 'unknown');
    } else if (path.endsWith('/v1/messages')) {
      provider = 'anthropic';
      model = String(body?.model || 'unknown');
    }

    const key = `${provider}:${model}`;
    const hasInlineAudio = JSON.stringify(body).includes('inlineData');
    const hasInputAudio = JSON.stringify(body).includes('input_audio');
    requests.push({
      key,
      provider,
      model,
      path,
      method: req.method || 'GET',
      hasInlineAudio,
      hasInputAudio,
      headers: req.headers,
      body,
      at: Date.now(),
    });

    const queue = queues.get(key);
    const spec: MockSpec = (queue && queue.length > 0 ? queue.shift() : defaultSpec) || GEMINI_OK;

    const send = () => {
      const status = spec.status ?? 200;
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...(spec.retryAfter !== undefined ? { 'retry-after': String(spec.retryAfter) } : {}),
        ...(spec.headers || {}),
      };
      const payload =
        spec.body ??
        (status >= 200 && status < 300
          ? envelopeFor(provider, model, spec.text ?? '{"ok":true}')
          : JSON.stringify({
              error: {
                code: status,
                message: `mock ${provider} failure (${status})`,
                status: status === 429 ? 'RESOURCE_EXHAUSTED' : status === 503 ? 'UNAVAILABLE' : 'ERROR',
              },
            }));
      res.writeHead(status, headers);
      res.end(payload);
    };

    if (spec.delayMs && spec.delayMs > 0) setTimeout(send, spec.delayMs);
    else send();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    port,
    queue(key, specs) {
      queues.set(key, [...specs]);
    },
    setDefault(spec) {
      defaultSpec = spec;
    },
    requests,
    requestsFor(key) {
      return requests.filter((r) => r.key === key);
    },
    reset() {
      queues.clear();
      requests.length = 0;
      defaultSpec = GEMINI_OK;
    },
    close() {
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
