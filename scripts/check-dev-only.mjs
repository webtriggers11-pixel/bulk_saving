#!/usr/bin/env node
/**
 * FEAT-026 (ADR-0037): the production web bundle must not contain the dev OTP path — not as
 * dead code, not as a lazy chunk. Reads every built asset and fails on the route's path or
 * the dev module's exported name. Runs after the build in verify.sh.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'apps/web/dist/assets');
const offenders = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.js')) continue;
  const source = readFileSync(join(dir, file), 'utf8');
  for (const needle of ['dev/otp', 'fetchDevOtp']) {
    if (source.includes(needle)) offenders.push(`${file}: contains "${needle}"`);
  }
}
if (offenders.length > 0) {
  console.error('==> [verify] dev-only code reached the production bundle:\n  ' + offenders.join('\n  '));
  process.exit(1);
}
console.log('==> [verify] production bundle carries no dev OTP path');
