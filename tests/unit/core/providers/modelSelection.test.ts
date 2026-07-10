import {
  decodeProviderModelSelectionId,
  encodeProviderModelSelectionId,
  getProviderModelSelectionPrefix,
  isProviderModelSelectionId,
  toProviderRuntimeModelId,
} from '@/core/providers/modelSelection';

describe('model selection namespacing', () => {
  describe('getProviderModelSelectionPrefix', () => {
    it('returns the registered prefix for octo-agent', () => {
      expect(getProviderModelSelectionPrefix('octo-agent')).toBe('octo-agent/');
    });

    it('returns null for a provider with no registered prefix', () => {
      expect(getProviderModelSelectionPrefix('unknown-provider')).toBeNull();
    });
  });

  describe('encodeProviderModelSelectionId', () => {
    it('prefixes a bare model id with the provider namespace', () => {
      expect(encodeProviderModelSelectionId('octo-agent', 'kimi-for-coding')).toBe('octo-agent/kimi-for-coding');
    });

    it('is idempotent: an already-namespaced id is returned unchanged', () => {
      const namespaced = 'octo-agent/kimi-for-coding';
      expect(encodeProviderModelSelectionId('octo-agent', namespaced)).toBe(namespaced);
    });

    it('trims surrounding whitespace before prefixing', () => {
      expect(encodeProviderModelSelectionId('octo-agent', '  kimi-for-coding  ')).toBe('octo-agent/kimi-for-coding');
    });

    it('returns an empty string for empty or whitespace-only input', () => {
      expect(encodeProviderModelSelectionId('octo-agent', '')).toBe('');
      expect(encodeProviderModelSelectionId('octo-agent', '   ')).toBe('');
    });

    // encode only guards against its OWN prefix, so a value that merely looks like
    // it carries a foreign namespace is treated as opaque and re-prefixed. This is
    // acceptable because callers only ever encode bare ids they own.
    it('re-prefixes a value that looks like it carries a foreign namespace', () => {
      expect(encodeProviderModelSelectionId('octo-agent', 'other-agent/gpt-5')).toBe('octo-agent/other-agent/gpt-5');
    });

    it('leaves the id untouched when the provider has no registered prefix', () => {
      expect(encodeProviderModelSelectionId('unknown-provider', 'kimi-for-coding')).toBe('kimi-for-coding');
    });
  });

  describe('decodeProviderModelSelectionId', () => {
    it('decodes a namespaced id into its provider and model id', () => {
      expect(decodeProviderModelSelectionId('octo-agent/kimi-for-coding')).toEqual({
        providerId: 'octo-agent',
        modelId: 'kimi-for-coding',
      });
    });

    it('returns null for empty or whitespace-only input', () => {
      expect(decodeProviderModelSelectionId('')).toBeNull();
      expect(decodeProviderModelSelectionId('   ')).toBeNull();
    });

    it('returns null for a non-namespaced model id', () => {
      expect(decodeProviderModelSelectionId('kimi-for-coding')).toBeNull();
      expect(decodeProviderModelSelectionId('my-model')).toBeNull();
    });

    it('returns null when only the prefix is present (no model id)', () => {
      expect(decodeProviderModelSelectionId('octo-agent/')).toBeNull();
      expect(decodeProviderModelSelectionId('octo-agent/   ')).toBeNull();
    });

    it('trims surrounding whitespace before decoding', () => {
      expect(decodeProviderModelSelectionId('  octo-agent/kimi-for-coding  ')).toEqual({
        providerId: 'octo-agent',
        modelId: 'kimi-for-coding',
      });
    });
  });

  describe('isProviderModelSelectionId', () => {
    it('is true for a value carrying the given provider namespace', () => {
      expect(isProviderModelSelectionId('octo-agent', 'octo-agent/kimi-for-coding')).toBe(true);
    });

    it('is false for a bare model id and for empty input', () => {
      expect(isProviderModelSelectionId('octo-agent', 'kimi-for-coding')).toBe(false);
      expect(isProviderModelSelectionId('octo-agent', '')).toBe(false);
    });

    it('is false for an unregistered provider id even with a matching-looking value', () => {
      expect(isProviderModelSelectionId('unknown-provider', 'octo-agent/kimi-for-coding')).toBe(false);
    });
  });

  describe('toProviderRuntimeModelId', () => {
    it('strips the namespace when the value belongs to the given provider', () => {
      expect(toProviderRuntimeModelId('octo-agent', 'octo-agent/kimi-for-coding')).toBe('kimi-for-coding');
    });

    it('leaves a bare model id unchanged', () => {
      expect(toProviderRuntimeModelId('octo-agent', 'kimi-for-coding')).toBe('kimi-for-coding');
    });

    // Never strip a namespace belonging to another provider id: handing it through
    // verbatim is what keeps a stray cross-provider id from being misrouted at the
    // runtime seam.
    it('leaves a value unchanged when it carries a different provider namespace', () => {
      expect(toProviderRuntimeModelId('unknown-provider', 'octo-agent/kimi-for-coding')).toBe('octo-agent/kimi-for-coding');
    });

    it('returns an empty string unchanged', () => {
      expect(toProviderRuntimeModelId('octo-agent', '')).toBe('');
    });
  });

  describe('encode/decode round-trip', () => {
    it('round-trips an octo-agent model id through encode and toRuntimeModelId', () => {
      const providerId = 'octo-agent';
      const prefix = 'octo-agent/';
      const modelId = 'kimi-for-coding';

      const encoded = encodeProviderModelSelectionId(providerId, modelId);
      expect(encoded).toBe(`${prefix}${modelId}`);
      // Stripping the runtime id must recover the original bare model id.
      expect(toProviderRuntimeModelId(providerId, encoded)).toBe(modelId);
      // Encoding is idempotent, so re-encoding never double-prefixes.
      expect(encodeProviderModelSelectionId(providerId, encoded)).toBe(encoded);
      // Decoding must attribute the id back to the owning provider.
      expect(decodeProviderModelSelectionId(encoded)).toEqual({ providerId, modelId });
    });
  });
});
