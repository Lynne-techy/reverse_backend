import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetRecommendationsQueryDto } from './dto/get-recommendations.dto';
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

  /** GET /verses/recommendations?emotion= — 감정에 맞는 추천 구절 (무작위 6개) */
  @ApiOperation({
    summary: '감정 기반 구절 추천',
    description:
      '감정 코드에 큐레이션된 구절들 중 무작위 6개를 유저 번역본으로 반환한다.',
  })
  @Get('recommendations')
  getRecommendations(
    @Query() query: GetRecommendationsQueryDto,
  ): Promise<Verse[]> {
    return this.verseService.getRecommendations(query.emotion);
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
