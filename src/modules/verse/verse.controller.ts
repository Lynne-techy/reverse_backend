import { Controller, Get, Query } from '@nestjs/common';
import { GetTodayVerseQueryDto } from './dto/get-today-verse.dto';
import { VerseService } from './verse.service';
import { Verse } from './verse.types';

@Controller('verses')
export class VerseController {
  constructor(private readonly verseService: VerseService) {}

  /** GET /verses/today?date=YYYY-MM-DD — 오늘의 말씀 (클라이언트 로컬 날짜 기준) */
  @Get('today')
  getToday(@Query() query: GetTodayVerseQueryDto): Promise<Verse> {
    return this.verseService.getToday(query.date);
  }
}
