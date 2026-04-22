// Small reusable retry + timeout helpers so every agent doesn't reinvent
// them. Kept dep-free — just AbortController + Promises.

export class TimeoutError extends Error {
  constructor(ms, label) {
    super(`Timed out after ${ms}ms${label ? ` (${label})` : ''}`);
    this.name = 'TimeoutError';
    this.code = 'timeout';
  }
}

export function withTimeout(promiseOrFn, ms, label) {
  const exec = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new TimeoutError(ms, label)), ms);
  });
  return Promise.race([exec, timeout]).finally(() => clearTimeout(timer));
}

// Exponential backoff with jitter. `shouldRetry` defaults to "retry on
// any error except 4xx-looking ones" (a status property less than 500 is
// treated as terminal).
export async function withRetry(fn, {
  retries = 3,
  baseMs = 300,
  maxMs = 5_000,
  shouldRetry = (err) => !(err && typeof err.status === 'number' && err.status >= 400 && err.status < 500),
  onRetry = null,
  label = '',
} = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) break;
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * (backoff / 2));
      const delay = backoff + jitter;
      if (onRetry) onRetry({ attempt: attempt + 1, delay, err, label });
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}
