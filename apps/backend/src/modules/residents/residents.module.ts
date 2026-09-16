import { Module } from '@nestjs/common';
import { ResidentsService } from './residents.service';

@Module({
  providers: [ResidentsService],
  exports: [ResidentsService],
})
export class ResidentsModule {}
