# apps/

Application code only. Bootstrap creates one directory per stack layer
(`backend/`, `frontend/`, `mobile/`, ...). Every layer MUST have a test suite
wired into `scripts/verify.sh` — a build is not a test (framework invariant 3).
