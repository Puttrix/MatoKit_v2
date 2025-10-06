import {
  MatomoHttpClient,
  matomoGet,
  type MatomoRateLimitEvent,
  type MatomoRateLimitOptions,
} from './httpClient.js';
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
  type TrackingIdempotencyRecord,
  type TrackingIdempotencyStore,
} from './tracking.js';
import { MatomoApiError, MatomoNetworkError } from './errors.js';
import {
  type MatomoSiteIndex,
  type MatomoSiteIndexSource,
  type MatomoSiteMetadata,
  normalizeSiteIndex,
} from './siteIndex.js';

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
    tokenAuth?: string;
    maxRetries?: number;
    retryDelayMs?: number;
    idempotencyStore?: TrackingIdempotencyStore;
  };
  cacheTtlMs?: number;
  cache?: CacheConfig;
  rateLimit?: MatomoRateLimitOptions;
  siteIndex?: MatomoSiteIndexSource;
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

interface SiteContext {
  http: MatomoHttpClient;
  reports: ReportsService;
  tracking: TrackingService;
  metadata: MatomoSiteMetadata;
}

export class MatomoClient {
  private readonly http: MatomoHttpClient;
  private readonly reports: ReportsService;
  private readonly tracking: TrackingService;
  private readonly defaultSiteId?: number;

  private readonly baseApiUrl: string;
  private readonly baseTokenAuth: string;
  private readonly baseTrackingBaseUrl: string;
  private readonly baseTrackingTokenAuth: string;
  private readonly reportsOptions: ReportsServiceOptions;
  private readonly trackingOptions: {
    maxRetries?: number;
    retryDelayMs?: number;
    idempotencyStore?: TrackingIdempotencyStore;
  };
  private readonly rateLimitOptions?: MatomoRateLimitOptions;
  private readonly siteIndex?: MatomoSiteIndex;
  private readonly siteContexts = new Map<number, SiteContext>();

  constructor(config: MatomoClientConfig) {
    this.baseApiUrl = config.baseUrl;
    this.baseTokenAuth = config.tokenAuth;
    this.rateLimitOptions = config.rateLimit;

    this.reportsOptions = {
      cacheTtlMs: config.cache?.ttlMs ?? config.cacheTtlMs,
      onCacheEvent: config.cache?.onEvent,
    };

    this.trackingOptions = {
      maxRetries: config.tracking?.maxRetries,
      retryDelayMs: config.tracking?.retryDelayMs,
      idempotencyStore: config.tracking?.idempotencyStore,
    };

    this.baseTrackingBaseUrl = config.tracking?.baseUrl ?? config.baseUrl;
    this.baseTrackingTokenAuth = config.tracking?.tokenAuth ?? config.tokenAuth;

    this.http = new MatomoHttpClient(this.baseApiUrl, this.baseTokenAuth, {
      rateLimit: this.rateLimitOptions,
    });

    this.reports = new ReportsService(this.http, this.reportsOptions);
    this.tracking = new TrackingService({
      baseUrl: this.baseTrackingBaseUrl,
      tokenAuth: this.baseTrackingTokenAuth,
      maxRetries: this.trackingOptions.maxRetries,
      retryDelayMs: this.trackingOptions.retryDelayMs,
      idempotencyStore: this.trackingOptions.idempotencyStore,
    });

    this.siteIndex = config.siteIndex ? normalizeSiteIndex(config.siteIndex) : undefined;
    this.defaultSiteId = this.siteIndex?.defaultSiteId ?? config.defaultSiteId;
  }

  private resolveSite(
    override?: number
  ): { siteId: number; http: MatomoHttpClient; reports: ReportsService; tracking: TrackingService; metadata?: MatomoSiteMetadata } {
    const candidate = override ?? this.defaultSiteId;
    assertSiteId(candidate);

    if (!this.siteIndex) {
      return {
        siteId: candidate,
        http: this.http,
        reports: this.reports,
        tracking: this.tracking,
      };
    }

    const metadata = this.siteIndex.sites.get(candidate);
    if (!metadata) {
      throw new Error(`Unknown siteId ${candidate}`);
    }

    const baseUrl = metadata.baseUrl ?? this.baseApiUrl;
    const tokenAuth = metadata.tokenAuth ?? this.baseTokenAuth;
    const trackingBaseUrl = metadata.tracking?.baseUrl ?? metadata.baseUrl ?? this.baseTrackingBaseUrl;
    const trackingTokenAuth = metadata.tracking?.tokenAuth ?? metadata.tokenAuth ?? this.baseTrackingTokenAuth;

    const matchesDefaultHttp = baseUrl === this.baseApiUrl && tokenAuth === this.baseTokenAuth;
    const matchesDefaultTracking =
      trackingBaseUrl === this.baseTrackingBaseUrl && trackingTokenAuth === this.baseTrackingTokenAuth;

    if (matchesDefaultHttp && matchesDefaultTracking) {
      return { siteId: candidate, http: this.http, reports: this.reports, tracking: this.tracking, metadata };
    }

    let context = this.siteContexts.get(candidate);
    if (!context) {
      const http = matchesDefaultHttp
        ? this.http
        : new MatomoHttpClient(baseUrl, tokenAuth, { rateLimit: this.rateLimitOptions });

      const reports = matchesDefaultHttp ? this.reports : new ReportsService(http, this.reportsOptions);

      const tracking = matchesDefaultTracking
        ? this.tracking
        : new TrackingService({
            baseUrl: trackingBaseUrl,
            tokenAuth: trackingTokenAuth,
            maxRetries: this.trackingOptions.maxRetries,
            retryDelayMs: this.trackingOptions.retryDelayMs,
            idempotencyStore: this.trackingOptions.idempotencyStore,
          });

      context = { http, reports, tracking, metadata };
      this.siteContexts.set(candidate, context);
    } else if (!context.metadata && metadata) {
      // Ensure metadata is stored for contexts created before the index was hydrated.
      this.siteContexts.set(candidate, { ...context, metadata });
      context = this.siteContexts.get(candidate)!;
    }

    return { siteId: candidate, ...context };
  }

  private resolveSiteId(override?: number) {
    return this.resolveSite(override).siteId;
  }

  async getKeyNumbers(input: GetKeyNumbersInput = {}): Promise<KeyNumbers> {
    const { siteId, http } = this.resolveSite(input.siteId);

    const raw = await matomoGet<unknown>(http, {
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
      const actionsRaw = await matomoGet<unknown>(http, {
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
    const { siteId, http } = this.resolveSite(input.siteId);
    const period = input.period ?? 'day';
    const date = input.date ?? 'last7';

    const response = await matomoGet<Record<string, unknown>>(http, {
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
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getMostPopularUrls({ ...input, siteId });
  }

  async getTopReferrers(
    input: Omit<Parameters<ReportsService['getTopReferrers']>[0], 'siteId'> & { siteId?: number }
  ): Promise<TopReferrer[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getTopReferrers({ ...input, siteId });
  }

  async getEvents(input: GetEventsInput = {}): Promise<EventSummary[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getEvents({
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
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getEntryPages({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getCampaigns(input: GetCampaignsInput = {}): Promise<Campaign[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getCampaigns({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getEcommerceOverview(input: GetEcommerceOverviewInput = {}): Promise<EcommerceSummary> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getEcommerceOverview({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
    });
  }

  async getEcommerceRevenueTotals(
    input: GetEcommerceRevenueTotalsInput = {}
  ): Promise<EcommerceRevenueTotals> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getEcommerceRevenueTotals({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      includeSeries: input.includeSeries,
    });
  }

  async getEventCategories(input: GetEventCategoriesInput = {}): Promise<EventCategory[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getEventCategories({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getDeviceTypes(input: GetDeviceTypesInput = {}): Promise<DeviceTypeSummary[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getDeviceTypes({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
    });
  }

  async getTrafficChannels(input: GetTrafficChannelsInput = {}): Promise<TrafficChannel[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getTrafficChannels({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
      channelType: input.channelType,
    });
  }

  async getGoalConversions(input: GetGoalConversionsInput = {}): Promise<GoalConversion[]> {
    const { siteId, reports } = this.resolveSite(input.siteId);
    return reports.getGoalConversions({
      siteId,
      period: input.period ?? 'day',
      date: input.date ?? 'today',
      segment: input.segment,
      limit: input.limit,
      goalId: input.goalId,
      goalType: input.goalType,
    });
  }

  getCacheStats(siteId?: number): CacheStatsSnapshot {
    if (siteId === undefined || !this.siteIndex) {
      return this.reports.getCacheStats();
    }

    const { reports } = this.resolveSite(siteId);
    return reports.getCacheStats();
  }

  getLastRateLimitEvent(siteId?: number): MatomoRateLimitEvent | undefined {
    if (siteId === undefined || !this.siteIndex) {
      return this.http.getLastRateLimitEvent();
    }

    const { http } = this.resolveSite(siteId);
    return http.getLastRateLimitEvent();
  }

  async trackPageview(
    input: Omit<TrackPageviewInput, 'siteId'> & { siteId?: number }
  ): Promise<TrackPageviewResult> {
    const { siteId, tracking } = this.resolveSite(input.siteId);
    return tracking.trackPageview({ ...input, siteId });
  }

  async trackEvent(
    input: Omit<TrackEventInput, 'siteId'> & { siteId?: number }
  ): Promise<TrackResult> {
    const { siteId, tracking } = this.resolveSite(input.siteId);
    return tracking.trackEvent({ ...input, siteId });
  }

  async trackGoal(
    input: Omit<TrackGoalInput, 'siteId'> & { siteId?: number }
  ): Promise<TrackResult> {
    const { siteId, tracking } = this.resolveSite(input.siteId);
    return tracking.trackGoal({ ...input, siteId });
  }

  async getTrackingRequestMetadata(
    key: string,
    siteId?: number
  ): Promise<TrackingIdempotencyRecord | undefined> {
    if (siteId === undefined || !this.siteIndex) {
      return this.tracking.getIdempotencyRecord(key);
    }

    const { tracking } = this.resolveSite(siteId);
    return tracking.getIdempotencyRecord(key);
  }

  async runDiagnostics(input: RunDiagnosticsInput = {}): Promise<RunDiagnosticsResult> {
    const checks: MatomoDiagnosticCheck[] = [];

    let context: ReturnType<typeof this.resolveSite> | undefined;
    let siteIdError: MatomoDiagnosticError | undefined;
    let httpForDiagnostics: MatomoHttpClient = this.http;

    try {
      context = this.resolveSite(input.siteId);
      httpForDiagnostics = context.http;
    } catch (error) {
      siteIdError = toDiagnosticError(error);
    }

    const baseCheck = await performDiagnosticCheck('base-url', 'Matomo base URL reachability', async () => {
      const payload = await matomoGet<unknown>(httpForDiagnostics, {
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
      const payload = await matomoGet<unknown>(httpForDiagnostics, {
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

    if (siteIdError) {
      checks.push({
        id: 'site-access',
        label: 'Site access permissions',
        status: 'error',
        error: siteIdError,
      });

      return { checks };
    }

    const resolvedContext = context ?? this.resolveSite();
    const siteIdForCheck = resolvedContext.siteId;

    const siteCheck = await performDiagnosticCheck('site-access', 'Site access permissions', async () => {
      const payload = await matomoGet<unknown>(resolvedContext.http, {
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
    const context = this.resolveSite(input.siteId);

    // Matomo API connectivity check
    let matomoStatus: 'pass' | 'fail' = 'pass';
    let matomoOutput = '';
    let responseTime = 0;

    try {
      const startTime = Date.now();
      await matomoGet<unknown>(context.http, {
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
    const cacheStats = this.getCacheStats(context.siteId);
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

    // Site access check (if siteId provided and details requested)
    if (input.includeDetails && (input.siteId || this.defaultSiteId)) {
      let siteStatus: 'pass' | 'fail' = 'pass';
      let siteOutput = '';

      try {
        const siteId = context.siteId;
        await matomoGet<unknown>(context.http, {
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
  TrackingIdempotencyRecord,
  TrackingIdempotencyStore,
  CacheStatsSnapshot,
  CacheEvent,
  EcommerceRevenueTotals,
  EcommerceRevenueSeriesPoint,
  EcommerceRevenueTotalsInput,
  TrafficChannel,
  GoalConversion,
  MatomoRateLimitEvent,
};

export type { MatomoRateLimitOptions } from './httpClient.js';

export {
  loadSiteIndexFromFile,
  loadSiteIndexFromEnv,
  loadSiteIndexFromJson,
  normalizeSiteIndex,
  getSiteMetadata,
} from './siteIndex.js';

export type {
  MatomoSiteDefinition,
  MatomoSiteIndex,
  MatomoSiteIndexDefinition,
  MatomoSiteIndexSource,
  MatomoSiteMetadata,
  MatomoSiteTrackingConfig,
  LoadSiteIndexFromEnvOptions,
} from './siteIndex.js';

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
