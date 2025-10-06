import 'dotenv/config';

import { fileURLToPath } from 'node:url';

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { Parameter, ParameterType, ToolsService } from '@optimizely-opal/opal-tools-sdk';
import { createMatomoClient, loadSiteIndexFromEnv, loadSiteIndexFromFile } from '@matokit/sdk';

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }

  const numeric = Number.parseInt(String(value), 10);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function parseRequiredNumber(value: unknown, field: string): number {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function requireString(value: unknown, field: string): string {
  const parsed = parseOptionalString(value);
  if (!parsed) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

export function buildServer() {
  const app = express();
  app.use(express.json());

  const bearerToken = process.env.OPAL_BEARER_TOKEN?.trim();

  if (!bearerToken || bearerToken === 'change-me') {
    throw new Error('OPAL_BEARER_TOKEN must be set to a non-default value before starting the service.');
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/tools')) {
      return next();
    }

    const header = req.headers.authorization;
    if (!header || header !== `Bearer ${bearerToken}`) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="MatomoTools"');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
  });

  const defaultSiteId = parseOptionalNumber(process.env.MATOMO_DEFAULT_SITE_ID ?? '1');
  const siteIndexPath = process.env.MATOKIT_SITE_INDEX_PATH?.trim();
  const siteMapEnv = process.env.MATOMO_SITE_MAP?.trim();
  const parsedDefaultSiteId = defaultSiteId ?? undefined;

  const siteIndex = siteMapEnv
    ? loadSiteIndexFromEnv(
        siteMapEnv,
        parsedDefaultSiteId !== undefined ? { defaultSiteId: parsedDefaultSiteId } : undefined
      )
    : siteIndexPath
      ? loadSiteIndexFromFile(siteIndexPath)
      : undefined;

  const matomoClient = createMatomoClient({
    baseUrl: process.env.MATOMO_BASE_URL || 'https://matomo.surputte.se',
    tokenAuth: process.env.MATOMO_TOKEN || 'set-me',
    defaultSiteId: parsedDefaultSiteId,
    siteIndex,
  });

  const toolsService = new ToolsService(app);

  const siteIdParam = new Parameter('siteId', ParameterType.Integer, 'Override site ID (defaults to MATOMO_DEFAULT_SITE_ID)', false);
  const periodParam = new Parameter('period', ParameterType.String, 'Matomo period (day, week, month, year, range)', false);
  const dateParam = new Parameter('date', ParameterType.String, 'Date or range (YYYY-MM-DD, today, yesterday, last7, etc.)', false);
  const segmentParam = new Parameter('segment', ParameterType.String, 'Matomo segment expression', false);
  const limitParam = new Parameter('limit', ParameterType.Integer, 'Maximum number of records to return', false);
  const pageUrlParam = new Parameter('url', ParameterType.String, 'Absolute URL for the pageview', true);
  const eventUrlParam = new Parameter('url', ParameterType.String, 'Absolute URL associated with the event or goal', false);
  const actionNameParam = new Parameter('actionName', ParameterType.String, 'Human-readable page title', false);
  const pvIdParam = new Parameter('pvId', ParameterType.String, 'Provide an existing Matomo pv_id for continuity', false);
  const visitorIdParam = new Parameter('visitorId', ParameterType.String, '16-character Matomo visitor ID', false);
  const uidParam = new Parameter('uid', ParameterType.String, 'User identifier for Matomo', false);
  const referrerParam = new Parameter('referrer', ParameterType.String, 'Referrer URL', false);
  const timestampParam = new Parameter('timestamp', ParameterType.Integer, 'Event timestamp (ms since epoch)', false);
  const categoryParam = new Parameter('category', ParameterType.String, 'Event category', true);
  const actionParam = new Parameter('action', ParameterType.String, 'Event action', true);
  const nameParam = new Parameter('name', ParameterType.String, 'Event name', false);
  const valueParam = new Parameter('value', ParameterType.Integer, 'Event value', false);
  const goalIdParam = new Parameter('goalId', ParameterType.Integer, 'Goal identifier', true);
  const revenueParam = new Parameter('revenue', ParameterType.Number, 'Goal revenue amount', false);
  const eventCategoryFilterParam = new Parameter('category', ParameterType.String, 'Filter by event category', false);
  const eventActionFilterParam = new Parameter('action', ParameterType.String, 'Filter by event action', false);
  const eventNameFilterParam = new Parameter('name', ParameterType.String, 'Filter by event name', false);
  const includeSeriesParam = new Parameter(
    'includeSeries',
    ParameterType.Boolean,
    'Include per-period breakdown for ecommerce revenue totals',
    false
  );
  const channelTypeParam = new Parameter(
    'channelType',
    ParameterType.String,
    'Filter traffic channels to a specific type (e.g., direct, search, social)',
    false
  );
  const goalFilterIdParam = new Parameter(
    'goalId',
    ParameterType.String,
    'Filter to a specific Matomo goal (numeric id or special goal name)',
    false
  );
  const goalTypeFilterParam = new Parameter(
    'goalType',
    ParameterType.String,
    'Filter goal conversions by Matomo goal type (ecommerce, manual, etc.)',
    false
  );

  toolsService.registerTool(
    'GetKeyNumbers',
    'Returns Matomo key metrics for the selected period and date.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getKeyNumbers({ siteId, period, date, segment });
    },
    [siteIdParam, periodParam, dateParam, segmentParam],
    '/tools/get-key-numbers'
  );

  toolsService.registerTool(
    'DiagnoseMatomo',
    'Runs connectivity and permission checks against the configured Matomo instance.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      return matomoClient.runDiagnostics({ siteId });
    },
    [siteIdParam],
    '/tools/diagnose-matomo'
  );

  const includeDetailsParam = new Parameter('includeDetails', ParameterType.Boolean, 'Include detailed site access checks', false);

  toolsService.registerTool(
    'GetHealthStatus',
    'Returns comprehensive health status for Matomo API, cache, and dependencies.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const includeDetails = Boolean(parameters?.['includeDetails']);
      return matomoClient.getHealthStatus({ siteId, includeDetails });
    },
    [siteIdParam, includeDetailsParam],
    '/tools/get-health-status'
  );

  toolsService.registerTool(
    'GetKeyNumbersHistorical',
    'Returns key metrics broken down per period for multi-day comparisons.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getKeyNumbersSeries({
        siteId,
        period: period ?? 'day',
        date: date ?? 'last7',
        segment,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam],
    '/tools/get-key-numbers-historical'
  );

  toolsService.registerTool(
    'GetMostPopularUrls',
    'Retrieves the most visited pages for the selected period and date.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getMostPopularUrls({ siteId, period: period ?? 'day', date: date ?? 'today', segment, limit });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam],
    '/tools/get-most-popular-urls'
  );

  toolsService.registerTool(
    'GetTopReferrers',
    'Lists the top referrers driving traffic for the selected period.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getTopReferrers({ siteId, period: period ?? 'day', date: date ?? 'today', segment, limit });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam],
    '/tools/get-top-referrers'
  );

  toolsService.registerTool(
    'GetEntryPages',
    'Returns the most common entry pages for the selected time range.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getEntryPages({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam],
    '/tools/get-entry-pages'
  );

  toolsService.registerTool(
    'GetCampaigns',
    'Lists campaign-level referrer metrics.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getCampaigns({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam],
    '/tools/get-campaigns'
  );

  toolsService.registerTool(
    'GetEcommerceOverview',
    'Returns ecommerce order revenue and conversion metrics for the selected period.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getEcommerceOverview({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam],
    '/tools/get-ecommerce-overview'
  );

  toolsService.registerTool(
    'GetEcommerceRevenue',
    'Aggregates ecommerce revenue totals with optional per-period breakdown.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const includeSeriesValue = parameters?.['includeSeries'];
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;
      const includeSeries =
        typeof includeSeriesValue === 'boolean'
          ? includeSeriesValue
          : typeof includeSeriesValue === 'string'
          ? includeSeriesValue.toLowerCase() === 'true'
          : undefined;

      return matomoClient.getEcommerceRevenueTotals({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        includeSeries,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, includeSeriesParam],
    '/tools/get-ecommerce-revenue'
  );

  toolsService.registerTool(
    'GetTrafficChannels',
    'Provides a high-level breakdown of traffic sources (direct, search, social, referrals, campaigns).',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const channelType = parseOptionalString(parameters?.['channelType']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getTrafficChannels({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
        channelType,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam, channelTypeParam],
    '/tools/get-traffic-channels'
  );

  toolsService.registerTool(
    'GetGoalConversions',
    'Returns goal conversion metrics with optional filtering by goal or type.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const goalIdValue = parameters?.['goalId'];
      const goalType = parseOptionalString(parameters?.['goalType']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      const goalIdNumeric = parseOptionalNumber(goalIdValue);
      const goalIdString = parseOptionalString(goalIdValue);
      const goalId = goalIdString ?? goalIdNumeric;

      return matomoClient.getGoalConversions({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
        goalId,
        goalType,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam, goalFilterIdParam, goalTypeFilterParam],
    '/tools/get-goal-conversions'
  );

  toolsService.registerTool(
    'GetEvents',
    'Returns aggregate event metrics optionally filtered by category, action, or name.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const category = parseOptionalString(parameters?.['category']);
      const action = parseOptionalString(parameters?.['action']);
      const name = parseOptionalString(parameters?.['name']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getEvents({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
        category,
        action,
        name,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam, eventCategoryFilterParam, eventActionFilterParam, eventNameFilterParam],
    '/tools/get-events'
  );

  toolsService.registerTool(
    'GetEventCategories',
    'Summarizes events grouped by category with aggregate counts and values.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getEventCategories({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam],
    '/tools/get-event-categories'
  );

  toolsService.registerTool(
    'GetDeviceTypes',
    'Breaks down visits by high-level device categories (desktop, mobile, tablet).',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const periodValue = parameters?.['period'];
      const dateValue = parameters?.['date'];
      const segmentValue = parameters?.['segment'];
      const limit = parseOptionalNumber(parameters?.['limit']);
      const period = typeof periodValue === 'string' ? periodValue : undefined;
      const date = typeof dateValue === 'string' ? dateValue : undefined;
      const segment = typeof segmentValue === 'string' ? segmentValue : undefined;

      return matomoClient.getDeviceTypes({
        siteId,
        period: period ?? 'day',
        date: date ?? 'today',
        segment,
        limit,
      });
    },
    [siteIdParam, periodParam, dateParam, segmentParam, limitParam],
    '/tools/get-device-types'
  );

  toolsService.registerTool(
    'TrackPageview',
    'Records a server-side pageview with optional pv_id continuity.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const url = requireString(parameters?.['url'], 'url');
      const actionName = parseOptionalString(parameters?.['actionName']);
      const pvId = parseOptionalString(parameters?.['pvId']);
      const visitorId = parseOptionalString(parameters?.['visitorId']);
      const uid = parseOptionalString(parameters?.['uid']);
      const referrer = parseOptionalString(parameters?.['referrer']);
      const timestamp = parseOptionalNumber(parameters?.['timestamp']);

      const result = await matomoClient.trackPageview({
        siteId,
        url,
        actionName,
        pvId,
        visitorId,
        uid,
        referrer,
        ts: timestamp,
      });

      return { ok: result.ok, status: result.status, pvId: result.pvId };
    },
    [
      siteIdParam,
      pageUrlParam,
      actionNameParam,
      pvIdParam,
      visitorIdParam,
      uidParam,
      referrerParam,
      timestampParam,
    ],
    '/track/pageview'
  );

  toolsService.registerTool(
    'TrackEvent',
    'Records a Matomo custom event.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const category = requireString(parameters?.['category'], 'category');
      const action = requireString(parameters?.['action'], 'action');
      const name = parseOptionalString(parameters?.['name']);
      const value = parseOptionalNumber(parameters?.['value']);
      const url = parseOptionalString(parameters?.['url']);
      const visitorId = parseOptionalString(parameters?.['visitorId']);
      const uid = parseOptionalString(parameters?.['uid']);
      const referrer = parseOptionalString(parameters?.['referrer']);
      const timestamp = parseOptionalNumber(parameters?.['timestamp']);

      const result = await matomoClient.trackEvent({
        siteId,
        category,
        action,
        name,
        value,
        url,
        visitorId,
        uid,
        referrer,
        ts: timestamp,
      });

      return { ok: result.ok, status: result.status };
    },
    [
      siteIdParam,
      categoryParam,
      actionParam,
      nameParam,
      valueParam,
      eventUrlParam,
      visitorIdParam,
      uidParam,
      referrerParam,
      timestampParam,
    ],
    '/track/event'
  );

  toolsService.registerTool(
    'TrackGoal',
    'Records a goal conversion.',
    async (parameters: Record<string, unknown>) => {
      const siteId = parseOptionalNumber(parameters?.['siteId']);
      const goalId = parseRequiredNumber(parameters?.['goalId'], 'goalId');
      const revenue = parseOptionalNumber(parameters?.['revenue']);
      const url = parseOptionalString(parameters?.['url']);
      const visitorId = parseOptionalString(parameters?.['visitorId']);
      const uid = parseOptionalString(parameters?.['uid']);
      const referrer = parseOptionalString(parameters?.['referrer']);
      const timestamp = parseOptionalNumber(parameters?.['timestamp']);

      const result = await matomoClient.trackGoal({
        siteId,
        goalId,
        revenue,
        url,
        visitorId,
        uid,
        referrer,
        ts: timestamp,
      });

      return { ok: result.ok, status: result.status };
    },
    [
      siteIdParam,
      goalIdParam,
      revenueParam,
      eventUrlParam,
      visitorIdParam,
      uidParam,
      referrerParam,
      timestampParam,
    ],
    '/track/goal'
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}

async function start() {
  const app = buildServer();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  return new Promise<void>((resolve, reject) => {
    app
      .listen(port, host, () => {
        // eslint-disable-next-line no-console
        console.log(`Server listening on http://${host}:${port}`);
        resolve();
      })
      .on('error', reject);
  });
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  start().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
