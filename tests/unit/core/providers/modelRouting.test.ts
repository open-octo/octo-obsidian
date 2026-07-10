import '@/providers';

import { getEnabledProviderForModel, getProviderForModel } from '@/core/providers/modelRouting';

describe('getProviderForModel', () => {
  it('routes octo-agent model ids to octo-agent', () => {
    expect(getProviderForModel('octo-agent')).toBe('octo-agent');
    expect(getProviderForModel('octo-agent/kimi-for-coding')).toBe('octo-agent');
  });

  it('routes provider-qualified custom octo-agent model ids to octo-agent', () => {
    expect(getProviderForModel('octo-agent/some-custom-model')).toBe('octo-agent');
  });

  it('routes unknown models to octo-agent, the sole registered provider', () => {
    expect(getProviderForModel('some-unknown-model')).toBe('octo-agent');
    expect(getProviderForModel('')).toBe('octo-agent');
  });
});

describe('getEnabledProviderForModel', () => {
  it('resolves octo-agent when it is enabled', () => {
    const settings = {
      providerConfigs: {
        'octo-agent': { enabled: true },
      },
    };

    expect(getEnabledProviderForModel('octo-agent/kimi-for-coding', settings)).toBe('octo-agent');
  });
});
