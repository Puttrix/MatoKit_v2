import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface MatomoSiteTrackingConfig {
  baseUrl?: string;
  tokenAuth?: string;
}

export interface MatomoSiteDefinition {
  siteId?: number;
  name: string;
  url?: string;
  baseUrl?: string;
  tokenAuth?: string;
  description?: string;
  tracking?: MatomoSiteTrackingConfig;
  metadata?: Record<string, unknown>;
}

export interface MatomoSiteIndexDefinition {
  defaultSiteId?: number;
  sites: Record<string, MatomoSiteDefinition> | MatomoSiteDefinition[];
}

export interface MatomoSiteMetadata {
  siteId: number;
  name: string;
  url?: string;
  baseUrl?: string;
  tokenAuth?: string;
  description?: string;
  tracking?: MatomoSiteTrackingConfig;
  metadata?: Record<string, unknown>;
}

export interface MatomoSiteIndex {
  defaultSiteId?: number;
  sites: Map<number, MatomoSiteMetadata>;
}

export type MatomoSiteIndexSource = MatomoSiteIndex | MatomoSiteIndexDefinition;

function assertRecord(value: unknown, errorMessage: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value as Record<string, unknown>;
}

function assertSiteDefinition(value: unknown, context: string): MatomoSiteDefinition {
  const record = assertRecord(value, `Site definition for ${context} must be an object`);
  return record as unknown as MatomoSiteDefinition;
}

function coerceOptionalSiteId(value: unknown, context: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return coerceSiteId(value, context);
}

function assertSiteIndexDefinition(
  value: Record<string, unknown>,
  context: string
): MatomoSiteIndexDefinition {
  if (!('sites' in value)) {
    throw new Error(`${context} must include a "sites" property`);
  }

  const defaultSiteId = coerceOptionalSiteId(value.defaultSiteId, `${context} defaultSiteId`);
  const rawSites = value.sites;

  if (Array.isArray(rawSites)) {
    return {
      defaultSiteId,
      sites: rawSites.map((entry, idx) => assertSiteDefinition(entry, `${context} site entry at index ${idx}`)),
    };
  }

  if (!rawSites || typeof rawSites !== 'object') {
    throw new Error(`${context} "sites" must be an object or array`);
  }

  const siteRecord: Record<string, MatomoSiteDefinition> = {};
  for (const [key, entry] of Object.entries(rawSites)) {
    siteRecord[key] = assertSiteDefinition(entry, `${context} site entry for key "${key}"`);
  }

  return {
    defaultSiteId,
    sites: siteRecord,
  };
}

function coerceSiteId(value: unknown, context: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Invalid siteId for ${context}`);
}

function normalizeTrackingConfig(
  input: unknown,
  context: string
): MatomoSiteTrackingConfig | undefined {
  if (input === undefined) return undefined;
  const record = assertRecord(input, `Tracking configuration for ${context} must be an object`);
  const config: MatomoSiteTrackingConfig = {};

  if (record.baseUrl !== undefined) {
    if (typeof record.baseUrl !== 'string' || record.baseUrl.trim().length === 0) {
      throw new Error(`Tracking baseUrl for ${context} must be a non-empty string`);
    }
    config.baseUrl = record.baseUrl.trim();
  }

  if (record.tokenAuth !== undefined) {
    if (typeof record.tokenAuth !== 'string' || record.tokenAuth.trim().length === 0) {
      throw new Error(`Tracking tokenAuth for ${context} must be a non-empty string`);
    }
    config.tokenAuth = record.tokenAuth.trim();
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

function normalizeSiteEntry(
  rawId: string | number | undefined,
  definition: MatomoSiteDefinition,
  context: string
): MatomoSiteMetadata {
  const siteId = coerceSiteId(definition.siteId ?? rawId, context);

  if (typeof definition.name !== 'string' || definition.name.trim().length === 0) {
    throw new Error(`Site name for siteId ${siteId} must be a non-empty string`);
  }

  const metadataKeys = new Set([
    'siteId',
    'name',
    'url',
    'baseUrl',
    'tokenAuth',
    'description',
    'tracking',
    'metadata',
  ]);

  const result: MatomoSiteMetadata = {
    siteId,
    name: definition.name.trim(),
  };

  if (definition.url !== undefined) {
    if (typeof definition.url !== 'string' || definition.url.trim().length === 0) {
      throw new Error(`Public URL for siteId ${siteId} must be a non-empty string when provided`);
    }
    result.url = definition.url.trim();
  }

  if (definition.baseUrl !== undefined) {
    if (typeof definition.baseUrl !== 'string' || definition.baseUrl.trim().length === 0) {
      throw new Error(`Matomo baseUrl for siteId ${siteId} must be a non-empty string when provided`);
    }
    result.baseUrl = definition.baseUrl.trim();
  }

  if (definition.tokenAuth !== undefined) {
    if (typeof definition.tokenAuth !== 'string' || definition.tokenAuth.trim().length === 0) {
      throw new Error(`Matomo tokenAuth for siteId ${siteId} must be a non-empty string when provided`);
    }
    result.tokenAuth = definition.tokenAuth.trim();
  }

  if (definition.description !== undefined) {
    if (typeof definition.description !== 'string') {
      throw new Error(`Description for siteId ${siteId} must be a string when provided`);
    }
    const trimmed = definition.description.trim();
    if (trimmed.length > 0) {
      result.description = trimmed;
    }
  }

  const tracking = normalizeTrackingConfig(definition.tracking, `siteId ${siteId}`);
  if (tracking) {
    result.tracking = tracking;
  }

  if (definition.metadata !== undefined) {
    const custom = assertRecord(definition.metadata, `metadata for siteId ${siteId} must be an object`);
    if (Object.keys(custom).length > 0) {
      result.metadata = custom;
    }
  }

  const extras = Object.entries(definition).filter(([key]) => !metadataKeys.has(key));
  if (extras.length > 0) {
    const customMetadata = { ...(result.metadata ?? {}) };
    for (const [key, value] of extras) {
      customMetadata[key] = value;
    }
    if (Object.keys(customMetadata).length > 0) {
      result.metadata = customMetadata;
    }
  }

  return result;
}

function isMatomoSiteIndex(input: MatomoSiteIndexSource): input is MatomoSiteIndex {
  return typeof (input as MatomoSiteIndex)?.sites?.get === 'function';
}

export function normalizeSiteIndex(source: MatomoSiteIndexSource): MatomoSiteIndex {
  if (isMatomoSiteIndex(source)) {
    const normalized = new Map<number, MatomoSiteMetadata>();
    for (const [siteId, metadata] of source.sites.entries()) {
      normalized.set(siteId, { ...metadata, siteId });
    }
    return { defaultSiteId: source.defaultSiteId, sites: normalized };
  }

  const sites = Array.isArray(source.sites)
    ? source.sites.map((entry, idx) => normalizeSiteEntry(entry.siteId, entry, `site entry at index ${idx}`))
    : Object.entries(source.sites).map(([rawId, entry]) =>
        normalizeSiteEntry(rawId, entry, `site entry for key "${rawId}"`)
      );

  const index = new Map<number, MatomoSiteMetadata>();
  for (const entry of sites) {
    if (index.has(entry.siteId)) {
      throw new Error(`Duplicate siteId detected in site index: ${entry.siteId}`);
    }
    index.set(entry.siteId, entry);
  }

  let defaultSiteId: number | undefined;
  if (source.defaultSiteId !== undefined) {
    defaultSiteId = coerceSiteId(source.defaultSiteId, 'defaultSiteId');
    if (!index.has(defaultSiteId)) {
      throw new Error(`defaultSiteId ${defaultSiteId} is not present in the site index`);
    }
  }

  return { defaultSiteId, sites: index };
}

export interface LoadSiteIndexFromEnvOptions {
  defaultSiteId?: number;
}

export function loadSiteIndexFromEnv(
  envValue: string,
  options: LoadSiteIndexFromEnvOptions = {}
): MatomoSiteIndex {
  if (typeof envValue !== 'string' || envValue.trim().length === 0) {
    throw new Error('Site index env value must be a non-empty string');
  }

  const entries = envValue
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  if (entries.length === 0) {
    throw new Error('Site index env value must contain at least one site entry');
  }

  const sites: Record<string, MatomoSiteDefinition> = {};

  for (const entry of entries) {
    const [rawId, ...nameParts] = entry.split(':');

    if (!rawId || nameParts.length === 0) {
      throw new Error(
        `Site index env entry "${entry}" must be formatted as <siteId>:<site name>`
      );
    }

    const siteId = coerceSiteId(rawId.trim(), `env entry "${entry}"`);
    const name = nameParts.join(':').trim();

    if (name.length === 0) {
      throw new Error(`Site name for env entry "${entry}" must be a non-empty string`);
    }

    sites[String(siteId)] = { siteId, name };
  }

  return normalizeSiteIndex({
    defaultSiteId: options.defaultSiteId,
    sites,
  });
}

function parseSiteIndexJson(json: string, context: string): MatomoSiteIndex {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `Failed to parse site index JSON from ${context}: ${(error as Error).message}`
    );
  }

  const data = assertRecord(
    parsed,
    `Site index loaded from ${context} must be a JSON object`
  );
  const definition = assertSiteIndexDefinition(
    data,
    `Site index loaded from ${context}`
  );

  return normalizeSiteIndex(definition);
}

export function loadSiteIndexFromJson(json: string): MatomoSiteIndex {
  if (typeof json !== 'string' || json.trim().length === 0) {
    throw new Error('Site index JSON string must be a non-empty string');
  }

  return parseSiteIndexJson(json, 'MATOKIT_SITE_INDEX_JSON');
}

export function loadSiteIndexFromFile(filePath: string): MatomoSiteIndex {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Site index path must be a non-empty string');
  }

  const resolved = resolve(process.cwd(), filePath);
  let fileContents: string;

  try {
    fileContents = readFileSync(resolved, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read site index from ${resolved}: ${(error as Error).message}`);
  }

  return parseSiteIndexJson(fileContents, resolved);
}

export function getSiteMetadata(index: MatomoSiteIndex, siteId: number): MatomoSiteMetadata | undefined {
  return index.sites.get(siteId);
}
