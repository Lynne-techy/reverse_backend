import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { LANGUAGES } from '../user.types';
import type { Language } from '../user.types';

/**
 * 프로필 수정 요청. 모든 필드가 선택이며, 전달된 필드만 갱신된다.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '홍길동', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'ko', enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: Language;
}
