import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DEMO_QUEUE, type DemoJobData } from './demo.processor';

@Injectable()
export class DemoQueueService {
  constructor(@InjectQueue(DEMO_QUEUE) private readonly queue: Queue<DemoJobData>) {}

  enqueue(data: DemoJobData): Promise<{ id?: string }> {
    return this.queue.add('demo-job', data);
  }
}
