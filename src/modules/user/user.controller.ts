import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { ProgressSnapshot } from '../writing/progress-calculator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';
import { LinkedProviders, User } from './user.types';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** GET /users/me — 내 프로필 */
  @ApiOperation({ summary: '내 프로필 조회' })
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<User> {
    return this.userService.getProfile(user.userId);
  }

  /** GET /users/me/linked-providers — 내 계정 연결 상태 */
  @ApiOperation({ summary: '내 계정 연결 상태 조회' })
  @Get('me/linked-providers')
  getLinkedProviders(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LinkedProviders> {
    return this.userService.getLinkedProviders(user.userId);
  }

  /** GET /users/me/progress — 내 진척률(완필 권수/전체 진척/점등 절수) */
  @ApiOperation({ summary: '내 진척률 조회' })
  @Get('me/progress')
  getMyProgress(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProgressSnapshot> {
    return this.userService.getMyProgress(user.userId);
  }

  /** PATCH /users/me — 내 프로필 수정 */
  @ApiOperation({ summary: '내 프로필 수정' })
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.userService.updateProfile(user.userId, dto);
  }
}
