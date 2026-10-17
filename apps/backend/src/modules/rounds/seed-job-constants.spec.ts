import { SEED_JOBS } from '../../../prisma/seed-demo.constants';
import {
  ROUND_CLOSING_ATTEMPTS,
  ROUND_CLOSING_JOB,
  ROUND_CLOSING_QUEUE,
  ROUND_JOB_BACKOFF,
  ROUND_JOB_REMOVE_ON_FAIL,
} from './round-closing.scheduler';
import {
  REMINDER_LEAD_MS,
  ROUND_REMINDER_ATTEMPTS,
  ROUND_REMINDER_JOB,
  ROUND_REMINDER_QUEUE,
  reminderJobId,
} from './round-reminder.scheduler';

/**
 * CHORE-019: the demo seed replaces a demo round's close and reminder jobs itself, with
 * names and options it cannot import (it compiles outside src/). If they drift, a re-seed
 * leaves the OLD job in place beside a new one — duplicate reminders, or a round closing
 * at a stale deadline — with nothing failing. This is what fails instead.
 */
describe('the demo seed’s job constants match the schedulers', () => {
  it('close jobs: same queue, job name and attempts', () => {
    expect(SEED_JOBS.closing).toEqual({
      queue: ROUND_CLOSING_QUEUE,
      job: ROUND_CLOSING_JOB,
      attempts: ROUND_CLOSING_ATTEMPTS,
    });
  });

  it('reminder jobs: same queue, job name, attempts, lead time and job id', () => {
    expect(SEED_JOBS.reminder.queue).toBe(ROUND_REMINDER_QUEUE);
    expect(SEED_JOBS.reminder.job).toBe(ROUND_REMINDER_JOB);
    expect(SEED_JOBS.reminder.attempts).toBe(ROUND_REMINDER_ATTEMPTS);
    expect(SEED_JOBS.reminder.leadMs).toBe(REMINDER_LEAD_MS);
    expect(SEED_JOBS.reminder.jobId('r1')).toBe(reminderJobId('r1'));
  });

  it('retry backoff and failed-job retention', () => {
    expect(SEED_JOBS.backoff).toEqual(ROUND_JOB_BACKOFF);
    expect(SEED_JOBS.removeOnFail).toEqual(ROUND_JOB_REMOVE_ON_FAIL);
  });
});
