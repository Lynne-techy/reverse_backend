import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
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
