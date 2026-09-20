import { createMockEl } from '@test/helpers/mockElement';

import { updateContextRowHasContent } from '@/features/chat/controllers/contextRowVisibility';

function createContextRow(browserIndicator: HTMLElement | null): HTMLElement {
  const editorIndicator = createMockEl();
  editorIndicator.addClass('octo-selection-indicator octo-hidden');
  const canvasIndicator = createMockEl();
  canvasIndicator.addClass('octo-canvas-indicator octo-hidden');
  const fileIndicator = createMockEl();
  fileIndicator.addClass('octo-file-indicator octo-hidden');
  const imagePreview = createMockEl();
  imagePreview.addClass('octo-image-preview octo-hidden');
  const lookup = new Map<string, unknown>([
    ['.octo-selection-indicator', editorIndicator],
    ['.octo-browser-selection-indicator', browserIndicator],
    ['.octo-canvas-indicator', canvasIndicator],
    ['.octo-file-indicator', fileIndicator],
    ['.octo-image-preview', imagePreview],
  ]);

  const contextRow = createMockEl();
  const toggle = contextRow.classList.toggle;
  contextRow.classList.toggle = jest.fn((cls: string, force?: boolean) => toggle(cls, force));
  contextRow.querySelector = jest.fn((selector: string) => lookup.get(selector) ?? null);
  return contextRow as unknown as HTMLElement;
}

describe('updateContextRowHasContent', () => {
  it('does not treat missing browser indicator as visible content', () => {
    const contextRowEl = createContextRow(null);

    expect(() => updateContextRowHasContent(contextRowEl)).not.toThrow();
    expect((contextRowEl.classList.toggle as jest.Mock)).toHaveBeenCalledWith('has-content', false);
  });

  it('treats browser indicator as visible only when it is not hidden', () => {
    const browserIndicator = createMockEl();
    browserIndicator.addClass('octo-browser-selection-indicator');
    const contextRowEl = createContextRow(browserIndicator);

    updateContextRowHasContent(contextRowEl);

    expect((contextRowEl.classList.toggle as jest.Mock)).toHaveBeenCalledWith('has-content', true);
  });
});
