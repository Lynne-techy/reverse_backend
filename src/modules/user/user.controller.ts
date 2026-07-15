import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
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
