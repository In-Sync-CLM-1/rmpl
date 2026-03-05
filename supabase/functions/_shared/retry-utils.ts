/**
 * Reusable retry utility with exponential backoff
 * Handles transient failures in API calls and database operations
 */

/**
 * Delay execution for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param maxAttempts - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000ms)
 * @param exponentialBase - Base for exponential backoff calculation (default: 2)
 * @param shouldRetry - Optional callback to determine if error is retryable
 * @returns The result of the successful function call
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000,
  exponentialBase: number = 2,
  shouldRetry?: (error: any) => boolean
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        console.log(`Error is not retryable, failing immediately:`, error.message);
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        console.error(`All ${maxAttempts} retry attempts exhausted`, error);
        throw error;
      }
      
      // Calculate backoff delay with exponential increase
      const delayMs = initialDelayMs * Math.pow(exponentialBase, attempt - 1);
      
      console.log(
        `Attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
        `Retrying in ${delayMs}ms...`
      );
      
      await delay(delayMs);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Check if an error is retryable based on common patterns
 * @param error - The error object to check
 * @returns true if the error should be retried
 */
export function isRetryableError(error: any): boolean {
  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }
  
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  // Common error messages that indicate transient failures
  const retryableMessages = [
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'network',
    'fetch failed',
    'rate limit',
    'too many requests',
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  if (retryableMessages.some(msg => errorMessage.includes(msg))) {
    return true;
  }
  
  return false;
}

/**
 * Retry function specifically for Supabase database operations
 */
export async function retrySupabaseOperation<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 500
): Promise<T> {
  return retryWithBackoff(
    fn,
    maxAttempts,
    initialDelayMs,
    2,
    isRetryableError
  );
}

/**
 * Retry function specifically for external API calls (like Resend)
 */
export async function retryApiCall<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  return retryWithBackoff(
    fn,
    maxAttempts,
    initialDelayMs,
    2,
    (error) => {
      // Always retry rate limits
      if (error.statusCode === 429 || error.status === 429) {
        return true;
      }
      // Check general retryable errors
      return isRetryableError(error);
    }
  );
}
