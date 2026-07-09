import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    '이미지를 분석해 주세요. 펜으로 직접 필사한 손글씨인지 판단하고, 손글씨라면 이미지에 적힌 문구를 최대한 정확히 판독해 주세요. ' +
                    '그리고 판독한 문구가 아래 원문과 의미/글자 기준으로 얼마나 유사한지 0~100 점수로 평가해 주세요. ' +
                    '띄어쓰기와 사소한 문장부호 차이는 약하게 감점하고, 글자 누락/추가/순서 변경/다른 단어는 강하게 감점해 주세요. ' +
                    'text에는 원문과 비교할 필사 본문만 넣고, 성경/경전 구절 출처 표기나 번역문/인쇄된 보조 문구는 제외하세요. ' +
                    '이미지 안이나 원문에서 성경/경전 구절 출처를 알 수 있으면 "잠언 4:23"처럼 한국어 표기로 scriptureReference에만 넣고, 알 수 없으면 null로 두세요. ' +
                    `원문: ${JSON.stringify(originalText)} ` +
                    '반드시 JSON만 반환하세요. 형식: {"isPenHandwriting": boolean, "text": string | null, "similarityScore": number | null, "scriptureReference": string | null, "confidence": "low" | "medium" | "high", "notes": string | null}',
                },
                {
                  inline_data: {
                    mime_type: image.mimetype,
                    data: image.buffer.toString('base64'),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

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
