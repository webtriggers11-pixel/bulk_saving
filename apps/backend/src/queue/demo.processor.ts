import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

export const DEMO_QUEUE = 'demo';

export interface DemoJobData {
  message: string;
}

export interface DemoJobResult {
  ok: true;
  echoed: string;
}

/**
 * Trivial BullMQ processor — proves enqueue -> consume against real Redis.
 * No domain logic here; the round closer processor arrives with the rounds feature.
 */
@Processor(DEMO_QUEUE)
export class DemoProcessor extends WorkerHost {
  private readonly logger = new Logger(DemoProcessor.name);

  async process(job: Job<DemoJobData>): Promise<DemoJobResult> {
    this.logger.log(`Processed demo job ${job.id ?? '(no id)'}: ${job.data.message}`);
    return { ok: true, echoed: job.data.message };
  }
}
