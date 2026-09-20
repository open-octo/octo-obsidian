import '@/providers';

import {
  getProviderEnvironmentVariables,
  setProviderEnvironmentVariables,
} from '@/core/providers/providerEnvironment';

describe('providerEnvironment', () => {
  it('reads provider env from the provider config bag', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        'octo-agent': { environmentVariables: 'OCTO_MODEL=custom-model' },
      },
    };

    expect(getProviderEnvironmentVariables(settings, 'octo-agent')).toBe('OCTO_MODEL=custom-model');
  });

  it('returns an empty string when the provider has no env configured', () => {
    expect(getProviderEnvironmentVariables({}, 'octo-agent')).toBe('');
  });

  it('ignores the pre-0.2 top-level env bag', () => {
    const settings: Record<string, unknown> = {
      environmentVariables: ['PATH=/usr/local/bin', 'OCTO_MODEL=octo-custom'].join('\n'),
    };

    expect(getProviderEnvironmentVariables(settings, 'octo-agent')).toBe('');
  });

  it('leaves the pre-0.2 bag on disk rather than erasing it', () => {
    // Dropped fields stay readable by hand in settings.json. Ignoring a value
    // is reversible for the user; deleting it is not.
    const settings: Record<string, unknown> = { environmentVariables: 'OCTO_MODEL=legacy' };

    setProviderEnvironmentVariables(settings, 'octo-agent', 'OCTO_API_KEY=test-key');

    expect(settings.providerConfigs).toEqual({
      'octo-agent': { environmentVariables: 'OCTO_API_KEY=test-key' },
    });
    expect(settings.environmentVariables).toBe('OCTO_MODEL=legacy');
  });

  it('preserves other provider config fields when writing env', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: { 'octo-agent': { host: '0.0.0.0', port: 9999 } },
    };

    setProviderEnvironmentVariables(settings, 'octo-agent', 'OCTO_MODEL=custom');

    expect(settings.providerConfigs).toEqual({
      'octo-agent': { host: '0.0.0.0', port: 9999, environmentVariables: 'OCTO_MODEL=custom' },
    });
  });
});
