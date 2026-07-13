import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import type { Env } from '../../config/env.validation';
import { HandwritingCheckService } from './handwriting-check.service';
import type {
  HandwritingCheckResult,
  UploadedImageFile,
} from './handwriting-check.types';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

@Controller('handwriting-check')
export class HandwritingCheckController {
  constructor(
    private readonly handwritingCheckService: HandwritingCheckService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('debug')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async debugCheck(
    @UploadedFile() image?: UploadedImageFile,
    @Body('originalText') originalText?: string,
  ): Promise<HandwritingCheckResult> {
    // 인증 없는(@Public) 디버그 경로가 프로덕션에서 Gemini 비용 남용 벡터가
    // 되지 않도록, dev 모듈과 같은 방식으로 개발 환경 밖에선 숨긴다.
    if (this.config.get('NODE_ENV', { infer: true }) !== 'development') {
      throw new NotFoundException();
    }
    if (!image) {
      throw new BadRequestException('image 파일이 필요합니다.');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(image.mimetype)) {
      throw new BadRequestException('지원하지 않는 이미지 형식입니다.');
    }

    const normalizedOriginalText = originalText?.trim();
    if (!normalizedOriginalText) {
      throw new BadRequestException('originalText가 필요합니다.');
    }

    return this.handwritingCheckService.checkAndLog(
      image,
      normalizedOriginalText,
    );
  }
}
