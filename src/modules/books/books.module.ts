import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksRepository } from './books.repository';
import { BooksService } from './books.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService, BooksRepository],
  // 다른 모듈(stats의 스트릭 시작 배너 등)이 책 이름 조회에 재사용한다.
  // 모듈 경계는 service로 유지 — repository는 내부에 감춘다.
  exports: [BooksService],
})
export class BooksModule {}
