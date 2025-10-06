import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMatomoClient } from '../src/index.js';

const baseUrl = 'https://matomo.example.com';
const token = 'token';

const createFetchMock = <T>(data: T) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  });

const createSequencedFetchMock = (responses: unknown[]) => {
  const mock = vi.fn();
  responses.forEach(response => {
    mock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => response,
      text: async () => JSON.stringify(response),
    });
  });
  return mock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MatomoClient', () => {
  it('throws when siteId is missing', async () => {
    const client = createMatomoClient({ baseUrl, tokenAuth: token });
    await expect(client.getKeyNumbers()).rejects.toThrow('siteId is required');
  });

  it('resolves default site ID when provided and merges pageview totals', async () => {
    const fetchMock = createSequencedFetchMock([{ nb_visits: 42 }, { nb_pageviews: 149, nb_uniq_pageviews: 140 }]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 5 });
    const result = await client.getKeyNumbers();

    expect(result.nb_visits).toEqual(42);
    expect(result.nb_pageviews).toEqual(149);
    expect(result.nb_uniq_pageviews).toEqual(140);

    const firstUrl = new URL((fetchMock.mock.calls[0] ?? [])[0] as string);
    expect(firstUrl.searchParams.get('idSite')).toBe('5');

    const secondUrl = new URL((fetchMock.mock.calls[1] ?? [])[0] as string);
    expect(secondUrl.searchParams.get('method')).toBe('Actions.get');
    expect(secondUrl.searchParams.get('idSite')).toBe('5');
  });

  it('guards against NaN responses from Matomo key numbers', async () => {
    const fetchMock = createSequencedFetchMock([
      {
        nb_visits: 'NaN',
        nb_actions: 'NaN',
        nb_visits_converted: false,
        sum_visit_length: '',
      },
      { nb_pageviews: 'NaN', nb_uniq_pageviews: 'NaN' },
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 8 });
    const result = await client.getKeyNumbers();

    expect(result.nb_visits).toBe(0);
    expect(result.nb_actions).toBeUndefined();
    expect(result.nb_visits_converted).toBeUndefined();
    expect(result.nb_pageviews).toBeUndefined();
  });

  it('coerces scalar key number payloads into objects', async () => {
    const fetchMock = createSequencedFetchMock(['0', { nb_pageviews: '0' }]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 11 });
    const result = await client.getKeyNumbers();

    expect(result.nb_visits).toBe(0);
    expect(result.nb_pageviews).toBe(0);
  });

  it('uses site index overrides for API calls', async () => {
    const fetchMock = createSequencedFetchMock([
      { nb_visits: 7 },
      { nb_pageviews: 15, nb_uniq_pageviews: 14 },
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({
      baseUrl,
      tokenAuth: token,
      siteIndex: {
        defaultSiteId: 7,
        sites: {
          '7': { name: 'Primary', baseUrl, tokenAuth: token },
          '9': {
            name: 'Secondary',
            baseUrl: 'https://matomo.secondary.example.com',
            tokenAuth: 'secondary-token',
          },
        },
      },
    });

    await client.getKeyNumbers({ siteId: 9 });

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.origin + requestUrl.pathname).toBe('https://matomo.secondary.example.com/index.php');
    expect(requestUrl.searchParams.get('idSite')).toBe('9');
    expect(requestUrl.searchParams.get('token_auth')).toBe('secondary-token');
  });

  it('falls back to index default site when config default is omitted', async () => {
    const fetchMock = createSequencedFetchMock([{ nb_visits: 3 }, { nb_pageviews: 8 }]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({
      baseUrl,
      tokenAuth: token,
      siteIndex: {
        defaultSiteId: 4,
        sites: {
          '4': { name: 'Marketing Site' },
        },
      },
    });

    await client.getKeyNumbers();

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('idSite')).toBe('4');
  });

  it('throws when siteId is missing from the site index', async () => {
    const client = createMatomoClient({
      baseUrl,
      tokenAuth: token,
      siteIndex: {
        defaultSiteId: 2,
        sites: {
          '2': { name: 'Main Site' },
        },
      },
    });

    await expect(client.getKeyNumbers({ siteId: 99 })).rejects.toThrow('Unknown siteId 99');
  });

  it('unwraps array key number payloads returned by Matomo', async () => {
    const fetchMock = createSequencedFetchMock([
      [{ nb_visits: 5, nb_actions: '10' }],
      [{ nb_pageviews: '15', nb_uniq_pageviews: '12' }],
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 13 });
    const result = await client.getKeyNumbers();

    expect(result.nb_visits).toBe(5);
    expect(result.nb_actions).toBe(10);
    expect(result.nb_pageviews).toBe(15);
    expect(result.nb_uniq_pageviews).toBe(12);
  });

  it('falls back to nb_visits_series totals when aggregate visits are NaN', async () => {
    const fetchMock = createSequencedFetchMock([
      {
        nb_visits: 'NaN',
        nb_visits_series: {
          '2024-01-01': '12',
          '2024-01-02': 8,
        },
        nb_actions: 'NaN',
      },
      { nb_pageviews: 'NaN', nb_uniq_pageviews: 'NaN' },
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 2 });
    const result = await client.getKeyNumbers({ period: 'week', date: 'last2' });

    expect(result.nb_visits).toBe(20);
  });

  it('normalizes non-finite visit totals for longer ranges and parses pageview strings', async () => {
    const fetchMock = createSequencedFetchMock([
      {
        nb_visits: 'NaN',
        nb_actions: '12',
        nb_uniq_visitors: '0',
      },
      { nb_pageviews: '450', nb_uniq_pageviews: '325' },
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 6 });
    const result = await client.getKeyNumbers({ period: 'week', date: 'last4' });

    expect(result.nb_visits).toBe(0);
    expect(result.nb_pageviews).toBe(450);
    expect(result.nb_uniq_pageviews).toBe(325);
    expect(result.nb_actions).toBe(12);

    const firstRequest = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstRequest.searchParams.get('period')).toBe('week');
    expect(firstRequest.searchParams.get('date')).toBe('last4');
  });

  it('returns key number series sorted by date', async () => {
    const seriesData = {
      '2024-01-02': { nb_visits: 2, nb_pageviews: 5 },
      '2024-01-01': { nb_visits: 1, nb_pageviews: 3 },
    };

    const fetchMock = createFetchMock(seriesData);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 3 });
    const result = await client.getKeyNumbersSeries({ date: 'last2' });

    expect(result).toEqual([
      { date: '2024-01-01', nb_visits: 1, nb_pageviews: 3 },
      { date: '2024-01-02', nb_visits: 2, nb_pageviews: 5 },
    ]);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('VisitsSummary.get');
    expect(url.searchParams.get('date')).toBe('last2');
  });

  it('coerces scalar series entries into key number objects', async () => {
    const seriesData = {
      '2025-08-01': 0,
      '2025-08-02': '3',
    };

    const fetchMock = createFetchMock(seriesData);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 12 });
    const result = await client.getKeyNumbersSeries({ date: '2025-08-01,2025-08-02', period: 'day' });

    expect(result).toEqual([
      { date: '2025-08-01', nb_visits: 0 },
      { date: '2025-08-02', nb_visits: 3 },
    ]);
  });

  it('unwraps array entries returned in key number series', async () => {
    const seriesData = {
      '2025-08-01': [{ nb_visits: '4', nb_pageviews: '6' }],
      '2025-08-02': [[{ nb_visits: 2 }]],
    } as Record<string, unknown>;

    const fetchMock = createFetchMock(seriesData);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 14 });
    const result = await client.getKeyNumbersSeries({ date: '2025-08-01,2025-08-02', period: 'day' });

    expect(result).toEqual([
      { date: '2025-08-01', nb_visits: 4, nb_pageviews: 6 },
      { date: '2025-08-02', nb_visits: 2 },
    ]);
  });

  it('runs diagnostics and reports successful checks', async () => {
    const fetchMock = createSequencedFetchMock([
      '5.0.0',
      { login: 'superuser' },
      { idsite: '1', name: 'Demo Site' },
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 1 });
    const result = await client.runDiagnostics();

    expect(result.checks).toEqual([
      {
        id: 'base-url',
        label: 'Matomo base URL reachability',
        status: 'ok',
        details: { version: '5.0.0' },
      },
      {
        id: 'token-auth',
        label: 'Token authentication',
        status: 'ok',
        details: { login: 'superuser' },
      },
      {
        id: 'site-access',
        label: 'Site access permissions',
        status: 'ok',
        details: { idsite: '1', name: 'Demo Site' },
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new URL(fetchMock.mock.calls[2][0] as string).searchParams.get('method')).toBe('SitesManager.getSiteFromId');
  });

  it('reports token failures and skips site diagnostics', async () => {
    const fetchMock = createSequencedFetchMock([
      '5.0.0',
      { result: 'error', message: 'Invalid token' },
    ]);

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 3 });
    const result = await client.runDiagnostics();

    expect(result.checks[0]).toMatchObject({
      id: 'base-url',
      status: 'ok',
      details: { version: '5.0.0' },
    });
    expect(result.checks[1]).toMatchObject({
      id: 'token-auth',
      status: 'error',
      error: {
        type: 'matomo',
        message: expect.stringContaining('Matomo authentication failed'),
        guidance: expect.stringContaining('token'),
      },
    });
    expect(result.checks[2]).toMatchObject({
      id: 'site-access',
      status: 'skipped',
      skippedReason: 'Authentication failed, unable to verify site permissions.',
    });
  });

  it('flags base URL errors and stops further checks', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fetch failed'));

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 9 });
    const result = await client.runDiagnostics();

    expect(result.checks[0]).toMatchObject({
      id: 'base-url',
      status: 'error',
      error: {
        type: 'network',
        message: 'Failed to reach Matomo instance.',
      },
    });
    expect(result.checks[1]).toMatchObject({
      id: 'token-auth',
      status: 'skipped',
      skippedReason: 'Matomo base URL could not be reached.',
    });
    expect(result.checks[2]).toMatchObject({
      id: 'site-access',
      status: 'skipped',
      skippedReason: 'Matomo base URL could not be reached.',
    });
  });

  it('caches repeated reporting calls within TTL', async () => {
    const responses = [[{ label: '/home' }], [{ label: '/other' }]];
    const fetchMock = createSequencedFetchMock(responses);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 4, cacheTtlMs: 60_000 });
    await client.getMostPopularUrls({ period: 'day', date: 'today', limit: 5 });
    await client.getMostPopularUrls({ period: 'day', date: 'today', limit: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes through overrides for reporting helpers', async () => {
    const fetchMock = createFetchMock([{ label: 'Home', nb_visits: 100 }]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 7 });
    const result = await client.getMostPopularUrls({ siteId: 9, period: 'week', date: '2024-01-01', limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Home');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Actions.getPageUrls');
    expect(url.searchParams.get('idSite')).toBe('9');
    expect(url.searchParams.get('period')).toBe('week');
    expect(url.searchParams.get('date')).toBe('2024-01-01');
    expect(url.searchParams.get('filter_limit')).toBe('20');
    expect(url.searchParams.get('flat')).toBe('1');
  });

  it('coerces numeric fields when Matomo returns strings', async () => {
    const fetchMock = createFetchMock([{ label: 'Search', nb_visits: '12' }]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 3 });
    const result = await client.getTopReferrers({ period: 'month', date: '2024-01-01' });

    expect(result[0].nb_visits).toBe(12);
  });

  it('retrieves events with optional filters', async () => {
    const fetchMock = createFetchMock([{ label: 'CTA > click', nb_events: '5' }]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 2 });
    const result = await client.getEvents({
      period: 'week',
      date: '2024-02-01',
      limit: 25,
      segment: 'country==SE',
      category: 'CTA',
      action: 'click',
      name: 'Download',
    });

    expect(result[0].nb_events).toBe(5);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Events.getAction');
    expect(url.searchParams.get('idSite')).toBe('2');
    expect(url.searchParams.get('period')).toBe('week');
    expect(url.searchParams.get('date')).toBe('2024-02-01');
    expect(url.searchParams.get('segment')).toBe('country==SE');
    expect(url.searchParams.get('filter_limit')).toBe('25');
    expect(url.searchParams.get('eventCategory')).toBe('CTA');
    expect(url.searchParams.get('eventAction')).toBe('click');
    expect(url.searchParams.get('eventName')).toBe('Download');
    expect(url.searchParams.get('flat')).toBe('1');
  });

  it('returns entry pages with defaults when omitted', async () => {
    const fetchMock = createFetchMock([{ label: '/home', nb_visits: '42', bounce_rate: '10%' }]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 4 });
    const result = await client.getEntryPages();

    expect(result[0].nb_visits).toBe(42);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Actions.getEntryPageUrls');
    expect(url.searchParams.get('idSite')).toBe('4');
    expect(url.searchParams.get('period')).toBe('day');
    expect(url.searchParams.get('date')).toBe('today');
    expect(url.searchParams.get('filter_limit')).toBe('10');
    expect(url.searchParams.get('flat')).toBe('1');
  });

  it('fetches campaigns with overrides and numeric coercion', async () => {
    const fetchMock = createFetchMock([{ label: 'Spring Campaign', nb_visits: '12' }]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 9 });
    const result = await client.getCampaigns({ siteId: 11, period: 'month', date: '2025-01-01', limit: 25 });

    expect(result[0].nb_visits).toBe(12);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Referrers.getCampaigns');
    expect(url.searchParams.get('idSite')).toBe('11');
    expect(url.searchParams.get('period')).toBe('month');
    expect(url.searchParams.get('date')).toBe('2025-01-01');
    expect(url.searchParams.get('filter_limit')).toBe('25');
  });

  it('tracks cache stats and emits events', async () => {
    const fetchMock = createFetchMock([{ label: 'Home', nb_visits: '42' }]);
    vi.stubGlobal('fetch', fetchMock);

    const events: Array<{ type: string }> = [];

    const client = createMatomoClient({
      baseUrl,
      tokenAuth: token,
      defaultSiteId: 5,
      cache: {
        ttlMs: 60_000,
        onEvent: event => events.push(event),
      },
    });

    await client.getMostPopularUrls({ period: 'day', date: 'today', limit: 5 });
    await client.getMostPopularUrls({ period: 'day', date: 'today', limit: 5 });

    const stats = client.getCacheStats();
    expect(stats.total.misses).toBe(1);
    expect(stats.total.hits).toBe(1);
    expect(stats.total.sets).toBe(1);

    const popularStats = stats.features.find(feature => feature.feature === 'popularUrls');
    expect(popularStats?.hits).toBe(1);
    expect(popularStats?.misses).toBe(1);

    expect(events.some(event => event.type === 'set')).toBe(true);
    expect(events.some(event => event.type === 'hit')).toBe(true);
  });

  it('records stale evictions when cache entries expire', async () => {
    const fetchMock = createSequencedFetchMock([
      [{ label: 'Home', nb_visits: '10' }],
      [{ label: 'Home', nb_visits: '12' }],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({
      baseUrl,
      tokenAuth: token,
      defaultSiteId: 6,
      cache: {
        ttlMs: 1,
      },
    });

    await client.getMostPopularUrls({ period: 'day', date: 'today', limit: 5 });
    await new Promise(resolve => setTimeout(resolve, 5));
    await client.getMostPopularUrls({ period: 'day', date: 'today', limit: 5 });

    const stats = client.getCacheStats();
    expect(stats.total.staleEvictions).toBeGreaterThanOrEqual(1);
    expect(stats.total.sets).toBe(2);
  });

  it('returns ecommerce revenue totals with series when requested', async () => {
    const payload = {
      '2025-09-25': { nb_conversions: '2', revenue: '100', items: '5' },
      '2025-09-26': { nb_conversions: '1', revenue: '50', items: '2' },
    };
    const fetchMock = createFetchMock(payload);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 6 });
    const result = await client.getEcommerceRevenueTotals({
      period: 'day',
      date: 'last2',
      includeSeries: true,
    });

    expect(result.totals.revenue).toBe(150);
    expect(result.totals.nb_conversions).toBe(3);
    expect(result.totals.items).toBe(7);
    expect(result.series).toHaveLength(2);
    expect(result.series?.[0].label).toBe('2025-09-25');
    expect(result.series?.[0].revenue).toBe(100);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Goals.get');
    expect(url.searchParams.get('idGoal')).toBe('ecommerceOrder');
    expect(url.searchParams.get('idSite')).toBe('6');
    expect(url.searchParams.get('period')).toBe('day');
    expect(url.searchParams.get('date')).toBe('last2');
  });

  it('omits series when not requested and single summary', async () => {
    const payload = { nb_conversions: '2', revenue: '80' };
    const fetchMock = createFetchMock(payload);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 4 });
    const result = await client.getEcommerceRevenueTotals();

    expect(result.totals.revenue).toBe(80);
    expect(result.series).toBeUndefined();
  });

  it('extracts ecommerce overview from nested responses', async () => {
    const fetchMock = createFetchMock({
      '2025-09-25': {
        'idgoal=ecommerceOrder': {
          nb_conversions: '3',
          revenue: '120.5',
          avg_order_revenue: '40.1666',
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 6 });
    const result = await client.getEcommerceOverview({ date: '2025-09-25' });

    expect(result.nb_conversions).toBe(3);
    expect(result.revenue).toBeCloseTo(120.5);
    expect(result.avg_order_revenue).toBeCloseTo(40.1666);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Goals.get');
    expect(url.searchParams.get('idGoal')).toBe('ecommerceOrder');
    expect(url.searchParams.get('date')).toBe('2025-09-25');
    expect(url.searchParams.get('idSite')).toBe('6');
  });

  it('returns event categories with limit handling', async () => {
    const fetchMock = createFetchMock([
      { label: 'CTA', nb_events: '5' },
      { label: 'Navigation', nb_events: '2' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 3 });
    const result = await client.getEventCategories({ limit: 20, segment: 'country==SE' });

    expect(result[0].nb_events).toBe(5);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Events.getCategory');
    expect(url.searchParams.get('filter_limit')).toBe('20');
    expect(url.searchParams.get('segment')).toBe('country==SE');
    expect(url.searchParams.get('flat')).toBe('1');
  });

  it('lists device types with numeric coercion and overrides', async () => {
    const fetchMock = createFetchMock([
      { label: 'Desktop', nb_visits: '40' },
      { label: 'Mobile', nb_visits: '25' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 2 });
    const result = await client.getDeviceTypes({ siteId: 9, period: 'week', date: '2025-09-01', limit: 5 });

    expect(result[0].nb_visits).toBe(40);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('DevicesDetection.getType');
    expect(url.searchParams.get('idSite')).toBe('9');
    expect(url.searchParams.get('period')).toBe('week');
    expect(url.searchParams.get('date')).toBe('2025-09-01');
    expect(url.searchParams.get('filter_limit')).toBe('5');
  });

  it('retrieves traffic channels and supports alias filtering', async () => {
    const fetchMock = createFetchMock([
      { label: 'Direct Entry', nb_visits: '120' },
      { label: 'Search Engines', nb_visits: '80' },
      { label: 'Websites', nb_visits: '25' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 3 });

    const channels = await client.getTrafficChannels({ period: 'week', date: '2025-09-01' });
    expect(channels).toHaveLength(3);
    expect(channels[0].nb_visits).toBe(120);

    const filtered = await client.getTrafficChannels({ channelType: 'search', period: 'week', date: '2025-09-01' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe('Search Engines');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Referrers.getReferrerType');
    expect(url.searchParams.get('filter_limit')).toBe('10');
  });

  it('fetches goal conversions with filters and normalization', async () => {
    const fetchMock = createFetchMock([
      { idgoal: 'ecommerceOrder', goal: 'Orders', type: 'ecommerce', nb_conversions: '12' },
      { idgoal: 2, name: 'Newsletter Signup', type: 'manually', nb_conversions: '8' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 3 });

    const allGoals = await client.getGoalConversions({ period: 'month', date: '2025-01-01', limit: 5 });
    expect(allGoals).toHaveLength(2);
    expect(allGoals[0]).toMatchObject({ id: 'ecommerceOrder', type: 'ecommerce', nb_conversions: 12 });

    const ecommerceOnly = await client.getGoalConversions({ goalType: 'ecommerce', period: 'month', date: '2025-01-01' });
    expect(ecommerceOnly).toHaveLength(1);
    expect(ecommerceOnly[0].label).toBe('Orders');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('method')).toBe('Goals.get');
    expect(url.searchParams.get('filter_limit')).toBe('5');
  });

  it('tracks pageviews using the default siteId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 8 });
    const result = await client.trackPageview({ url: 'https://example.com/' });

    expect(result.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = (init?.body as URLSearchParams).toString();
    expect(body).toContain('idsite=8');
  });

  it('allows overriding siteId on tracking calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 4 });
    await client.trackEvent({ siteId: 11, category: 'cta', action: 'click' });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = (init?.body as URLSearchParams).toString();
    expect(body).toContain('idsite=11');
    expect(body).toContain('e_c=cta');
  });

  it('uses site index overrides for tracking calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = createMatomoClient({
      baseUrl,
      tokenAuth: token,
      siteIndex: {
        defaultSiteId: 5,
        sites: {
          '5': {
            name: 'Primary',
            tracking: {
              baseUrl: 'https://collector.primary.example.com/matomo.php',
              tokenAuth: 'primary-track',
            },
          },
          '12': {
            name: 'Secondary',
            tracking: {
              baseUrl: 'https://collector.secondary.example.com/matomo.php',
              tokenAuth: 'secondary-track',
            },
          },
        },
      },
    });

    await client.trackEvent({ siteId: 12, category: 'cta', action: 'click' });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://collector.secondary.example.com/matomo.php');
    const body = (init?.body as URLSearchParams).toString();
    expect(body).toContain('token_auth=secondary-track');
    expect(body).toContain('idsite=12');
  });

  describe('getHealthStatus', () => {
    it('returns healthy status when all checks pass', async () => {
      const fetchMock = createSequencedFetchMock(['3.14.0']);
      vi.stubGlobal('fetch', fetchMock);

      const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 1 });
      const result = await client.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.checks).toHaveLength(3); // matomo-api, reports-cache, tracking-queue
      
      const matomoCheck = result.checks.find(c => c.name === 'matomo-api');
      expect(matomoCheck?.status).toBe('pass');
      expect(matomoCheck?.componentType).toBe('service');
      expect(matomoCheck?.observedUnit).toBe('ms');
    });

    it('returns unhealthy status when API fails', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', fetchMock);

      const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 1 });
      const result = await client.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      
      const matomoCheck = result.checks.find(c => c.name === 'matomo-api');
      expect(matomoCheck?.status).toBe('fail');
      expect(matomoCheck?.output).toContain('Failed to reach Matomo instance');
    });

    it('includes site access check when requested', async () => {
      const fetchMock = createSequencedFetchMock([
        '3.14.0', // API.getVersion
        { idsite: '5', name: 'Test Site' } // SitesManager.getSiteFromId
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const client = createMatomoClient({ baseUrl, tokenAuth: token, defaultSiteId: 5 });
      const result = await client.getHealthStatus({ includeDetails: true });

      expect(result.checks).toHaveLength(4); // includes site-access check
      
      const siteCheck = result.checks.find(c => c.name === 'site-access');
      expect(siteCheck?.status).toBe('pass');
      expect(siteCheck?.output).toContain('Site ID 5 accessible');
    });
  });
});
