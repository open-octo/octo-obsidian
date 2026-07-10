import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '@/core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderId,
  TitleGenerationCallback,
  TitleGenerationResult,
  TitleGenerationService,
} from '@/core/providers/types';

describe('ProviderRegistry', () => {
  beforeEach(() => {
    ProviderWorkspaceRegistry.clear();
    ProviderWorkspaceRegistry.setServices('octo-agent', {
      mcpManager: {} as any,
      mcpServerManager: {} as any,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a runtime with the default provider id', () => {
    const runtime = ProviderRegistry.createChatRuntime({
      plugin: {} as any,
    });

    expect(runtime.providerId).toBe('octo-agent');
  });

  it('creates a runtime with an explicit octo-agent provider id', () => {
    const runtime = ProviderRegistry.createChatRuntime({
      providerId: 'octo-agent',
      plugin: {} as any,
    });

    expect(runtime.providerId).toBe('octo-agent');
  });

  it('returns capabilities for the default provider', () => {
    const caps = ProviderRegistry.getCapabilities();
    expect(caps.providerId).toBe('octo-agent');
    expect(caps).toHaveProperty('supportsPlanMode');
    expect(caps).toHaveProperty('supportsFork');
  });

  it('returns boundary services for the default provider', () => {
    const historyService = ProviderRegistry.getConversationHistoryService();
    expect(historyService).toHaveProperty('hydrateConversationHistory');

    const taskInterpreter = ProviderRegistry.getTaskResultInterpreter();
    expect(taskInterpreter).toHaveProperty('resolveTerminalStatus');
  });

  it('returns a settings reconciler for the default provider', () => {
    const reconciler = ProviderRegistry.getSettingsReconciler();
    expect(reconciler).toHaveProperty('reconcileModelWithEnvironment');
    expect(reconciler).toHaveProperty('normalizeModelVariantSettings');
  });

  it('returns a chat UI config for the default provider', () => {
    const uiConfig = ProviderRegistry.getChatUIConfig();
    expect(uiConfig).toHaveProperty('getModelOptions');
    expect(uiConfig).toHaveProperty('getCustomModelIds');
  });

  it('throws when an unknown provider is requested', () => {
    expect(() => ProviderRegistry.getCapabilities(
      'nonexistent' as any,
    )).toThrow('Provider "nonexistent" is not registered.');
  });

  it('lists registered provider ids', () => {
    const ids = ProviderRegistry.getRegisteredProviderIds();
    expect(ids).toEqual(['octo-agent']);
  });

  it('filters enabled provider ids using registration metadata', () => {
    expect(ProviderRegistry.getEnabledProviderIds({
      providerConfigs: {
        'octo-agent': { enabled: false },
      },
    })).toEqual([]);
    expect(ProviderRegistry.getEnabledProviderIds({
      providerConfigs: {
        'octo-agent': { enabled: true },
      },
    })).toEqual(['octo-agent']);
  });

  it('returns the display name from provider registration metadata', () => {
    expect(ProviderRegistry.getProviderDisplayName('octo-agent')).toBe('Octo Agent');
  });

  it('routes auto title generation to octo-agent independently of chat provider state', async () => {
    const providerCalls: ProviderId[] = [];
    const originalCreate = ProviderRegistry.createTitleGenerationService.bind(ProviderRegistry);
    jest.spyOn(ProviderRegistry, 'createTitleGenerationService')
      .mockImplementation((plugin: any, providerId?: ProviderId) => {
        if (!providerId) {
          return originalCreate(plugin);
        }
        providerCalls.push(providerId);
        return createMockTitleService(providerId);
      });

    const service = ProviderRegistry.createTitleGenerationService({
      settings: {
        titleGenerationModel: '',
      },
    } as any);
    const callback = jest.fn();

    await service.generateTitle('conv-1', 'hello', callback);

    expect(providerCalls).toEqual(['octo-agent']);
    expect(callback).toHaveBeenCalledWith('conv-1', {
      success: true,
      title: 'octo-agent title',
    });
  });

  it('routes explicit title model selections to the owning provider', async () => {
    const providerCalls: ProviderId[] = [];
    const originalCreate = ProviderRegistry.createTitleGenerationService.bind(ProviderRegistry);
    jest.spyOn(ProviderRegistry, 'createTitleGenerationService')
      .mockImplementation((plugin: any, providerId?: ProviderId) => {
        if (!providerId) {
          return originalCreate(plugin);
        }
        providerCalls.push(providerId);
        return createMockTitleService(providerId);
      });

    const service = ProviderRegistry.createTitleGenerationService({
      settings: {
        titleGenerationModel: 'octo-agent/kimi-for-coding',
      },
    } as any);
    const callback = jest.fn();

    await service.generateTitle('conv-1', 'hello', callback);

    expect(providerCalls).toEqual(['octo-agent']);
    expect(callback).toHaveBeenCalledWith('conv-1', {
      success: true,
      title: 'octo-agent title',
    });
  });

  it('suppresses stale callbacks when a newer title generation replaces the old one', async () => {
    const originalCreate = ProviderRegistry.createTitleGenerationService.bind(ProviderRegistry);
    const firstService = createDeferredTitleService();
    const secondService = createMockTitleService('octo-agent');
    let callCount = 0;

    jest.spyOn(ProviderRegistry, 'createTitleGenerationService')
      .mockImplementation((plugin: any, providerId?: ProviderId) => {
        if (!providerId) {
          return originalCreate(plugin);
        }
        callCount += 1;
        return callCount === 1 ? firstService : secondService;
      });

    const plugin = {
      settings: {
        titleGenerationModel: '',
      },
    } as any;
    const service = ProviderRegistry.createTitleGenerationService(plugin);
    const callback = jest.fn();

    // Two title generations race for the same conversation; the newer one
    // should win and the stale first one's callback must be suppressed.
    const first = service.generateTitle('conv-1', 'first', callback);
    await service.generateTitle('conv-1', 'second', callback);
    await firstService.resolve({ success: true, title: 'stale title' });
    await first;

    expect(firstService.cancel).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('conv-1', {
      success: true,
      title: 'octo-agent title',
    });
  });
});

function createMockTitleService(providerId: ProviderId): TitleGenerationService {
  return {
    cancel: jest.fn(),
    generateTitle: jest.fn(async (conversationId, _userMessage, callback) => {
      await callback(conversationId, {
        success: true,
        title: `${providerId} title`,
      });
    }),
  };
}

function createDeferredTitleService(): TitleGenerationService & {
  resolve: (result: TitleGenerationResult) => Promise<void>;
} {
  let callback: TitleGenerationCallback | null = null;
  let conversationId = '';
  let resolvePromise: (() => void) | null = null;
  const done = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    cancel: jest.fn(),
    generateTitle: jest.fn(async (nextConversationId, _userMessage, nextCallback) => {
      conversationId = nextConversationId;
      callback = nextCallback;
      await done;
    }),
    resolve: async (result) => {
      await callback?.(conversationId, result);
      resolvePromise?.();
    },
  };
}
