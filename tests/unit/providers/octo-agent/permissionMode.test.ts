import {
  isValidOctoPermissionMode,
  toOctoAgentPermissionMode,
  toOctoPermissionMode,
} from '@/providers/octo-agent/permissionMode';

describe('octo-agent permissionMode', () => {
  describe('toOctoAgentPermissionMode', () => {
    it('maps Octo yolo to octo-agent auto', () => {
      expect(toOctoAgentPermissionMode('yolo')).toBe('auto');
    });

    it('maps Octo normal to octo-agent interactive', () => {
      expect(toOctoAgentPermissionMode('normal')).toBe('interactive');
    });

    it('maps Octo plan to octo-agent plan', () => {
      expect(toOctoAgentPermissionMode('plan')).toBe('plan');
    });

    it('falls back to auto for unknown values', () => {
      expect(toOctoAgentPermissionMode('unknown')).toBe('auto');
      expect(toOctoAgentPermissionMode(undefined)).toBe('auto');
    });

    it('passes through server-native values', () => {
      expect(toOctoAgentPermissionMode('auto')).toBe('auto');
      expect(toOctoAgentPermissionMode('interactive')).toBe('interactive');
    });
  });

  describe('toOctoPermissionMode', () => {
    it('maps octo-agent auto to Octo yolo', () => {
      expect(toOctoPermissionMode('auto')).toBe('yolo');
    });

    it('maps octo-agent interactive to Octo normal', () => {
      expect(toOctoPermissionMode('interactive')).toBe('normal');
    });

    it('maps octo-agent plan to Octo plan', () => {
      expect(toOctoPermissionMode('plan')).toBe('plan');
    });

    it('falls back to yolo for unknown values', () => {
      expect(toOctoPermissionMode('unknown')).toBe('yolo');
      expect(toOctoPermissionMode(undefined)).toBe('yolo');
    });

    it('passes through UI-native values', () => {
      expect(toOctoPermissionMode('yolo')).toBe('yolo');
      expect(toOctoPermissionMode('normal')).toBe('normal');
    });
  });

  describe('isValidOctoPermissionMode', () => {
    it('accepts yolo, normal, and plan', () => {
      expect(isValidOctoPermissionMode('yolo')).toBe(true);
      expect(isValidOctoPermissionMode('normal')).toBe(true);
      expect(isValidOctoPermissionMode('plan')).toBe(true);
    });

    it('rejects octo-agent values and unknown strings', () => {
      expect(isValidOctoPermissionMode('auto')).toBe(false);
      expect(isValidOctoPermissionMode('interactive')).toBe(false);
      expect(isValidOctoPermissionMode('')).toBe(false);
      expect(isValidOctoPermissionMode('unknown')).toBe(false);
    });
  });
});
