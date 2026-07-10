
import { DEFAULT_CLAUDIAN_SETTINGS as DEFAULT_SETTINGS } from '@/app/settings/defaultSettings';
import { VIEW_TYPE_CLAUDIAN } from '@/core/types';

// Mock fs for ClaudianService
jest.mock('fs');

// Now import the plugin after mocking
import ClaudianPlugin from '@/main';

describe('ClaudianPlugin', () => {
  let plugin: ClaudianPlugin;
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
      id: 'claudian',
      name: 'Claudian',
      version: '0.1.0',
    };

    // Create plugin instance with mocked app
    plugin = new ClaudianPlugin(mockApp, mockManifest);
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
        VIEW_TYPE_CLAUDIAN,
        expect.any(Function)
      );
    });

    it('should add ribbon icon', async () => {
      await plugin.onload();

      expect((plugin.addRibbonIcon as jest.Mock)).toHaveBeenCalledWith(
        'bot',
        'Open Claudian',
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
    // Note: With multi-tab, cleanup is handled per-tab via ClaudianView.onClose()
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
        type: VIEW_TYPE_CLAUDIAN,
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
        type: VIEW_TYPE_CLAUDIAN,
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
        type: VIEW_TYPE_CLAUDIAN,
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
      // Mock claudian-settings.json exists with custom values (Claudian-specific settings)
      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        return path === '.claudian/claudian-settings.json';
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.claudian/claudian-settings.json') {
          return JSON.stringify({
            userName: 'TestUser',
          });
        }
        return '';
      });

      await plugin.loadSettings();

      expect(plugin.settings.userName).toBe('TestUser');
      expect(plugin.settings.hiddenProviderCommands).toEqual(DEFAULT_SETTINGS.hiddenProviderCommands);
    });

    it('should strip legacy blocklist fields when loading old settings', async () => {
      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        return path === '.claudian/claudian-settings.json';
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.claudian/claudian-settings.json') {
          return JSON.stringify({
            enableBlocklist: false,
            blockedCommands: { unix: ['rm -rf', '  '] },
          });
        }
        return '';
      });

      await plugin.loadSettings();

      expect('enableBlocklist' in plugin.settings).toBe(false);
      expect('blockedCommands' in plugin.settings).toBe(false);
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '.claudian/claudian-settings.json',
        expect.any(String),
      );
      const writeCall = (mockApp.vault.adapter.write as jest.Mock).mock.calls.find(
        ([path]) => path === '.claudian/claudian-settings.json',
      );
      expect(writeCall).toBeDefined();
      const content = JSON.parse(writeCall[1]);
      expect(content).not.toHaveProperty('enableBlocklist');
      expect(content).not.toHaveProperty('blockedCommands');
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

    it('should migrate legacy openInMainTab true to main-tab placement', async () => {
      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        return path === '.claudian/claudian-settings.json';
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.claudian/claudian-settings.json') {
          return JSON.stringify({ openInMainTab: true });
        }
        return '';
      });

      await plugin.loadSettings();

      expect(plugin.settings.chatViewPlacement).toBe('main-tab');
      const writeCall = (mockApp.vault.adapter.write as jest.Mock).mock.calls.find(
        ([path]) => path === '.claudian/claudian-settings.json',
      );
      expect(writeCall).toBeDefined();
      const content = JSON.parse(writeCall[1]);
      expect(content.chatViewPlacement).toBe('main-tab');
      expect(content).not.toHaveProperty('openInMainTab');
    });
  });

  describe('saveSettings', () => {
    it('should save settings to file', async () => {
      await plugin.onload();

      await plugin.saveSettings();

      // Claudian-specific settings should be written to .claudian/claudian-settings.json
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '.claudian/claudian-settings.json',
        expect.any(String)
      );

      // The written content should include state fields
      const writeCall = (mockApp.vault.adapter.write as jest.Mock).mock.calls.find(
        ([path]) => path === '.claudian/claudian-settings.json'
      );
      expect(writeCall).toBeDefined();
      const content = JSON.parse(writeCall[1]);
      expect(content).not.toHaveProperty('activeConversationId');
      expect(content).toHaveProperty(['providerConfigs', 'octo-agent', 'cliPath']);
      expect(content).toHaveProperty(['providerConfigs', 'octo-agent', 'enabled']);
      expect(content).toHaveProperty('lastCustomModel');
      expect(content).not.toHaveProperty('enableBlocklist');
      expect(content).not.toHaveProperty('blockedCommands');
      // Permissions are now in .claude/settings.json (CC format), not claudian-settings.json
      expect(content).not.toHaveProperty('permissions');
    });
  });

  describe('applyEnvironmentVariables', () => {
    it('updates runtime env vars when changed', async () => {
      await plugin.onload();

      await plugin.applyEnvironmentVariables('shared', 'A=2');
      expect(plugin.getEnvironmentVariablesForScope('shared')).toBe('A=2');

      await plugin.applyEnvironmentVariables('shared', 'A=3');
      expect(plugin.getEnvironmentVariablesForScope('shared')).toBe('A=3');

      // No change - should not update
      const currentEnv = plugin.getEnvironmentVariablesForScope('shared');
      await plugin.applyEnvironmentVariables('shared', 'A=3');
      expect(plugin.getEnvironmentVariablesForScope('shared')).toBe(currentEnv);
    });

    it('invalidates sessions when env hash changes', async () => {
      await plugin.onload();

      const conv = await plugin.createConversation({ providerId: 'octo-agent', sessionId: 'session-123' });
      const saveMetadataSpy = jest.spyOn(plugin.storage.sessions, 'saveMetadata');
      saveMetadataSpy.mockClear();

      await plugin.applyEnvironmentVariables('provider:octo-agent', 'SOME_VAR=changed');

      const updated = await plugin.getConversationById(conv.id);
      expect(updated?.sessionId).toBeNull();
      expect(saveMetadataSpy).toHaveBeenCalled();
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
      await plugin.applyEnvironmentVariables('shared', 'SOME_VAR=value');

      expect(mockSyncConversationState).toHaveBeenCalledWith(null, []);
      expect(mockEnsureReady).toHaveBeenCalledWith({ force: true });
    });

    it('syncs live external contexts before restarting invalidated runtimes', async () => {
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

      await plugin.applyEnvironmentVariables('provider:octo-agent', 'SOME_VAR=changed');

      expect(mockSyncConversationState).toHaveBeenCalledWith(
        expect.objectContaining({ id: conversation.id }),
        ['/live/context'],
      );
      expect(mockResetSession).toHaveBeenCalledTimes(1);
      expect(mockEnsureReady).toHaveBeenCalledWith();
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

    it('keeps tab commands unavailable while a Claudian leaf view is not initialized', async () => {
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
        if (path === '.claudian/sessions' || path === '.claudian/sessions/conv-saved-1.meta.json') {
          return true;
        }
        // claudian-settings.json exists
        if (path === '.claudian/claudian-settings.json') {
          return true;
        }
        return false;
      });
      mockApp.vault.adapter.list.mockImplementation(async (path: string) => {
        if (path === '.claudian/sessions') {
          return { files: ['.claudian/sessions/conv-saved-1.meta.json'], folders: [] };
        }
        return { files: [], folders: [] };
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.claudian/sessions/conv-saved-1.meta.json') {
          return sessionMeta;
        }
        if (path === '.claudian/claudian-settings.json') {
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

    it('should clear session IDs when provider base URL changes', async () => {
      const timestamp = Date.now();
      const sessionMeta = JSON.stringify({
        id: 'conv-saved-1',
        title: 'Saved Chat',
        createdAt: timestamp,
        updatedAt: timestamp,
        sessionId: 'saved-session',
      });

      mockApp.vault.adapter.exists.mockImplementation(async (path: string) => {
        return path === '.claudian/claudian-settings.json' ||
          path === '.claudian/sessions' ||
          path === '.claudian/sessions/conv-saved-1.meta.json';
      });
      mockApp.vault.adapter.list.mockImplementation(async (path: string) => {
        if (path === '.claudian/sessions') {
          return { files: ['.claudian/sessions/conv-saved-1.meta.json'], folders: [] };
        }
        return { files: [], folders: [] };
      });
      mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
        if (path === '.claudian/claudian-settings.json') {
          // All these fields are now in claudian-settings.json
          return JSON.stringify({
            lastEnvHash: 'old-hash',
            environmentVariables: 'ANTHROPIC_BASE_URL=https://api.example.com',
          });
        }
        if (path === '.claudian/sessions/conv-saved-1.meta.json') {
          return sessionMeta;
        }
        return '';
      });

      // data.json is minimal (already migrated)
      (plugin.loadData as jest.Mock).mockResolvedValue({});

      await plugin.loadSettings();

      const loaded = await plugin.getConversationById('conv-saved-1');
      expect(loaded?.sessionId).toBeNull();

      const sessionWrite = (mockApp.vault.adapter.write as jest.Mock).mock.calls.find(
        ([path]) => path === '.claudian/sessions/conv-saved-1.meta.json'
      );
      expect(sessionWrite).toBeDefined();
      const meta = JSON.parse(sessionWrite?.[1] as string);
      expect(meta.sessionId).toBeNull();
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
