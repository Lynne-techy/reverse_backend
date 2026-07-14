import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRepository } from './user.repository';
import { AuthProvider, User } from './user.types';

/**
 * User 비즈니스 로직. controller 와 repository 사이에서 규칙을 처리한다.
 */
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /** 내 프로필 조회 (없으면 404). */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('사용자 프로필을 찾을 수 없습니다.');
    }
    return user;
  }

  /** 내 프로필 수정. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    // 존재 확인 후 수정 (없으면 404)
    await this.getProfile(userId);
    return this.userRepository.updateProfile(userId, {
      displayName: dto.displayName,
      avatarUrl: dto.avatarUrl,
      language: dto.language,
    });
  }

  /**
   * 로그인한 사용자를 프로필 테이블에 생성/갱신(JIT 프로비저닝).
   * AuthGuard 가 최초 인증 시 호출한다.
   */
  async provisionFromAuth(input: {
    id: string;
    email: string;
    provider: AuthProvider;
  }): Promise<User> {
    return this.userRepository.upsertFromAuth(input);
  }
}
