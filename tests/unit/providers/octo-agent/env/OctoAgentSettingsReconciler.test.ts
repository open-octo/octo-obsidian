import type { Conversation } from '@/core/types';
import { octoAgentSettingsReconciler } from '@/providers/octo-agent/env/OctoAgentSettingsReconciler';

describe('octoAgentSettingsReconciler', () => {
  describe('normalizeModelVariantSettings', () => {
    it('returns false and leaves non-octo-agent models untouched', () => {
      const settings: Record<string, unknown> = { model: 'claude-code/claude-sonnet-4-5' };
      expect(octoAgentSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(false);
      expect(settings.model).toBe('claude-code/claude-sonnet-4-5');
    });

    it('returns false when the octo-agent model is already valid', () => {
      const settings: Record<string, unknown> = { model: 'octo-agent/kimi-for-coding' };
      expect(octoAgentSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(false);
      expect(settings.model).toBe('octo-agent/kimi-for-coding');
    });

    it('normalizes a bare octo-agent id to the qualified default', () => {
      const settings: Record<string, unknown> = { model: 'octo-agent' };
      expect(octoAgentSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(false);
      expect(settings.model).toBe('octo-agent');
    });

    it('leaves a server-resolved model untouched', () => {
      const settings: Record<string, unknown> = { model: 'octo-agent/k3' };
      expect(octoAgentSettingsReconciler.normalizeModelVariantSettings(settings)).toBe(false);
      expect(settings.model).toBe('octo-agent/k3');
    });
  });

  describe('reconcileModelWithEnvironment', () => {
    it('never invalidates conversations — octo-agent sessions are server-resident', () => {
      const conversation = {
        id: 'c1',
        providerId: 'octo-agent',
        sessionId: 's1',
        providerState: { sessionId: 's1' },
      } as unknown as Conversation;

      const result = octoAgentSettingsReconciler.reconcileModelWithEnvironment({}, [conversation]);

      expect(result).toEqual({ changed: false, invalidatedConversations: [] });
      expect(conversation.sessionId).toBe('s1');
      expect(conversation.providerState).toEqual({ sessionId: 's1' });
    });
  });
});
