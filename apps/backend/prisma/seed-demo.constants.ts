/**
 * The BullMQ names and options the demo seed uses to replace a demo round's close and
 * reminder jobs. They MUST equal the ones in src/modules/rounds/round-*.scheduler.ts —
 * this file compiles outside src/ (the seed's own tsconfig), so it cannot import them.
 * `src/modules/rounds/seed-job-constants.spec.ts` imports both and fails on any drift
 * (CHORE-019): a renamed reminder id would otherwise leave every re-seed with duplicate
 * reminders, silently.
 */
export const SEED_JOBS = {
  closing: { queue: 'round-closing', job: 'close-round', attempts: 6 },
  reminder: {
    queue: 'round-reminder',
    job: 'remind-round',
    attempts: 3,
    leadMs: 24 * 60 * 60 * 1000,
    jobId: (roundId: string): string => `reminder-${roundId}`,
  },
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnFail: { age: 24 * 60 * 60 },
} as const;
