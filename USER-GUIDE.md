# Loop Engineering — Complete User Guide

*Ships with the Loop Engineering Framework (see `loop/framework.md` for version). This guide is the canonical manual — share it with every team using the framework. Framework layout: machinery in `.claude/` + `scripts/`, all process state in `loop/` (registry, work items, decisions, LOG, HANDOFF, framework.md manifest), application code only in `apps/<layer>/`. Verified against Claude Code docs and Anthropic's "Getting started with loops" (June 2026). Sources at the end.*

---

## Part 1 — How the looping ACTUALLY works (read this first)

### The three layers of "keeps going"

**Layer 1 — the agentic turn (automatic, always on).** When you send one prompt, Claude Code runs gather-context → act → verify → repeat *within that turn* — possibly hundreds of tool calls. It stops when it **judges** the task done or needs your input. This judgment is a claim, not a proof.

**Layer 2 — `/goal` (turns keep restarting until PROVABLY done).** This is the piece you asked about. `/goal <condition>` attaches a separate evaluator ( cheap) that checks your condition against the conversation after every turn. Not met → the reason is injected and a **new turn starts automatically**. Met → the goal clears and Claude stops. This is what makes "loop till the goal is completed" literally true.

**Layer 3 — time/event loops (`/loop`, `/schedule`).** `/loop 30m <prompt>` re-runs a prompt on a local timer; `/schedule` runs routines in Anthropic's cloud (daily, on GitHub events). These find and re-trigger work when you're not even present.

### The autonomy ladder (Shift+Tab cycles the first three)

| Mode | What runs without asking | Use for |
|------|--------------------------|---------|
| `default` | reads only | unfamiliar repos, risky work |
| `acceptEdits` | + file edits | normal loop sessions ← **recommended default** |
| `plan` | nothing (read-only, proposes a plan) | spec/plan phases |
| `auto` | everything, vetted by a safety classifier | long unattended `/goal` runs |
| `bypassPermissions` | everything, no checks | isolated sandboxes/CI only — never on your laptop |

Set the default in `.claude/settings.json`: `{"permissions": {"defaultMode": "acceptEdits"}}`. Pre-approve safe commands so even `default` mode flows: `"permissions": {"allow": ["Bash(bash scripts/verify.sh)", "Bash(git diff *)", "Bash(git log *)"]}`.

### Rules for writing `/goal` conditions

1. Must be **provable inside the conversation** — the evaluator reads only the transcript, no files. Good: "`bash scripts/verify.sh` was run and printed ALL GREEN". Bad: "the code is good".
2. Put the **turn cap inside the condition**: "…or stop after 10 turns".
3. One goal per session; max 4,000 chars. `/goal` alone shows status; `/goal clear` cancels.
4. Quantitative beats subjective: test counts, exit codes, checked boxes, HTTP codes.

---

## Part 2 — The states (what the machine can be in)

### Work-item states (tracked in `loop/REGISTRY.md`)

```
FEATURE:  triaged → specced → planned → in-progress → in-review → done
BUG:      triaged → reproduced → in-progress → in-review → done
```

| State | Meaning | Who moves it forward |
|-------|---------|---------------------|
| `triaged` | ID assigned, folder created, registry row added | agent (triage skill) |
| `specced` | spec.md filled, open questions answered, **you approved** | YOU (gate 1) |
| `reproduced` | failing test written, fails for the right reason | agent |
| `planned` | plan.md + tasks.md written, ADRs drafted, **you approved** | YOU (gate 2) |
| `in-progress` | task loop running: implement → verify → commit → log | agent (autonomous) |
| `in-review` | code-reviewer subagent examining the diff vs spec | agent (different one) |
| `done` | criteria verified with evidence, closed date set | YOU (gate 3: read diff, merge) |

### Session states

| State | File | Prompt to enter it |
|-------|------|--------------------|
| Fresh session | reads CLAUDE.md automatically | `claude` |
| Resuming | loop/HANDOFF.md | "Read loop/HANDOFF.md and continue from the next safe action" |
| Wrapping up | HANDOFF.md + LOG.md updated | "wrap up" |
| Context getting long | — | `/compact` (never `/clear` mid-goal — it kills the goal) |

---

## Part 3 — The prompt book (every prompt, every stage)

### Stage 0 — Project creation (once)

```bash
mkdir my-app && cd my-app && git init && claude
```

**Prompt:** paste `SETUP-PROMPT.md` (edit the `MY STACK:` line), or if you copied the boilerplate:

> Bootstrap this project: frontend React + Vite, backend NestJS, database SQLite. Latest stable versions.

**Optional goal wrapper for unattended bootstrap** (after approving the stack when asked):

> /goal STACK.md and CLAUDE.md have no {{placeholders}} left, scripts/verify.sh was run and printed ALL GREEN, and one ADR exists per stack choice. Stop after 15 turns.

### Stage 1 — Creating a FEATURE

**Prompt (plain English — triage handles the rest):**

> Users should be able to set a due date on a todo and see overdue todos highlighted.

Claude triages (FEAT-002, registry, LOG), writes the spec, and **asks you its open questions**. Answer them; then:

**Gate 1 prompt:** "Spec approved." (or: "Change AC3 to X, drop story 4, then approved.")

Claude runs the planner → plan.md + tasks.md (+ draft ADRs with confidence).

**Gate 2 prompt:** "Plan approved. Implement it."

**Now attach the goal so it loops until provably done (note the V1/V2/V3 clauses):**

> /goal Every checkbox in loop/work/FEAT-002-due-dates/tasks.md is checked; `bash scripts/verify.sh` printed ALL GREEN after each task (V1); the code-reviewer subagent ran verify.sh itself and returned "approve" (V2); at close, verify.sh was run TWICE back-to-back with identical ALL GREEN output (V3, flake check); every acceptance criterion was individually verified with evidence shown; and all three checkpoints were logged to loop/LOG.md. Stop after 25 turns.

Walk away. The evaluator keeps restarting turns — implementing, fixing red tests, re-running review — until every clause is true or the cap hits.

**Gate 3 prompt (when the goal clears):** "Show me the full diff and the review verdict." → then "Merge/close it."

### Stage 2 — Reporting a BUG

**Prompt:**

> Bug: marking a todo done, then refreshing, shows it as not done.

Triage → BUG-001. Then attach the bug goal:

> /goal loop/work/BUG-001-*/report.md shows a failing test that reproduced the bug BEFORE any fix was made; `bash scripts/verify.sh` now prints ALL GREEN including that test (V1); the ADR revisit-trigger check was performed and its result stated; the code-reviewer subagent ran verify.sh itself and returned "approve" (V2); verify.sh was then run TWICE back-to-back with identical output (V3 — bug fixes are where flakiness hides); and all checkpoints were logged to loop/LOG.md. Stop after 15 turns.

The "BEFORE any fix" clause forces test-first — the evaluator will reject a turn that fixed code without showing the red test first.

### Stage 3 — CHOREs (refactors, upgrades, tooling)

> Chore: the DB path default is duplicated in db.ts and todos.module.ts — single-source it.

> /goal The duplication is gone, `bash scripts/verify.sh` printed ALL GREEN, and no behavior changed (all existing tests pass unmodified). Stop after 8 turns.

### Stage 4 — Session hygiene

| Situation | Prompt |
|-----------|--------|
| Ending work | "wrap up" (runs session-handoff: HANDOFF.md + LOG entry + registry sync) |
| Starting next day | "Read loop/HANDOFF.md and continue from the next safe action." |
| Recording a decision made in chat | "Record this as an ADR — be honest about confidence and research depth." |
| Stack feels stale | "Run the update-skills skill." |
| Weekly (or every ~5 closed items) | "Run the retrospective skill." — analyzes your git/LOG/prompting patterns, proposes ≤3 loop improvements, applies only what you approve |
| Automated weekly retro report | `/schedule weekly on Friday at 4pm: run the retrospective skill through step 2 only — write the report, do not apply anything.` |
| Reviewing anytime | "Run the code-reviewer subagent on the current diff." |
| What's the status? | "Show loop/REGISTRY.md and the last 5 LOG entries." |

### Stage 5 — Background/recurring loops (optional, advanced)

| Want | Command |
|------|---------|
| Re-check something locally every 30 min | `/loop 30m run bash scripts/verify.sh; if anything is red, fix it and commit` |
| Cloud routine while laptop is closed | `/schedule daily at 9am: review open PRs, triage new issues into loop/REGISTRY.md` |
| Fully unattended one-shot (CI/sandbox) | `claude -p "/goal <condition>" --permission-mode acceptEdits --max-turns 30` |
| Endless fresh-context loop (sandbox ONLY) | the Ralph pattern: `while :; do cat PROMPT.md \| claude -p --dangerously-skip-permissions; done` — state must live in files (which is exactly what REGISTRY/LOG/HANDOFF are for) |

---

## Part 3.5 — The three verification checkpoints (V1/V2/V3)

Every work item passes verification **three times, by different verifiers** —
not the same check three times in a row (which re-proves the same thing at 3x
cost), but three checkpoints that catch different failure classes:

| Checkpoint | Who runs it | When | Catches |
|------------|-------------|------|---------|
| **V1** | implementer (+ the PostToolUse hook) | after every task | broken logic, regressions — the loop's steering signal |
| **V2** | code-reviewer subagent, running verify.sh **itself** | at review | implementer self-deception; "it passed for me" claims; spec drift |
| **V3** | fresh double-run, back-to-back | at close | flaky tests, state leakage, order dependence — the one case where *repeating* a run reveals something new |

Rules: V2 never trusts V1's output — it must produce its own. V3's two runs
must be green AND identical; a difference is a flaky test, which is a BUG to
triage and blocks closing. **Every checkpoint appends its actual output to
`loop/LOG.md`** — one file holds the complete verification history of the
project, so "how do we know this works?" is always answerable by scrolling one
document. (HANDOFF.md stays separate on purpose: LOG is the permanent history,
HANDOFF is the disposable "where are we now" — merging them would bloat what
every session must read.)

## Part 4 — How the boilerplate and /goal fit together

They enforce different things and you want both:

- **Hooks (in the boilerplate)** = quality gates *inside* a turn: verify.sh auto-runs after every edit (exit 2 = agent must fix now), dangerous commands blocked. Deterministic — doesn't depend on any model's judgment.
- **/goal** = persistence *across* turns: keeps the agent working until the done-condition is provably met.
- **Skills** = the process itself (triage → spec → plan → tasks) so what the goal-driven turns *do* is structured, tagged, and logged.
- **The evaluator can't read files** — so our skills' habit of *showing* evidence in conversation (test counts, verify.sh output) is exactly what makes /goal conditions checkable. This is why "Evidence, not assertions" is a rule.

## Part 5 — Concerns specific to goal loops

1. **Evaluator can be gamed by sloppy conditions.** "Tests pass" can be satisfied by a turn that *says* tests pass. Always phrase as "`verify.sh` **was run in this conversation** and printed ALL GREEN".
2. **Always include the turn cap** — an unachievable goal without a cap burns tokens until you notice. Start small (8–25 turns).
3. **Context rot on long goals.** If a goal takes 20+ turns, quality degrades. Prefer smaller goals per task group; `/compact` mid-run if needed; never `/clear` (kills the goal).
4. **Don't put the gates inside the goal.** Spec and plan approval stay OUTSIDE the loop — attach /goal only after gate 2. An agent that writes its own spec, approves it, and loops to "done" is the over-automation trap.
5. **Auto mode ≠ bypass.** For unattended runs prefer `auto` (classifier blocks force-push, prod deploys, curl|bash) over `bypassPermissions` (blocks nothing).
6. **/clear, /goal clear, Esc** are your brakes. `/goal` alone shows spend and the evaluator's last reason.

## Part 6 — Token budget: what one project + one feature costs

*Framework overhead measured from the v1.1 boilerplate files (chars ÷ 4); work estimates calibrated against the real FEAT-001 reference run (todo-app-v2), where the code-review subagent alone metered ~43k tokens.*

### Fixed framework overhead (tiny — this is the point)

| Loaded | When | Tokens |
|--------|------|--------|
| CLAUDE.md (auto-read) | every session | ~800 |
| AGENTS.md + STACK.md | when consulted | ~350 |
| Skill descriptions (8 × ~60) | every session | ~500 |
| One full SKILL.md | only when triggered | ~250–650 |
| One subagent system prompt | per delegation | ~200–460 |

**Total framework tax: ~1.5–2k tokens per session** — under 1% of any real session. The cost lives in the work, not the framework.

### One-time: bootstrap a project

| Phase | Tokens (est.) |
|-------|---------------|
| Stack research (stack-researcher, web) | 60–150k |
| Contracts + conventions + ADRs | 30–60k |
| Scaffolding + first green verify.sh | 100–300k |
| **Bootstrap total** | **~200–500k** |

### Per feature (the recurring cost — medium feature, 5–7 tasks)

| Phase | Tokens (est.) |
|-------|---------------|
| Triage + spec + your Q&A | 20–50k |
| Plan (planner subagent) | 30–60k |
| Implementation V1 loops (incl. failed attempts) | 150–400k |
| V2 independent review (measured: ~43k) | 40–80k |
| V3 close + handoff + LOG | 20–40k |
| **Feature total** | **~250–650k** |

Small feature ≈ 150k; complex feature or a long-churning `/goal` run can reach ~1M. Bugs typically 80–250k (reproduction + fix + V1–V3). A weekly retrospective ≈ 50–120k.

**In money (Sonnet-class, ~$3/M in, $15/M out, with Claude Code's prompt caching):** a medium feature lands around **$2–8 API-cost equivalent**; on Pro/Max subscriptions it's covered by the plan's usage allowance. Treat all numbers as ±50% — codebase size and failure count dominate.

### What actually drives cost (and the framework's built-in levers)

1. **Failed V1 iterations** — the biggest variable. Tight specs and small tasks (the framework's whole design) directly cut this.
2. **Context length** — long sessions re-send history every turn. Lever: subagent isolation (planner/reviewer return summaries, not transcripts), `/compact`, fresh sessions from HANDOFF.md.
3. **Uncapped `/goal` runs** — always include "stop after N turns". The evaluator itself is Haiku — negligible.
4. **Re-reading the codebase** — CLAUDE.md/STACK.md exist precisely so the agent doesn't re-derive the project each session.
5. **Measure, don't guess:** run `/usage` (per-skill/subagent breakdown) and `/cost` in Claude Code; log the numbers in your weekly retro — the pattern-analyst can then optimize your actual spend, not estimates.

## Sources

- Getting started with loops — https://claude.com/blog/getting-started-with-loops
- /goal reference — https://code.claude.com/docs/en/goal
- Scheduled tasks (/loop) — https://code.claude.com/docs/en/scheduled-tasks
- Cloud routines (/schedule) — https://code.claude.com/docs/en/routines
- Permission modes — https://code.claude.com/docs/en/permission-modes
- Hooks — https://code.claude.com/docs/en/hooks
- Headless mode — https://code.claude.com/docs/en/headless
- Auto mode — https://www.anthropic.com/engineering/claude-code-auto-mode
- Ralph Wiggum plugin — https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum
