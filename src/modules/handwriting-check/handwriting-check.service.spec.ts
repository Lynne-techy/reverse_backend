import { ConfigService } from '@nestjs/config';
import { HandwritingCheckService } from './handwriting-check.service';
import type { UploadedImageFile } from './handwriting-check.types';

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
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns recognized text, llm similarity score, and scripture reference', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      isPenHandwriting: true,
                      text: 'Keep thy heart with all diligence.',
                      similarityScore: 97.5,
                      scriptureReference: '잠언 4:23',
                      confidence: 'high',
                      notes: null,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
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
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).toContain(
      'scriptureReference',
    );
  });

  it('clamps invalid score ranges from the llm response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      isPenHandwriting: true,
                      text: 'sample',
                      similarityScore: 120,
                      scriptureReference: null,
                      confidence: 'medium',
                      notes: null,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const service = new HandwritingCheckService(config);
    const result = await service.checkAndLog(image, 'sample');

    expect(result.similarityScore).toBe(100);
  });
});
