import { getBuiltInProviderDefaultConfigs } from '@/providers/defaultProviderConfigs';

describe('getBuiltInProviderDefaultConfigs', () => {
  it('returns fresh built-in provider config objects', () => {
    const first = getBuiltInProviderDefaultConfigs();
    const second = getBuiltInProviderDefaultConfigs();

    expect(first).toHaveProperty('octo-agent');
    expect(first).not.toBe(second);
    expect(first['octo-agent']).not.toBe(second['octo-agent']);
  });
});
