import type { Conversation } from '../types';
import { ProviderRegistry } from './ProviderRegistry';
import type { ProviderChatUIConfig, ProviderId } from './types';

export interface SettingsReconciliationResult {
  changed: boolean;
  invalidatedConversations: Conversation[];
}

function getSettingsProviderId(settings: Record<string, unknown>): ProviderId {
  return ProviderRegistry.resolveSettingsProviderId(settings);
}

function normalizeToggleValue(
  value: unknown,
  allowedValues: Set<string>,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return allowedValues.has(value) ? value : undefined;
}

function normalizeReasoningValue(
  uiConfig: ProviderChatUIConfig,
  settings: Record<string, unknown>,
  model: string,
  value: unknown,
): string {
  const allowedValues = new Set(uiConfig.getReasoningOptions(model, settings).map(option => option.value));
  if (typeof value === 'string' && allowedValues.has(value)) {
    return value;
  }
  return uiConfig.getDefaultReasoningValue(model, settings);
}

function normalizeProviderModel(
  uiConfig: ProviderChatUIConfig,
  settings: Record<string, unknown>,
  model: string | undefined,
): string | undefined {
  if (!model) {
    return undefined;
  }
  return uiConfig.normalizeModelVariant(model, settings);
}

/**
 * Coordinates provider-owned settings reconciliation.
 *
 * Only one provider (octo-agent) is registered, so the historical
 * per-provider projection maps (savedProviderModel etc.) are gone: the
 * top-level model/effortLevel/serviceTier/thinkingBudget/permissionMode
 * fields are authoritative and are only normalized against the provider's
 * chat UI config.
 */
export class ProviderSettingsCoordinator {
  static handleEnvironmentChange(
    settings: Record<string, unknown>,
    providerIds: ProviderId[],
  ): boolean {
    let anyChanged = false;
    for (const providerId of providerIds) {
      const reconciler = ProviderRegistry.getSettingsReconciler(providerId);
      if (reconciler.handleEnvironmentChange?.(settings)) {
        anyChanged = true;
      }
    }
    return anyChanged;
  }

  static getProviderSettingsSnapshot<T extends Record<string, unknown>>(
    settings: T,
    providerId: ProviderId,
  ): T {
    const snapshot = { ...settings };
    this.projectProviderState(snapshot, providerId);
    return snapshot;
  }

  static commitProviderSettingsSnapshot(
    settings: Record<string, unknown>,
    providerId: ProviderId,
    snapshot: Record<string, unknown>,
  ): void {
    // Single provider: the snapshot is just the normalized top-level state.
    void providerId;
    Object.assign(settings, snapshot);
  }

  /**
   * Normalize the top-level model/effort/tier/budget/permission values
   * against the provider's chat UI config (variant aliases, allowed
   * reasoning values, toggle defaults).
   */
  static projectProviderState(
    settings: Record<string, unknown>,
    providerId: ProviderId,
  ): void {
    const uiConfig = ProviderRegistry.getChatUIConfig(providerId);
    const currentModelRaw = typeof settings.model === 'string' ? settings.model : '';
    const currentModel = normalizeProviderModel(uiConfig, settings, currentModelRaw) ?? '';
    const currentEffort = typeof settings.effortLevel === 'string' ? settings.effortLevel : undefined;
    const currentBudget = typeof settings.thinkingBudget === 'string' ? settings.thinkingBudget : undefined;
    const modelOptions = uiConfig.getModelOptions(settings);
    const model = currentModel || (modelOptions[0]?.value ?? '');
    const modelFellBack = currentModel.length === 0 || model !== currentModel;

    if (model) {
      settings.model = model;
      uiConfig.applyModelDefaults(model, settings);
    }

    const serviceTierToggle = uiConfig.getServiceTierToggle?.({
      ...settings,
      ...(model ? { model } : {}),
    }) ?? null;

    const isAdaptive = Boolean(model) && uiConfig.isAdaptiveReasoningModel(model, settings);

    if (isAdaptive) {
      settings.effortLevel = normalizeReasoningValue(
        uiConfig,
        settings,
        model,
        modelFellBack ? undefined : currentEffort,
      );
    }

    if (typeof settings.serviceTier !== 'string') {
      settings.serviceTier = serviceTierToggle?.inactiveValue ?? 'default';
    }

    const usesBudget = Boolean(model) && !isAdaptive;

    if (usesBudget) {
      settings.thinkingBudget = normalizeReasoningValue(
        uiConfig,
        settings,
        model,
        modelFellBack ? undefined : currentBudget,
      );
    }

    const permissionToggle = uiConfig.getPermissionModeToggle?.() ?? null;
    if (!permissionToggle) {
      return;
    }

    const allowedPermissionModes = new Set([
      permissionToggle.inactiveValue,
      permissionToggle.activeValue,
      ...(permissionToggle.planValue ? [permissionToggle.planValue] : []),
    ]);
    const currentPermissionMode = normalizeToggleValue(settings.permissionMode, allowedPermissionModes);
    const derivedPermissionMode = normalizeToggleValue(
      uiConfig.resolvePermissionMode?.(settings),
      allowedPermissionModes,
    );

    const projectedPermissionMode = derivedPermissionMode ?? currentPermissionMode;

    if (projectedPermissionMode !== undefined) {
      settings.permissionMode = projectedPermissionMode;
    }
  }

  static reconcileAllProviders(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): SettingsReconciliationResult {
    return this.reconcileProviders(
      settings,
      conversations,
      ProviderRegistry.getRegisteredProviderIds(),
    );
  }

  static reconcileProviders(
    settings: Record<string, unknown>,
    conversations: Conversation[],
    providerIds: ProviderId[],
  ): SettingsReconciliationResult {
    let anyChanged = false;
    const allInvalidated: Conversation[] = [];

    for (const providerId of providerIds) {
      const reconciler = ProviderRegistry.getSettingsReconciler(providerId);
      const providerConversations = conversations.filter(c => c.providerId === providerId);

      const { changed, invalidatedConversations } = reconciler.reconcileModelWithEnvironment(
        settings,
        providerConversations,
      );

      if (changed) {
        anyChanged = true;
      }
      allInvalidated.push(...invalidatedConversations);
    }

    return { changed: anyChanged, invalidatedConversations: allInvalidated };
  }

  static normalizeAllModelVariants(settings: Record<string, unknown>): boolean {
    let anyChanged = false;

    for (const providerId of ProviderRegistry.getRegisteredProviderIds()) {
      const reconciler = ProviderRegistry.getSettingsReconciler(providerId);
      const changed = reconciler.normalizeModelVariantSettings(settings);
      if (changed) {
        anyChanged = true;
      }
    }
    return anyChanged;
  }

  /**
   * Normalize the active provider's top-level model/effortLevel/
   * thinkingBudget fields against its chat UI config.
   */
  static projectActiveProviderState(settings: Record<string, unknown>): void {
    this.projectProviderState(settings, getSettingsProviderId(settings));
  }
}
