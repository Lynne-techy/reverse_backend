import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BooksRepository } from './books.repository';
import { Book } from './books.types';

// 현재는 개역개정(KO_GAEGAEJEONG) 단일 번역본만 적재돼 있다.
// verses 모듈과 동일하게, 여러 번역본을 실제로 지원하게 되면 이 상수 대신
// 요청 파라미터(예: 사용자 언어 설정)로 대체한다.
const DEFAULT_TRANSLATION_CODE = 'KO_GAEGAEJEONG';

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

    const book = await this.booksRepository.findByBookNo(
      DEFAULT_TRANSLATION_CODE,
      bookNo,
    );
    if (!book) {
      throw new NotFoundException(
        `책 배경 정보를 찾을 수 없습니다: book_no=${bookNo}`,
      );
    }
    return book;
  }

  /**
   * 내부 모듈용 조회 — 없으면 예외 대신 null을 돌려준다.
   * getByBookNo는 HTTP 응답(400/404)에 결합된 controller용 API라,
   * 다른 모듈(stats의 스트릭 시작 배너 등)이 재사용할 때는 이쪽을 쓴다.
   */
  findByBookNo(bookNo: number): Promise<Book | null> {
    return this.booksRepository.findByBookNo(DEFAULT_TRANSLATION_CODE, bookNo);
  }
}
