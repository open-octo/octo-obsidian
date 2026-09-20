import {
  SETTINGS_PATH,
} from '../../core/bootstrap/StoragePaths';
import {
  normalizeHiddenProviderCommands,
} from '../../core/providers/commands/hiddenCommands';
import type { VaultFileAdapter } from '../../core/storage/VaultFileAdapter';
import {
  CHAT_VIEW_PLACEMENTS,
  type ChatViewPlacement,
  type EnvSnippet,
  type OctoSettings,
  type ProviderConfigMap,
} from '../../core/types/settings';
import { DEFAULT_OCTO_SETTINGS } from './defaultSettings';

export {
  SETTINGS_PATH,
};

export type StoredOctoSettings = OctoSettings;

const LEGACY_PROJECTION_KEYS = [
  'settingsProvider',
  'savedProviderModel',
  'savedProviderEffort',
  'savedProviderServiceTier',
  'savedProviderThinkingBudget',
  'savedProviderPermissionMode',
] as const;

function isChatViewPlacement(value: unknown): value is ChatViewPlacement {
  return typeof value === 'string'
    && (CHAT_VIEW_PLACEMENTS as readonly string[]).includes(value);
}

function normalizeChatViewPlacement(value: unknown): ChatViewPlacement {
  return isChatViewPlacement(value) ? value : DEFAULT_OCTO_SETTINGS.chatViewPlacement;
}

function normalizeProviderConfigs(value: unknown): ProviderConfigMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: ProviderConfigMap = {};
  for (const [providerId, config] of Object.entries(value as Record<string, unknown>)) {
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      result[providerId] = { ...(config as Record<string, unknown>) };
    }
  }
  return result;
}

function normalizeContextLimits(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry > 0) {
      result[key] = entry;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeModelAliases(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, alias] of Object.entries(value)) {
    if (typeof alias !== 'string') {
      continue;
    }

    const modelId = key.trim();
    const normalizedAlias = alias.trim();
    if (modelId && normalizedAlias) {
      result[modelId] = normalizedAlias;
    }
  }

  return result;
}

function normalizeEnvSnippets(value: unknown): EnvSnippet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const snippets: EnvSnippet[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string'
      || typeof candidate.name !== 'string'
      || typeof candidate.description !== 'string'
      || typeof candidate.envVars !== 'string'
    ) {
      continue;
    }

    const modelAliases = 'modelAliases' in candidate
      ? normalizeModelAliases(candidate.modelAliases)
      : undefined;

    snippets.push({
      id: candidate.id,
      name: candidate.name,
      description: candidate.description,
      envVars: candidate.envVars,
      contextLimits: normalizeContextLimits(candidate.contextLimits),
      modelAliases,
    });
  }

  return snippets;
}

export class OctoSettingsStorage {
  constructor(private adapter: VaultFileAdapter) {}

  async load(): Promise<StoredOctoSettings> {
    if (!(await this.adapter.exists(SETTINGS_PATH))) {
      return this.getDefaults();
    }

    const content = await this.adapter.read(SETTINGS_PATH);
    const stored = JSON.parse(content) as Record<string, unknown>;

    // Legacy multi-provider projection fields (removed in 0.2.x): with a
    // single registered provider the top-level model/effort/tier/budget
    // fields are authoritative, so these saved maps are simply dropped.
    for (const legacyKey of LEGACY_PROJECTION_KEYS) {
      delete stored[legacyKey];
    }

    return {
      ...this.getDefaults(),
      ...stored,
      envSnippets: normalizeEnvSnippets(stored.envSnippets),
      customModelAliases: normalizeModelAliases(stored.customModelAliases),
      hiddenProviderCommands: normalizeHiddenProviderCommands(stored.hiddenProviderCommands),
      providerConfigs: normalizeProviderConfigs(stored.providerConfigs),
      chatViewPlacement: normalizeChatViewPlacement(stored.chatViewPlacement),
    };
  }

  async save(settings: StoredOctoSettings): Promise<void> {
    await this.adapter.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  }

  async exists(): Promise<boolean> {
    return this.adapter.exists(SETTINGS_PATH);
  }

  async update(updates: Partial<StoredOctoSettings>): Promise<void> {
    const current = await this.load();
    await this.save({ ...current, ...updates });
  }

  private getDefaults(): StoredOctoSettings {
    return DEFAULT_OCTO_SETTINGS;
  }
}
