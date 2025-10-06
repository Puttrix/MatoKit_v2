import {
  MatomoSiteConfigurationError,
  type MatomoResolvedSite,
  type MatomoSiteResolver,
  type MatomoSiteSelector,
} from '@matokit/sdk';

export interface MatokitSiteDefinition {
  key: string;
  siteId: number;
  name: string;
}

export interface SiteRegistry {
  sites: MatokitSiteDefinition[];
  defaultSiteId?: number;
  resolver?: MatomoSiteResolver;
}

export const MATOKIT_MAX_SITES = 25;

const SITE_ID_PATTERN = /^MATOKIT_SITE_([A-Z0-9_]+)_ID$/;

function parseDefaultSiteId(env: NodeJS.ProcessEnv): number | undefined {
  const raw = env.MATOMO_DEFAULT_SITE_ID ?? '1';
  if (!raw) return undefined;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const numeric = Number.parseInt(trimmed, 10);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function normalizeSiteDefinition(definition: MatokitSiteDefinition): MatomoResolvedSite {
  return {
    id: definition.siteId,
    key: definition.key,
    name: definition.name,
  };
}

function buildResolver(
  sites: MatokitSiteDefinition[],
  defaultSiteId: number
): MatomoSiteResolver {
  const byId = new Map<number, MatokitSiteDefinition>();
  const byKey = new Map<string, MatokitSiteDefinition>();
  const byName = new Map<string, MatokitSiteDefinition>();

  for (const site of sites) {
    byId.set(site.siteId, site);
    byKey.set(site.key.toLowerCase(), site);
    byName.set(site.name.toLowerCase(), site);
  }

  const defaultSite = byId.get(defaultSiteId);
  if (!defaultSite) {
    throw new MatomoSiteConfigurationError(
      `MATOMO_DEFAULT_SITE_ID=${defaultSiteId} must match one of the configured MATOKIT_SITE_* entries.`,
      defaultSiteId
    );
  }

  return (selector: MatomoSiteSelector | undefined) => {
    if (selector === undefined || selector === null) {
      return normalizeSiteDefinition(defaultSite);
    }

    if (typeof selector === 'number') {
      if (!Number.isFinite(selector) || selector <= 0) {
        throw new MatomoSiteConfigurationError('Matomo siteId must be a positive integer.', selector);
      }
      const site = byId.get(selector);
      if (!site) {
        throw new MatomoSiteConfigurationError(
          `Matomo site ${selector} is not configured.`,
          selector
        );
      }
      return normalizeSiteDefinition(site);
    }

    const trimmed = selector.trim();
    if (!trimmed) {
      return normalizeSiteDefinition(defaultSite);
    }

    if (/^-?\d+$/.test(trimmed)) {
      const numeric = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new MatomoSiteConfigurationError('Matomo siteId must be a positive integer.', numeric);
      }
      const site = byId.get(numeric);
      if (!site) {
        throw new MatomoSiteConfigurationError(
          `Matomo site ${numeric} is not configured.`,
          numeric
        );
      }
      return normalizeSiteDefinition(site);
    }

    const keyMatch = byKey.get(trimmed.toLowerCase());
    if (keyMatch) {
      return normalizeSiteDefinition(keyMatch);
    }

    const nameMatch = byName.get(trimmed.toLowerCase());
    if (nameMatch) {
      return normalizeSiteDefinition(nameMatch);
    }

    throw new MatomoSiteConfigurationError(`Matomo site "${selector}" is not configured.`, selector);
  };
}

export function buildSiteRegistry(env: NodeJS.ProcessEnv = process.env): SiteRegistry {
  const defaultSiteId = parseDefaultSiteId(env);
  const sites: MatokitSiteDefinition[] = [];

  for (const [envKey, rawValue] of Object.entries(env)) {
    const match = SITE_ID_PATTERN.exec(envKey);
    if (!match) continue;

    const keySegment = match[1];
    const normalizedKey = keySegment.trim();
    if (!normalizedKey) {
      throw new MatomoSiteConfigurationError(
        `Environment variable ${envKey} must include a non-empty site key.`
      );
    }

    const idValue = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue ?? '').trim();
    if (!idValue) {
      throw new MatomoSiteConfigurationError(
        `Environment variable ${envKey} must contain a numeric Matomo site ID.`
      );
    }

    const numeric = Number.parseInt(idValue, 10);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new MatomoSiteConfigurationError(
        `${envKey} must be a positive integer (received "${idValue}").`
      );
    }

    const nameKey = `MATOKIT_SITE_${normalizedKey}_NAME`;
    const rawName = env[nameKey];
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) {
      throw new MatomoSiteConfigurationError(
        `Environment variable ${nameKey} must be set when configuring ${envKey}.`
      );
    }

    sites.push({ key: normalizedKey, siteId: numeric, name });
  }

  sites.sort((a, b) => a.key.localeCompare(b.key));

  if (sites.length === 0) {
    return { sites, defaultSiteId };
  }

  if (sites.length > MATOKIT_MAX_SITES) {
    throw new MatomoSiteConfigurationError(
      `A maximum of ${MATOKIT_MAX_SITES} Matomo sites are supported (received ${sites.length}).`
    );
  }

  const ids = new Set<number>();
  const keys = new Set<string>();
  const names = new Set<string>();

  for (const site of sites) {
    if (ids.has(site.siteId)) {
      throw new MatomoSiteConfigurationError(
        `Duplicate Matomo site ID detected: ${site.siteId}.`
      );
    }
    ids.add(site.siteId);

    const keyLower = site.key.toLowerCase();
    if (keys.has(keyLower)) {
      throw new MatomoSiteConfigurationError(
        `Duplicate MATOKIT site key detected: ${site.key}.`
      );
    }
    keys.add(keyLower);

    const nameLower = site.name.toLowerCase();
    if (names.has(nameLower)) {
      throw new MatomoSiteConfigurationError(
        `Duplicate Matomo site name detected: ${site.name}.`
      );
    }
    names.add(nameLower);
  }

  if (defaultSiteId === undefined) {
    throw new MatomoSiteConfigurationError(
      'MATOMO_DEFAULT_SITE_ID must be set when configuring multiple Matomo sites.'
    );
  }

  return {
    sites,
    defaultSiteId,
    resolver: buildResolver(sites, defaultSiteId),
  };
}
