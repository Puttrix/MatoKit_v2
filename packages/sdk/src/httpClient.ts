import { URL } from 'node:url';

import {
  MatomoNetworkError,
  MatomoParseError,
  classifyMatomoError,
  classifyMatomoResultError,
  extractMatomoError,
  type MatomoRateLimitInfo,
} from './errors.js';

export interface MatomoRequestOptions {
  method: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface MatomoResponse<T> {
  data: T;
  status: number;
  ok: boolean;
  rateLimit?: MatomoRateLimitInfo;
}

function parseNumericHeader(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (!value) return undefined;
  const numeric = Number.parseInt(value, 10);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function parseRateLimitHeaders(headers: Headers): MatomoRateLimitInfo | undefined {
  const limit = parseNumericHeader(headers, 'x-matomo-rate-limit-limit');
  const remaining = parseNumericHeader(headers, 'x-matomo-rate-limit-remaining');
  const resetInSeconds = parseNumericHeader(headers, 'x-matomo-rate-limit-reset');
  const retryAfterSeconds = parseNumericHeader(headers, 'retry-after');

  if (
    limit === undefined &&
    remaining === undefined &&
    resetInSeconds === undefined &&
    retryAfterSeconds === undefined
  ) {
    return undefined;
  }

  const dateHeader = headers.get('date');
  const observedAtDate = dateHeader ? new Date(dateHeader) : new Date();
  const rateLimit: MatomoRateLimitInfo = {
    limit,
    remaining,
    resetInSeconds,
    retryAfterSeconds,
    observedAt: observedAtDate.toISOString(),
  };

  if (resetInSeconds !== undefined) {
    rateLimit.resetAt = new Date(observedAtDate.getTime() + resetInSeconds * 1000).toISOString();
  }

  return rateLimit;
}

function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    throw new Error('Matomo base URL is required');
  }

  const trimmed = baseUrl.trim();
  if (trimmed.endsWith('index.php')) {
    return trimmed;
  }

  return `${trimmed.replace(/\/?$/, '')}/index.php`;
}

export class MatomoHttpClient {
  private readonly baseEndpoint: string;
  private readonly token: string;
  private lastRateLimit?: MatomoRateLimitInfo;

  constructor(baseUrl: string, tokenAuth: string) {
    this.baseEndpoint = normalizeBaseUrl(baseUrl);
    if (!tokenAuth) {
      throw new Error('Matomo token_auth is required');
    }

    this.token = tokenAuth;
  }

  async get<T>({ method, params = {} }: MatomoRequestOptions): Promise<MatomoResponse<T>> {
    if (!method) {
      throw new Error('Matomo API method is required');
    }

    const url = new URL(this.baseEndpoint);
    url.searchParams.set('module', 'API');
    url.searchParams.set('method', method);
    url.searchParams.set('token_auth', this.token);
    url.searchParams.set('format', 'JSON');

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    const endpoint = url.toString();
    let res: Awaited<ReturnType<typeof fetch>>;

    try {
      res = await fetch(endpoint);
    } catch (error) {
      throw new MatomoNetworkError('Failed to reach Matomo instance.', {
        endpoint,
        cause: error,
      });
    }

    const responseHeaders =
      res && 'headers' in res && res.headers ? new Headers(res.headers as HeadersInit) : new Headers();

    const rateLimit = parseRateLimitHeaders(responseHeaders);
    if (rateLimit) {
      this.lastRateLimit = rateLimit;
    }

    let bodyText: string | undefined;
    try {
      bodyText = await res.text();
    } catch (error) {
      throw new MatomoNetworkError('Failed to read Matomo response.', {
        endpoint,
        cause: error,
        status: res.status,
      });
    }

    let payload: unknown = undefined;
    const trimmedBody = bodyText?.trim() ?? '';

    if (trimmedBody.length > 0) {
      try {
        payload = JSON.parse(trimmedBody);
      } catch (error) {
        if (res.ok) {
          throw new MatomoParseError('Failed to parse Matomo JSON response.', {
            endpoint,
            status: res.status,
            body: bodyText,
            cause: error,
          });
        }
      }
    }

    if (!res.ok) {
      throw classifyMatomoError({
        status: res.status,
        statusText: res.statusText,
        endpoint,
        bodyText,
        payload,
        rateLimit,
      });
    }

    if (payload && typeof payload === 'object') {
      const extracted = extractMatomoError(payload);
      if (extracted) {
        throw classifyMatomoResultError(endpoint, payload);
      }
    }

    return {
      data: payload as T,
      status: res.status,
      ok: res.ok,
      rateLimit,
    };
  }

  getRateLimitInfo(): MatomoRateLimitInfo | undefined {
    return this.lastRateLimit;
  }
}

export async function matomoGet<T>(client: MatomoHttpClient, options: MatomoRequestOptions) {
  const response = await client.get<T>(options);
  return response.data;
}
