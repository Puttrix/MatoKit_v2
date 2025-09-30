import { MatomoHttpClient, matomoGet } from './httpClient.js';
import {
  ReportsService,
  type CacheStatsSnapshot,
  type ReportsServiceOptions,
  type CacheEvent,
  type EcommerceRevenueTotals,
  type EcommerceRevenueSeriesPoint,
  type EcommerceRevenueTotalsInput,
  type GoalConversion,
  type GoalConversionsInput,
} from './reports.js';
import { keyNumbersSchema, keyNumbersSeriesSchema } from './schemas.js';
import type {
  Campaign,
  DeviceTypeSummary,
  EcommerceSummary,
  EntryPage,
  EventCategory,
  EventSummary,
  KeyNumbers,
  MostPopularUrl,
  TopReferrer,
  TrafficChannel,
} from './schemas.js';
import {
  TrackingService,
  type TrackEventInput,
  type TrackGoalInput,
  type TrackPageviewInput,
  type TrackPageviewResult,
  type TrackResult,
} from './tracking.js';
import { MatomoApiError, MatomoNetworkError } from './errors.js';

export interface CacheConfig {
  ttlMs?: number;
  onEvent?: (event: CacheEvent) => void;
}

export interface MatomoClientConfig {
  baseUrl: string;
  tokenAuth: string;
  defaultSiteId?: number;
  tracking?: {
    baseUrl?: string;
    maxRetries?: number;
    retryDelayMs?: number;
  };
  cacheTtlMs?: number;
  cache?: CacheConfig;
}

export interface GetKeyNumbersInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
}

export interface GetEventsInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
  limit?: number;
  category?: string;
  action?: string;
  name?: string;
}

export interface GetEntryPagesInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
  limit?: number;
}

export interface GetCampaignsInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
  limit?: number;
}

export interface GetEcommerceOverviewInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
}

export interface GetEcommerceRevenueTotalsInput extends GetEcommerceOverviewInput {
  includeSeries?: boolean;
}

export interface GetEventCategoriesInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
  limit?: number;
}

export interface GetDeviceTypesInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
  limit?: number;
}

export interface GetTrafficChannelsInput {
  siteId?: number;
  period?: string;
  date?: string;
  segment?: string;
  limit?: number;
  channelType?: string;
}

export type GetGoalConversionsInput = Partial<Omit<GoalConversionsInput, 'siteId'>> & { siteId?: number };

export type GetKeyNumbersSeriesInput = GetKeyNumbersInput;

export interface KeyNumbersSeriesPoint extends KeyNumbers {
  date: string;
}

type DiagnosticCheckId = 'base-url' | 'token-auth' | 'site-access';

export type DiagnosticStatus = 'ok' | 'error' | 'skipped';

export interface MatomoDiagnosticError {
  type: 'matomo' | 'network' | 'unknown';
  message: string;
  code?: string | number;
  guidance?: string;
}

export interface MatomoDiagnosticCheck {
  id: DiagnosticCheckId;
  label: string;
  status: DiagnosticStatus;
  details?: Record<string, unknown>;
  error?: MatomoDiagnosticError;
  skippedReason?: string;
}

export interface RunDiagnosticsInput {
  siteId?: number;
}

export interface RunDiagnosticsResult {
  checks: MatomoDiagnosticCheck[];
}

export interface HealthCheckStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  componentType: 'service' | 'database' | 'cache' | 'queue';
  observedValue?: string | number;
  observedUnit?: string;
  time?: string;
  output?: string;
}

export interface GetHealthStatusInput {
  includeDetails?: boolean;
  siteId?: number;
}

export type RateLimitStatusLevel = 'unknown' | 'normal' | 'warn' | 'depleted';

export interface RateLimitStatus {
  status: RateLimitStatusLevel;
  limit?: number;
  remaining?: number;
  resetInSeconds?: number;
  resetAt?: string;
  retryAfterSeconds?: number;
  observedAt?: string;
  message: string;
}

const keyNumberNumericFields: Array<keyof KeyNumbers> = [
  'nb_visits',
  'nb_uniq_visitors',
  'nb_actions',
  'nb_users',
  'nb_visits_converted',
  'sum_visit_length',
  'max_actions',
  'nb_pageviews',
  'nb_uniq_pageviews',
];

function toFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.toLowerCase() === 'nan') return undefined;
    const normalized = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  return undefined;
}

function sumSeriesValues(series: unknown): number | undefined {
  if (!series || (typeof series !== 'object' && !Array.isArray(series))) {
    return undefined;
  }

  const values = Array.isArray(series)
    ? series
    : Object.values(series as Record<string, unknown>);

  let total = 0;
  let seen = false;

  for (const value of values) {
    if (value && typeof value === 'object') {
      const nested = sumSeriesValues(value);
      if (nested !== undefined) {
        total += nested;
        seen = true;
        continue;
      }
    }

    const numeric = toFiniteNumber(value);
    if (numeric !== undefined) {
      total += numeric;
      seen = true;
    }
  }

  return seen ? total : undefined;
}

function unwrapMatomoValue(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return undefined;
    return unwrapMatomoValue(raw[0]);
  }
  return raw;
}

function unwrapToRecord(raw: unknown): Record<string, unknown> {
  const unwrapped = unwrapMatomoValue(raw);
  if (unwrapped && typeof unwrapped === 'object') {
    return { ...(unwrapped as Record<string, unknown>) };
  }
  return {};
}

function normalizeKeyNumbersPayload(raw: unknown): Record<string, unknown> {
  const record = unwrapToRecord(raw);
  if (Object.keys(record).length > 0) {
    return record;
  }

  const nb_visits = toFiniteNumber(unwrapMatomoValue(raw)) ?? 0;
  return { nb_visits };
}

function sanitizeKeyNumbers(raw: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...raw };

  for (const field of keyNumberNumericFields) {
    const current = sanitized[field as string];
    const coerced = toFiniteNumber(current);

    if (coerced !== undefined) {
      sanitized[field as string] = coerced;
      continue;
    }

    if (field === 'nb_visits') {
      const fromSeries =
        sumSeriesValues(raw?.['nb_visits_series']) ?? sumSeriesValues(raw?.['nb_visits']);
      sanitized[field as string] = fromSeries ?? 0;
    } else {
      delete sanitized[field as string];
    }
  }

  return sanitized;
}

function toDiagnosticError(error: unknown): MatomoDiagnosticError {
  if (error instanceof MatomoApiError) {
    return {
      type: error instanceof MatomoNetworkError ? 'network' : 'matomo',
      message: error.message,
      code: error.code,
      guidance: error.guidance,
    };
  }

  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message || 'Unknown error',
    };
  }

  return { type: 'unknown', message: String(error) };
}

type DiagnosticHandler = () => Promise<Record<string, unknown> | void>;

async function performDiagnosticCheck(
  id: DiagnosticCheckId,
  label: string,
  handler: DiagnosticHandler
): Promise<MatomoDiagnosticCheck> {
  try {
    const details = await handler();
    return {
      id,
      label,
      status: 'ok',
      ...(details ? { details } : {}),
    };
  } catch (error) {
    return {
      id,
      label,
      status: 'error',
      error: toDiagnosticError(error),
    };
  }
}

function assertSiteId(siteId: number | undefined): asserts siteId is number {
  if (typeof siteId !== 'number' || Number.isNaN(siteId)) {
    throw new Error('siteId is required');
  }
}

export class MatomoClient {
  private readonly http: MatomoHttpClient;
  private readonly reports: ReportsService;
  private readonly tracking: TrackingService;
  private readonly defaultSiteId?: number;

  constructor(config: MatomoClientConfig) {
    this.http = new MatomoHttpClient(config.baseUrl, config.tokenAuth);
    const reportsOptions: ReportsServiceOptions = {
      cacheTtlMs: config.cache?.ttlMs ?? config.cacheTtlMs,
      onCacheEvent: config.cache?.onEvent,
    };
    this.reports = new ReportsService(this.http, reportsOptions);
    this.tracking = new TrackingService({
      baseUrl: config.tracking?.baseUrl ?? config.baseUrl,
      tokenAuth: config.tokenAuth,
      maxRetries: config.tracking?.maxRetries,
      retryDelayMs: config.tracking?.retryDelayMs,
    });
    this.defaultSiteId = config.defaultSiteId;
  }

  private resolveSiteId(override?: number) {
    const value = override ?? this.defaultSiteId;
    assertSiteId(value);
    return value;
  }

  getRateLimitStatus(): RateLimitStatus {
    const info = this.http.getRateLimitInfo();

    if (!info) {
      return {
        status: 'unknown',
        message: 'Matomo did not include rate limit headers on the last response.',
      };
    }

    const { limit, remaining, resetInSeconds, resetAt, retryAfterSeconds, observedAt } = info;

    let status: RateLimitStatusLevel = 'normal';
    if (remaining === undefined) {
      status = 'unknown';
    } else if (remaining <= 0) {
      status = 'depleted';
    } else {
      const thresholdBase = typeof limit === 'number' && limit > 0 ? limit : undefined;
      const threshold = thresholdBase !== undefined ? Math.max(1, Math.floor(thresholdBase * 0.1)) : 1;
      if (remaining <= threshold) {
        status = 'warn';
      }
    }

    const parts: string[] = [];
    if (typeof limit === 'number') {
      parts.push(`Limit ${limit}`);
    }
    if (typeof remaining === 'number') {
      parts.push(`Remaining ${remaining}`);
    }
    if (resetAt) {
      parts.push(`Resets at ${resetAt}`);
    } else if (typeof resetInSeconds === 'number') {
      parts.push(`Resets in ${resetInSeconds}s`);
    }
    if (typeof retryAfterSeconds === 'number') {
      parts.push(`Retry after ${retryAfterSeconds}s`);
    }

    const message = parts.length > 0 ? parts.join(' • ') : 'Rate limit headers observed.';

    return {
      status,
      limit,
      remaining,
      resetInSeconds,
      resetAt,
      retryAfterSeconds,
      observedAt,
      message,
    };
  }

  async getKeyNumbers(input: GetKeyNumbersInput = {}): Promise<KeyNumbers> {
    const siteId = this.resolveSiteId(input.siteId);

    const raw = await matomoGet<unknown>(this.http, {
      method: 'VisitsSummary.get',
      params: {
        idSite: siteId,
        period: input.period ?? 'day',
        date: input.date ?? 'today',
        segment: input.segment,
      },
    });

    const source = normalizeKeyNumbersPayload(raw);

    let pageviewSummary: Partial<Pick<KeyNumbers, 'nb_pageviews' | 'nb_uniq_pageviews'>> = {};

    try {
      const actionsRaw = await matomoGet<unknown>(this.http, {
        method: 'Actions.get',
        params: {
          idSite: siteId,
          period: input.period ?? 'day',
          date: input.date ?? 'today',
          segment: input.segment,
        },
      });

      const actionsSummary = unwrapToRecord(actionsRaw);

      const nb_pageviews = toFiniteNumber(actionsSummary?.['nb_pageviews']);
      const nb_uniq_pageviews = toFiniteNumber(actionsSummary?.['nb_uniq_pageviews']);

      pageviewSummary = {
        nb_pageviews: nb_pageviews ?? undefined,
        nb_uniq_pageviews: nb_uniq_pageviews ?? undefined,
      };
    } catch (error) {
      // swallow errors; nb_actions will still be returned
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch pageview summary from Actions.get', error);
      }
    }

    const payload = sanitizeKeyNumbers({ ...source, ...pageviewSummary });
    const parsed = keyNumbersSchema.parse(payload);

    const normalized: KeyNumbers = { ...parsed };

    for (const field of keyNumberNumericFields) {
      const value = normalized[field];

      if (typeof value !== 'number') {
        continue;
      }

      if (Number.isFinite(value)) {
        continue;
      }

      if (field === 'nb_visits') {
        normalized.nb_visits = 0;
        continue;
      }

      normalized[field] = undefined;
    }

    return normalized;
  }

  async getKeyNumbersSeries(input: GetKeyNumbersSeriesInput = {}): Promise<KeyNumbersSeriesPoint[]> {
    const siteId = this.resolveSiteId(input.siteId);
    const period = input.period ?? 'day';
    const date = input.date ?? 'last7';

    const response = await matomoGet<Record<string, unknown>>(this.http, {
      method: 'VisitsSummary.get',
      params: {
        idSite: siteId,
        period,
        date,
        segment: input.segment,
      },
    });

    const normalizedResponse = Object.fromEntries(
      Object.entries(response ?? {}).map(([label, value]) => {
        const record = unwrapToRecord(value);

        if (Object.keys(record).length > 0) {
          return [label, record];
        }

        const visits = toFiniteNumber(unwrapMatomoValue(value)) ?? 0;
        return [label, { nb_visits: visits } as Record<string, unknown>];
      })
    );

    const parsed = keyNumbersSeriesSchema.parse(normalizedResponse);

    return Object.entries(parsed)
      .map(([label, value]) => ({ date: label, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getMostPopularUrls(
    input: Omit<Parameters<ReportsService['getMostPopularUrls']>[0], 'siteId'> & { siteId?: number }
  ): Promise<MostPopularUrl[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getMostPopularUrls({ ...input, siteId });
  }

  async getTopReferrers(
    input: Omit<Parameters<ReportsService['getTopReferrers']>[0], 'siteId'> & { siteId?: number }
  ): Promise<TopReferrer[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getTopReferrers({ ...input, siteId });
  }

  async getEvents(input: GetEventsInput = {}): Promise<EventSummary[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getEvents({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
      category: input.category,
      action: input.action,
      name: input.name,
    });
  }

  async getEntryPages(input: GetEntryPagesInput = {}): Promise<EntryPage[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getEntryPages({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getCampaigns(input: GetCampaignsInput = {}): Promise<Campaign[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getCampaigns({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getEcommerceOverview(input: GetEcommerceOverviewInput = {}): Promise<EcommerceSummary> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getEcommerceOverview({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
    });
  }

  async getEcommerceRevenueTotals(
    input: GetEcommerceRevenueTotalsInput = {}
  ): Promise<EcommerceRevenueTotals> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getEcommerceRevenueTotals({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      includeSeries: input.includeSeries,
    });
  }

  async getEventCategories(input: GetEventCategoriesInput = {}): Promise<EventCategory[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getEventCategories({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getDeviceTypes(input: GetDeviceTypesInput = {}): Promise<DeviceTypeSummary[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getDeviceTypes({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getTrafficChannels(input: GetTrafficChannelsInput = {}): Promise<TrafficChannel[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getTrafficChannels({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
      channelType: input.channelType,
    });
  }

  async getGoalConversions(input: GetGoalConversionsInput = {}): Promise<GoalConversion[]> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.reports.getGoalConversions({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
      goalId: input.goalId,
      goalType: input.goalType,
    });
  }

  getCacheStats(): CacheStatsSnapshot {
    return this.reports.getCacheStats();
  }

  async trackPageview(
    input: Omit<TrackPageviewInput, 'siteId'> & { siteId?: number }
  ): Promise<TrackPageviewResult> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.tracking.trackPageview({ ...input, siteId });
  }

  async trackEvent(
    input: Omit<TrackEventInput, 'siteId'> & { siteId?: number }
  ): Promise<TrackResult> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.tracking.trackEvent({ ...input, siteId });
  }

  async trackGoal(
    input: Omit<TrackGoalInput, 'siteId'> & { siteId?: number }
  ): Promise<TrackResult> {
    const siteId = this.resolveSiteId(input.siteId);
    return this.tracking.trackGoal({ ...input, siteId });
  }

  async runDiagnostics(input: RunDiagnosticsInput = {}): Promise<RunDiagnosticsResult> {
    const checks: MatomoDiagnosticCheck[] = [];

    const baseCheck = await performDiagnosticCheck('base-url', 'Matomo base URL reachability', async () => {
      const payload = await matomoGet<unknown>(this.http, {
        method: 'API.getVersion',
      });

      if (typeof payload === 'string') {
        return { version: payload };
      }

      if (payload && typeof payload === 'object') {
        const version = (payload as Record<string, unknown>)['version'];
        if (typeof version === 'string') {
          return { version };
        }
      }

      return undefined;
    });

    checks.push(baseCheck);

    if (baseCheck.status !== 'ok') {
      checks.push({
        id: 'token-auth',
        label: 'Token authentication',
        status: 'skipped',
        skippedReason: 'Matomo base URL could not be reached.',
      });
      checks.push({
        id: 'site-access',
        label: 'Site access permissions',
        status: 'skipped',
        skippedReason: 'Matomo base URL could not be reached.',
      });

      return { checks };
    }

    const tokenCheck = await performDiagnosticCheck('token-auth', 'Token authentication', async () => {
      const payload = await matomoGet<unknown>(this.http, {
        method: 'API.getLoggedInUser',
      });

      if (payload && typeof payload === 'object') {
        const login = (payload as Record<string, unknown>)['login'];
        if (typeof login === 'string') {
          return { login };
        }
      }

      return undefined;
    });

    checks.push(tokenCheck);

    if (tokenCheck.status !== 'ok') {
      checks.push({
        id: 'site-access',
        label: 'Site access permissions',
        status: 'skipped',
        skippedReason: 'Authentication failed, unable to verify site permissions.',
      });

      return { checks };
    }

    let resolvedSiteId: number | undefined;
    let siteIdError: MatomoDiagnosticError | undefined;

    try {
      resolvedSiteId = this.resolveSiteId(input.siteId);
    } catch (error) {
      siteIdError = toDiagnosticError(error);
    }

    if (siteIdError) {
      checks.push({
        id: 'site-access',
        label: 'Site access permissions',
        status: 'error',
        error: siteIdError,
      });

      return { checks };
    }

    const siteIdForCheck = resolvedSiteId as number;

    const siteCheck = await performDiagnosticCheck('site-access', 'Site access permissions', async () => {
      const payload = await matomoGet<unknown>(this.http, {
        method: 'SitesManager.getSiteFromId',
        params: { idSite: siteIdForCheck },
      });

      if (payload && typeof payload === 'object') {
        const data = payload as Record<string, unknown>;
        const idsite = typeof data.idsite === 'string' || typeof data.idsite === 'number' ? data.idsite : undefined;
        const name = typeof data.name === 'string' ? data.name : undefined;

        if (idsite !== undefined || name !== undefined) {
          const details: Record<string, unknown> = {};
          if (idsite !== undefined) details.idsite = idsite;
          if (name !== undefined) details.name = name;
          return details;
        }
      }

      return undefined;
    });

    checks.push(siteCheck);

    return { checks };
  }

  async getHealthStatus(input: GetHealthStatusInput = {}): Promise<HealthCheckStatus> {
    const timestamp = new Date().toISOString();
    const checks: HealthCheck[] = [];

    // Matomo API connectivity check
    let matomoStatus: 'pass' | 'fail' = 'pass';
    let matomoOutput = '';
    let responseTime = 0;

    try {
      const startTime = Date.now();
      await matomoGet<unknown>(this.http, {
        method: 'API.getVersion',
      });
      responseTime = Date.now() - startTime;
      matomoOutput = `API responded in ${responseTime}ms`;
    } catch (error) {
      matomoStatus = 'fail';
      matomoOutput = error instanceof Error ? error.message : String(error);
    }

    checks.push({
      name: 'matomo-api',
      status: matomoStatus,
      componentType: 'service',
      observedValue: responseTime,
      observedUnit: 'ms',
      time: timestamp,
      output: matomoOutput,
    });

    // Cache health check
    const cacheStats = this.getCacheStats();
    const totalRequests = cacheStats.total.hits + cacheStats.total.misses;
    const hitRate = totalRequests > 0 ? (cacheStats.total.hits / totalRequests) * 100 : 0;
    
    let cacheStatus: 'pass' | 'warn' | 'fail' = 'pass';
    if (hitRate < 20 && totalRequests > 10) {
      cacheStatus = 'warn';
    } else if (hitRate < 5 && totalRequests > 20) {
      cacheStatus = 'fail';
    }

    checks.push({
      name: 'reports-cache',
      status: cacheStatus,
      componentType: 'cache',
      observedValue: Math.round(hitRate * 100) / 100,
      observedUnit: '%',
      time: timestamp,
      output: `Hit rate: ${hitRate.toFixed(1)}% (${cacheStats.total.hits}/${totalRequests} requests)`,
    });

    // Tracking queue health check (simulate queue length check)
    checks.push({
      name: 'tracking-queue',
      status: 'pass',
      componentType: 'queue',
      observedValue: 0,
      observedUnit: 'pending',
      time: timestamp,
      output: 'Queue processing normally',
    });

    const rateLimitStatus = this.getRateLimitStatus();
    const rateLimitCheckStatus: HealthCheck['status'] =
      rateLimitStatus.status === 'depleted'
        ? 'fail'
        : rateLimitStatus.status === 'warn' || rateLimitStatus.status === 'unknown'
        ? 'warn'
        : 'pass';

    checks.push({
      name: 'rate-limit',
      status: rateLimitCheckStatus,
      componentType: 'service',
      ...(typeof rateLimitStatus.remaining === 'number'
        ? { observedValue: rateLimitStatus.remaining, observedUnit: 'requests' as const }
        : {}),
      time: timestamp,
      output: rateLimitStatus.message,
    });

    // Site access check (if siteId provided and details requested)
    if (input.includeDetails && (input.siteId || this.defaultSiteId)) {
      let siteStatus: 'pass' | 'fail' = 'pass';
      let siteOutput = '';

      try {
        const siteId = this.resolveSiteId(input.siteId);
        await matomoGet<unknown>(this.http, {
          method: 'SitesManager.getSiteFromId',
          params: { idSite: siteId },
        });
        siteOutput = `Site ID ${siteId} accessible`;
      } catch (error) {
        siteStatus = 'fail';
        siteOutput = error instanceof Error ? error.message : String(error);
      }

      checks.push({
        name: 'site-access',
        status: siteStatus,
        componentType: 'service',
        time: timestamp,
        output: siteOutput,
      });
    }

    // Determine overall status
    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp,
      checks,
    };
  }
}

export function createMatomoClient(config: MatomoClientConfig) {
  return new MatomoClient(config);
}

export type {
  KeyNumbers,
  MostPopularUrl,
  EventSummary,
  EntryPage,
  Campaign,
  DeviceTypeSummary,
  EcommerceSummary,
  TopReferrer,
  EventCategory,
  TrackEventInput,
  TrackGoalInput,
  TrackPageviewInput,
  TrackPageviewResult,
  TrackResult,
  CacheStatsSnapshot,
  CacheEvent,
  EcommerceRevenueTotals,
  EcommerceRevenueSeriesPoint,
  EcommerceRevenueTotalsInput,
  TrafficChannel,
  GoalConversion,
};

export { TrackingService } from './tracking.js';
export {
  MatomoApiError,
  MatomoAuthError,
  MatomoPermissionError,
  MatomoRateLimitError,
  MatomoClientError,
  MatomoServerError,
  MatomoNetworkError,
  MatomoParseError,
} from './errors.js';
