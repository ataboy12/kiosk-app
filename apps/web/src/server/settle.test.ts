import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prefill } from '~/prefill';
import { settle } from './settle';

const FAILED: Prefill = { status: 'FAILED', message: 'Not a DSN.' };

describe('settle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the result of work that finishes in time, and clears the timer', async () => {
    await expect(settle(() => Promise.resolve(FAILED), 1000, vi.fn())).resolves.toEqual(FAILED);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves to RETRY when the work takes too long', async () => {
    const result = settle(() => new Promise<Prefill>(() => {}), 1000, vi.fn());
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toMatchObject({
      status: 'RETRY',
      message: expect.stringContaining('longer than expected'),
    });
  });

  it('resolves to RETRY and reports the error when the work fails', async () => {
    const onError = vi.fn();
    const error = new Error('database down');
    await expect(settle(() => Promise.reject(error), 1000, onError)).resolves.toMatchObject({
      status: 'RETRY',
      message: expect.stringContaining('went wrong'),
    });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('ignores a failure that happens after the timeout', async () => {
    const onError = vi.fn();
    let fail: (error: Error) => void = () => {};
    const result = settle(
      () => new Promise<Prefill>((_, reject) => (fail = reject)),
      1000,
      onError,
    );
    await vi.advanceTimersByTimeAsync(1000);
    fail(new Error('late'));
    await expect(result).resolves.toMatchObject({ status: 'RETRY' });
    expect(onError).not.toHaveBeenCalled();
  });
});
