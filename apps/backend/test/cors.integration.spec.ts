import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/bootstrap';
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
    beforeEach(() => {
      delete process.env.CORS_ORIGINS;
      process.env.NODE_ENV = 'production';
    });

    it('allows no cross-origin browser access at all', async () => {
      app = await boot();

      const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED).expect(200);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
