import { describe, expect, it } from 'vitest';
import { Budget, OutOfBudget } from '../src/budget';

describe('Budget', () => {
  it('per-user shares charge the run budget and stop cleanly at the cap', () => {
    const run = new Budget(40);
    const users = 5;
    const used: number[] = [];
    for (let i = 0; i < users; i++) {
      const share = run.sub(Math.floor(run.left / (users - i)));
      let n = 0;
      try {
        for (;;) {
          share.take();
          n++;
        }
      } catch (e) {
        expect(e).toBeInstanceOf(OutOfBudget);
      }
      used.push(n);
    }
    expect(used).toEqual([8, 8, 8, 8, 8]);
    expect(run.used).toBe(40);
    expect(() => run.take()).toThrow(OutOfBudget);
  });

  it('leftover from a light user flows to the next ones', () => {
    const run = new Budget(40);
    const light = run.sub(Math.floor(run.left / 4));
    light.take(); // used 1 of its 10
    const next = run.sub(Math.floor(run.left / 3));
    expect(next.limit).toBe(13);
  });
});
