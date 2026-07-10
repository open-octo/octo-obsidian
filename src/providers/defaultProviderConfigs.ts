import type { ProviderConfigMap } from '../core/types/settings';
import { DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS } from './octo-agent/settings';

export function getBuiltInProviderDefaultConfigs(): ProviderConfigMap {
  return {
    'octo-agent': { ...DEFAULT_OCTO_AGENT_PROVIDER_SETTINGS },
  };
}
