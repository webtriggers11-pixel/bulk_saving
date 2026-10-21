# Tasks CHORE-026 — Dev fixed OTP

- [x] T1 ADR-0040 + `devFixedOtp()` in OtpService + production refusal + env files + tests
- [x] T1b "only 4 digit": every OTP is 4 digits (generator, DTOs `^\d{4}$`, web inputs, tests)
- [x] T1c "That code has expired… fix this": in development `1111` verifies with or without an outstanding request
- [x] T1d Owner chose B: an administrator's number gets 8 digits through either door; residents 4; dev `1111` wins everywhere
- [x] T2 V2: r1 PASS-conditional (P1-1 → owner chose B; P2-1/P3-1/P3-3 taken); r2 PASS-conditional (flake = BUG-014, evidence added; P3-1/3/4/5 taken)
- [x] T3 V3 two identical runs at b757edf (site 62, backend 566, web 665); closed
