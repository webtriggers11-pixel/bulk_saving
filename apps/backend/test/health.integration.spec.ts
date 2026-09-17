import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/bootstrap';
import { HealthModule } from '../src/health/health.module';

/**
 * Integration test: boots a Nest app with just the health slice + the global
 * envelope wiring and hits GET /health over HTTP. No DB / Redis required.
 */
describe('GET /health (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the standard success envelope with a HealthStatus', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'backend',
      },
    });
    expect(typeof res.body.data.timestamp).toBe('string');
  });
});
