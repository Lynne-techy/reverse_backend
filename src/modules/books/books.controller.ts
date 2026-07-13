import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { Book } from './books.types';

@ApiTags('books')
@ApiBearerAuth('access-token')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  /** GET /books/:bookNo — 책(1~66) 배경 정보 조회 */
  @ApiOperation({
    summary: '책 배경 정보 조회',
    description:
      'book_no(1~66)로 해당 책의 요약·저자·기록시기·기록장소·수신대상·핵심주제·유튜브 링크를 반환한다.',
  })
  @Get(':bookNo')
  getBook(@Param('bookNo') bookNo: string): Promise<Book> {
    // 경로 파라미터는 문자열 — 기존 컨벤션대로 service에서 숫자로 변환·검증한다.
    return this.booksService.getByBookNo(Number(bookNo));
  }
}
