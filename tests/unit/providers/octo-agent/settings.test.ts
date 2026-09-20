import {
  getOctoAgentProviderSettings,
  parseOctoServerPort,
  updateOctoAgentProviderSettings,
} from '@/providers/octo-agent/settings';

describe('getOctoAgentProviderSettings', () => {
  it('returns defaults when no provider config exists', () => {
    const settings = getOctoAgentProviderSettings({});

    expect(settings.host).toBe('127.0.0.1');
    expect(settings.port).toBe(8088);
    expect(settings.autoStartServer).toBe(true);
    expect(settings.cliPath).toBe('octo');
    expect(settings.accessKey).toBe('');
  });

  it('reads values from the octo-agent provider config', () => {
    const settings = getOctoAgentProviderSettings({
      providerConfigs: {
        'octo-agent': {
          accessKey: 'octo_secret',
          autoStartServer: false,
          cliPath: '/opt/homebrew/bin/octo',
          host: '0.0.0.0',
          port: 9999,
        },
      },
    });

    expect(settings.host).toBe('0.0.0.0');
    expect(settings.port).toBe(9999);
    expect(settings.autoStartServer).toBe(false);
    expect(settings.cliPath).toBe('/opt/homebrew/bin/octo');
    expect(settings.accessKey).toBe('octo_secret');
  });
});

describe('updateOctoAgentProviderSettings', () => {
  it('writes into the octo-agent provider config bag', () => {
    const settings: Record<string, unknown> = {};

    updateOctoAgentProviderSettings(settings, { host: '0.0.0.0', port: 9999 });

    expect(getOctoAgentProviderSettings(settings).host).toBe('0.0.0.0');
    expect(getOctoAgentProviderSettings(settings).port).toBe(9999);
  });

  it('merges partial updates without dropping untouched fields', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        'octo-agent': { accessKey: 'octo_secret', host: '0.0.0.0' },
      },
    };

    updateOctoAgentProviderSettings(settings, { port: 9999 });

    const next = getOctoAgentProviderSettings(settings);
    expect(next.port).toBe(9999);
    expect(next.accessKey).toBe('octo_secret');
    expect(next.host).toBe('0.0.0.0');
  });

  it('preserves environment variables stored alongside the connection fields', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        'octo-agent': { environmentVariables: 'OCTO_MODEL=custom' },
      },
    };

    updateOctoAgentProviderSettings(settings, { cliPath: '/opt/homebrew/bin/octo' });

    expect(settings.providerConfigs).toEqual({
      'octo-agent': expect.objectContaining({
        cliPath: '/opt/homebrew/bin/octo',
        environmentVariables: 'OCTO_MODEL=custom',
      }),
    });
  });

  it('returns the merged settings to the caller', () => {
    const result = updateOctoAgentProviderSettings({}, { autoStartServer: false });

    expect(result.autoStartServer).toBe(false);
    expect(result.host).toBe('127.0.0.1');
  });
});

describe('parseOctoServerPort', () => {
  it('accepts a valid port', () => {
    expect(parseOctoServerPort('9999')).toBe(9999);
    expect(parseOctoServerPort('  8088  ')).toBe(8088);
  });

  it('clamps out-of-range ports into the TCP range', () => {
    expect(parseOctoServerPort('70000')).toBe(65535);
    expect(parseOctoServerPort('0')).toBe(1);
    expect(parseOctoServerPort('-1')).toBe(1);
  });

  it('falls back to the default when the input is not a number', () => {
    expect(parseOctoServerPort('')).toBe(8088);
    expect(parseOctoServerPort('abc')).toBe(8088);
  });

  it('takes the leading digits of a partially numeric entry', () => {
    // Number.parseInt semantics, kept deliberately: typing "80abc" lands on 80
    // rather than silently resetting the field to the default.
    expect(parseOctoServerPort('80abc')).toBe(80);
  });
});

describe('getOctoAgentProviderSettings port validation', () => {
  it.each([0, 70000, -1, 8088.5])('rejects a stored port of %p', (port) => {
    const settings = getOctoAgentProviderSettings({
      providerConfigs: { 'octo-agent': { port } },
    });

    expect(settings.port).toBe(8088);
  });

  it('keeps a valid stored port', () => {
    const settings = getOctoAgentProviderSettings({
      providerConfigs: { 'octo-agent': { port: 9999 } },
    });

    expect(settings.port).toBe(9999);
  });
});
