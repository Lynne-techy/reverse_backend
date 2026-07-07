import { Module } from '@nestjs/common';
import { VerseController } from './verse.controller';
import { VerseRepository } from './verse.repository';
import { VerseService } from './verse.service';

@Module({
  controllers: [VerseController],
  providers: [VerseService, VerseRepository],
  // writing 모듈이 verse_id 검증/조회를 위해 VerseService 를 사용한다.
  exports: [VerseService],
})
export class VerseModule {}
