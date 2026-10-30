import { fetchWithTimeout, readJson, type FetchLike } from '../common/http';
import { kindForStatus, ProviderError } from '../common/provider-error';

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens: number;
}

/** Minimal provider-agnostic LLM interface; swap implementations without touching callers. */
export interface LlmClient {
  readonly providerName: string;
  complete(req: LlmRequest): Promise<string>;
}

const errorFor = (provider: string, status: number) =>
  new ProviderError(
    kindForStatus(status),
    `${provider} is unavailable right now.`,
    `HTTP ${status}`,
  );

/** Anthropic Messages API. Docs: https://docs.claude.com/en/api/messages */
export class AnthropicClient implements LlmClient {
  readonly providerName = 'Anthropic';
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: FetchLike,
    private readonly timeoutMs: number,
  ) {}

  async complete(req: LlmRequest): Promise<string> {
    const res = await fetchWithTimeout(
      this.fetchImpl,
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens,
          temperature: 0,
          system: req.system,
          messages: [{ role: 'user', content: req.user }],
        }),
      },
      this.timeoutMs,
      this.providerName,
    );
    if (res.status !== 200) throw errorFor(this.providerName, res.status);
    const body = (await readJson(res, this.providerName)) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    if (!text)
      throw new ProviderError(
        'bad_response',
        'The AI provider returned an empty response.',
        'no text content',
      );
    return text;
  }
}

export interface OpenAiCompatibleOptions {
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Added to max_tokens for models whose thinking tokens count against that limit. */
  extraMaxTokens?: number;
}

/** Any OpenAI-compatible Chat Completions endpoint (OpenAI, Gemini, Azure OpenAI proxies, local servers). */
export class OpenAiCompatibleClient implements LlmClient {
  readonly providerName = 'OpenAI-compatible';
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike,
    private readonly timeoutMs: number,
    private readonly options: OpenAiCompatibleOptions = {},
  ) {}

  async complete(req: LlmRequest): Promise<string> {
    const res = await fetchWithTimeout(
      this.fetchImpl,
      `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens + (this.options.extraMaxTokens ?? 0),
          temperature: 0,
          ...(this.options.reasoningEffort
            ? { reasoning_effort: this.options.reasoningEffort }
            : {}),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
      },
      this.timeoutMs,
      this.providerName,
    );
    if (res.status !== 200) throw errorFor(this.providerName, res.status);
    const body = (await readJson(res, this.providerName)) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text)
      throw new ProviderError(
        'bad_response',
        'The AI provider returned an empty response.',
        'no content',
      );
    return text;
  }
}

/** Development-only fake model that returns fixed, clearly labelled output. */
export class MockLlmClient implements LlmClient {
  readonly providerName = 'Mock AI (development only)';
  async complete(req: LlmRequest): Promise<string> {
    if (req.system.includes('TASK: URL_INDICATORS')) return JSON.stringify({ indicators: [] });
    if (req.system.includes('TASK: JOB_AD_INDICATORS')) return JSON.stringify({ indicators: [] });
    return JSON.stringify({
      summary:
        '[SIMULATED AI TEXT] This summary was produced by the development mock model and restates the deterministic findings shown below.',
      whyItMatters: ['[SIMULATED] Mock explanation text for development and testing.'],
      additionalActions: [],
    });
  }
}
