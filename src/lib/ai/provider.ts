export interface AiCompletionRequest {
  maxTokens: number;
  signal?: AbortSignal;
  system: string;
  user: string;
}

export interface AiCompletion {
  model: string;
  provider: string;
  text: string;
}

export interface AiProvider {
  complete: (request: AiCompletionRequest) => Promise<AiCompletion>;
  readonly id: string;
  isConfigured: () => boolean;
}

export type AiFailureKind =
  | 'bad-response'
  | 'network'
  | 'rate-limited'
  | 'restricted'
  | 'timeout'
  | 'unauthorized'
  | 'upstream';

export class AiProviderError extends Error {
  public constructor(
    public readonly kind: AiFailureKind,
    public readonly provider: string,
    public readonly status?: number,
  ) {
    super(`${provider}: ${kind}${status ? ` (${status})` : ''}`);
  }
}
