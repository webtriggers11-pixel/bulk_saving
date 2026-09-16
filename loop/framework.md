# Loop Engineering Framework

**Version:** 1.1.2 · **Date:** 2026-07-09 · **Owner:** Vivek (Sorigin)

The framework is everything OUTSIDE `apps/`: process contracts, skills, agents,
hooks, and the `loop/` state directory. Application code never lives in the
framework; framework state never lives in `apps/`.

## Layout contract (invariant across all projects)

| Path | Role | Written by |
|------|------|-----------|
| `CLAUDE.md` / `AGENTS.md` | agent operating manual (root — tools require it) | bootstrap (stack section only) |
| `USER-GUIDE.md` | canonical human manual: states, prompts, /goal, token budget | framework |
| `SETUP-PROMPT.md` | from-zero generator prompt (when the folder isn't available) | framework |
| `STACK.md` | stack contract | bootstrap |
| `.claude/` | skills, subagents, hooks | framework (+ bootstrap adds `<stack>-conventions`) |
| `scripts/verify.sh` | THE single verification entrypoint | bootstrap |
| `loop/framework.md` | this manifest + version | framework |
| `loop/REGISTRY.md` | index of every work item | triage skill |
| `loop/work/<ID>-slug/` | one folder per FEAT/BUG/CHORE | triage skill |
| `loop/_templates/` | feature + bug artifact templates | framework |
| `loop/decisions/` | ADRs (confidence + research depth, immutable) | write-adr skill |
| `loop/LOG.md` | append-only journal — the permanent record | every skill |
| `loop/retros/` | weekly retrospective reports + proposals | retrospective skill |
| `loop/HANDOFF.md` | where-are-we-now (overwritten per session) | session-handoff skill |
| `apps/<layer>/` | application code (backend/, frontend/, ...) | bootstrap + feature loops |

## Framework invariants

1. No untracked work — everything actionable has a registry ID.
2. No unproven done — three verification checkpoints (V1 implementer, V2
   independent reviewer, V3 fresh double-run flake check), all logged.
3. **Every layer in `apps/` ships with a real test suite wired into
   verify.sh — a build is not a test.**
4. No unrecorded decisions — ADRs with honest confidence and research depth.
5. No lost state — LOG.md and HANDOFF.md survive every session.

## Changelog

- **1.1.2** (2026-07-09) — SETUP-PROMPT.md ships in-repo: recreates this exact
  framework from zero on machines without the boilerplate folder.

- **1.1.1** (2026-07-09) — USER-GUIDE.md now ships inside the framework
  (canonical manual incl. token budget); layout table updated.

- **1.1.0** (2026-07-09) — retrospective meta-loop: `pattern-analyst` subagent,
  `retrospective` skill, `loop/retros/`. The loop now measures itself weekly
  and proposes improvements; humans approve all changes.
- **1.0.0** (2026-07-03) — initial framework.

## Upgrading a project to a newer framework version

Diff this file's version against the source boilerplate; copy changed files
from `.claude/`, `loop/_templates/`, and `scripts/`; never overwrite
`loop/REGISTRY.md`, `loop/LOG.md`, `loop/work/`, or `loop/decisions/` — those
are project history. Record the upgrade as a CHORE with a LOG entry.
