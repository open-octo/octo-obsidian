import { getProviderConfig } from '../../core/providers/providerConfig';

export interface OctoAgentProviderSettings {
  host: string;
  port: number;
  autoStartServer: boolean;
  cliPath: string;
  accessKey: string;
  environmentVariables: string;
  permissionMode?: string;
}

export const DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS: Readonly<OctoAgentProviderSettings> =
  Object.freeze({
    accessKey: '',
    autoStartServer: true,
    cliPath: 'octo',
    environmentVariables: '',
    host: '127.0.0.1',
    permissionMode: 'yolo',
    port: 8088,
  });

const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * Parses a port from user input, clamping it into the valid TCP range. The
 * value is interpolated straight into the server URL, so an out-of-range or
 * non-numeric entry must never reach storage.
 */
export function parseOctoServerPort(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.port;
  }
  return Math.min(Math.max(parsed, MIN_PORT), MAX_PORT);
}

export function getOctoAgentProviderSettings(
  settings: Record<string, unknown>,
): OctoAgentProviderSettings {
  const config = getProviderConfig(settings, 'octo-agent');
  return {
    accessKey: asString(config.accessKey) ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.accessKey,
    autoStartServer: asBoolean(config.autoStartServer)
      ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.autoStartServer,
    cliPath: asString(config.cliPath) ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.cliPath,
    environmentVariables: asString(config.environmentVariables)
      ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.environmentVariables,
    host: asString(config.host) ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.host,
    permissionMode: asString(config.permissionMode) ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.permissionMode,
    port: asPort(config.port) ?? DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS.port,
  };
}

export function updateOctoAgentProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<OctoAgentProviderSettings>,
): OctoAgentProviderSettings {
  const current = getOctoAgentProviderSettings(settings);
  const next = { ...current, ...updates };
   
  (settings.providerConfigs as Record<string, unknown> | undefined) ??= {};
   
  (settings.providerConfigs as Record<string, unknown>)['octo-agent'] = next;
  return next;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Rejects out-of-range ports so a hand-edited settings.json cannot break the server URL. */
function asPort(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }
  return value >= MIN_PORT && value <= MAX_PORT ? value : undefined;
}
