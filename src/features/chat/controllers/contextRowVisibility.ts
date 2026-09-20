export function updateContextRowHasContent(contextRowEl: HTMLElement): void {
  const editorIndicator = contextRowEl.querySelector('.octo-selection-indicator');
  const browserIndicator = contextRowEl.querySelector('.octo-browser-selection-indicator');
  const canvasIndicator = contextRowEl.querySelector('.octo-canvas-indicator');
  const fileIndicator = contextRowEl.querySelector('.octo-file-indicator');
  const imagePreview = contextRowEl.querySelector('.octo-image-preview');

  const hasEditorSelection = !!editorIndicator && !editorIndicator.hasClass('octo-hidden');
  const hasBrowserSelection = !!browserIndicator && !browserIndicator.hasClass('octo-hidden');
  const hasCanvasSelection = !!canvasIndicator && !canvasIndicator.hasClass('octo-hidden');
  const hasFileChips = !!fileIndicator && fileIndicator.hasClass('octo-visible-flex');
  const hasImageChips = !!imagePreview && imagePreview.hasClass('octo-visible-flex');

  contextRowEl.classList.toggle(
    'has-content',
    hasEditorSelection || hasBrowserSelection || hasCanvasSelection || hasFileChips || hasImageChips
  );
}
