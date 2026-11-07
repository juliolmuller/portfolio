import 'server-only';

import { type AiCompletion, type AiCompletionRequest, AiProviderError } from './provider';

export interface ChatTarget {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
}

export const PROVIDER_TIMEOUT_MS = 6000;

function kindOf(status: number): ConstructorParameters<typeof AiProviderError>[0] {
  if (status === 401) return 'unauthorized';

  if (status === 403) return 'restricted';

  if (status === 429) return 'rate-limited';

  return status >= 500 ? 'upstream' : 'bad-response';
}

/**
 * Shared `/chat/completions` transport; each provider owns its config and
 * defaults.
 */
export async function completeChat(
  target: ChatTarget,
  request: AiCompletionRequest,
): Promise<AiCompletion> {
  const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
  let response: Response;

  try {
    response = await fetch(`${target.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${target.apiKey}` },
      body: JSON.stringify({
        model: target.model,
        temperature: 0,
        max_tokens: request.maxTokens,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
      }),
      cache: 'no-store',
      signal,
    });
  } catch {
    throw new AiProviderError(timeout.aborted ? 'timeout' : 'network', target.provider);
  }

  if (!response.ok)
    throw new AiProviderError(kindOf(response.status), target.provider, response.status);

  const data: unknown = await response.json().catch(() => null);
  const text = (data as { choices?: Array<{ message?: { content?: unknown } }> } | null)
    ?.choices?.[0]?.message?.content;

  if (typeof text !== 'string' || !text.trim()) {
    throw new AiProviderError('bad-response', target.provider);
  }

  return { text, provider: target.provider, model: target.model };
}
