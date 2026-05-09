/**
 * Backend error classification + lightweight retry helper.
 *
 * Used by page-load reads (notifications, friend requests, credits, bonuses)
 * to suppress noisy console errors for expected/transient failures and to
 * gate `reportConnectionFailure()` so a single read miss does not inflate
 * the connection-recovery banner counter.
 *
 * See mem://constraints/observability/backend-error-noise-policy.
 */

export type BackendErrorKind = 'transient' | 'auth' | 'rls' | 'unexpected';

export interface BackendErrorClass {
  kind: BackendErrorKind;
  /** true → emit console.warn (handled but worth noticing) */
  shouldLog: boolean;
  /** true → emit console.error and notify connection-recovery banner */
  shouldEscalate: boolean;
}

interface AnyErrorLike {
  name?: string;
  message?: string;
  code?: string | number;
  status?: number;
  statusCode?: number;
  context?: { status?: number };
}

function pick(err: unknown): AnyErrorLike {
  if (err && typeof err === 'object') return err as AnyErrorLike;
  return { message: String(err ?? '') };
}

export function classifyBackendError(err: unknown): BackendErrorClass {
  const e = pick(err);
  const name = String(e.name ?? '');
  const msg = String(e.message ?? '').toLowerCase();
  const code = e.code != null ? String(e.code) : '';
  const status = Number(e.status ?? e.statusCode ?? e.context?.status ?? 0);

  // Transient network / function fetch / 5xx
  if (
    name === 'FunctionsFetchError' ||
    name === 'TypeError' && msg.includes('failed to fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    status === 0 || status === 502 || status === 503 || status === 504
  ) {
    return { kind: 'transient', shouldLog: true, shouldEscalate: false };
  }

  // Auth — handled by AuthContext; stay silent here
  if (
    status === 401 ||
    msg.includes('jwt expired') ||
    msg.includes('auth session missing') ||
    msg.includes('not authenticated') ||
    code === '401'
  ) {
    return { kind: 'auth', shouldLog: false, shouldEscalate: false };
  }

  // RLS / Postgres permission — expected for anon / wrong-user reads
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST116' || status === 403) {
    return { kind: 'rls', shouldLog: false, shouldEscalate: false };
  }

  return { kind: 'unexpected', shouldLog: true, shouldEscalate: true };
}

export interface RetryOptions {
  tries?: number;       // total attempts (including first), default 2
  delayMs?: number;     // base backoff between attempts, default 400
  /** Only retry when classification matches one of these kinds. Default: ['transient']. */
  retryOn?: BackendErrorKind[];
}

/**
 * Run `fn`; on a retryable failure (per `classifyBackendError`), wait and try again.
 * Always rethrows the last error so the caller can apply its own fallback.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const tries = Math.max(1, opts.tries ?? 2);
  const delayMs = opts.delayMs ?? 400;
  const retryOn = opts.retryOn ?? ['transient'];
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= tries) break;
      const cls = classifyBackendError(err);
      if (!retryOn.includes(cls.kind)) break;
      await new Promise(res => setTimeout(res, delayMs * attempt));
    }
  }
  throw lastErr;
}

/**
 * Convenience: log a backend error per its classification. Returns the classification.
 * - transient/unexpected → console.warn / console.error with a stable prefix
 * - auth/rls → silent
 */
export function logBackendError(prefix: string, err: unknown): BackendErrorClass {
  const cls = classifyBackendError(err);
  if (cls.shouldEscalate) {
    // eslint-disable-next-line no-console
    console.error(prefix, err);
  } else if (cls.shouldLog) {
    // eslint-disable-next-line no-console
    console.warn(prefix, err);
  }
  return cls;
}
