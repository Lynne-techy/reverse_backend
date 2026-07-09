import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetTodayVerseQueryDto } from './dto/get-today-verse.dto';
import { GetVerseRangeQueryDto } from './dto/get-verse-range.dto';
import { VerseService } from './verse.service';
import { Verse } from './verse.types';

@ApiTags('verses')
@ApiBearerAuth('access-token')
@Controller('verses')
export class VerseController {
  constructor(private readonly verseService: VerseService) {}

  /** GET /verses/today?date=YYYY-MM-DD — 오늘의 말씀 (클라이언트 로컬 날짜 기준) */
  @ApiOperation({
    summary: '오늘의 말씀 조회',
    description:
      'date는 클라이언트 기기의 로컬 날짜. 해당 날짜에 배정된 적 없으면 무작위로 하나 배정한다.',
  })
  @Get('today')
  getToday(@Query() query: GetTodayVerseQueryDto): Promise<Verse> {
    return this.verseService.getToday(query.date);
  }

  /** GET /verses?book=&chapter=&from=&to= — 같은 장 안의 절 범위 조회 (key verse 선택용) */
  @ApiOperation({
    summary: '구절 범위 조회',
    description:
      '같은 책·장 안에서 from~to 절을 오름차순으로 반환한다. 클라이언트가 이 목록에서 key verse를 고른다.',
  })
  @Get()
  getRange(@Query() query: GetVerseRangeQueryDto): Promise<Verse[]> {
    return this.verseService.getRange(
      query.book,
      query.chapter,
      query.from,
      query.to,
    );
  }
}
