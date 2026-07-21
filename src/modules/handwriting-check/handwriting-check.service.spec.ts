import { ConfigService } from '@nestjs/config';
import { HandwritingCheckService } from './handwriting-check.service';
import type { UploadedImageFile } from './handwriting-check.types';
import type { Env } from '../../config/env.validation';

describe('HandwritingCheckService', () => {
  const image: UploadedImageFile = {
    buffer: Buffer.from('image-bytes'),
    mimetype: 'image/jpeg',
    originalname: 'sample.jpg',
    size: 11,
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') {
        return 'test-api-key';
      }
      if (key === 'GEMINI_MODEL') {
        return 'gemini-test-model';
      }
      if (key === 'GEMINI_THINKING_BUDGET') {
        return 0;
      }
      if (key === 'GEMINI_MAX_OUTPUT_TOKENS') {
        return 512;
      }
      if (key === 'GEMINI_TIMEOUT_MS') {
        return 30000;
      }
      return undefined;
    }),
  } as unknown as ConfigService<Env, true>;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function mockGeminiText(text?: string) {
    return jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates:
            text === undefined
              ? []
              : [
                  {
                    content: {
                      parts: [{ text }],
                    },
                  },
                ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  function requestBody(fetchMock: jest.SpyInstance): Record<string, unknown> {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<
      string,
      unknown
    >;
  }

  it('returns recognized text, llm similarity score, and scripture reference', async () => {
    const fetchMock = mockGeminiText(
      JSON.stringify({
        isPenHandwriting: true,
        text: 'Keep thy heart with all diligence.',
        similarityScore: 97.5,
        scriptureReference: '잠언 4:23',
        confidence: 'high',
        notes: null,
      }),
    );

    const service = new HandwritingCheckService(config);
    const result = await service.checkAndLog(
      image,
      'Keep thy heart with all diligence.',
    );

    expect(result).toEqual({
      isPenHandwriting: true,
      text: 'Keep thy heart with all diligence.',
      similarityScore: 97.5,
      scriptureReference: '잠언 4:23',
      confidence: 'high',
      notes: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('gemini-test-model');
  });

  it('keeps scripture reference separate from the body transcription contract', async () => {
    const fetchMock = mockGeminiText(
      JSON.stringify({
        isPenHandwriting: true,
        text: 'Keep thy heart with all diligence.',
        similarityScore: 99,
        scriptureReference: '잠언 4:23',
        confidence: 'high',
        notes: 'Reference and printed helper text were excluded.',
      }),
    );

    const service = new HandwritingCheckService(config);
    await service.checkAndLog(image, 'Keep thy heart with all diligence.');

    const body = JSON.stringify(requestBody(fetchMock));
    expect(body).toContain('text에는 원문과 비교할 필사 본문만');
    expect(body).toContain('scriptureReference에만');
    expect(body).toContain('번역문/인쇄된 보조 문구는 제외');
  });

  it('clamps invalid score ranges from the llm response', async () => {
    mockGeminiText(
      JSON.stringify({
        isPenHandwriting: true,
        text: 'sample',
        similarityScore: 120,
        scriptureReference: null,
        confidence: 'medium',
        notes: null,
      }),
    );

    const service = new HandwritingCheckService(config);
    const result = await service.checkAndLog(image, 'sample');

    expect(result.similarityScore).toBe(100);
  });

  it('falls back safely when Gemini returns no text part', async () => {
    mockGeminiText(undefined);

    const service = new HandwritingCheckService(config);
    const result = await service.checkAndLog(image, 'sample');

    expect(result).toEqual({
      isPenHandwriting: false,
      text: null,
      similarityScore: null,
      scriptureReference: null,
      confidence: 'low',
      notes: 'Gemini 응답에 판독 결과가 없습니다.',
    });
  });

  it('falls back safely when Gemini returns non-json text', async () => {
    mockGeminiText('This is not JSON.');

    const service = new HandwritingCheckService(config);
    const result = await service.checkAndLog(image, 'sample');

    expect(result).toEqual({
      isPenHandwriting: false,
      text: null,
      similarityScore: null,
      scriptureReference: null,
      confidence: 'low',
      notes: 'This is not JSON.',
    });
  });

  it('normalizes malformed optional fields from Gemini', async () => {
    mockGeminiText(
      JSON.stringify({
        isPenHandwriting: true,
        text: '   ',
        similarityScore: '98',
        scriptureReference: { book: 'Proverbs', chapter: 4, verse: 23 },
        confidence: 'very high',
        notes: [],
      }),
    );

    const service = new HandwritingCheckService(config);
    const result = await service.checkAndLog(image, 'sample');

    expect(result).toEqual({
      isPenHandwriting: true,
      text: null,
      similarityScore: null,
      scriptureReference: null,
      confidence: 'low',
      notes: null,
    });
  });

  it('sends thinking budget, output cap, and response schema in generationConfig', async () => {
    const fetchMock = mockGeminiText(
      JSON.stringify({
        isPenHandwriting: true,
        text: 'sample',
        similarityScore: 90,
        scriptureReference: null,
        confidence: 'high',
        notes: null,
      }),
    );

    const service = new HandwritingCheckService(config);
    await service.checkAndLog(image, 'sample');

    const gen = requestBody(fetchMock).generationConfig as Record<
      string,
      unknown
    >;
    expect(gen.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(gen.maxOutputTokens).toBe(512);
    expect(gen.responseSchema).toBeDefined();
    expect(gen.responseMimeType).toBe('application/json');
  });
});
