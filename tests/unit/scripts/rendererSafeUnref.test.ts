import * as rendererSafeUnrefHelpers from '../../../scripts/rendererSafeUnref.js';

const {
  findUnsafeTimerUnrefSites,
  patchRendererUnsafeUnrefSites,
} = rendererSafeUnrefHelpers;

describe('rendererSafeUnref helpers', () => {
  it('patches the known unsafe mcp-sdk stdio close-wait timer site', () => {
    const input = 'await Promise.race([closePromise, new Promise((resolve5) => setTimeout(resolve5, 2e3).unref())]);';

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'mcp-sdk-stdio-close-wait', count: 1 },
    ]);
    expect(result.contents).toContain('closeTimeout.unref?.();');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('reports remaining direct timer .unref() calls but ignores guarded usage', () => {
    const input = [
      'const timer = setTimeout(run, 1000);',
      'timer.unref?.();',
      'if (timer.unref) timer.unref();',
      'setTimeout(run, 1000).unref();',
      'setInterval(run, 1000).unref();',
    ].join('\n');

    expect(findUnsafeTimerUnrefSites(input)).toEqual([
      { line: 4, snippet: 'setTimeout(run, 1000).unref()' },
      { line: 5, snippet: 'setInterval(run, 1000).unref()' },
    ]);
  });
});
