import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  loadSiteIndexFromEnv,
  loadSiteIndexFromFile,
  loadSiteIndexFromJson,
  normalizeSiteIndex,
  type MatomoSiteIndex,
} from '../src/siteIndex.js';

function createTempFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'matokit-site-index-'));
  const file = join(dir, 'site-index.json');
  writeFileSync(file, contents, 'utf-8');
  return file;
}

describe('site index utilities', () => {
  it('normalizes site definitions and trims values', () => {
    const index = normalizeSiteIndex({
      defaultSiteId: '5',
      sites: {
        '5': {
          name: '  Primary Site  ',
          url: 'https://example.com',
          baseUrl: ' https://matomo.example.com ',
          tokenAuth: ' secret-token ',
          tracking: {
            baseUrl: ' https://collector.example.com/matomo.php ',
            tokenAuth: ' tracker-token ',
          },
          description: ' Main site for marketing ',
          metadata: { channel: 'marketing' },
          owner: 'growth-team',
        },
      },
    });

    const metadata = index.sites.get(5);
    expect(index.defaultSiteId).toBe(5);
    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('Primary Site');
    expect(metadata?.baseUrl).toBe('https://matomo.example.com');
    expect(metadata?.tokenAuth).toBe('secret-token');
    expect(metadata?.tracking?.baseUrl).toBe('https://collector.example.com/matomo.php');
    expect(metadata?.tracking?.tokenAuth).toBe('tracker-token');
    expect(metadata?.description).toBe('Main site for marketing');
    expect(metadata?.metadata).toMatchObject({ channel: 'marketing', owner: 'growth-team' });
  });

  it('loads a site index from disk', () => {
    const file = createTempFile(
      JSON.stringify({
        defaultSiteId: 2,
        sites: {
          '2': {
            name: 'Docs Site',
            baseUrl: 'https://matomo.docs.example.com',
          },
        },
      })
    );

    const index: MatomoSiteIndex = loadSiteIndexFromFile(file);
    const metadata = index.sites.get(2);

    expect(index.defaultSiteId).toBe(2);
    expect(metadata?.name).toBe('Docs Site');
    expect(metadata?.baseUrl).toBe('https://matomo.docs.example.com');
  });

  it('throws when site entries conflict', () => {
    expect(() =>
      normalizeSiteIndex({
        sites: {
          '1': { name: 'Primary' },
          '01': { name: 'Duplicate' },
        },
      })
    ).toThrow(/Duplicate siteId/);
  });

  it('throws when default site is missing', () => {
    expect(() =>
      normalizeSiteIndex({
        defaultSiteId: 7,
        sites: {
          '5': { name: 'Only Site' },
        },
      })
    ).toThrow(/defaultSiteId 7 is not present/);
  });

  it('parses site entries from an environment string', () => {
    const index = loadSiteIndexFromEnv('1:Primary,2:Docs Portal', { defaultSiteId: 2 });

    expect(index.defaultSiteId).toBe(2);
    expect(index.sites.get(1)?.name).toBe('Primary');
    expect(index.sites.get(2)?.name).toBe('Docs Portal');
  });

  it('throws when environment entries are malformed', () => {
    expect(() => loadSiteIndexFromEnv('1,2:')).toThrow(/must be formatted/);
    expect(() => loadSiteIndexFromEnv('3:   ')).toThrow(/must be a non-empty string/);
  });

  it('parses a full site index from an inline JSON string', () => {
    const json = JSON.stringify({
      defaultSiteId: 1,
      sites: {
        '1': {
          name: 'Primary',
          baseUrl: 'https://matomo.primary.example',
          tokenAuth: 'primary-token',
        },
        '2': {
          name: 'Docs',
          tracking: { baseUrl: 'https://collector.example/matomo.php' },
        },
      },
    });

    const index = loadSiteIndexFromJson(json);

    expect(index.defaultSiteId).toBe(1);
    expect(index.sites.get(1)?.tokenAuth).toBe('primary-token');
    expect(index.sites.get(2)?.tracking?.baseUrl).toBe(
      'https://collector.example/matomo.php'
    );
  });

  it('throws when inline JSON is invalid', () => {
    expect(() => loadSiteIndexFromJson('')).toThrow(/non-empty string/);
    expect(() => loadSiteIndexFromJson('not-json')).toThrow(/Failed to parse/);
  });
});
