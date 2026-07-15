import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProgressSnapshot } from '../writing/progress-calculator';
import { WritingService } from '../writing/writing.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRepository } from './user.repository';
import { AuthProvider, LinkedProviders, User } from './user.types';

/**
 * User 비즈니스 로직. controller 와 repository 사이에서 규칙을 처리한다.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly writingService: WritingService,
  ) {}

  /** 내 프로필 조회 (없으면 404). */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('사용자 프로필을 찾을 수 없습니다.');
    }
    return user;
  }

  /** 내 계정 연결 상태 조회 (google/kakao 연결 여부). */
  async getLinkedProviders(userId: string): Promise<LinkedProviders> {
    return this.userRepository.getLinkedProviders(userId);
  }

  /**
   * 내 진척률 조회 (완필 권수/전체 진척/점등 절수).
   * 계산은 필사 도메인 소관이라 WritingService에 위임한다(얇은 pass-through).
   * userId는 검증된 JWT에서 오므로 별도 존재 확인은 하지 않는다.
   */
  async getMyProgress(userId: string): Promise<ProgressSnapshot> {
    return this.writingService.getMyProgress(userId);
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
