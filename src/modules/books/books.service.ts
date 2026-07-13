import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BooksRepository } from './books.repository';
import { Book } from './books.types';

/**
 * 책 배경 정보 비즈니스 로직.
 */
@Injectable()
export class BooksService {
  constructor(private readonly booksRepository: BooksRepository) {}

  /**
   * book_no(1~66)로 책 배경 정보를 조회한다.
   * 범위를 벗어난 값은 400, 아직 배경 정보가 없는 책은 404.
   */
  async getByBookNo(bookNo: number): Promise<Book> {
    if (!Number.isInteger(bookNo) || bookNo < 1 || bookNo > 66) {
      throw new BadRequestException(
        `book_no는 1~66 사이 정수여야 합니다: ${bookNo}`,
      );
    }

    const book = await this.booksRepository.findByBookNo(bookNo);
    if (!book) {
      throw new NotFoundException(
        `책 배경 정보를 찾을 수 없습니다: book_no=${bookNo}`,
      );
    }
    return book;
  }
}
