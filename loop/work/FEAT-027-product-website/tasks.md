# Tasks FEAT-027 — Product website (`apps/site`)

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-027): ...`) AND append a LOG.md entry.

- [ ] T1: FEATURES.md gains FEAT-023..026; ADR-0038 written; `apps/site` scaffolded (Astro 7, scripts, eslint, tsconfig, vitest) and green in the gate with a placeholder page + the content/tokens tests
- [ ] T2: tokens.css mirrors the app; pre-paint script; base layout (nav, footer, accent + scheme switch) — depends: T1
- [ ] T3: all sections with real copy from FEATURES.md; page container test — depends: T2
- [ ] T4: 3D hero: pure model + tests, Three.js building, lazy load, fallback, reduced motion — depends: T2
- [ ] T5: browser pass at 390/1280, light/dark, two accents; fix what the screenshots show; CI node 24; DEPLOY.md note — depends: T3, T4
- [ ] T6: V2 (code-reviewer), fixes, V3 double run, close — depends: T5
