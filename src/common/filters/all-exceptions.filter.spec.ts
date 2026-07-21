import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface Body {
  statusCode: number;
  message: string | string[];
  error: string;
}

/** ArgumentsHost 스텁 — response.status().json() 캡처 + request 메타. */
function makeHost() {
  const json = jest.fn<void, [Body]>();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/x', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    // 5xx 로깅은 의도된 동작 — 테스트 출력만 조용히.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('4xx는 클라이언트용 메시지를 그대로 전달한다', () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new BadRequestException('시작 절이 종료 절보다 뒤일 수 없습니다.'),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('시작 절이 종료 절보다 뒤일 수 없습니다.');
  });

  it('검증 실패 메시지 배열도 유지한다', () => {
    const { host, json } = makeHost();
    filter.catch(
      new BadRequestException({
        message: ['emotion must be one of ...'],
        error: 'Bad Request',
      }),
      host,
    );
    expect(json.mock.calls[0][0].message).toEqual([
      'emotion must be one of ...',
    ]);
  });

  it('예상치 못한 예외는 500 일반 메시지로 마스킹한다', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('DB password=secret 연결 실패'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('InternalServerError');
    // 내부 상세가 응답 어디에도 새지 않아야 한다.
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('5xx로 던져진 HttpException도 내부 문구를 감춘다', () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new ServiceUnavailableException('Gemini upstream 502: internal detail'),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('internal detail');
  });
});
