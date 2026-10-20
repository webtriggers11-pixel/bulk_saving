import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { ErrorCode } from '../../common/error-codes';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Developer routes answer this machine only (FEAT-026 V2 P3; shared by FEAT-027's simulator).
 * The SOCKET address, not `req.ip` — the latter honours proxy headers under TRUST_PROXY and
 * could be told it is loopback.
 */
export function assertLoopback(req: Pick<Request, 'socket'>): void {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) {
    throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'Developer routes answer the local machine only.' });
  }
}
