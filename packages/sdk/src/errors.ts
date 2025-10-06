export type MatomoErrorCode = string | number | undefined;

export interface MatomoRateLimitInfo {
  limit?: number;
  remaining?: number;
  resetAt?: number;
  retryAfterMs?: number;
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

const codeGuidance: Record<string, string> = {
  '101': 'Check the siteId value—ensure the site exists and the token can access it.',
  '103': 'Ensure the date parameter uses a Matomo-supported format (e.g. YYYY-MM-DD or date ranges).',
  '110': 'Review the Matomo segment expression for syntax errors and unsupported operators.',
};

const keywordGuidance: Array<{ pattern: RegExp; guidance: string }> = [
  {
    pattern:
      /id\s*site|siteid|site id|no website found|unknown website|website id|idsite|site does not exist|no view access to idsite/,
    guidance: 'Check the siteId value—ensure the site exists and the token can access it.',
  },
  {
    pattern: /\bdate\b|date parameter|invalid date|date format/,
    guidance: 'Ensure the date parameter matches Matomo formats (YYYY-MM-DD or a date range) for the chosen period.',
  },
  {
    pattern: /\bperiod\b|unknown period|invalid period|unsupported period/,
    guidance: 'Use Matomo-supported periods (day, week, month, year, range) and align with the requested date.',
  },
  {
    pattern: /\bsegment\b|invalid segment|segment .* does not exist/,
    guidance: 'Review the Matomo segment expression for syntax errors and test it in Matomo’s segment builder.',
  },
  {
    pattern: /unknown method|invalid method|method .* does not exist|report .* not found|requested report/,
    guidance: 'Verify the Matomo API method/module name and enable the required plugin if necessary.',
  },
  {
    pattern: /\bgoal\b|goal id|unknown goal/,
    guidance: 'Confirm the Matomo goal ID exists for the site and matches the request parameters.',
  },
  {
    pattern: /\bformat\b|invalid format|unsupported format/,
    guidance: 'Request the report in JSON format and confirm the Matomo plugin supports the chosen format.',
  },
];

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

  const codeKey = code !== undefined && code !== null ? String(code) : undefined;
  if (codeKey && codeGuidance[codeKey]) {
    return codeGuidance[codeKey];
  }

  for (const { pattern, guidance } of keywordGuidance) {
    if (pattern.test(normalized)) {
      return guidance;
    }
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

export class MatomoSiteConfigurationError extends Error {
  readonly selector?: string | number;

  constructor(message: string, selector?: string | number) {
    super(message);
    this.name = this.constructor.name;
    this.selector = selector;
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
  const { status, statusText, endpoint, payload, bodyText } = context;
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
    rateLimit: context.rateLimit,
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

export function classifyMatomoResultError(
  endpoint: string,
  payload: unknown,
  rateLimit?: MatomoRateLimitInfo
): MatomoApiError {
  const extracted = extractMatomoError(payload);
  const message = extracted?.message ?? 'Matomo reported an error result.';
  const details: MatomoErrorDetails = {
    endpoint,
    payload,
    code: extracted?.code,
    rateLimit,
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
