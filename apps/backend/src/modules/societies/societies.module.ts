import { Module } from '@nestjs/common';
import { SocietiesService } from './societies.service';

@Module({
  providers: [SocietiesService],
  exports: [SocietiesService],
})
export class SocietiesModule {}
