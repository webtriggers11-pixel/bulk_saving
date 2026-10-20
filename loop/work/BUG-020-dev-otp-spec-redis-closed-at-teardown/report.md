# BUG-020 — `test/dev-otp.integration.spec.ts` fails 1 run in N with an unhandled "Connection is closed" from a BullMQ worker at teardown

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-10-20 · **Found by:** FEAT-028 V3 (run 2 of 2)

## Symptom

In a full `bash scripts/verify.sh` run (detached worktree at 9cbbf66, 13:09–13:10), the backend suite
reported 555/556: every case in `GET /dev/otp (integration, needs Redis)` failed with

```
Unhandled error. (Error: Connection is closed.
  at close (ioredis/built/redis/event_handler.js:214:25) …
  at Worker.emit (bullmq/dist/cjs/classes/queue-base.js:91:26)
  at bullmq/dist/cjs/classes/redis-connection.js:87:45
```

The run immediately before (13:08–13:09) and the V2 reviewer's run (13:00–13:01) passed 556/556 on
the same commit. Nothing in `apps/backend` changed between the runs.

## Reading

A BullMQ `Worker` (the notifications/OTP queue) emits an error after its ioredis connection was
closed by the test app's teardown; with no `error` listener left on the worker, Node turns it into
an unhandled error that Jest attributes to the running case. Same family as BUG-006 / BUG-013
(shared Redis between test apps) and BUG-018 (a teardown race). Another session's gate was active
in the same minutes (its V2 fixes landed at 1afe10a), so a second process sharing Redis is the
likely trigger — but the spec should survive that: close the worker (`await worker.close()`)
before the connection, or attach an `error` listener that swallows "Connection is closed" during
teardown.

## Reproduce

Run the gate twice back-to-back while another gate shares Redis (`bull-test`), or loop
`pnpm --filter backend test -- dev-otp` ~10 times with a second process holding the queue.

## Not caused by

`apps/site` (FEAT-028) — the site touches no backend file; its suites were 34/34 in both runs.
