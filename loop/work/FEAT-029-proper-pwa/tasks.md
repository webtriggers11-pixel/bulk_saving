# Tasks FEAT-029 — A proper installable PWA

- [x] T1 ADR-0041; mark.svg + gen script; every icon and launch image; manifest module + vite wiring; iOS head tags; font runtime caching; tests (AC1–AC4)
- [x] T2 InstallCard on Home + tests (AC5)
- [x] T3 Screenshots from the real app (CDP), wired into the manifest; browser pass: installability in Chrome, offline launch. Found and fixed: the SW registered only inside AppShell (ServiceWorkerProvider at the root)
- [x] T4 V2: r1 PASS-conditional (P1 → BUG-025, fixed; P2/P3 taken); r2 PASS
- [x] T5 V3 at 3c957d7, two identical runs (site 62, backend 566, web 689); closed
