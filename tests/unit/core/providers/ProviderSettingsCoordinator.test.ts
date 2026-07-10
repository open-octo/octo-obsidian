import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from '@/core/providers/ProviderSettingsCoordinator';
import type { Conversation } from '@/core/types';

describe('ProviderSettingsCoordinator', () => {
  describe('normalizeProviderSelection', () => {
    it('falls back to octo-agent for unknown providers', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'mystery-provider',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
      };

      const changed = ProviderSettingsCoordinator.normalizeProviderSelection(settings);

      expect(changed).toBe(true);
      expect(settings.settingsProvider).toBe('octo-agent');
    });

    it('returns false when already normalized (no-op)', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
      };
      expect(ProviderSettingsCoordinator.normalizeProviderSelection(settings)).toBe(false);
    });
  });

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

    it('migrates the active octo-agent model when the cached model list no longer offers it', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        model: 'octo-agent/gpt-legacy',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        octoAgentModels: [
          { label: 'Kimi For Coding', value: 'octo-agent/kimi-for-coding' },
        ],
        savedProviderModel: { 'octo-agent': 'octo-agent/gpt-legacy' },
      };

      expect(ProviderSettingsCoordinator.normalizeAllModelVariants(settings)).toBe(true);
      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.savedProviderModel).toEqual({ 'octo-agent': 'octo-agent/kimi-for-coding' });
    });
  });

  describe('reconcileTitleGenerationModelSelection', () => {
    it('clears titleGenerationModel when no provider owns the saved model', () => {
      const settings: Record<string, unknown> = {
        titleGenerationModel: 'legacy-model-id',
      };

      expect(
        ProviderSettingsCoordinator.reconcileTitleGenerationModelSelection(settings),
      ).toBe(true);
      expect(settings.titleGenerationModel).toBe('');
    });

    it('clears a stale provider-qualified octo-agent title model instead of retargeting to a fallback', () => {
      const settings: Record<string, unknown> = {
        titleGenerationModel: 'octo-agent/stale-model',
      };

      expect(
        ProviderSettingsCoordinator.reconcileTitleGenerationModelSelection(settings),
      ).toBe(true);
      expect(settings.titleGenerationModel).toBe('');
    });

    it('leaves a valid provider-qualified octo-agent title model unchanged', () => {
      const settings: Record<string, unknown> = {
        titleGenerationModel: 'octo-agent/kimi-for-coding',
      };

      expect(
        ProviderSettingsCoordinator.reconcileTitleGenerationModelSelection(settings),
      ).toBe(false);
      expect(settings.titleGenerationModel).toBe('octo-agent/kimi-for-coding');
    });
  });

  describe('projectActiveProviderState', () => {
    it('projects saved model and effort for the settings provider', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        permissionMode: 'normal',
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
        // A leftover key from a removed provider should be ignored, not read from.
        savedProviderModel: { 'octo-agent': 'octo-agent/kimi-for-coding', 'legacy-provider': 'legacy-model' },
        savedProviderEffort: { 'octo-agent': 'medium', 'legacy-provider': 'high' },
        savedProviderServiceTier: { 'octo-agent': 'default', 'legacy-provider': 'fast' },
        savedProviderThinkingBudget: { 'octo-agent': 'off', 'legacy-provider': '2048' },
        savedProviderPermissionMode: { 'octo-agent': 'yolo', 'legacy-provider': 'normal' },
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.effortLevel).toBe('medium');
      expect(settings.serviceTier).toBe('default');
      expect(settings.thinkingBudget).toBe('off');
      expect(settings.permissionMode).toBe('yolo');
    });

    it('migrates a stale saved octo-agent model before projecting provider state', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        octoAgentModels: [
          { label: 'Kimi For Coding', value: 'octo-agent/kimi-for-coding' },
        ],
        savedProviderModel: { 'octo-agent': 'octo-agent/retired-model' },
        savedProviderEffort: { 'octo-agent': 'medium' },
        savedProviderServiceTier: { 'octo-agent': 'default' },
        savedProviderThinkingBudget: { 'octo-agent': 'off' },
      };

      const snapshot = ProviderSettingsCoordinator.getProviderSettingsSnapshot(settings, 'octo-agent');

      expect(snapshot.model).toBe('octo-agent/kimi-for-coding');
      expect(snapshot.serviceTier).toBe('default');
    });

    it('defaults to octo-agent when settingsProvider is not set', () => {
      const settings: Record<string, unknown> = {
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'low',
        serviceTier: 'default',
        thinkingBudget: '500',
        savedProviderModel: { 'octo-agent': 'octo-agent/kimi-for-coding' },
        savedProviderEffort: { 'octo-agent': 'high' },
        savedProviderServiceTier: { 'octo-agent': 'default' },
        savedProviderThinkingBudget: { 'octo-agent': 'off' },
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.effortLevel).toBe('high');
      expect(settings.serviceTier).toBe('default');
      expect(settings.thinkingBudget).toBe('off');
    });

    it('does not overwrite when no saved values exist', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
        savedProviderModel: {},
        savedProviderEffort: {},
        savedProviderServiceTier: {},
        savedProviderThinkingBudget: {},
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.effortLevel).toBe('high');
      expect(settings.thinkingBudget).toBe('off');
    });

    it('handles missing saved maps gracefully', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
      };

      // Should not throw
      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
    });

    it('normalizes a saved thinking budget that octo-agent does not support', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: '4096',
        savedProviderModel: { 'octo-agent': 'octo-agent/kimi-for-coding' },
        savedProviderThinkingBudget: { 'octo-agent': '4096' },
      };

      ProviderSettingsCoordinator.projectActiveProviderState(settings);

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
      expect(settings.thinkingBudget).toBe('off');
    });
  });

  describe('persistProjectedProviderState', () => {
    it('stores the current top-level projection for the settings provider without clobbering other keys', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        permissionMode: 'normal',
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'low',
        serviceTier: 'default',
        thinkingBudget: 'off',
        savedProviderModel: { 'legacy-provider': 'legacy-model' },
        savedProviderEffort: { 'legacy-provider': 'high' },
        savedProviderServiceTier: { 'legacy-provider': 'default' },
        savedProviderThinkingBudget: { 'legacy-provider': 'off' },
        savedProviderPermissionMode: { 'legacy-provider': 'yolo' },
      };

      ProviderSettingsCoordinator.persistProjectedProviderState(settings);

      expect(settings.savedProviderModel).toEqual({
        'legacy-provider': 'legacy-model',
        'octo-agent': 'octo-agent/kimi-for-coding',
      });
      expect(settings.savedProviderEffort).toEqual({
        'legacy-provider': 'high',
        'octo-agent': 'low',
      });
      // octo-agent has no service-tier toggle, so persisting must not add an entry for it.
      expect(settings.savedProviderServiceTier).toEqual({
        'legacy-provider': 'default',
      });
      expect(settings.savedProviderPermissionMode).toEqual({
        'legacy-provider': 'yolo',
        'octo-agent': 'normal',
      });
    });
  });

  describe('projectProviderState', () => {
    it('seeds the default octo-agent model when no model or saved state exists yet', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        model: '',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
        savedProviderModel: {},
        savedProviderEffort: {},
        savedProviderServiceTier: {},
        savedProviderThinkingBudget: {},
      };

      ProviderSettingsCoordinator.projectProviderState(settings, 'octo-agent');

      expect(settings.model).toBe('octo-agent/kimi-for-coding');
    });

    it('derives a valid permission mode from a legacy octo-agent permission value', () => {
      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        permissionMode: 'auto',
        providerConfigs: {
          'octo-agent': { enabled: true },
        },
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
        savedProviderModel: {},
        savedProviderEffort: {},
        savedProviderServiceTier: {},
        savedProviderThinkingBudget: {},
        savedProviderPermissionMode: {},
      };

      ProviderSettingsCoordinator.projectProviderState(settings, 'octo-agent');

      expect(settings.permissionMode).toBe('yolo');
    });
  });

  describe('provider-scoped reconciliation', () => {
    it('invalidates a bound conversation session when octo-agent is disabled', () => {
      const octoConv = {
        providerId: 'octo-agent',
        sessionId: 'session-1',
        messages: [],
      } as unknown as Conversation;

      const settings: Record<string, unknown> = {
        settingsProvider: 'octo-agent',
        providerConfigs: {
          'octo-agent': { enabled: false },
        },
        model: 'octo-agent/kimi-for-coding',
        effortLevel: 'high',
        serviceTier: 'default',
        thinkingBudget: 'off',
      };

      const result = ProviderSettingsCoordinator.reconcileAllProviders(settings, [octoConv]);

      expect(result.changed).toBe(true);
      expect(octoConv.sessionId).toBeNull();
      expect(octoConv.providerState).toBeUndefined();
    });
  });
});
