# Tasks FEAT-028 — Product website (`apps/site`)

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-028): ...`) AND append a LOG.md entry.

- [x] T1: FEATURES.md gains FEAT-023..026; ADR-0039 written; `apps/site` scaffolded (Astro 7, scripts, eslint, tsconfig, vitest) and green in the gate with a placeholder page + the content/tokens tests
- [x] T2: tokens.css mirrors the app; pre-paint script; base layout (nav, footer, accent + scheme switch) — depends: T1
- [x] T3: all sections with real copy from FEATURES.md; page container test — depends: T2
- [x] T4: 3D hero: pure model + tests, Three.js building, lazy load, fallback, reduced motion — depends: T2
- [x] T5: browser pass at 390/1280, light/dark, two accents; fix what the screenshots show; CI node 24; DEPLOY.md note — depends: T3, T4
- [x] T5b (owner, mid-build: "make this product website creative and fancy as per theme"): the app's micro-interactions carried over — spotlight, border beam, sparkles, shimmer, press sparks, circular scheme reveal — plus section reveal, tilt, ticker, count-up, grid floor + window halos + pledge sparks in 3D; all off under reduced motion
- [ ] T6: V2 (code-reviewer), fixes, V3 double run, close — depends: T5
- [x] T5c (owner, mid-build: "use GSAP, kens and much more animation 3d … use internet to search"): GSAP 3.15 (ScrollTrigger, SplitText) + Lenis 1.3.27 wired per both READMEs; SplitText hero entrance with the towers rising; the How section is a scroll-scrubbed 3D story (sticky second scene, camera orbit/zoom, windows filling, HUD price, burst at close) driven by a pure, tested story.ts; heading/row reveals, mock parallax; Ken Burns drift on the hero scene; all behind gsap.matchMedia with a reduced-motion branch
- [x] T5d (owner, mid-build: "Browse, ask, book … not creative … better UI/UX with fancy style"): the section is a living catalog wall — the real 23 services with the seed's prices and unit nouns, chips + search re-arranging the cards with GSAP Flip, five open rounds with ladders and ticking deadlines, "Ask for this" that toggles with a count and sparkles, and the app's pledge sheet (native <dialog>) with a unit stepper repricing through the tier rule; pure catalogModel.ts with 8 tests
- [x] T5e (owner, mid-build: "show this to my financiers … remove unwanted things, add positive product things, more interactive, good labels, get the idea in one go"): the "not here yet" table and the "no gateway, no vendor app, no chat" line are gone; added an Overview (the mechanic in three tiles, an animated money-flow diagram, the brief's numbers, a who-gains-what switcher, "why it holds"), an interactive savings calculator (pure calc.ts, 5 tests, defaults = the brief's worked example, commission labelled illustrative) and a Now/Next/Later roadmap; nav relabelled
