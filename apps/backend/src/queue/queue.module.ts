import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DEMO_QUEUE, DemoProcessor } from './demo.processor';
import { DemoQueueService } from './demo-queue.service';

@Module({
  imports: [BullModule.registerQueue({ name: DEMO_QUEUE })],
  providers: [DemoProcessor, DemoQueueService],
  exports: [DemoQueueService],
})
export class QueueModule {}
