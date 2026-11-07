import 'server-only';

import { env } from '@/env';

import { completeChat } from './openai-compatible';
import { type AiCompletion, type AiCompletionRequest, type AiProvider } from './provider';

export class OpenRouterProvider implements AiProvider {
  public readonly id = 'openrouter';

  public isConfigured(): boolean {
    return Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL);
  }

  public complete(request: AiCompletionRequest): Promise<AiCompletion> {
    return completeChat(
      {
        provider: this.id,
        baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
        apiKey: env.OPENROUTER_API_KEY ?? '',
        model: env.OPENROUTER_MODEL ?? '',
      },
      request,
    );
  }
}
