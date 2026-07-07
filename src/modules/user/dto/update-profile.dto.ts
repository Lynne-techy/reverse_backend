import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * 프로필 수정 요청. 두 필드 모두 선택이며, 전달된 필드만 갱신된다.
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
}
