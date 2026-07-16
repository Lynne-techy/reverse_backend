import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { StatsController } from './stats.controller';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  // BooksModule: 스트릭 시작 배너의 책 이름 조회(BooksService.findByBookNo).
  imports: [BooksModule],
  controllers: [StatsController],
  providers: [StatsService, StatsRepository],
  exports: [StatsService],
})
export class StatsModule {}
