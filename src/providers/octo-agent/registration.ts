import type { ProviderRegistration } from '../../core/providers/types';
import { OctoAgentInlineEditService } from './auxiliary/OctoAgentInlineEditService';
import { OctoAgentTaskResultInterpreter } from './auxiliary/OctoAgentTaskResultInterpreter';
import { OCTO_AGENT_PROVIDER_CAPABILITIES } from './capabilities';
import { octoAgentSettingsReconciler } from './env/OctoAgentSettingsReconciler';
import { OctoAgentConversationHistoryService } from './history/OctoAgentConversationHistoryService';
import { OctoAgentChatRuntime } from './runtime/OctoAgentChatRuntime';
import { octoAgentChatUIConfig } from './ui/OctoAgentChatUIConfig';

export const octoAgentProviderRegistration: ProviderRegistration = {
  blankTabOrder: 15,
  capabilities: OCTO_AGENT_PROVIDER_CAPABILITIES,
  chatUIConfig: octoAgentChatUIConfig,
  createInlineEditService: (plugin) => new OctoAgentInlineEditService(plugin),
  createRuntime: ({ plugin }) => new OctoAgentChatRuntime(plugin),
  displayName: 'Octo Agent',
  historyService: new OctoAgentConversationHistoryService(),
  // The plugin registers exactly one provider; Obsidian's own plugin toggle is
  // the enable/disable control, so there is no second in-plugin switch.
  isEnabled: () => true,
  settingsReconciler: octoAgentSettingsReconciler,
  taskResultInterpreter: new OctoAgentTaskResultInterpreter(),
};
