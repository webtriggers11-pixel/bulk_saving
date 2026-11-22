# Plan FEAT-031

1. `apps/web/src/components/ui/phone-field.tsx`: `PhoneField` wraps `Input` (new inset `prefix`) with an
   absolutely positioned `+91` span (`pointer-events-none select-none`, `aria-hidden`; the input gets
   `aria-describedby` pointing at a visually-hidden "Country code +91"). Exports `toLocalDigits(raw)` (sanitiser)
   and `indianPhone(digits)` → `normalisePhone('+91'+digits)` when exactly 10 digits, otherwise null.
2. OnboardingPage + AdminLoginPage: `phone` state holds the 10 local digits; `canonical = indianPhone(phone)`
   feeds the request/verify bodies, the button's disabled state, the hint, the dev toast and "Sent by SMS to".
3. `PHONE_HINT` → "Enter your 10-digit mobile number." (the "+country code" part no longer applies).
4. Tests: new `phone-field.test.tsx`; update the page tests that typed a foreign number.
Approved: autonomous mode (owner standing instruction).
