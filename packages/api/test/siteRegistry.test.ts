import { describe, expect, it } from 'vitest';

import { MatomoSiteConfigurationError } from '@matokit/sdk';

import { buildSiteRegistry, MATOKIT_MAX_SITES } from '../src/siteRegistry.js';

describe('buildSiteRegistry', () => {
  it('returns an empty registry when no site variables are set', () => {
    const registry = buildSiteRegistry({ MATOMO_DEFAULT_SITE_ID: '5' });

    expect(registry.sites).toEqual([]);
    expect(registry.defaultSiteId).toBe(5);
    expect(registry.resolver).toBeUndefined();
  });

  it('builds a resolver that matches by id, key, and name', () => {
    const registry = buildSiteRegistry({
      MATOMO_DEFAULT_SITE_ID: '7',
      MATOKIT_SITE_MAIN_ID: '7',
      MATOKIT_SITE_MAIN_NAME: 'Main Site',
      MATOKIT_SITE_BLOG_ID: '8',
      MATOKIT_SITE_BLOG_NAME: 'Blog',
    });

    expect(registry.sites).toHaveLength(2);
    expect(registry.defaultSiteId).toBe(7);
    expect(typeof registry.resolver).toBe('function');

    const resolver = registry.resolver!;
    expect(resolver(undefined)).toEqual({ id: 7, key: 'MAIN', name: 'Main Site' });
    expect(resolver('blog')).toEqual({ id: 8, key: 'BLOG', name: 'Blog' });
    expect(resolver('Main Site')).toEqual({ id: 7, key: 'MAIN', name: 'Main Site' });
    expect(resolver('8')).toEqual({ id: 8, key: 'BLOG', name: 'Blog' });
  });

  it('throws when site names are missing', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '4',
        MATOKIT_SITE_MAIN_ID: '4',
      })
    ).toThrow(MatomoSiteConfigurationError);
  });

  it('throws when MATOMO_DEFAULT_SITE_ID is not among configured sites', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '3',
        MATOKIT_SITE_MAIN_ID: '4',
        MATOKIT_SITE_MAIN_NAME: 'Main Site',
      })
    ).toThrow(MatomoSiteConfigurationError);
  });

  it('rejects duplicate Matomo site IDs', () => {
    expect(() =>
      buildSiteRegistry({
        MATOMO_DEFAULT_SITE_ID: '3',
        MATOKIT_SITE_MAIN_ID: '3',
        MATOKIT_SITE_MAIN_NAME: 'Main',
        MATOKIT_SITE_DUPLICATE_ID: '3',
        MATOKIT_SITE_DUPLICATE_NAME: 'Duplicate',
      })
    ).toThrow(MatomoSiteConfigurationError);
  });

  it('enforces a maximum number of configured sites', () => {
    const env: Record<string, string> = { MATOMO_DEFAULT_SITE_ID: '1' };

    for (let index = 0; index < MATOKIT_MAX_SITES + 1; index += 1) {
      const key = `SITE${index}`;
      env[`MATOKIT_SITE_${key}_ID`] = String(index + 1);
      env[`MATOKIT_SITE_${key}_NAME`] = `Site ${index + 1}`;
    }

    expect(() => buildSiteRegistry(env)).toThrow(
      `A maximum of ${MATOKIT_MAX_SITES} Matomo sites are supported`
    );
  });
});
