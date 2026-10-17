import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';

/**
 * Any port on the loopback host, over plain http. Anchored at both ends and
 * scheme-locked, so `http://localhost.evil.com`, `http://localhost@evil.com`,
 * `http://evil.localhost` and `https://localhost` all fail to match. `[::1]` is
 * included because Vite binds IPv6 loopback on some setups.
 */
const LOCALHOST_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

/**
 * Environments where an unset `CORS_ORIGINS` falls back to "any localhost port".
 * An ALLOWLIST, not a denylist: an unrecognised `NODE_ENV` (`prod`, `staging`,
 * a typo) gets no localhost fallback, so the fail-closed rule does not hinge on
 * spelling one string correctly. Unset is included — that is the documented
 * local-dev default (`apps/backend/.env` sets no NODE_ENV).
 */
const LOCALHOST_FALLBACK_ENVS = new Set([undefined, '', 'development', 'test']);

/** Methods the API actually exposes (see the route map in the boot log). */
const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/** Preflight result cache (seconds) — one day, the common browser ceiling. */
const CORS_MAX_AGE_SECONDS = 86_400;

/**
 * Parses `CORS_ORIGINS` and rejects anything a browser `Origin` header could
 * never equal — a trailing slash, a path, a bare hostname. Such an entry would
 * silently match nothing and reproduce BUG-003 in production, so it fails the
 * boot instead (same spirit as `validateEnv`: never start half-configured).
 */
function parseConfiguredOrigins(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  for (const entry of entries) {
    let normalized: string;
    try {
      normalized = new URL(entry).origin;
    } catch {
      throw new Error(`Invalid CORS_ORIGINS entry "${entry}": not a URL. Expected an origin like https://app.example.com`);
    }
    if (normalized !== entry) {
      throw new Error(`Invalid CORS_ORIGINS entry "${entry}": expected the bare origin "${normalized}" (no path, no trailing slash).`);
    }
  }
  return entries;
}

/**
 * Builds the CORS policy from the environment (ADR-0014).
 *
 * - `CORS_ORIGINS` — comma-separated exact origins. When set, it is the whole
 *   allowlist, in every environment.
 * - Unset, in a {@link LOCALHOST_FALLBACK_ENVS} environment — any
 *   `http://localhost:<port>` / `http://127.0.0.1:<port>` / `http://[::1]:<port>`,
 *   so a shifted Vite dev port never breaks dev.
 * - Unset anywhere else (production included) — nothing is allowed. A deploy
 *   that forgets the variable fails closed.
 *
 * No `credentials`: auth is Bearer-token only, the API sets no cookies.
 */
export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const configured = parseConfiguredOrigins(env.CORS_ORIGINS);
  const allowLocalhost = configured.length === 0 && LOCALHOST_FALLBACK_ENVS.has(env.NODE_ENV);

  return {
    origin(requestOrigin, callback): void {
      // No Origin header: not a browser cross-origin call (curl, server-to-server,
      // same-origin navigation). Nothing to allow, nothing to block.
      if (!requestOrigin) {
        callback(null, false);
        return;
      }
      const allowed = configured.includes(requestOrigin) || (allowLocalhost && LOCALHOST_ORIGIN.test(requestOrigin));
      // Never throw on a refused origin: that would surface as a 500. Answering
      // without CORS headers is what the browser expects — it blocks the read.
      // Note: the `cors` package skips the rest of its middleware on `false`, so
      // a refused PREFLIGHT falls through to the router and 404s (ADR-0014).
      callback(null, allowed);
    },
    methods: CORS_METHODS,
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: CORS_MAX_AGE_SECONDS,
  };
}

/**
 * Express's `trust proxy`, from `TRUST_PROXY` (CHORE-016, ADR-0027). Behind a reverse
 * proxy every request arrives from the proxy's address, so per-client limits — the OTP
 * budgets and the global throttler — would see one client. Set it to the number of
 * proxies in front of the API (`1` for a single Caddy/nginx), or to a list of their
 * addresses. Unset: the socket address, which is right when nothing is in front.
 *
 * `true` (trust EVERY hop) is refused: it lets any client name its own address in
 * X-Forwarded-For and walk past every per-client limit.
 */
export function trustProxyFrom(env: NodeJS.ProcessEnv = process.env): number | string | undefined {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw || raw === 'false' || raw === '0') {
    return undefined;
  }
  if (raw === 'true') {
    throw new Error('TRUST_PROXY=true would trust a client-supplied X-Forwarded-For; set a hop count or proxy addresses.');
  }
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/**
 * The ONE place that applies the app's global wiring. `main.ts` and every test
 * that boots an app call this, so runtime and test behaviour can never drift
 * (BUG-003: they had, and the drift hid the missing CORS config from the suite).
 */
export function configureApp(app: INestApplication): INestApplication {
  // Security headers (CHORE-007, ADR-0020). The API serves a browser app, so it gets
  // HSTS, nosniff, frame-deny and a strict referrer policy. `contentSecurityPolicy` is
  // off: this process serves JSON only, never HTML, so a CSP here protects nothing and
  // would only be a second place to keep in step with the PWA's own headers.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  const trustProxy = trustProxyFrom();
  if (trustProxy !== undefined) {
    (app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void }).set('trust proxy', trustProxy);
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableCors(buildCorsOptions());
  return app;
}
