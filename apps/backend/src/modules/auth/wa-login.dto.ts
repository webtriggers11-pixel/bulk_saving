import { Matches } from 'class-validator';
import type { WaStartBody } from '@bulk/shared';

const INVITE_CODE = /^[A-Z0-9]{8}$/;

/** `POST /auth/wa/start` (FEAT-027). The invite code names the society; nothing else is accepted. */
export class WaStartDto implements WaStartBody {
  @Matches(INVITE_CODE, { message: 'inviteCode must be 8 uppercase alphanumeric characters.' })
  inviteCode!: string;
}

/**
 * `POST /auth/admin/wa/start` takes nothing. An explicit empty class, so the global
 * `whitelist` pipe strips whatever a caller sends rather than a bare `@Body()` ignoring it.
 */
export class AdminWaStartDto {}
