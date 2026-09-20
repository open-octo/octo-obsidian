import { Setting } from 'obsidian';

import type ClaudianPlugin from '../../../main';
import { EnvSnippetManager } from './EnvSnippetManager';

interface EnvironmentSettingsSectionOptions {
  container: HTMLElement;
  plugin: ClaudianPlugin;
  heading?: string;
  name: string;
  desc: string;
  placeholder: string;
  renderCustomContextLimits?: (container: HTMLElement) => void;
}

export function renderEnvironmentSettingsSection(
  options: EnvironmentSettingsSectionOptions,
): void {
  const {
    container,
    plugin,
    heading,
    name,
    desc,
    placeholder,
    renderCustomContextLimits,
  } = options;

  if (heading) {
    new Setting(container).setName(heading).setHeading();
  }

  new Setting(container)
    .setName(name)
    .setDesc(desc)
    .addTextArea((text) => {
      text
        .setPlaceholder(placeholder)
        .setValue(plugin.getActiveEnvironmentVariables());
      text.inputEl.rows = 6;
      text.inputEl.cols = 50;
      text.inputEl.addClass('claudian-settings-env-textarea');
      text.inputEl.addEventListener('blur', () => {
        void (async (): Promise<void> => {
          await plugin.applyEnvironmentVariables(text.inputEl.value);
          renderCustomContextLimits?.(contextLimitsContainer);
        })();
      });
    });

  const contextLimitsContainer = container.createDiv({ cls: 'claudian-context-limits-container' });
  renderCustomContextLimits?.(contextLimitsContainer);

  const envSnippetsContainer = container.createDiv({ cls: 'claudian-env-snippets-container' });
  new EnvSnippetManager(envSnippetsContainer, plugin, () => {
    renderCustomContextLimits?.(contextLimitsContainer);
  });
}
