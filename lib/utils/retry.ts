/**
 * Utility for retrying failed operations with exponential backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 * @param fn The async function to retry
 * @param options Retry configuration
 * @returns The result of the function if successful
 * @throws The last error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === opts.maxAttempts) {
        // Last attempt failed
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );
      
      // Call the retry callback
      opts.onRetry(lastError, attempt);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Retry a function with a fallback value if all attempts fail
 * @param fn The async function to retry
 * @param fallback The fallback value or function to use if all retries fail
 * @param options Retry configuration
 * @returns The result of the function if successful, otherwise the fallback
 */
export async function withRetryOrFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T | Promise<T>),
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await withRetry(fn, options);
  } catch (error) {
    console.error('All retry attempts failed, using fallback:', error);
    
    if (typeof fallback === 'function') {
      return await (fallback as () => T | Promise<T>)();
    }
    
    return fallback;
  }
}

/**
 * Wrap a function to automatically retry on failure
 * @param fn The async function to wrap
 * @param options Retry configuration
 * @returns A wrapped version of the function that retries on failure
 */
export function retryable<Args extends any[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: RetryOptions = {}
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    return withRetry(() => fn(...args), options);
  };
}
