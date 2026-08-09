import { providerUsesServerKey } from '../../lib/provider-config.js';
import type { ProviderId } from '../../types.js';

export class ProviderError extends Error {
  status: number;
  responseHeaders?: Record<string, string>;

  constructor(status: number, message: string, responseHeaders?: Record<string, string>) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.responseHeaders = responseHeaders;
  }
}

function providerLabel(provider: ProviderId) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function mapUpstreamStatus(provider: ProviderId, upstreamStatus: number) {
  if (upstreamStatus === 429) {
    return 429;
  }

  if ((upstreamStatus === 401 || upstreamStatus === 403) && !providerUsesServerKey(provider)) {
    return 401;
  }

  return 502;
}

export async function createProviderResponseError(
  provider: ProviderId,
  response: Response,
): Promise<ProviderError> {
  const label = providerLabel(provider);
  const fallbackMessage = `${label} request failed with status ${response.status}.`;
  let upstreamMessage: string | undefined;

  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    upstreamMessage = data.error?.message ?? data.message;
  } catch {
    upstreamMessage = undefined;
  }

  const isServerKeyAuthFailure =
    providerUsesServerKey(provider) && (response.status === 401 || response.status === 403);
  const message = isServerKeyAuthFailure
    ? `${label} authentication is not configured correctly on the server.`
    : upstreamMessage ?? fallbackMessage;
  const retryAfter = response.headers.get('retry-after');

  return new ProviderError(
    mapUpstreamStatus(provider, response.status),
    message,
    retryAfter ? { 'Retry-After': retryAfter } : undefined,
  );
}

export function normalizeProviderFailure(provider: ProviderId, error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  const label = providerLabel(provider);
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return new ProviderError(504, `${label} did not respond before the request timed out.`);
  }

  return new ProviderError(502, `${label} returned an invalid response.`);
}
