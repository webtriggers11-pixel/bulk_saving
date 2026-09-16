/**
 * Minimal .env loader for the Jest process (no dependency on dotenv).
 * Ensures integration tests read DATABASE_URL / REDIS_* from apps/backend/.env
 * before any test module evaluates its connection config.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const contents = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of contents.split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {
  // No .env present — fall back to process defaults (localhost:6379 / 5432).
}
