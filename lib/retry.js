/**
 * Retry utilities with exponential backoff for Google Classroom API
 */

import { GoogleApis } from 'googleapis';

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error (429)
 */
export function isRateLimitError(error) {
  if (!error) return false;
  
  // Google API errors
  if (error.code === 429 || error.status === 429) return true;
  if (error.errors?.some(e => e.reason === 'rateLimitExceeded' || e.reason === 'userRateLimitExceeded')) return true;
  
  // Axios/fetch style errors
  if (error.response?.status === 429) return true;
  
  // Error message patterns
  const msg = error.message || error.toString();
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('Rate limit') || msg.includes('quota')) {
    return true;
  }
  
  return false;
}

/**
 * Check if an error is retryable (network errors, 5xx, rate limits)
 */
export function isRetryableError(error) {
  if (!error) return false;
  
  // Rate limits are always retryable
  if (isRateLimitError(error)) return true;
  
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') return true;
  if (error.message?.includes('network') || error.message?.includes('timeout') || error.message?.includes('socket')) return true;
  
  // 5xx server errors
  if (error.code >= 500 && error.code < 600) return true;
  if (error.status >= 500 && error.status < 600) return true;
  if (error.response?.status >= 500 && error.response?.status < 600) return true;
  
  return false;
}

/**
 * Exponential backoff retry wrapper
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Base delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay in ms (default: 30000)
 * @param {Function} options.onRetry - Callback on each retry (attempt, error, delay)
 * @returns {Promise<any>} Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry = null,
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) break;
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error; // Non-retryable, throw immediately
      }
      
      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );
      
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }
      
      console.warn(`[Retry ${attempt + 1}/${maxRetries}] Retrying after ${Math.round(delay)}ms due to:`, error.message);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Wrapper for Google Classroom API calls that handles pagination and retries
 */
export async function withClassroomRetry(classroom, methodName, params = {}, options = {}) {
  return withRetry(async () => {
    const method = classroom[methodName];
    if (!method) throw new Error(`Method ${methodName} not found on classroom client`);
    
    // Handle paginated responses
    let allResults = [];
    let pageToken = null;
    const maxPages = options.maxPages || 10;
    
    for (let page = 0; page < maxPages; page++) {
      const requestParams = { ...params };
      if (pageToken) requestParams.pageToken = pageToken;
      
      const response = await method(requestParams);
      const data = response.data;
      
      // Extract items from response (varies by API)
      const items = data.courses || data.courseWork || data.studentSubmissions || data.userProfiles || [];
      allResults.push(...items);
      
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    
    return allResults;
  }, {
    maxRetries: options.maxRetries ?? 3,
    baseDelayMs: options.baseDelayMs ?? 2000, // Start at 2s for Classroom API
    maxDelayMs: options.maxDelayMs ?? 60000,
    onRetry: (attempt, error, delay) => {
      console.warn(`[Classroom API Retry ${attempt}] ${methodName}: ${error.message} (waiting ${Math.round(delay)}ms)`);
      if (options.onProgress) {
        options.onProgress({ type: 'retry', attempt, error: error.message, delay });
      }
    },
  });
}

/**
 * Create a Classroom client with built-in retry logic
 */
export function createRetryableClassroomClient(accessToken, onProgress = null) {
  const { google } = require('googleapis');
  const classroom = google.classroom({ version: 'v1', auth: accessToken });
  
  // Wrap methods with retry logic
  const methodsToWrap = [
    'courses.list',
    'courses.get',
    'courses.courseWork.list',
    'courses.courseWork.get',
    'courses.courseWork.studentSubmissions.list',
    'courses.courseWork.studentSubmissions.get',
    'courses.courseWork.studentSubmissions.patch',
    'courses.courseWork.studentSubmissions.return',
    'courses.courseWork.studentSubmissions.addPrivateComment',
    'userProfiles.get',
  ];
  
  const wrapped = { ...classroom };
  
  for (const methodPath of methodsToWrap) {
    const parts = methodPath.split('.');
    let obj = wrapped;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]] = obj[parts[i]] || {};
    }
    const methodName = parts[parts.length - 1];
    const originalMethod = obj[methodName];
    
    obj[methodName] = async (params = {}) => {
      return withRetry(async () => originalMethod(params), {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 60000,
        onRetry: (attempt, error, delay) => {
          console.warn(`[Classroom ${methodPath} Retry ${attempt}] ${error.message} (waiting ${Math.round(delay)}ms)`);
          if (onProgress) {
            onProgress({ type: 'retry', method: methodPath, attempt, error: error.message, delay });
          }
        },
      });
    };
  }
  
  return wrapped;
}

export default {
  sleep,
  isRateLimitError,
  isRetryableError,
  withRetry,
  withClassroomRetry,
  createRetryableClassroomClient,
};