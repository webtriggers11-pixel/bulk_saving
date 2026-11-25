# CHORE-028 — OTP SMS wording that carriers deliver

## Why
On 2026-11-25 the TextBee gateway's Airtel SIM refused (Android generic failure) every
OTP text worded "<code> is your BulkSaving code. Do not share it with anyone." (4 times)
and "BulkSaving: your sign-in number is <code>". The same SIM delivered three friendlier
variants. The owner picked: "Hi, welcome to BulkSaving. Please enter 482-913 in the app to sign in."

## Acceptance
- AC1: `otpMessage('482913')` = `Hi, welcome to BulkSaving. Please enter 482-913 in the app to sign in.`
- AC2: the text contains neither "code" nor "share".
- AC3: a non-6-digit code (not used in production) is shown unsplit.
- AC4: the server sends the new wording after redeploy.
