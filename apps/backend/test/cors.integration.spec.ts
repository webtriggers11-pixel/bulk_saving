import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { buildCorsOptions, configureApp } from '../src/bootstrap';
import { HealthModule } from '../src/health/health.module';

/**
 * BUG-003 regression: the API is called cross-origin by the web PWA, so it must
 * answer preflights and carry CORS headers. Boots the health slice only (no DB /
 * Redis) through the SAME configureApp() that main.ts uses — if the CORS wiring
 * is ever dropped from bootstrap, these tests fail.
 */
describe('CORS (integration)', () => {
  const ALLOWED = 'http://localhost:5174';
  const FOREIGN = 'https://evil.example.com';

  let app: INestApplication;
  const originalEnv = { ...process.env };

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    process.env = { ...originalEnv };
  });

  async function boot(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    const created = moduleRef.createNestApplication();
    configureApp(created);
    await created.init();
    return created;
  }

  describe('with no CORS_ORIGINS set, outside production (local dev)', () => {
    beforeEach(() => {
      delete process.env.CORS_ORIGINS;
      process.env.NODE_ENV = 'development';
    });

    it('answers a preflight from a localhost origin with the CORS headers', async () => {
      app = await boot();

      const res = await request(app.getHttpServer())
        .options('/health')
        .set('Origin', ALLOWED)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'content-type,authorization')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(res.headers['access-control-allow-methods']).toContain('PATCH');
      expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
    });

    it('carries Access-Control-Allow-Origin on the actual response', async () => {
      app = await boot();

      const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
    });

    it('allows any localhost port, so a shifting Vite dev port never breaks dev', async () => {
      app = await boot();

      for (const origin of ['http://localhost:5173', 'http://127.0.0.1:4173']) {
        const res = await request(app.getHttpServer()).get('/health').set('Origin', origin).expect(200);
        expect(res.headers['access-control-allow-origin']).toBe(origin);
      }
    });

    it('sends no CORS headers to a non-localhost origin', async () => {
      app = await boot();

      const res = await request(app.getHttpServer()).get('/health').set('Origin', FOREIGN).expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('never allows credentials (auth is Bearer-only, no cookies)', async () => {
      app = await boot();

      const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);

      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('with an explicit CORS_ORIGINS allowlist', () => {
    beforeEach(() => {
      process.env.CORS_ORIGINS = 'https://app.bulksaving.example, https://admin.bulksaving.example';
      process.env.NODE_ENV = 'production';
    });

    it('allows a listed origin', async () => {
      app = await boot();

      const res = await request(app.getHttpServer())
        .get('/health')
        .set('Origin', 'https://admin.bulksaving.example')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('https://admin.bulksaving.example');
    });

    it('refuses an unlisted origin — including localhost, which dev mode would have allowed', async () => {
      app = await boot();

      for (const origin of [FOREIGN, ALLOWED]) {
        const res = await request(app.getHttpServer()).get('/health').set('Origin', origin).expect(200);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      }
    });
  });

  describe('in production with no CORS_ORIGINS', () => {
    /**
     * P1-2: a bare "no header" assertion also passes when CORS was never wired
     * at all, so it cannot tell fail-closed from fail-absent. Each test here
     * carries a POSITIVE CONTROL in the same run: the identical request is
     * allowed once an allowlist is configured, which is only true when the
     * middleware is actually live.
     */
    it('allows no cross-origin browser access at all — while the same request IS allowed once configured', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGINS = ALLOWED;
      app = await boot();
      const control = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);
      expect(control.headers['access-control-allow-origin']).toBe(ALLOWED); // middleware is live
      await app.close();

      delete process.env.CORS_ORIGINS;
      app = await boot();
      const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('gives no localhost fallback to an unrecognised NODE_ENV either (allowlist, not denylist)', async () => {
      delete process.env.CORS_ORIGINS;
      // A typo'd/unlisted value must NOT re-enable the dev fallback. (Boot-time
      // env validation rejects these too; this pins the CORS rule itself.)
      for (const nodeEnv of ['prod', 'Production', 'staging']) {
        process.env.NODE_ENV = nodeEnv;
        app = await boot();
        const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        await app.close();
      }

      // Control: the same origin, same code path, allowed in development.
      process.env.NODE_ENV = 'development';
      app = await boot();
      const control = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);
      expect(control.headers['access-control-allow-origin']).toBe(ALLOWED);
    });
  });

  describe('a refused origin', () => {
    beforeEach(() => {
      process.env.CORS_ORIGINS = 'https://app.bulksaving.example';
      process.env.NODE_ENV = 'production';
    });

    /**
     * P2-1: `callback(null, false)` makes the `cors` package skip the rest of
     * its middleware, so a refused PREFLIGHT falls through to the Nest router
     * and 404s with the standard error envelope — character-for-character the
     * pre-fix BUG-003 signature. Pinned here so that trap is documented
     * behaviour rather than a surprise during a production misconfiguration.
     */
    it('404s a refused preflight (documented consequence — it looks exactly like BUG-003)', async () => {
      app = await boot();

      const res = await request(app.getHttpServer())
        .options('/health')
        .set('Origin', FOREIGN)
        .set('Access-Control-Request-Method', 'GET')
        .expect(404);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    });

    it('still serves the actual request normally — the browser, not the server, blocks the read', async () => {
      app = await boot();

      const res = await request(app.getHttpServer()).get('/health').set('Origin', FOREIGN).expect(200);

      expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  /** P2-5: the policy itself, with env passed explicitly — no process globals. */
  describe('buildCorsOptions (unit)', () => {
    function decide(env: NodeJS.ProcessEnv, origin: string | undefined): boolean {
      const { origin: rule } = buildCorsOptions(env);
      let allowed = false;
      (rule as (o: string | undefined, cb: (e: Error | null, a?: boolean) => void) => void)(origin, (_err, a) => {
        allowed = a ?? false;
      });
      return allowed;
    }

    it('refuses look-alike origins that a loose regex would let through', () => {
      const dev = { NODE_ENV: 'development' };
      for (const origin of [
        'http://localhost.evil.com',
        'http://localhost@evil.com',
        'http://evil.localhost',
        'http://localhost:5174.evil.com',
        'https://localhost',
        'https://evil.example.com',
      ]) {
        expect(decide(dev, origin)).toBe(false);
      }
    });

    it('allows loopback in all three spellings, on any port, in dev', () => {
      const dev = { NODE_ENV: 'development' };
      for (const origin of ['http://localhost', 'http://localhost:5174', 'http://127.0.0.1:4173', 'http://[::1]:5173']) {
        expect(decide(dev, origin)).toBe(true);
      }
    });

    it('treats an unset NODE_ENV as local dev, an unknown one as closed', () => {
      expect(decide({}, 'http://localhost:5174')).toBe(true);
      expect(decide({ NODE_ENV: 'staging' }, 'http://localhost:5174')).toBe(false);
      expect(decide({ NODE_ENV: 'production' }, 'http://localhost:5174')).toBe(false);
    });

    it('ignores a request with no Origin header (curl, server-to-server)', () => {
      expect(decide({ NODE_ENV: 'development' }, undefined)).toBe(false);
    });

    it('an explicit allowlist wins everywhere, and closes the localhost fallback', () => {
      const env = { NODE_ENV: 'development', CORS_ORIGINS: ' https://app.example.com , https://admin.example.com ' };
      expect(decide(env, 'https://app.example.com')).toBe(true);
      expect(decide(env, 'https://admin.example.com')).toBe(true);
      expect(decide(env, 'http://localhost:5174')).toBe(false);
    });

    /** P2-4: an entry a browser Origin can never equal is a silent outage. */
    it('refuses to boot on a CORS_ORIGINS entry that is not a bare origin', () => {
      expect(() => buildCorsOptions({ CORS_ORIGINS: 'https://app.example.com/' })).toThrow(/bare origin/);
      expect(() => buildCorsOptions({ CORS_ORIGINS: 'https://app.example.com/admin' })).toThrow(/bare origin/);
      expect(() => buildCorsOptions({ CORS_ORIGINS: 'app.example.com' })).toThrow(/not a URL/);
    });
  });
});
