import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushController } from './push.controller';
import { PushModule } from './push.module';

/** The web-push HTTP routes (FEAT-020): the core module plus the access-token guard. */
@Module({
  imports: [AuthModule, PushModule],
  controllers: [PushController],
})
export class PushApiModule {}
