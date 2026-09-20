import { getProviderConfig, setProviderConfig } from './providerConfig';
import type { ProviderId } from './types';

/**
 * Environment variables are stored per provider under
 * `providerConfigs[providerId].environmentVariables`.
 */
export function getProviderEnvironmentVariables(
  settings: Record<string, unknown>,
  providerId: ProviderId,
): string {
  const providerConfig = getProviderConfig(settings, providerId);
  return typeof providerConfig.environmentVariables === 'string'
    ? providerConfig.environmentVariables
    : '';
}

export function setProviderEnvironmentVariables(
  settings: Record<string, unknown>,
  providerId: ProviderId,
  envText: string,
): void {
  setProviderConfig(settings, providerId, {
    ...getProviderConfig(settings, providerId),
    environmentVariables: envText,
  });
}
