import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatomoSiteConfigurationError, createMatomoClient } from '@matokit/sdk';

import { buildSiteRegistry, MATOKIT_MAX_SITES } from '../src/siteRegistry.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildSiteRegistry', () => {
  it('returns an empty registry when no site variables are set', () => {
    const registry = buildSiteRegistry({ MATOMO_DEFAULT_SITE_ID: '5' });

    expect(registry.sites).toEqual([]);
    expect(registry.defaultSiteId).toBe(5);
    expect(registry.resolver).toBeUndefined();
  });

  it('builds a resolver that matches by id and name selectors', () => {
    const registry = buildSiteRegistry({
      MATOMO_DEFAULT_SITE_ID: '7',
      MATOKIT_SITE_0_ID: '7',
      MATOKIT_SITE_0_NAME: 'Main Site',
      MATOKIT_SITE_1_ID: '8',
      MATOKIT_SITE_1_NAME: 'Blog',
    });

    expect(registry.sites).toHaveLength(2);
    expect(registry.defaultSiteId).toBe(7);
    expect(typeof registry.resolver).toBe('function');

    const resolver = registry.resolver!;
    expect(resolver(undefined)).toEqual({ id: 7, name: 'Main Site' });
    expect(resolver('blog')).toEqual({ id: 8, name: 'Blog' });
    expect(resolver('Main Site')).toEqual({ id: 7, name: 'Main Site' });
    expect(resolver('8')).toEqual({ id: 8, name: 'Blog' });
  });

  it('throws when site names are missing', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '4',
        MATOKIT_SITE_0_ID: '4',
      })
    ).toThrow(MatomoSiteConfigurationError);
  });

  it('throws when MATOMO_DEFAULT_SITE_ID is not among configured sites', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '3',
        MATOKIT_SITE_0_ID: '4',
        MATOKIT_SITE_0_NAME: 'Main Site',
      })
    ).toThrow(MatomoSiteConfigurationError);
  });

  it('rejects duplicate Matomo site IDs', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '3',
        MATOKIT_SITE_0_ID: '3',
        MATOKIT_SITE_0_NAME: 'Main',
        MATOKIT_SITE_1_ID: '3',
        MATOKIT_SITE_1_NAME: 'Duplicate',
      })
    ).toThrow(MatomoSiteConfigurationError);
  });

  it('enforces sequential zero-based indexes with no gaps', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '5',
        MATOKIT_SITE_1_ID: '5',
        MATOKIT_SITE_1_NAME: 'Site B',
      })
    ).toThrow('MATOKIT_SITE indexes must start at 0');

    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '5',
        MATOKIT_SITE_0_ID: '5',
        MATOKIT_SITE_0_NAME: 'Site A',
        MATOKIT_SITE_2_ID: '6',
        MATOKIT_SITE_2_NAME: 'Site C',
      })
    ).toThrow('MATOKIT_SITE indexes must be sequential with no gaps');
  });

  it('enforces a maximum number of configured sites', () => {
    const env: Record<string, string> = { MATOMO_DEFAULT_SITE_ID: '1' };

    for (let index = 0; index < MATOKIT_MAX_SITES + 1; index += 1) {
      env[`MATOKIT_SITE_${index}_ID`] = String(index + 1);
      env[`MATOKIT_SITE_${index}_NAME`] = `Site ${index + 1}`;
    }

    expect(() => buildSiteRegistry(env)).toThrow(
      `A maximum of ${MATOKIT_MAX_SITES} Matomo sites are supported`
    );
  });

  it('fetches metrics for multiple configured sites using numbered selectors', async () => {
    const responses = [
      { nb_visits: 11 },
      { nb_pageviews: 20, nb_uniq_pageviews: 18 },
      { nb_visits: 5 },
      { nb_pageviews: 8, nb_uniq_pageviews: 7 },
    ];

    const fetchMock = vi.fn();
    for (const payload of responses) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      });
    }

    vi.stubGlobal('fetch', fetchMock);

    const registry = buildSiteRegistry({
      MATOMO_DEFAULT_SITE_ID: '2',
      MATOKIT_SITE_0_ID: '2',
      MATOKIT_SITE_0_NAME: 'Marketing',
      MATOKIT_SITE_1_ID: '4',
      MATOKIT_SITE_1_NAME: 'Support',
    });

    const client = createMatomoClient({
      baseUrl: 'https://matomo.example.com',
      tokenAuth: 'token',
      defaultSiteId: registry.defaultSiteId,
      siteResolver: registry.resolver,
    });

    const marketing = await client.getKeyNumbers({ siteId: 'Marketing' });
    const support = await client.getKeyNumbers({ siteId: 4 });

    expect(marketing.nb_visits).toBe(11);
    expect(support.nb_visits).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const firstRequest = new URL((fetchMock.mock.calls[0] ?? [])[0] as string);
    const thirdRequest = new URL((fetchMock.mock.calls[2] ?? [])[0] as string);

    expect(firstRequest.searchParams.get('idSite')).toBe('2');
    expect(thirdRequest.searchParams.get('idSite')).toBe('4');
  });
});
