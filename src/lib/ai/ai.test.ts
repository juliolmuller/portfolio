import { afterEach, describe, expect, it, vi } from 'vitest';

import { FallbackAiProvider } from './fallback';
import { completeChat } from './openai-compatible';
import { type AiProvider, AiProviderError } from './provider';

const target = { apiKey: 'k', baseUrl: 'https://x.test/v1', model: 'm', provider: 'p' };
const request = { system: 's', user: 'u', maxTokens: 10 };

const reply = (status: number, body: unknown = {}): Response =>
  new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('completeChat', () => {
  it('returns the message text', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(reply(200, { choices: [{ message: { content: 'hi' } }] })),
    );

    await expect(completeChat(target, request)).resolves.toMatchObject({
      text: 'hi',
      provider: 'p',
    });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'restricted'],
    [429, 'rate-limited'],
    [503, 'upstream'],
  ])('maps %i to %s', async (status, kind) => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply(status)));

    await expect(completeChat(target, request)).rejects.toMatchObject({ kind });
  });

  it('rejects empty or malformed payloads', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply(200, { choices: [] })));

    await expect(completeChat(target, request)).rejects.toMatchObject({ kind: 'bad-response' });
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('down')));

    await expect(completeChat(target, request)).rejects.toMatchObject({ kind: 'network' });
  });
});

const fake = (id: string, configured: boolean, run: () => Promise<string>): AiProvider => ({
  id,
  isConfigured: () => configured,
  complete: async () => ({ text: await run(), provider: id, model: 'm' }),
});

describe('FallbackAiProvider', () => {
  it('skips unconfigured providers and falls through failures in order', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const chain = new FallbackAiProvider([
      fake('a', false, () => Promise.resolve('never')),
      fake('b', true, () => Promise.reject(new AiProviderError('rate-limited', 'b', 429))),
      fake('c', true, () => Promise.resolve('ok')),
    ]);

    await expect(chain.complete(request)).resolves.toMatchObject({ provider: 'c' });
  });

  it('throws one aggregate error when all fail', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const chain = new FallbackAiProvider([fake('a', true, () => Promise.reject(new Error('x')))]);

    await expect(chain.complete(request)).rejects.toBeInstanceOf(AiProviderError);
    expect(new FallbackAiProvider([]).isConfigured()).toBe(false);
  });
});
