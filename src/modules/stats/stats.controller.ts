import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { GetActivityQueryDto } from './dto/get-activity.dto';
import { StatsService } from './stats.service';
import { DailyActivity, UserStatistics } from './stats.types';

@ApiTags('stats')
@ApiBearerAuth('access-token')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** GET /stats/me — 내 streak/총 필사 수 요약 */
  @ApiOperation({
    summary: '내 통계 조회',
    description: '현재 연속 일수(streak), 최고 기록, 총 필사 수를 반환한다.',
  })
  @Get('me')
  getMyStatistics(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserStatistics> {
    return this.statsService.getMyStatistics(user.userId);
  }

  /** GET /stats/activity?from=&to= — 잔디(일자별 활동) */
  @ApiOperation({
    summary: '잔디(일자별 활동) 조회',
    description: '[from, to] 구간의 날짜별 통과 필사 수를 반환한다.',
  })
  @Get('activity')
  getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetActivityQueryDto,
  ): Promise<DailyActivity[]> {
    return this.statsService.getActivityCalendar(
      user.userId,
      query.from,
      query.to,
    );
  }
}
