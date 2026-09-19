# CHORE-017 — the OTP send still runs in the request process

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-09-19 · **Found by:** V2 rounds 2–4 of FEAT-012

## What

Three rounds of review closed three mechanisms by which the admin door's SMS dispatch
leaked *who is an administrator*: the rate limiter it skipped, the stored state it
differed in, the response time it occupied, and the exception it threw. Each fix was
correct. None addressed the root cause, which the reviewer stated plainly at the end of
round 4:

> the send still executes in the process that serves requests, so the only complete
> answer is the notification queue.

What remains after the current fix is real but small: the deferred send occupies the
shared event loop, so an adapter's synchronous prefix delays other requests. A reviewer
could not turn that into a usable signal in-process, and it is bounded by that prefix
(~0.1–1ms for a typical HTTP client). Detaching also bought two operational costs — a
send in flight is lost on shutdown, and resend ordering widened — both recorded in
ADR-0023.

## The change

Stage the OTP the way ADR-0013 already stages lifecycle notifications: a durable row plus
a BullMQ job, dispatched by a worker. The admin endpoint would then do no provider work
at all, in any phase.

## Why it needs a decision, not just an implementation

ADR-0007 made the OTP send synchronous **on purpose**: an OTP is not a lifecycle message.
Queueing it changes three things that were deliberate.

1. **The outbox persists what it queues**, and ADR-0013's own comment says the login OTP
   is never persisted because "an OTP row would be a stored credential". A queued OTP
   needs either a row that holds a hashed code and a payload that does not, or a
   queue-only path with no durable record — which is not what the outbox is.
2. **Latency becomes worker latency.** A code that arrives ten seconds late against a
   5-minute TTL and a 30s resend floor is a support problem, not a bug anyone can see.
3. **Failure becomes invisible to the caller** — which is already true on the admin door
   by design, but NOT on the resident door, where an awaited send is currently what makes
   a provider outage visible at all.

The resident door may well keep its synchronous send: its latency varies only with
invite-code validity, which its 400-vs-200 already discloses outright, so it has nothing
to leak. That asymmetry is the decision to make.
