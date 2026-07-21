import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetRecommendationsQueryDto } from './get-recommendations.dto';

/**
 * 추천 조회 감정 allowlist(@IsIn) 검증. 이 DTO 는 임의 문자열이 서비스/DB 로
 * 흘러드는 것을 막는 첫 방어선이므로 명시적으로 테스트한다.
 */
describe('GetRecommendationsQueryDto', () => {
  it('유효한 감정 코드는 통과한다', async () => {
    const dto = plainToInstance(GetRecommendationsQueryDto, {
      emotion: 'depression',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('허용 목록에 없는 감정은 isIn 에러로 거부한다', async () => {
    const dto = plainToInstance(GetRecommendationsQueryDto, {
      emotion: 'rage',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('emotion 누락도 거부한다', async () => {
    const dto = plainToInstance(GetRecommendationsQueryDto, {});
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
