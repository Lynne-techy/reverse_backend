import { ConcurrencyLimiter } from './concurrency-limiter';

/** resolve를 외부에서 호출할 수 있는 지연 프로미스. 실행 타이밍 제어용. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ConcurrencyLimiter', () => {
  it('max는 1 이상의 정수여야 한다', () => {
    expect(() => new ConcurrencyLimiter(0)).toThrow();
    expect(() => new ConcurrencyLimiter(-1)).toThrow();
    expect(() => new ConcurrencyLimiter(1.5)).toThrow();
    expect(() => new ConcurrencyLimiter(2)).not.toThrow();
  });

  it('동시 실행 수가 max를 넘지 않는다', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred());

    const tasks = gates.map((gate, i) =>
      limiter.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await gate.promise;
        running--;
        return i;
      }),
    );

    // 처음엔 2개만 실행되고 나머지는 대기해야 한다.
    await Promise.resolve();
    expect(limiter.activeCount).toBe(2);
    expect(limiter.pending).toBe(3);

    // 게이트를 하나씩 열어 전부 완료시킨다.
    gates.forEach((gate) => gate.resolve());
    const results = await Promise.all(tasks);

    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(limiter.activeCount).toBe(0);
    expect(limiter.pending).toBe(0);
  });

  it('작업이 실패해도 슬롯을 반납해 다음 작업이 진행된다', async () => {
    const limiter = new ConcurrencyLimiter(1);

    await expect(
      limiter.run(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    // 슬롯이 반납됐다면 다음 작업이 정상 실행된다.
    await expect(limiter.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(limiter.activeCount).toBe(0);
  });

  it('max=1이면 작업이 직렬로 실행된다', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const order: number[] = [];
    const run = (n: number) =>
      limiter.run(async () => {
        order.push(n);
        await Promise.resolve();
      });

    await Promise.all([run(1), run(2), run(3)]);
    expect(order).toEqual([1, 2, 3]);
  });
});
