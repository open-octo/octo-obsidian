
import { DEFAULT_OCTO_SETTINGS as DEFAULT_SETTINGS } from '@/app/settings/defaultSettings';
import { VIEW_TYPE_OCTO } from '@/core/types';
import { OCTO_APP_ICON_ID } from '@/shared/icons';

// Mock fs for OctoService
jest.mock('fs');

// Now import the plugin after mocking
import OctoPlugin from '@/main';

describe('OctoPlugin', () => {
  let plugin: OctoPlugin;
  let mockApp: any;
  let mockManifest: any;

  function getRegisteredCommand(commandId: string) {
    const call = (plugin.addCommand as jest.Mock).mock.calls.find(
      ([config]) => config.id === commandId,
    );

    if (!call) {
      throw new Error(`Command ${commandId} was not registered`);
    }

    return call[0];
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockApp = {
      vault: {
        adapter: {
          basePath: '/test/vault',
          exists: jest.fn().mockResolvedValue(false),
          read: jest.fn().mockResolvedValue(''),
          write: jest.fn().mockResolvedValue(undefined),
          remove: jest.fn().mockResolvedValue(undefined),
          mkdir: jest.fn().mockResolvedValue(undefined),
          list: jest.fn().mockResolvedValue({ files: [], folders: [] }),
          stat: jest.fn().mockResolvedValue(null),
          rename: jest.fn().mockResolvedValue(undefined),
        },
      },
      workspace: {
        getLeavesOfType: jest.fn().mockReturnValue([]),
        getRightLeaf: jest.fn().mockReturnValue({
          setViewState: jest.fn().mockResolvedValue(undefined),
        }),
        getLeftLeaf: jest.fn().mockReturnValue({
          setViewState: jest.fn().mockResolvedValue(undefined),
        }),
        getLeaf: jest.fn().mockReturnValue({
          setViewState: jest.fn().mockResolvedValue(undefined),
        }),
        setActiveLeaf: jest.fn(),
        revealLeaf: jest.fn(),
      },
    };

    mockManifest = {
      id: 'octo',
      name: 'Octo',
      version: '0.1.0',
    };

    // Create plugin instance with mocked app
    plugin = new OctoPlugin(mockApp, mockManifest);
    (plugin.loadData as jest.Mock).mockResolvedValue({});
  });

  describe('onload', () => {
    it('should initialize settings with defaults', async () => {
      await plugin.onload();

      expect(plugin.settings).toBeDefined();
      expect(plugin.settings.permissionMode).toBe(DEFAULT_SETTINGS.permissionMode);
      expect(plugin.settings.hiddenProviderCommands).toEqual(DEFAULT_SETTINGS.hiddenProviderCommands);
    });

    // Note: With multi-tab, agentService is per-tab via TabManager, not on plugin

    it('should register the view', async () => {
      await plugin.onload();

      expect((plugin.registerView as jest.Mock)).toHaveBeenCalledWith(
        VIEW_TYPE_OCTO,
        expect.any(Function)
      );
    });

    it('should add ribbon icon', async () => {
      await plugin.onload();

      expect((plugin.addRibbonIcon as jest.Mock)).toHaveBeenCalledWith(
        OCTO_APP_ICON_ID,
        'Open Octo',
        expect.any(Function)
      );
    });

    it('should add command to open view', async () => {
      await plugin.onload();

      expect((plugin.addCommand as jest.Mock)).toHaveBeenCalledWith({
        id: 'open-view',
        name: 'Open chat view',
        callback: expect.any(Function),
      });
    });

  });

  describe('onunload', () => {
    // Note: With multi-tab, cleanup is handled per-tab via OctoView.onClose()
    it('should complete without error', async () => {
      await plugin.onload();

      expect(() => plugin.onunload()).not.toThrow();
    });
  });

  describe('activateView', () => {
    it('should reveal existing leaf if view already exists', async () => {
      const mockLeaf = { id: 'existing-leaf' };
      mockApp.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);

      await plugin.onload();
      await plugin.activateView();

      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });

    it('should create new leaf in right sidebar by default if view does not exist', async () => {
      const mockRightLeaf = {
        setViewState: jest.fn().mockResolvedValue(undefined),
      };
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);
      mockApp.workspace.getRightLeaf.mockReturnValue(mockRightLeaf);

      await plugin.onload();
      await plugin.activateView();

      expect(mockApp.workspace.getRightLeaf).toHaveBeenCalledWith(false);
      expect(mockRightLeaf.setViewState).toHaveBeenCalledWith({
        type: VIEW_TYPE_OCTO,
        active: true,
      });
    });

    it('should create new leaf in left sidebar when chatViewPlacement is left-sidebar', async () => {
      const mockLeftLeaf = {
        setViewState: jest.fn().mockResolvedValue(undefined),
      };
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);
      mockApp.workspace.getLeftLeaf.mockReturnValue(mockLeftLeaf);

      await plugin.onload();
      plugin.settings.chatViewPlacement = 'left-sidebar';
      await plugin.activateView();

      expect(mockApp.workspace.getLeftLeaf).toHaveBeenCalledWith(false);
      expect(mockApp.workspace.getRightLeaf).not.toHaveBeenCalled();
      expect(mockApp.workspace.getLeaf).not.toHaveBeenCalled();
      expect(mockLeftLeaf.setViewState).toHaveBeenCalledWith({
        type: VIEW_TYPE_OCTO,
        active: true,
      });
    });

    it('should handle null right leaf gracefully', async () => {
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);
      mockApp.workspace.getRightLeaf.mockReturnValue(null);

      await plugin.onload();

      // Should not throw
      await expect(plugin.activateView()).resolves.not.toThrow();
    });

    it('should create new leaf in main editor area when chatViewPlacement is main-tab', async () => {
      const mockMainLeaf = {
        setViewState: jest.fn().mockResolvedValue(undefined),
      };
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);
      mockApp.workspace.getLeaf.mockReturnValue(mockMainLeaf);

      await plugin.onload();
      plugin.settings.chatViewPlacement = 'main-tab';
      await plugin.activateView();

      expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith('tab');
      expect(mockApp.workspace.getRightLeaf).not.toHaveBeenCalled();
      expect(mockApp.workspace.getLeftLeaf).not.toHaveBeenCalled();
      expect(mockMainLeaf.setViewState).toHaveBeenCalledWith({
        type: VIEW_TYPE_OCTO,
        active: true,
      });
    });

    it('should handle null main leaf gracefully when chatViewPlacement is main-tab', async () => {
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);
      mockApp.workspace.getLeaf.mockReturnValue(null);

      await plugin.onload();
      plugin.settings.chatViewPlacement = 'main-tab';

      await expect(plugin.activateView()).resolves.not.toThrow();
    });
  });

  describe('loadSettings', () => {
    it('should merge saved data with defaults', async () => {
      // Mock octo-settings.json exists with custom values (Octo-specific settings)
      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        return path === '.octo-agent/settings.json';
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.octo-agent/settings.json') {
          return JSON.stringify({
            mediaFolder: 'Attachments',
          });
        }
        return '';
      });

      await plugin.loadSettings();

      expect(plugin.settings.mediaFolder).toBe('Attachments');
      expect(plugin.settings.hiddenProviderCommands).toEqual(DEFAULT_SETTINGS.hiddenProviderCommands);
    });

    it('should use defaults when no saved data', async () => {
      // No settings file exists
      mockApp.vault.adapter.exists.mockResolvedValue(false);
      (plugin.loadData as jest.Mock).mockResolvedValue(null);

      await plugin.loadSettings();

      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should use defaults when loadData returns empty object', async () => {
      // No settings file exists
      mockApp.vault.adapter.exists.mockResolvedValue(false);
      (plugin.loadData as jest.Mock).mockResolvedValue({});

      await plugin.loadSettings();

      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
    });

  });

  describe('saveSettings', () => {
    it('should save settings to file', async () => {
      await plugin.onload();

      await plugin.saveSettings();

      // Plugin settings should be written to .octo-agent/settings.json
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '.octo-agent/settings.json',
        expect.any(String)
      );

      // The written content should include state fields
      const writeCall = (mockApp.vault.adapter.write as jest.Mock).mock.calls.find(
        ([path]) => path === '.octo-agent/settings.json'
      );
      expect(writeCall).toBeDefined();
      const content = JSON.parse(writeCall[1]);
      expect(content).not.toHaveProperty('activeConversationId');
      expect(content).toHaveProperty(['providerConfigs', 'octo-agent', 'cliPath']);
      expect(content).toHaveProperty('lastCustomModel');
      expect(content).not.toHaveProperty('enableBlocklist');
      expect(content).not.toHaveProperty('blockedCommands');
      // Permissions are now in .claude/settings.json (CC format), not octo-settings.json
      expect(content).not.toHaveProperty('permissions');
    });
  });

  describe('applyEnvironmentVariables', () => {
    it('updates runtime env vars when changed', async () => {
      await plugin.onload();

      await plugin.applyEnvironmentVariables('A=2');
      expect(plugin.getActiveEnvironmentVariables()).toBe('A=2');

      await plugin.applyEnvironmentVariables('A=3');
      expect(plugin.getActiveEnvironmentVariables()).toBe('A=3');

      // No change - should not update
      const currentEnv = plugin.getActiveEnvironmentVariables();
      await plugin.applyEnvironmentVariables('A=3');
      expect(plugin.getActiveEnvironmentVariables()).toBe(currentEnv);
    });

    it('keeps server-resident sessions alive across env changes', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation({ providerId: 'octo-agent', sessionId: 'session-123' });

      await plugin.applyEnvironmentVariables('SOME_VAR=changed');

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.sessionId).toBe('session-123');
    });

    it('broadcasts ensureReady with force when env changes without model change', async () => {
      await plugin.onload();

      // Mock getView to return a view with tabManager
      const mockSyncConversationState = jest.fn();
      const mockEnsureReady = jest.fn().mockResolvedValue(true);
      const mockTabManager = {
        getAllTabs: jest.fn().mockReturnValue([{
          providerId: 'octo-agent',
          conversationId: null,
          state: { isStreaming: false },
          serviceInitialized: true,
          service: {
            ensureReady: mockEnsureReady,
            syncConversationState: mockSyncConversationState,
          },
          ui: { externalContextSelector: { getExternalContexts: jest.fn().mockReturnValue([]) } },
        }]),
      };
      const mockView = {
        getTabManager: jest.fn().mockReturnValue(mockTabManager),
        invalidateProviderCommandCaches: jest.fn(),
        refreshModelSelector: jest.fn(),
      };
      jest.spyOn(plugin, 'getView').mockReturnValue(mockView as any);

      // Change env but not in a way that affects model
      await plugin.applyEnvironmentVariables('SOME_VAR=value');

      expect(mockSyncConversationState).toHaveBeenCalledWith(null, []);
      expect(mockEnsureReady).toHaveBeenCalledWith({ force: true });
    });

    it('syncs live external contexts before force-restarting runtimes', async () => {
      await plugin.onload();

      const conversation = await plugin.createConversation({
        providerId: 'octo-agent',
        sessionId: 'session-123',
      });
      await plugin.updateConversation(conversation.id, {
        externalContextPaths: ['/saved/context'],
        messages: [{
          content: 'hi',
          id: 'msg-1',
          role: 'user',
          timestamp: Date.now(),
          userMessageId: 'msg-1',
        }],
      });

      const mockSyncConversationState = jest.fn();
      const mockResetSession = jest.fn();
      const mockEnsureReady = jest.fn().mockResolvedValue(true);
      const mockTabManager = {
        getAllTabs: jest.fn().mockReturnValue([{
          conversationId: conversation.id,
          providerId: 'octo-agent',
          state: { isStreaming: false },
          serviceInitialized: true,
          service: {
            ensureReady: mockEnsureReady,
            resetSession: mockResetSession,
            syncConversationState: mockSyncConversationState,
          },
          ui: { externalContextSelector: { getExternalContexts: jest.fn().mockReturnValue(['/live/context']) } },
        }]),
      };
      const mockView = {
        getTabManager: jest.fn().mockReturnValue(mockTabManager),
        invalidateProviderCommandCaches: jest.fn(),
        refreshModelSelector: jest.fn(),
      };
      jest.spyOn(plugin, 'getView').mockReturnValue(mockView as any);

      await plugin.applyEnvironmentVariables('SOME_VAR=changed');

      expect(mockSyncConversationState).toHaveBeenCalledWith(
        expect.objectContaining({ id: conversation.id }),
        ['/live/context'],
      );
      // Octo Agent sessions survive env changes, so the runtime is force-restarted
      // in place rather than reset.
      expect(mockResetSession).not.toHaveBeenCalled();
      expect(mockEnsureReady).toHaveBeenCalledWith({ force: true });
    });
  });

  describe('ribbon icon callback', () => {
    it('reveals existing view when ribbon icon is clicked', async () => {
      await plugin.onload();
      const mockLeaf = { id: 'existing' };
      mockApp.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);

      const ribbonCallback = (plugin.addRibbonIcon as jest.Mock).mock.calls[0][2];
      await ribbonCallback();

      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });
  });

  describe('command callback', () => {
    it('reveals existing view when command is executed', async () => {
      await plugin.onload();
      const mockLeaf = { id: 'existing' };
      mockApp.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);

      const commandConfig = (plugin.addCommand as jest.Mock).mock.calls[0][0];
      await commandConfig.callback();

      expect(mockApp.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });
  });

  describe('new-tab command', () => {
    it('opens the view without creating a duplicate tab when no tab layout is persisted', async () => {
      await plugin.onload();

      const createNewTab = jest.fn().mockResolvedValue(undefined);
      const mockView = {
        createNewTab,
      };

      let viewOpened = false;
      jest.spyOn(plugin, 'activateView').mockImplementation(async () => {
        viewOpened = true;
      });
      jest.spyOn(plugin, 'getView').mockImplementation(() => (
        viewOpened ? mockView as any : null
      ));

      const command = getRegisteredCommand('new-tab');

      expect(command.checkCallback(true)).toBe(true);
      expect(command.checkCallback(false)).toBe(true);

      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(plugin.activateView).toHaveBeenCalledTimes(1);
      expect(createNewTab).not.toHaveBeenCalled();
    });

    it('creates a new tab after reopening a persisted tab layout', async () => {
      (plugin.loadData as jest.Mock).mockResolvedValue({
        tabManagerState: {
          openTabs: [
            { tabId: 'tab-1', conversationId: null },
          ],
          activeTabId: 'tab-1',
        },
      });

      await plugin.onload();

      const createNewTab = jest.fn().mockResolvedValue(undefined);
      const mockView = {
        createNewTab,
      };

      let viewOpened = false;
      jest.spyOn(plugin, 'activateView').mockImplementation(async () => {
        viewOpened = true;
      });
      jest.spyOn(plugin, 'getView').mockImplementation(() => (
        viewOpened ? mockView as any : null
      ));

      const command = getRegisteredCommand('new-tab');

      expect(command.checkCallback(true)).toBe(true);
      expect(command.checkCallback(false)).toBe(true);

      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(plugin.activateView).toHaveBeenCalledTimes(1);
      expect(createNewTab).toHaveBeenCalledTimes(1);
    });

    it('stays unavailable when the open view is already at the tab limit', async () => {
      await plugin.onload();

      const mockView = {
        getTabManager: jest.fn().mockReturnValue({
          canCreateTab: jest.fn().mockReturnValue(false),
        }),
      };

      jest.spyOn(plugin, 'getView').mockReturnValue(mockView as any);

      const command = getRegisteredCommand('new-tab');

      expect(command.checkCallback(true)).toBe(false);
    });

    it('keeps tab commands unavailable while a Octo leaf view is not initialized', async () => {
      await plugin.onload();

      mockApp.workspace.getLeavesOfType.mockReturnValue([{ view: {} }]);

      for (const commandId of ['new-tab', 'new-session', 'close-current-tab']) {
        const command = getRegisteredCommand(commandId);

        expect(() => command.checkCallback(true)).not.toThrow();
        expect(command.checkCallback(true)).toBe(false);
      }
    });

    it('stays unavailable when reopening the persisted layout would already hit the tab limit', async () => {
      (plugin.loadData as jest.Mock).mockResolvedValue({
        tabManagerState: {
          openTabs: [
            { tabId: 'tab-1', conversationId: null },
            { tabId: 'tab-2', conversationId: null },
            { tabId: 'tab-3', conversationId: null },
          ],
          activeTabId: 'tab-3',
        },
      });

      await plugin.onload();

      jest.spyOn(plugin, 'getView').mockReturnValue(null);

      const command = getRegisteredCommand('new-tab');

      expect(command.checkCallback(true)).toBe(false);
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation with unique ID', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();

      expect(conv.id).toMatch(/^conv-\d+-[a-z0-9]+$/);
      expect(conv.messages).toEqual([]);
      expect(conv.sessionId).toBeNull();
    });

    it('should allow retrieving created conversation by ID', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      const fetched = await plugin.getConversationById(conv.id);

      expect(fetched?.id).toBe(conv.id);
    });

    it('should store the selected model in conversation metadata', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation({ selectedModel: 'octo-agent/kimi-for-coding' });
      const fetched = await plugin.getConversationById(conv.id);

      expect(conv.selectedModel).toBe('octo-agent/kimi-for-coding');
      expect(fetched?.selectedModel).toBe('octo-agent/kimi-for-coding');
    });

    it('should preserve custom selected models that are not in picker options', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation({
        providerId: 'octo-agent',
        selectedModel: 'octo-agent/custom-model',
      });
      const fetched = await plugin.getConversationById(conv.id);

      expect(conv.selectedModel).toBe('octo-agent/custom-model');
      expect(fetched?.selectedModel).toBe('octo-agent/custom-model');
    });

    it('should lazily migrate missing selected model from usage metadata', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      delete (conv as { selectedModel?: string }).selectedModel;
      conv.usage = {
        model: 'octo-agent/custom-model',
        inputTokens: 1,
        contextTokens: 1,
        contextWindow: 200000,
        percentage: 1,
      };
      const saveMetadataSpy = jest.spyOn(plugin.storage.sessions, 'saveMetadata');
      saveMetadataSpy.mockClear();

      const fetched = await plugin.getConversationById(conv.id);

      expect(fetched?.selectedModel).toBe('octo-agent/custom-model');
      expect(saveMetadataSpy).toHaveBeenCalledWith(expect.objectContaining({
        selectedModel: 'octo-agent/custom-model',
      }));
    });

    it('should not permanently default legacy conversations with unknown model metadata', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      delete (conv as { selectedModel?: string }).selectedModel;
      const saveMetadataSpy = jest.spyOn(plugin.storage.sessions, 'saveMetadata');
      saveMetadataSpy.mockClear();

      const fetched = await plugin.getConversationById(conv.id);

      expect(fetched?.selectedModel).toBeUndefined();
      expect(saveMetadataSpy).not.toHaveBeenCalled();
    });

    it('should generate default title with timestamp', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();

      // Title should contain month and time
      expect(conv.title).toBeTruthy();
      expect(conv.title.length).toBeGreaterThan(0);
    });

    // Note: Session management is now per-tab via TabManager
  });

  describe('switchConversation', () => {
    it('should switch to existing conversation', async () => {
      await plugin.onload();

      const conv1 = await plugin.createConversation();
      await plugin.createConversation(); // Create second conversation to switch from

      const result = await plugin.switchConversation(conv1.id);

      expect(result?.id).toBe(conv1.id);
    });

    // Note: Session ID restoration is now handled per-tab via TabManager

    it('should return null for non-existent conversation', async () => {
      await plugin.onload();

      const result = await plugin.switchConversation('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation by ID', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      const convId = conv.id;

      // Create another so we have at least one left
      await plugin.createConversation();

      await plugin.deleteConversation(convId);

      const list = plugin.getConversationList();
      expect(list.find(c => c.id === convId)).toBeUndefined();
    });

    it('should allow deleting last conversation without recreating', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      await plugin.deleteConversation(conv.id);

      const list = plugin.getConversationList();
      expect(list.find(c => c.id === conv.id)).toBeUndefined();
    });
  });

  describe('renameConversation', () => {
    it('should rename conversation', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();

      await plugin.renameConversation(conv.id, 'New Title');

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.title).toBe('New Title');
    });

    it('should use default title if empty string provided', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();

      await plugin.renameConversation(conv.id, '   ');

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.title).toBeTruthy();
    });
  });

  describe('updateConversation', () => {
    it('should update conversation messages', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      const messages = [
        { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
      ];

      await plugin.updateConversation(conv.id, { messages });

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.messages).toEqual(messages);
    });

    it('should preserve image data when updating conversation messages', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      const messages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'See attached image',
          timestamp: Date.now(),
          images: [
            {
              id: 'img-1',
              name: 'pasted.png',
              mediaType: 'image/png' as const,
              data: 'YmFzZTY0',
              size: 10,
              source: 'paste' as const,
            },
          ],
        },
      ];

      await plugin.updateConversation(conv.id, { messages });

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.messages[0].images?.[0].data).toBe('YmFzZTY0');
    });

    it('should update conversation sessionId', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();

      await plugin.updateConversation(conv.id, { sessionId: 'new-session-id' });

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.sessionId).toBe('new-session-id');
    });

    it('should update updatedAt timestamp', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      const originalUpdatedAt = conv.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise(resolve => setTimeout(resolve, 10));

      await plugin.updateConversation(conv.id, { title: 'Changed' });

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });

  describe('getConversationList', () => {
    it('should return conversation metadata', async () => {
      await plugin.onload();

      await plugin.createConversation();

      const list = plugin.getConversationList();

      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('title');
      expect(list[0]).toHaveProperty('messageCount');
      expect(list[0]).toHaveProperty('preview');
    });

    it('should return preview from first user message', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation();
      await plugin.updateConversation(conv.id, {
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello Claude', timestamp: Date.now() },
        ],
      });

      const list = plugin.getConversationList();
      const meta = list.find(c => c.id === conv.id);

      expect(meta?.preview).toContain('Hello Claude');
    });
  });

  describe('loadSettings with conversations', () => {
    it('should load saved conversations from metadata files', async () => {
      const timestamp = Date.now();
      const sessionMeta = JSON.stringify({
        id: 'conv-saved-1',
        title: 'Saved Chat',
        createdAt: timestamp,
        updatedAt: timestamp,
        sessionId: 'saved-session',
      });

      // Mock files exist
      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        // Session files
        if (path === '.octo-agent/sessions' || path === '.octo-agent/sessions/conv-saved-1.meta.json') {
          return true;
        }
        // octo-settings.json exists
        if (path === '.octo-agent/settings.json') {
          return true;
        }
        return false;
      });
      mockApp.vault.adapter.list.mockImplementation(async (path: string) => {
        if (path === '.octo-agent/sessions') {
          return { files: ['.octo-agent/sessions/conv-saved-1.meta.json'], folders: [] };
        }
        return { files: [], folders: [] };
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.octo-agent/sessions/conv-saved-1.meta.json') {
          return sessionMeta;
        }
        if (path === '.octo-agent/settings.json') {
          return JSON.stringify({});
        }
        return '';
      });

      // data.json is minimal (no state - already migrated)
      (plugin.loadData as jest.Mock).mockResolvedValue({});

      await plugin.loadSettings();

      const loaded = await plugin.getConversationById('conv-saved-1');
      expect(loaded?.id).toBe('conv-saved-1');
      expect(loaded?.title).toBe('Saved Chat');
    });

    it('should keep server-resident session IDs across a plugin reload', async () => {
      const timestamp = Date.now();
      const sessionMeta = JSON.stringify({
        id: 'conv-saved-1',
        title: 'Saved Chat',
        createdAt: timestamp,
        updatedAt: timestamp,
        sessionId: 'saved-session',
      });

      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        return path === '.octo-agent/settings.json' ||
          path === '.octo-agent/sessions' ||
          path === '.octo-agent/sessions/conv-saved-1.meta.json';
      });
      mockApp.vault.adapter.list.mockImplementation(async (path: string) => {
        if (path === '.octo-agent/sessions') {
          return { files: ['.octo-agent/sessions/conv-saved-1.meta.json'], folders: [] };
        }
        return { files: [], folders: [] };
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.octo-agent/settings.json') {
          // Pre-0.2 top-level env bag: no longer read, and must not be erased.
          return JSON.stringify({
            environmentVariables: 'LEGACY_VAR=legacy-value',
          });
        }
        if (path === '.octo-agent/sessions/conv-saved-1.meta.json') {
          return sessionMeta;
        }
        return '';
      });

      // data.json is minimal (already migrated)
      (plugin.loadData as jest.Mock).mockResolvedValue({});

      await plugin.loadSettings();

      const loaded = await plugin.getConversationById('conv-saved-1');
      expect(loaded?.sessionId).toBe('saved-session');

      // The pre-0.2 bag is ignored, not migrated and not deleted.
      expect(plugin.getActiveEnvironmentVariables()).toBe('');
      expect((plugin.settings as Record<string, unknown>).environmentVariables)
        .toBe('LEGACY_VAR=legacy-value');
    });

    it('should ignore legacy activeConversationId when no sessions exist', async () => {
      // No sessions exist
      mockApp.vault.adapter.exists.mockResolvedValue(false);
      mockApp.vault.adapter.list.mockResolvedValue({ files: [], folders: [] });

      (plugin.loadData as jest.Mock).mockResolvedValue({
        activeConversationId: 'non-existent',
        migrationVersion: 2,
      });

      await plugin.loadSettings();

      expect(plugin.getConversationList()).toHaveLength(0);
    });
  });

});
