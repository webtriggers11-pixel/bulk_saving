import { INVITE_CODE_ALPHABET } from '@bulk/shared';
import { generateInviteCode } from './invite-code';

describe('generateInviteCode (FEAT-032, ADR-0043)', () => {
  it('is 8 characters from the look-alike-free alphabet, and fits the existing invite shape', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      for (const ch of code) expect(INVITE_CODE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[O0I1L]/);
    }
  });

  it('draws every position from the random source it is given', () => {
    expect(generateInviteCode(() => 0)).toBe('AAAAAAAA');
    expect(generateInviteCode((max) => max - 1)).toBe('99999999');
  });

  it('two codes in a row differ (a CSPRNG, not a constant)', () => {
    expect(new Set(Array.from({ length: 50 }, () => generateInviteCode())).size).toBe(50);
  });
});
