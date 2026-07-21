import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { Env } from '../../config/env.validation';
import {
  HandwritingCheckResult,
  UploadedImageFile,
} from './handwriting-check.types';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

/**
 * Gemini 구조적 출력 스키마 — HandwritingCheckResult 형태를 강제한다.
 * 프롬프트로 형식을 서술하는 대신 스키마로 고정 → 파싱 실패 0 + 출력 토큰 절약.
 */
const HANDWRITING_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    isPenHandwriting: { type: 'boolean' },
    text: { type: 'string', nullable: true },
    similarityScore: { type: 'number', nullable: true },
    scriptureReference: { type: 'string', nullable: true },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string', nullable: true },
  },
  required: ['isPenHandwriting', 'confidence'],
} as const;

/**
 * Gemini 입력 이미지 다운스케일 파라미터. Gemini는 이미지를 타일로 토큰화하므로
 * 해상도가 곧 입력 토큰 비용 → 전송 전 긴 변을 IMAGE_MAX_DIM으로 축소하고 JPEG로 재압축.
 * 손글씨 판독엔 1024px면 충분하다.
 */
const IMAGE_MAX_DIM = 1024;
const IMAGE_JPEG_QUALITY = 80;

@Injectable()
export class HandwritingCheckService {
  private readonly logger = new Logger(HandwritingCheckService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async checkAndLog(
    image: UploadedImageFile,
    originalText: string,
  ): Promise<HandwritingCheckResult> {
    const apiKey = this.config.get('GEMINI_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    const model = this.config.get('GEMINI_MODEL', { infer: true });
    const thinkingBudget = this.config.get('GEMINI_THINKING_BUDGET', {
      infer: true,
    });
    const maxOutputTokens = this.config.get('GEMINI_MAX_OUTPUT_TOKENS', {
      infer: true,
    });
    const timeoutMs = this.config.get('GEMINI_TIMEOUT_MS', { infer: true });

    // 전송 전 이미지 다운스케일(입력 토큰·지연 절감). 실패 시 원본으로 폴백.
    const { data: imageData, mimeType: imageMime } =
      await this.downscaleImage(image);

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 타임아웃 — 무한 대기로 유사도 검사 동시성 슬롯이 묶이는 것을 방지.
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    // 형식 서술은 responseSchema로 대체 → 프롬프트 슬림화(입력 토큰 절약).
                    text:
                      '이미지를 분석해 주세요. 펜으로 직접 필사한 손글씨인지 판단하고, 손글씨라면 이미지에 적힌 문구를 최대한 정확히 판독해 주세요. ' +
                      '그리고 판독한 문구가 아래 원문과 의미/글자 기준으로 얼마나 유사한지 0~100 점수로 평가해 주세요. ' +
                      '띄어쓰기와 사소한 문장부호 차이는 약하게 감점하고, 글자 누락/추가/순서 변경/다른 단어는 강하게 감점해 주세요. ' +
                      'text에는 원문과 비교할 필사 본문만 넣고, 성경/경전 구절 출처 표기나 번역문/인쇄된 보조 문구는 제외하세요. ' +
                      '이미지 안이나 원문에서 성경/경전 구절 출처를 알 수 있으면 "잠언 4:23"처럼 한국어 표기로 scriptureReference에만 넣고, 알 수 없으면 null로 두세요. ' +
                      `원문: ${JSON.stringify(originalText)}`,
                  },
                  {
                    inline_data: {
                      mime_type: imageMime,
                      data: imageData,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              // 구조적 출력 — 형식 강제로 파싱 실패 0 + 출력 토큰 절약.
              responseSchema: HANDWRITING_RESULT_SCHEMA,
              // 결과가 작은 JSON이라 출력 상한을 둔다.
              maxOutputTokens,
              // 2.5-flash "사고" 예산 — 구조적 추출엔 불필요 → 기본 0(토큰·지연 절감).
              thinkingConfig: { thinkingBudget },
            },
          }),
        },
      );
    } catch (error) {
      // 타임아웃(TimeoutError)·네트워크 오류 → 명확한 503으로 변환.
      // (호출부 processSimilarity가 failed 처리 → 사용자 재시도 가능)
      this.logger.error(`Gemini 호출 실패(네트워크/타임아웃): ${String(error)}`);
      throw new ServiceUnavailableException(
        'Gemini 이미지 판독 호출에 실패했습니다.',
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Gemini request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('Gemini 이미지 판독 요청에 실패했습니다.');
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.warn('Gemini response did not include text content.');
      return {
        isPenHandwriting: false,
        text: null,
        similarityScore: null,
        scriptureReference: null,
        confidence: 'low',
        notes: 'Gemini 응답에 판독 결과가 없습니다.',
      };
    }

    const result = this.parseResult(text);
    this.logger.log(
      `Handwriting debug result: file=${image.originalname}, isPenHandwriting=${result.isPenHandwriting}, originalText=${originalText}, recognizedText=${result.text ?? ''}, similarityScore=${result.similarityScore ?? 'null'}, scriptureReference=${result.scriptureReference ?? 'null'}`,
    );
    return result;
  }

  /**
   * 이미지를 긴 변 IMAGE_MAX_DIM 이내로 축소하고 JPEG로 재압축해 base64로 반환한다.
   * 원본이 이미 작으면 확대하지 않는다(withoutEnlargement). EXIF 회전도 보정한다.
   * 손상·비이미지 등으로 실패하면 원본 그대로 전송(안전 폴백) — 판독 자체가 막히지 않게.
   */
  private async downscaleImage(
    image: UploadedImageFile,
  ): Promise<{ data: string; mimeType: string }> {
    try {
      const resized = await sharp(image.buffer)
        .rotate()
        .resize({
          width: IMAGE_MAX_DIM,
          height: IMAGE_MAX_DIM,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: IMAGE_JPEG_QUALITY })
        .toBuffer();
      return { data: resized.toString('base64'), mimeType: 'image/jpeg' };
    } catch (error) {
      this.logger.warn(
        `이미지 다운스케일 실패 — 원본으로 전송: ${String(error)}`,
      );
      return {
        data: image.buffer.toString('base64'),
        mimeType: image.mimetype,
      };
    }
  }

  private parseResult(text: string): HandwritingCheckResult {
    try {
      const parsed = JSON.parse(text) as Partial<HandwritingCheckResult>;
      return {
        isPenHandwriting: parsed.isPenHandwriting === true,
        text: this.parseNullableString(parsed.text),
        similarityScore: this.parseSimilarityScore(parsed.similarityScore),
        scriptureReference: this.parseNullableString(
          parsed.scriptureReference,
        ),
        confidence: this.parseConfidence(parsed.confidence),
        notes: this.parseNullableString(parsed.notes),
      };
    } catch {
      this.logger.warn(`Gemini response was not valid JSON: ${text}`);
      return {
        isPenHandwriting: false,
        text: null,
        similarityScore: null,
        scriptureReference: null,
        confidence: 'low',
        notes: text,
      };
    }
  }

  private parseSimilarityScore(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return Math.min(100, Math.max(0, value));
  }

  private parseNullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseConfidence(value: unknown): HandwritingCheckResult['confidence'] {
    return value === 'medium' || value === 'high' ? value : 'low';
  }
}
