import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';
import { User } from './user.types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** GET /users/me — 내 프로필 */
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<User> {
    return this.userService.getProfile(user.userId);
  }

  /** PATCH /users/me — 내 프로필 수정 */
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.userService.updateProfile(user.userId, dto);
  }
}
