import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { RoundStatus } from '@bulk/shared';
import type { Job } from 'bullmq';
import {
  ROUND_CLOSING_QUEUE,
  type RoundClosingJobData,
} from './round-closing.scheduler';
import { RoundsService } from './rounds.service';

/** What the processor reports back — the resulting status, or null if it no-oped. */
export interface RoundCloserJobResult {
  status: RoundStatus | null;
}

/**
 * The deadline-driven closer (FEAT-004, ADR-0011). When a round's delayed job
 * fires, it delegates to {@link RoundsService.closeRound}, which — under the
 * ADR-0004 row lock, in a transaction — transitions an OPEN round to CLOSED_MET
 * or CLOSED_EXPIRED and no-ops idempotently if the round is already non-OPEN
 * (manually closed/cancelled first) or gone. It never mutates status itself; the
 * guarded transition in RoundsService is the only status-writing path.
 */
@Processor(ROUND_CLOSING_QUEUE)
export class RoundCloserProcessor extends WorkerHost {
  private readonly logger = new Logger(RoundCloserProcessor.name);

  constructor(private readonly rounds: RoundsService) {
    super();
  }

  async process(job: Job<RoundClosingJobData>): Promise<RoundCloserJobResult> {
    const { roundId } = job.data;
    const result = await this.rounds.closeRound(roundId);
    const status = result?.status ?? null;
    this.logger.log(`Round ${roundId} close job → ${status ?? 'no-op (round not found)'}`);
    return { status };
  }
}
