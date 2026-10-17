# CHORE-017 — spec

The problem statement and the three things a queued OTP changes are in `report.md`.
Decision and acceptance live in **ADR-0027**. Acceptance, as built:

- The admin door's request enqueues a sealed code for EVERY caller and never looks the
  caller up; the worker decides whether to send.
- The provider is never on the request path, in any phase; provider failures are retried
  by BullMQ with the code redacted; jobs are removed on completion and on final failure;
  the worker returns nothing for the events stream to keep.
- The resident door keeps its awaited send.
- The test suite's queues are namespaced (`BULLMQ_PREFIX=bull-test`) away from a dev server.
