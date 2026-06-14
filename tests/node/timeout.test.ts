import { describe, expect, it } from 'vitest';

import { TimeoutError, isTimeoutError, withTimeout } from '../../src/node/timeout.js';

describe('withTimeout', () => {
  it('resolves with the producer value when within budget', async () => {
    const value = await withTimeout(() => Promise.resolve(42), { limitMs: 100 });
    expect(value).toBe(42);
  });

  it('rejects with TimeoutError when the producer exceeds the budget', async () => {
    const slow = () => new Promise<number>((r) => setTimeout(() => r(1), 200));
    await expect(
      withTimeout(slow, { limitMs: 30, location: 'icon.svg' }),
    ).rejects.toMatchObject({ name: 'TimeoutError', limitMs: 30, location: 'icon.svg' });
  });

  it('propagates synchronous producer errors as-is (not wrapped)', async () => {
    await expect(
      withTimeout(() => Promise.reject(new Error('boom')), { limitMs: 50 }),
    ).rejects.toThrow('boom');
  });

  it('isTimeoutError narrows correctly', async () => {
    try {
      await withTimeout(
        () => new Promise<number>((r) => setTimeout(() => r(1), 100)),
        { limitMs: 10 },
      );
      expect.fail('should have timed out');
    } catch (error) {
      expect(isTimeoutError(error)).toBe(true);
      expect(error).toBeInstanceOf(TimeoutError);
    }
  });
});
