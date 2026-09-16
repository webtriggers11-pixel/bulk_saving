# loop-boilerplate

Stack-agnostic loop-engineering template. Copy this folder to start ANY project
— React, NestJS, Python, Go, mobile, anything. The process is permanent; only
the stack is a variable.

## How to use (3 steps)

```bash
cp -r loop-boilerplate my-new-project && cd my-new-project && git init
claude
```

Then say one sentence:

> **"Bootstrap this project: frontend React + Vite, backend NestJS + Postgres."**

The `bootstrap` skill takes over: it researches current best practices for your
stack on the internet, installs/generates stack-specific skills and agents,
fills in STACK.md, CLAUDE.md and `scripts/verify.sh`, and scaffolds the app.
From then on you just talk. Everything actionable goes through **triage**:

> **"Users should be able to share a todo list"** → triage tags it `FEAT-001`, registers it, then: spec → your approval → plan → your approval → autonomous task loop
>
> **"Sharing fails for empty lists"** → triage tags it `BUG-001`, then: failing test first → root cause (incl. decision-log check) → fix until green → review → commit

Nothing is untracked: every item has an ID in `loop/REGISTRY.md`, every event
appends to `loop/LOG.md`, and every decision becomes an ADR that states its
**confidence level** and whether it came from deep research, a quick check, or
a judgment call.

## What's inside

```
project/
├── CLAUDE.md                      # agent manual: process rules + stack section (root — tools require it)
├── USER-GUIDE.md                  # human manual: states, prompts, /goal recipes, token budget
├── SETUP-PROMPT.md                # recreate this framework from zero (no folder needed)
├── AGENTS.md                      # cross-tool pointer
├── STACK.md                       # stack contract — filled by bootstrap
├── .claude/                       # THE MACHINERY
│   ├── settings.json              #   hooks → scripts/verify.sh, dangerous-command blocks
│   ├── agents/                    #   planner · code-reviewer · stack-researcher · pattern-analyst
│   └── skills/                    #   triage · bootstrap · new-feature · fix-bug
│                                  #   write-adr · session-handoff · update-skills · retrospective
├── scripts/
│   └── verify.sh                  # single verification entrypoint — real tests per layer
├── loop/                          # THE STATE (all process artifacts, one place)
│   ├── framework.md               #   manifest: version, layout contract, invariants
│   ├── REGISTRY.md                #   every work item: ID, status, priority, dates
│   ├── work/<ID>-slug/            #   one folder per FEAT / BUG / CHORE
│   ├── _templates/                #   feature/ (spec, plan, tasks) · bug/ (report)
│   ├── decisions/                 #   ADRs — confidence, research depth, immutable
│   ├── LOG.md                     #   append-only journal — the permanent record
│   ├── retros/                    #   weekly retrospectives — the loop improving itself
│   └── HANDOFF.md                 #   where-are-we-now (overwritten per session)
└── apps/                          # THE PRODUCT (only application code)
    ├── backend/                   #   created by bootstrap, tests mandatory
    └── frontend/                  #   created by bootstrap, tests mandatory
```

## Three zones, never mixed

**Machinery** (`.claude/`, `scripts/`) — how work happens. **State** (`loop/`) —
what happened and why. **Product** (`apps/`) — the code. The framework version
and invariants live in `loop/framework.md`; upgrade projects by copying
machinery, never state.

## The one trick that makes it stack-agnostic

Hooks and agents never call `npm test` or `pytest` directly — they call
`scripts/verify.sh`. Bootstrap writes the right commands into that one file.
Swap stacks, swap one file; the entire loop machinery is untouched.
