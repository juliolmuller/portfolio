import 'server-only';

import { env } from '@/env';

import { completeChat } from './openai-compatible';
import { type AiCompletion, type AiCompletionRequest, type AiProvider } from './provider';

export class VercelGatewayProvider implements AiProvider {
  public readonly id = 'vercel';

  public isConfigured(): boolean {
    return Boolean(env.AI_GATEWAY_API_KEY && env.AI_GATEWAY_MODEL);
  }

  public complete(request: AiCompletionRequest): Promise<AiCompletion> {
    return completeChat(
      {
        provider: this.id,
        baseUrl: env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1',
        apiKey: env.AI_GATEWAY_API_KEY ?? '',
        model: env.AI_GATEWAY_MODEL ?? '',
      },
      request,
    );
  }
}
