import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { QueueEvents } from 'bullmq';
import { DemoQueueService } from '../src/queue/demo-queue.service';
import { DEMO_QUEUE, type DemoJobResult } from '../src/queue/demo.processor';
import { QueueModule } from '../src/queue/queue.module';
import { configureApp } from '../src/bootstrap';

/**
 * Integration test: proves BullMQ enqueue -> consume against REAL Redis.
 * Requires `docker compose up -d` (redis) to be running.
 */
describe('BullMQ demo queue (integration, needs Redis)', () => {
  let app: INestApplication;
  let queueEvents: QueueEvents;

  const connection = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // The suite's own prefix, so a dev server on this Redis cannot take the job.
        BullModule.forRoot({ connection, prefix: process.env.BULLMQ_PREFIX }),
        QueueModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    queueEvents = new QueueEvents(DEMO_QUEUE, { connection, prefix: process.env.BULLMQ_PREFIX });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await queueEvents.close();
    await app.close();
  });

  it('enqueues a job and the processor consumes it', async () => {
    const service = app.get(DemoQueueService);
    const job = await service.enqueue({ message: 'ping' });

    const result = (await (
      job as unknown as { waitUntilFinished: (qe: QueueEvents, ttl?: number) => Promise<unknown> }
    ).waitUntilFinished(queueEvents, 15000)) as DemoJobResult;

    expect(result.ok).toBe(true);
    expect(result.echoed).toBe('ping');
  });
});
