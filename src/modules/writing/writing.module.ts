import { Module } from '@nestjs/common';
import { WritingController } from './writing.controller';
import { WritingRepository } from './writing.repository';
import { WritingService } from './writing.service';

@Module({
  controllers: [WritingController],
  providers: [WritingService, WritingRepository],
  exports: [WritingService],
})
export class WritingModule {}
