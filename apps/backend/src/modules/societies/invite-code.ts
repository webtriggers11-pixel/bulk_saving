import { randomInt } from 'node:crypto';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '@bulk/shared';

/**
 * A fresh society invite code (FEAT-032, ADR-0043): 8 characters drawn with a CSPRNG from an
 * alphabet without look-alikes, so a code read off a poster or over the phone is not misread.
 * Uniqueness is the database's job (`Society.inviteCode @unique`); callers retry on a clash.
 */
export function generateInviteCode(random: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[random(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
