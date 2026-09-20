import { getDefaultHiddenProviderCommands } from '../../core/providers/commands/hiddenCommands';
import { type OctoSettings } from '../../core/types/settings';
import { getBuiltInProviderDefaultConfigs } from '../../providers/defaultProviderConfigs';

export const DEFAULT_OCTO_SETTINGS: OctoSettings = {
  permissionMode: 'yolo',

  model: 'octo-agent/kimi-for-coding',
  thinkingBudget: 'off',
  effortLevel: 'high',
  serviceTier: 'default',

  excludedTags: [],
  mediaFolder: '',
  persistentExternalContextPaths: [],

  envSnippets: [],
  customContextLimits: {},
  customModelAliases: {},

  keyboardNavigation: {
    scrollUpKey: 'w',
    scrollDownKey: 's',
    focusInputKey: 'i',
  },
  requireCommandOrControlEnterToSend: false,

  locale: 'en',

  providerConfigs: getBuiltInProviderDefaultConfigs(),

  lastCustomModel: '',

  maxTabs: 3,
  enableAutoScroll: true,
  deferMathRenderingDuringStreaming: true,
  expandFileEditsByDefault: false,
  chatViewPlacement: 'right-sidebar',

  hiddenProviderCommands: getDefaultHiddenProviderCommands(),
};
