import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from '@/core/providers/ProviderSettingsCoordinator';
import type { Conversation } from '@/core/types';
import { octoAgentSettingsReconciler } from '@/providers/octo-agent/env/OctoAgentSettingsReconciler';

describe('ProviderSettingsCoordinator', () => {
  describe('reconcileAllProviders', () => {
    it('delegates to each registered provider reconciler with its own conversations', () => {
      const settings: Record<string, unknown> = { model: 'octo-agent/kimi-for-coding' };
      const octoConv = { providerId: 'octo-agent', messages: [] } as unknown as Conversation;
      const conversations = [octoConv];

      const result = ProviderSettingsCoordinator.reconcileAllProviders(settings, conversations);

      expect(result).toHaveProperty('changed');
      expect(result).toHaveProperty('invalidatedConversations');
      expect(Array.isArray(result.invalidatedConversations)).toBe(true);
    });

    it('filters conversations per provider', () => {
      const reconcileSpy = jest.spyOn(
        ProviderRegistry.getSettingsReconciler('octo-agent'),
        'reconcileModelWithEnvironment',
      );

      const octoConv = { providerId: 'octo-agent', messages: [] } as unknown as Conversation;
      // Simulates a conversation orphaned by a provider that was removed from the registry.
      const orphanedConv = { providerId: 'legacy-provider', messages: [] } as unknown as Conversation;
      const settings: Record<string, unknown> = { model: 'octo-agent/kimi-for-coding' };

      ProviderSettingsCoordinator.reconcileAllProviders(settings, [octoConv, orphanedConv]);

      // octo-agent's reconciler should only receive octo-agent conversations.
      expect(reconcileSpy).toHaveBeenCalledWith(
        settings,
        [octoConv],
      );

      reconcileSpy.mockRestore();
    });
  });

  describe('normalizeAllModelVariants', () => {
    it('delegates to registered providers', () => {
      const settings: Record<string, unknown> = { model: 'haiku' };
      const result = ProviderSettingsCoordinator.normalizeAllModelVariants(settings);
      expect(typeof result).toBe('boolean');
    });

    it('keeps any octo-agent model the server may have resolved', () => {
      // The plugin no longer curates a model list, so an unfamiliar
      // octo-agent/* value must survive rather than snap back to a default.
      const settings: Record<string, unknown> = { model: 'octo-agent/k3' };

      expect(ProviderSettingsCoordinator.normalizeAllModelVariants(settings)).toBe(false);
      expect(settings.model).toBe('octo-agent/k3');
    });
  });

  describe('projectActiveProviderState', () => {
    it('keeps valid top-level values, ignoring legacy saved-provider maps', () => {
      const settings: Record<string, unknown> = {
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        permissionMode: 'normal',
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
        // Legacy keys from the removed multi-provider projection must not be read.
        savedProviderModel: { 'octo-agent': 'octo-agent/retired-model' },
        savedProviderEffort: { 'octo-agent': 'low' },
        savedProviderThinkingBudget: { 'octo-agent': '2048' },
        savedProviderPermissionMode: { 'octo-agent': 'yolo' },
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.effortLevel).toBe('high');
      expect(settings.serviceTier).toBe('default');
      expect(settings.thinkingBudget).toBe('off');
      expect(settings.permissionMode).toBe('normal');
    });

    it('does not require any provider selection fields to exist', () => {
      const settings: Record<string, unknown> = {
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'low',
        serviceTier: 'default',
        thinkingBudget: 'off',
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.effortLevel).toBe('low');
      expect(settings.serviceTier).toBe('default');
      expect(settings.thinkingBudget).toBe('off');
    });

    it('normalizes a top-level thinking budget that octo-agent does not support', () => {
      const settings: Record<string, unknown> = {
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: '4096',
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.thinkingBudget).toBe('off');
    });
  });

  describe('snapshot round-trip', () => {
    it('getProviderSettingsSnapshot normalizes a clone without mutating the source', () => {
      const settings: Record<string, unknown> = {
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: '4096',
      };

      const snapshot = ProviderSettingsCoordinator.getProviderSettingsSnapshot(settings, 'octo-agent');

      expect(snapshot.thinkingBudget).toBe('off');
      expect(settings.thinkingBudget).toBe('4096');
    });

    it('commitProviderSettingsSnapshot assigns the normalized snapshot back', () => {
      const settings: Record<string, unknown> = {
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: '4096',
      };

      const snapshot = ProviderSettingsCoordinator.getProviderSettingsSnapshot(settings, 'octo-agent');
      ProviderSettingsCoordinator.commitProviderSettingsSnapshot(settings, 'octo-agent', snapshot);

      expect(settings.thinkingBudget).toBe('off');
    });
  });

  describe('projectProviderState', () => {
    it('seeds the default octo-agent model when no model exists yet', () => {
      const settings: Record<string, unknown> = {
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        model: '',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
      };

      ProviderSettingsCoordinator.projectProviderState(settings, 'octo-agent');

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
    });

    it('derives a valid permission mode from a legacy octo-agent permission value', () => {
      const settings: Record<string, unknown> = {
        permissionMode: 'auto',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
      };

      ProviderSettingsCoordinator.projectProviderState(settings, 'octo-agent');

      expect(settings.permissionMode).toBe('yolo');
    });
  });

  describe('provider-scoped reconciliation', () => {
    it('leaves bound conversation sessions alone — they are server-resident', () => {
      const octoConv = {
        providerId: 'octo-agent',
        sessionId: 'session-1',
        providerState: { sessionId: 'session-1' },
        messages: [],
      } as unknown as Conversation;

      const settings: Record<string, unknown> = {
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
      };

      const reconcileSpy = jest.spyOn(octoAgentSettingsReconciler, 'reconcileModelWithEnvironment');
      const result = ProviderSettingsCoordinator.reconcileAllProviders(settings, [octoConv]);

      // The outcome is a no-op, so assert the conversation still reached the
      // provider's reconciler — otherwise a broken dispatch would pass too.
      expect(reconcileSpy).toHaveBeenCalledWith(settings, [octoConv]);
      expect(result).toEqual({ changed: false, invalidatedConversations: [] });
      expect(octoConv.sessionId).toBe('session-1');
      reconcileSpy.mockRestore();
    });
  });
});
