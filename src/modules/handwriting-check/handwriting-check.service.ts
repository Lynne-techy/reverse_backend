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

  async checkAndLog(image: UploadedImageFile): Promise<HandwritingCheckResult> {
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
                    '이 이미지를 분석해 주세요. 펜으로 직접 필사한 손글씨인지 판단하고, 손글씨라면 이미지에 적힌 문구를 최대한 정확히 판독해 주세요. ' +
                    '반드시 JSON만 반환하세요. 형식: {"isPenHandwriting": boolean, "text": string | null, "confidence": "low" | "medium" | "high", "notes": string | null}',
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
        confidence: 'low',
        notes: 'Gemini 응답에 판독 결과가 없습니다.',
      };
    }

    const result = this.parseResult(text);
    this.logger.log(
      `Handwriting debug result: file=${image.originalname}, isPenHandwriting=${result.isPenHandwriting}, text=${result.text ?? ''}`,
    );
    return result;
  }

  private parseResult(text: string): HandwritingCheckResult {
    try {
      const parsed = JSON.parse(text) as Partial<HandwritingCheckResult>;
      return {
        isPenHandwriting: parsed.isPenHandwriting === true,
        text: typeof parsed.text === 'string' ? parsed.text : null,
        confidence: this.parseConfidence(parsed.confidence),
        notes: typeof parsed.notes === 'string' ? parsed.notes : null,
      };
    } catch {
      this.logger.warn(`Gemini response was not valid JSON: ${text}`);
      return {
        isPenHandwriting: false,
        text: null,
        confidence: 'low',
        notes: text,
      };
    }
  }

  private parseConfidence(value: unknown): HandwritingCheckResult['confidence'] {
    return value === 'medium' || value === 'high' ? value : 'low';
  }
}
