import 'server-only';

import { env } from '@/env';

import { OpenRouterProvider } from './openrouter';
import {
  type AiCompletion,
  type AiCompletionRequest,
  type AiProvider,
  AiProviderError,
} from './provider';
import { VercelGatewayProvider } from './vercel-gateway';

/**
 * Ordered chain: skips unconfigured providers, moves on after any failure.
 */
export class FallbackAiProvider implements AiProvider {
  public readonly id = 'fallback';

  public constructor(private readonly providers: AiProvider[]) {}

  public isConfigured(): boolean {
    return this.providers.some((provider) => provider.isConfigured());
  }

  public async complete(request: AiCompletionRequest): Promise<AiCompletion> {
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;

      if (request.signal?.aborted) break;

      try {
        return await provider.complete(request);
      } catch (error) {
        const message = error instanceof AiProviderError ? error.message : `${provider.id}: error`;

        // Names and kinds only, never keys or bodies.
        console.warn(`[ai] ${message}`);
      }
    }

    throw new AiProviderError('upstream', this.id);
  }
}

export function getAiProvider(): AiProvider {
  const all: Record<string, AiProvider> = {
    vercel: new VercelGatewayProvider(),
    openrouter: new OpenRouterProvider(),
  };
  const order = (env.AI_PROVIDER_ORDER ?? 'vercel,openrouter')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => Object.hasOwn(all, id));

  return new FallbackAiProvider(order.map((id) => all[id] as AiProvider));
}
