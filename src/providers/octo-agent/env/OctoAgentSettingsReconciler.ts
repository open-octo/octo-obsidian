import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import { octoAgentChatUIConfig } from '../ui/OctoAgentChatUIConfig';

export const octoAgentSettingsReconciler: ProviderSettingsReconciler = {
  // Octo Agent sessions are server-resident and survive any settings change the
  // plugin can make, so neither hook ever invalidates a conversation.
  handleEnvironmentChange(): boolean {
    return false;
  },

  reconcileModelWithEnvironment(): { changed: boolean; invalidatedConversations: [] } {
    return { changed: false, invalidatedConversations: [] };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    const model = typeof settings.model === 'string' ? settings.model : '';
    if (!model || (!model.startsWith('octo-agent') && model !== 'octo-agent')) {
      return false;
    }
    const normalized = octoAgentChatUIConfig.normalizeModelVariant(model, settings);
    if (normalized !== model) {
      settings.model = normalized;
      return true;
    }
    return false;
  },
};
