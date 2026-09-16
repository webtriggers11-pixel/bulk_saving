# ADR-0008: Hand-rolled shadcn-style UI primitives (defer the shadcn CLI)

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** FEAT-001

## Confidence

**Level:** High
**Basis:** shadcn/ui is a copy-in component pattern, not a runtime dependency; the
hand-rolled primitives follow the same conventions and satisfy the intent. Surfaced
by the V2 review as a doc-drift correction.

## Research depth

**Depth:** Judgment call

## Context and problem

STACK.md and ARCHITECTURE.md name "Tailwind + shadcn/ui". During FEAT-001 the PWA
build revealed the CHORE-001 scaffold never actually ran the shadcn CLI / added its
peer libs (clsx, tailwind-merge, cva, Radix). Rather than add dependencies mid-feature
(which needs approval and wasn't required), the onboarding UI needed primitives now.

## Options considered

1. **Hand-rolled shadcn-style primitives** (chosen) — `Button`/`Input`/`Label`/`Card`
   in `apps/web/src/components/ui/` with a local `cn` helper, forwardRef + className
   passthrough + Tailwind. Zero new deps; same API/feel as shadcn.
2. **Run the shadcn CLI now** — adds clsx/tailwind-merge/cva/Radix deps mid-feature;
   deferred to avoid unapproved deps and scope creep.

## Decision

Use hand-rolled shadcn-style primitives for now. Docs corrected to say "Tailwind +
hand-rolled shadcn-style primitives (shadcn CLI may be adopted later)". Adopting the
shadcn CLI later is a clean swap (same component API) and would be its own CHORE + deps approval.

## Consequences

Good: no unapproved deps, honest docs, UI ships. Bad: primitives are minimal vs the
full shadcn catalog; a later migration re-generates them via the CLI.

## Revisit trigger

When the UI needs richer shadcn components (dialogs, selects, toasts, etc.), triage a
CHORE to adopt the shadcn CLI + its deps (with dependency approval).
