import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../core/providers/ProviderWorkspaceRegistry';
import { octoAgentWorkspaceRegistration } from './octo-agent/app/OctoAgentWorkspaceServices';
import { octoAgentProviderRegistration } from './octo-agent/registration';

let builtInProvidersRegistered = false;

export function registerBuiltInProviders(): void {
  if (builtInProvidersRegistered) {
    return;
  }

  ProviderRegistry.register('octo-agent', octoAgentProviderRegistration);
  ProviderWorkspaceRegistry.register('octo-agent', octoAgentWorkspaceRegistration);
  builtInProvidersRegistered = true;
}

registerBuiltInProviders();
