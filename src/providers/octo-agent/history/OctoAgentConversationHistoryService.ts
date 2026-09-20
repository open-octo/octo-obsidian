import type { ProviderConversationHistoryService } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import type OctoPlugin from '../../../main';
import { OctoAgentClient } from '../runtime/OctoAgentClient';
import { getOctoAgentProviderSettings } from '../settings';
import { buildPersistedOctoAgentState, getOctoAgentState } from '../types';

export class OctoAgentConversationHistoryService implements ProviderConversationHistoryService {
  // octo-agent stores conversation history on the server. Octo keeps the
  // session id in Conversation.providerState; the runtime re-subscribes to the
  // session and continues from there. We do not eagerly hydrate the full history
  // because the server is the source of truth and the client is owned by the runtime.
  async hydrateConversationHistory(
    _conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    // No-op: history is server-resident and recovered through session continuity.
  }

  async deleteConversationSession(
    conversation: Conversation,
    _vaultPath: string | null,
    plugin: OctoPlugin,
  ): Promise<void> {
    const sessionId = this.resolveSessionIdForConversation(conversation);
    if (!sessionId) {
      return;
    }

    const settings = getOctoAgentProviderSettings(plugin.settings as Record<string, unknown>);
    const client = new OctoAgentClient({
      accessKey: settings.accessKey || undefined,
      baseUrl: `http://${settings.host}:${settings.port}`,
    });

    try {
      await client.deleteSession(sessionId);
    } catch (error) {
      // The conversation is already gone locally and its metadata is deleted
      // next, so a server that refuses must not abort that. Worst case the
      // session lingers server-side, visible in octo's own session list.
      console.error('Failed to delete the octo-agent session:', error);
    }
  }

  resolveSessionIdForConversation(conversation: Conversation | null): string | null {
    const state = getOctoAgentState(conversation?.providerState);
    return state.sessionId ?? conversation?.sessionId ?? null;
  }

  isPendingForkConversation(conversation: Conversation): boolean {
    const state = getOctoAgentState(conversation.providerState);
    return !!state.sessionId && !conversation.sessionId;
  }

  buildForkProviderState(
    sourceSessionId: string,
    _resumeAt: string,
    _sourceProviderState?: Record<string, unknown>,
  ): Record<string, unknown> {
    return buildPersistedOctoAgentState({ sessionId: sourceSessionId }) ?? {};
  }

  buildPersistedProviderState(
    conversation: Conversation,
  ): Record<string, unknown> | undefined {
    return buildPersistedOctoAgentState(getOctoAgentState(conversation.providerState));
  }
}
