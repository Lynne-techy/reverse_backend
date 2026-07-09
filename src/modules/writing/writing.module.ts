import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { VerseModule } from '../verse/verse.module';
import { WritingController } from './writing.controller';
import { WritingRepository } from './writing.repository';
import { WritingService } from './writing.service';

@Module({
  imports: [StatsModule, VerseModule],
  controllers: [WritingController],
  providers: [WritingService, WritingRepository],
  exports: [WritingService],
})
export class WritingModule {}
