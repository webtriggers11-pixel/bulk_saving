import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { SocietiesService } from '../societies/societies.service';
import { ipBucket } from './otp.service';

/** Wrong invite codes one client may try per window before the check refuses (ADR-0052). */
export const INVITE_CHECK_FAIL_MAX = 20;
export const INVITE_CHECK_WINDOW_SECONDS = 60 * 60;

export type InviteCheckResult = 'VALID' | 'INVALID' | 'RATE_LIMITED';

/**
 * Reserve one guess from the client's budget, atomically: refuse at the cap, else INCR (TTL
 * on the first hit). Reserving BEFORE the lookup means parallel guesses cannot all slip past
 * the cap between a read and an increment (the ADR-0027 V2 lesson). Returns -1 when spent.
 *   KEYS[1] fail key · ARGV[1] max · ARGV[2] window s
 */
const RESERVE_LUA = `
if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[1]) then
  return -1
end
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return n`;

/** Give a reservation back (the code was right). Never resurrects an expired key without a TTL. */
const REFUND_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('DECR', KEYS[1])
end
return 1`;

/**
 * The invite step's pre-check (FEAT-045, ADR-0052). Only WRONG codes are counted, per client
 * IP bucket (ADR-0027), so a society's residents on one shared wifi are never blocked by
 * each other's correct codes. Once the budget is spent the check answers RATE_LIMITED
 * before looking the code up, so a correct guess cannot be found past the cap.
 */
@Injectable()
export class InviteCheckService {
  constructor(
    private readonly redis: RedisService,
    private readonly societies: SocietiesService,
  ) {}

  static failKey(clientIp: string | undefined): string {
    return `invite-check:fail:${ipBucket(clientIp)}`;
  }

  async check(inviteCode: string, clientIp: string | undefined): Promise<InviteCheckResult> {
    const key = InviteCheckService.failKey(clientIp);
    const reserved = (await this.redis.eval(
      RESERVE_LUA,
      1,
      key,
      String(INVITE_CHECK_FAIL_MAX),
      String(INVITE_CHECK_WINDOW_SECONDS),
    )) as number;
    if (reserved < 0) {
      return 'RATE_LIMITED';
    }
    // An inactive society's code admits nobody, so it is "invalid" here too (ADR-0045 §4).
    if (await this.societies.findByInviteCode(inviteCode)) {
      await this.redis.eval(REFUND_LUA, 1, key);
      return 'VALID';
    }
    return 'INVALID';
  }
}
