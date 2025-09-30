export type MatomoErrorCode = string | number | undefined;

export interface MatomoRateLimitInfo {
  limit?: number;
  remaining?: number;
  resetInSeconds?: number;
  resetAt?: string;
  retryAfterSeconds?: number;
  observedAt?: string;
}

export interface MatomoErrorDetails {
  status?: number;
  code?: MatomoErrorCode;
  body?: string;
  endpoint?: string;
  payload?: unknown;
  cause?: unknown;
  rateLimit?: MatomoRateLimitInfo;
}

type GuidanceKey = 'auth' | 'permission' | 'rate-limit' | 'client' | 'server' | 'parse' | 'network' | 'unknown';

const defaultGuidance: Record<GuidanceKey, string> = {
  auth: 'Verify MATOMO_TOKEN and ensure the account still has API access.',
  permission: 'Confirm the token has view access to the requested Matomo site.',
  'rate-limit': 'Reduce request frequency or adjust Matomo archiving limits before retrying.',
  client: 'Double-check the request parameters (siteId, period, date) and try again.',
  server: 'Matomo returned a server error. Retry later or review the Matomo logs for more detail.',
  parse: 'Matomo returned an unexpected payload. Validate the Matomo version and response format.',
  network: 'Could not reach Matomo. Check connectivity, base URL, and DNS configuration.',
  unknown: 'An unexpected error occurred while calling Matomo. Inspect the details and Matomo logs.',
};

function resolveGuidance(key: GuidanceKey, message?: string, code?: MatomoErrorCode): string {
  if (!message && !code) {
    return defaultGuidance[key];
  }

  const normalized = message?.toLowerCase() ?? '';

  if (key === 'auth' || key === 'permission') {
    if (normalized.includes('token')) {
      return 'Matomo rejected the API token. Generate a new token or update MATOMO_TOKEN.';
    }
    if (normalized.includes('access denied') || normalized.includes('no view access')) {
      return 'Grant view access for the token user to this site in Matomo’s administration UI.';
    }
  }

  if (key === 'rate-limit') {
    return 'Matomo rate limits were hit. Pause briefly or stagger requests before retrying.';
  }

  if (key === 'client' && normalized.includes('site id')) {
    return 'Check the siteId value—ensure the site exists and the token can access it.';
  }

  return defaultGuidance[key];
}

export class MatomoApiError extends Error {
  readonly status?: number;
  readonly code?: MatomoErrorCode;
  readonly body?: string;
  readonly endpoint?: string;
  readonly payload?: unknown;
  readonly guidance: string;
  readonly rateLimit?: MatomoRateLimitInfo;

  constructor(message: string, guidanceKey: GuidanceKey, details: MatomoErrorDetails = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = details.status;
    this.code = details.code;
    this.body = details.body;
    this.endpoint = details.endpoint;
    this.payload = details.payload;
    this.guidance = resolveGuidance(guidanceKey, message, details.code);
    this.rateLimit = details.rateLimit;

    if (details.cause instanceof Error) {
      type ErrorWithCause = Error & { cause?: unknown };
      const self = this as ErrorWithCause;
      if (self.cause === undefined) {
        self.cause = details.cause;
      }
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      guidance: this.guidance,
      endpoint: this.endpoint,
      rateLimit: this.rateLimit,
    };
  }
}

export class MatomoNetworkError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'network', details);
  }
}

export class MatomoParseError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'parse', details);
  }
}

export class MatomoAuthError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'auth', details);
  }
}

export class MatomoPermissionError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'permission', details);
  }
}

export class MatomoRateLimitError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'rate-limit', details);
  }
}

export class MatomoClientError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'client', details);
  }
}

export class MatomoServerError extends MatomoApiError {
  constructor(message: string, details: MatomoErrorDetails = {}) {
    super(message, 'server', details);
  }
}

export type MatomoErrorResult = {
  result?: unknown;
  message?: unknown;
  code?: unknown;
  [key: string]: unknown;
};

export function extractMatomoError(result: unknown): { message?: string; code?: MatomoErrorCode } | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const payload = result as MatomoErrorResult;

  if (typeof payload.error === 'string') {
    return { message: payload.error };
  }

  const normalizedResult = typeof payload.result === 'string' ? payload.result.toLowerCase() : undefined;
  if (normalizedResult === 'error') {
    const message = typeof payload.message === 'string' ? payload.message : undefined;
    const code = typeof payload.code === 'string' || typeof payload.code === 'number' ? payload.code : undefined;
    return { message, code };
  }

  return undefined;
}

export interface MatomoHttpErrorContext {
  status: number;
  statusText: string;
  endpoint: string;
  bodyText?: string;
  payload?: unknown;
  rateLimit?: MatomoRateLimitInfo;
}

export function classifyMatomoError(context: MatomoHttpErrorContext): MatomoApiError {
  const { status, statusText, endpoint, payload, bodyText, rateLimit } = context;
  const extracted = extractMatomoError(payload);
  const messageFromPayload = extracted?.message;
  const code = extracted?.code;
  const defaultMessage = messageFromPayload ?? bodyText ?? statusText ?? 'Matomo API error';

  const details: MatomoErrorDetails = {
    status,
    code,
    body: bodyText,
    endpoint,
    payload,
    rateLimit,
  };

  if (status === 401) {
    return new MatomoAuthError(`Matomo authentication failed: ${defaultMessage}`, details);
  }

  if (status === 403) {
    return new MatomoPermissionError(`Matomo permission error: ${defaultMessage}`, details);
  }

  if (status === 429 || (messageFromPayload && messageFromPayload.toLowerCase().includes('rate'))) {
    return new MatomoRateLimitError(`Matomo rate limit exceeded: ${defaultMessage}`, details);
  }

  if (status >= 500) {
    return new MatomoServerError(`Matomo server error (${status}): ${defaultMessage}`, details);
  }

  return new MatomoClientError(`Matomo request failed (${status}): ${defaultMessage}`, details);
}

export function classifyMatomoResultError(endpoint: string, payload: unknown): MatomoApiError {
  const extracted = extractMatomoError(payload);
  const message = extracted?.message ?? 'Matomo reported an error result.';
  const details: MatomoErrorDetails = {
    endpoint,
    payload,
    code: extracted?.code,
  };

  const normalized = message.toLowerCase();
  if (normalized.includes('token') || normalized.includes('authentication')) {
    return new MatomoAuthError(`Matomo authentication failed: ${message}`, details);
  }

  if (normalized.includes('access denied') || normalized.includes('no view access')) {
    return new MatomoPermissionError(`Matomo permission error: ${message}`, details);
  }

  if (normalized.includes('rate')) {
    return new MatomoRateLimitError(`Matomo rate limit exceeded: ${message}`, details);
  }

  return new MatomoClientError(`Matomo request failed: ${message}`, details);
}
