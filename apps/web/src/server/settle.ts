import type { Prefill } from '~/prefill';

/**
 * Runs `work` and never rejects: past `timeoutMs`, or on any error, it resolves to `RETRY` so the
 * page can offer a retry. `work` itself isn't cancelled; a later call picks up its result.
 */
export async function settle(
  work: () => Promise<Prefill>,
  timeoutMs: number,
  onError: (error: unknown) => void,
): Promise<Prefill> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Prefill>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({ status: 'RETRY', message: 'Reading your DSN is taking longer than expected.' }),
      timeoutMs,
    );
  });

  return Promise.race([work(), timeout])
    .catch((error: unknown): Prefill => {
      onError(error);
      return { status: 'RETRY', message: 'Something went wrong while reading your DSN.' };
    })
    .finally(() => clearTimeout(timer));
}
