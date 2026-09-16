# Loop Engineering Framework — Project Setup Prompt for Claude Code

Paste everything below the line into Claude Code (`claude`) in an empty git repo.
Edit only the STACK line at the top. (If you have the `loop-boilerplate/` folder,
prefer `cp -r loop-boilerplate my-app` — this prompt is for machines without it.)

---

MY STACK: frontend React + Vite, backend NestJS, database SQLite. *(edit this line)*

Set up this repository on the Loop Engineering Framework — spec-driven, agent-run, fully traceable development with a strict three-zone layout: **machinery** (`.claude/`, `scripts/`), **state** (`loop/`), **product** (`apps/`). Never mix the zones. Create ALL of the following before writing any application code, then bootstrap for my stack. Work in this exact order and commit when done.

## 1. Framework manifest

Create **loop/framework.md**: framework name + version 1.1.1 + today's date; a layout-contract table mapping every path below to its role and writer (including `USER-GUIDE.md` and `loop/retros/`); a changelog section; and these five invariants: (1) no untracked work — everything actionable has a registry ID; (2) no unproven done — three verification checkpoints V1/V2/V3, all logged; (3) every layer in `apps/` ships with a real test suite wired into verify.sh — **a build is not a test**; (4) no unrecorded decisions — ADRs with honest confidence and research depth; (5) no lost state — LOG.md and HANDOFF.md survive every session. Include an upgrade note: copy machinery, never overwrite `loop/REGISTRY.md`, `loop/LOG.md`, `loop/work/`, `loop/decisions/`.

## 2. Process contracts (stack-agnostic)

Create **CLAUDE.md** with two clearly-marked sections:
- PROCESS section (permanent): a Structure note (framework contract lives in loop/framework.md; app code ONLY in `apps/<layer>/`, process state ONLY in `loop/`); all work enters through a `triage` skill; features need approved spec then approved plan before code; bugs need a failing reproduction test before any fix; every technical choice becomes an ADR; verification only via `bash scripts/verify.sh`; **three verification checkpoints per work item, each logged to loop/LOG.md** — V1 implementer runs verify.sh after every change (hook-enforced), V2 the code-reviewer subagent runs verify.sh ITSELF and reviews the diff vs spec, V3 at close a fresh run plus a SECOND back-to-back run where differing results = flaky test = a BUG that blocks closing; implementer never reviews its own work; append to loop/LOG.md at every work-item open/close, completed task, and decision; end sessions with the session-handoff skill; commit per task with `feat(FEAT-NNN):` / `fix(BUG-NNN):`; every apps/ layer has real tests — a build is not a test. Include "Ask the human before": adding dependencies, deleting files/tables, migrations, deploys, anything costing money.
- STACK section: `{{placeholders}}` for now (filled in step 7).

Create **AGENTS.md** (short pointer to CLAUDE.md, listing the loop/ paths) and **STACK.md** (stack contract template: pieces, versions, commands table, layout — all `{{placeholders}}`).

Create **scripts/verify.sh**: the ONLY verification entrypoint; must run real tests for EVERY layer and exit non-zero on any failure; placeholder body until bootstrap.

Create **USER-GUIDE.md** (root — the human manual, shared with every team member). If the canonical guide from the loop-boilerplate is available, copy it verbatim. Otherwise generate a concise version covering: the three layers of looping (agentic turn / `/goal` evaluator loops with turn caps / `/loop` + `/schedule`); the autonomy ladder (default → acceptEdits → plan → auto → bypassPermissions and when each is safe); all work-item states with who moves each forward; the prompt book (bootstrap, feature with gates 1–3, bug, chore, wrap up, resume); the V1/V2/V3 verification checkpoints; rules for writing provable `/goal` conditions; and a token-budget section (framework tax ~2k/session; bootstrap ~200–500k; medium feature ~250–650k; measure real usage with `/usage` and `/cost`).

## 3. Work tracking (loop/)

Create **loop/REGISTRY.md**: table of every work item — ID, Title, Status, Priority, Opened, Closed, Folder, Decisions. IDs FEAT-NNN / BUG-NNN / CHORE-NNN; status flow triaged→specced→planned→in-progress→in-review→done (bugs: triaged→reproduced→…); priorities P0–P3; rows never deleted.

Create **loop/_templates/feature/**: spec.md (problem/why, user stories, testable acceptance-criteria checkboxes = definition of done, explicit out-of-scope, open questions the agent must ask not assume), plan.md (approach, data model/contracts, new decisions required, risks), tasks.md (dependency-ordered checkboxes; check only when verify.sh passes; commit + LOG entry per task).

Create **loop/_templates/bug/report.md**: observed vs expected, reproduction (path to the failing test written BEFORE any fix), root cause, decision-log check (symptom of a past ADR? check revisit triggers), fix (commit + regression guard), lesson (one line added to CLAUDE.md if an agent assumption caused it).

Create empty **loop/work/** (with .gitkeep) and **apps/** with a README stating the per-layer test mandate.

## 4. Decision + memory files (loop/)

Create **loop/decisions/0000-template.md**: Status/Date/Deciders/Work item; **Confidence** (High/Medium/Low + basis); **Research depth** (Deep research with dated source URLs / Quick check with one authoritative source / honest Judgment call); Context; **Options considered (minimum two)**; Decision (one sentence); Consequences; **Revisit trigger** (mandatory when confidence is Low or depth is Judgment call). Immutable once Accepted — supersede, never edit.

Create **loop/decisions/0001-record-architecture-decisions.md** (Accepted, dated today).

Create **loop/LOG.md**: append-only journal, newest at bottom; entry format: date — ID/session — event, with What / Evidence / Decisions / By (agent | human-approved). Never edit past entries.

Create **loop/HANDOFF.md**: overwritten each session — goal/result, verification evidence (actual output like "11/11 pass"), unverified assumptions (mandatory), decisions made, blockers, next safe action.

## 5. Subagents (.claude/agents/)

- **planner.md** — approved spec → plan.md + tasks.md; reads CLAUDE.md, STACK.md, all ADRs first; never writes application code; returns open questions instead of guessing; tools: Read, Grep, Glob, Write.
- **code-reviewer.md** — skeptical, fresh-context, never the author; checks diff vs acceptance criteria and ADR/CLAUDE.md violations; runs verify.sh ITSELF and reports actual output (this is checkpoint V2); verdict approve/request-changes with file:line findings; tools: Read, Grep, Glob, Bash.
- **stack-researcher.md** — researches current best practices online (official docs, release notes, dated sources); never modifies the repo; returns conventions with URL + date per claim; tools: WebSearch, WebFetch, Read.
- **pattern-analyst.md** — read-only analyst of how we actually work: git history (fix-after-feat ratio, churn hotspots), loop/LOG.md (which checkpoint catches most), registry cycle times, ADR confidence distribution, and local session transcripts for repeated manual instructions; every claim with evidence; max 5 findings; tools: Read, Grep, Glob, Bash.

## 6. Skills (.claude/skills/<name>/SKILL.md) and hooks

Skills: **triage** (entry point: classify FEAT/BUG/CHORE, next ID from registry, folder from _templates, registry row, LOG entry, route), **new-feature** (spec → approval → planner → approval → per-task V1 loop with `feat(ID):` commits and LOG entries → V2 review → V3 close with double-run flake check), **fix-bug** (failing test first, confirmed failing for the right reason → decision-log check → smallest fix → V1 → V2 → V3 double-run → lesson line), **write-adr** (honest confidence + research depth; Low → mandatory revisit trigger; LOG entry noting both), **session-handoff** (overwrite HANDOFF.md, append session to LOG.md, sync checkboxes and registry), **update-skills** (re-research stack when STACK.md research date >3 months; propose diffs with sources BEFORE applying), **retrospective** (weekly meta-loop: pattern-analyst gathers evidence → report to `loop/retros/YYYY-MM-DD.md` with metrics, ≤5 patterns, ≤3 proposals each mapped to one mechanism → HUMAN GATE, apply nothing without approval → approved changes get ADR + LOG entry), **bootstrap** (step 7, reusable). Also create empty **loop/retros/**.

Hooks (.claude/settings.json): PostToolUse on Write|Edit → `bash scripts/verify.sh`, exit 2 with message on failure; PreToolUse on Bash → block `rm -rf`, `drop table`, `drop database`, `git push --force`.

## 7. Bootstrap for MY STACK (from the top line)

Ask me anything missing, then: quick-check current stable versions (npm registry / official sources — cite them); fill STACK.md and the CLAUDE.md stack section; write real commands into scripts/verify.sh covering EVERY layer's tests; generate `<framework>-conventions` skills from researched practice; write one ADR per stack choice with honest confidence + research depth + sources; scaffold each layer under `apps/<layer>/` (ask before installing dependencies) **with at least one passing test per layer from day one**; get `bash scripts/verify.sh` fully green.

## 8. Finish

Append LOG entries for everything, update HANDOFF.md, commit `chore: loop framework v1.0 + bootstrap`. Then tell me: "Ready — describe a feature or a bug and I'll triage it."

---

## After setup, your entire vocabulary is:

- "Users should be able to ___" → FEAT loop
- "___ is broken" → BUG loop
- "wrap up" → handoff
- "update skills" → refresh conventions from the internet
- "run the retrospective skill" → weekly: the loop measures itself and proposes improvements (you approve)
- `/goal <provable condition>. Stop after N turns.` → loop until done (see USER-GUIDE.md)
