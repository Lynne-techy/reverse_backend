import { Test } from '@nestjs/testing';
import { VerseController } from './verse.controller';
import { VerseService } from './verse.service';

describe('VerseController', () => {
  let controller: VerseController;
  const service = {
    getToday: jest.fn(),
    getRecommendations: jest.fn(),
    getRange: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [VerseController],
      providers: [{ provide: VerseService, useValue: service }],
    }).compile();
    controller = moduleRef.get(VerseController);
  });

  it('getToday는 date를 그대로 서비스에 위임한다', async () => {
    const verse = { id: 1 } as never;
    service.getToday.mockResolvedValue(verse);
    await expect(controller.getToday({ date: '2026-07-22' })).resolves.toBe(
      verse,
    );
    expect(service.getToday).toHaveBeenCalledWith('2026-07-22');
  });

  it('getRecommendations는 emotion을 그대로 위임한다', async () => {
    const verses = [{ id: 1 }] as never;
    service.getRecommendations.mockResolvedValue(verses);
    await expect(
      controller.getRecommendations({ emotion: 'joy' }),
    ).resolves.toBe(verses);
    expect(service.getRecommendations).toHaveBeenCalledWith('joy');
  });

  it('getRange는 book/chapter/from/to를 순서대로 위임한다', async () => {
    service.getRange.mockResolvedValue([] as never);
    await controller.getRange({ book: '시편', chapter: 23, from: 1, to: 6 });
    expect(service.getRange).toHaveBeenCalledWith('시편', 23, 1, 6);
  });
});
