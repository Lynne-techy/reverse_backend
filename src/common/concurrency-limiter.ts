/**
 * 동시에 실행되는 비동기 작업 수를 max 개로 제한하는 경량 세마포어.
 * 한도를 넘는 작업은 큐에 쌓였다가 슬롯이 나면 순서대로 실행된다.
 *
 * 외부 의존성 없이 인프로세스에서 동작 — ADR 6.11의 인프로세스 백그라운드 잡이
 * 업로드 폭주 시 메모리를 무제한으로 점유하는 것을 막는 용도(2GB VM 보호).
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) {
      throw new Error(`ConcurrencyLimiter max는 1 이상의 정수여야 합니다: ${max}`);
    }
  }

  /** 슬롯이 날 때까지 기다렸다가 task를 실행하고, 끝나면(성공/실패 무관) 슬롯을 반납한다. */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  /** 현재 실행 중인 작업 수. */
  get activeCount(): number {
    return this.active;
  }

  /** 슬롯을 기다리며 큐에 쌓인 작업 수(백프레셔 관측용). */
  get pending(): number {
    return this.waiters.length;
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }
}
