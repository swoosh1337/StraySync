import { useState, useCallback } from 'react';

interface UseLoadingReturn {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: <T>(promiseOrFn: Promise<T> | (() => Promise<T>)) => Promise<T>;
}

/**
 * Custom hook to handle loading states
 * @returns Object with loading state and methods to control it
 */
export const useLoading = (): UseLoadingReturn => {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  /**
   * Executes a promise while handling the loading state
   * @param promiseOrFn The promise or function returning a promise to execute
   * @returns The result of the promise
   */
  const withLoading = useCallback(async <T>(promiseOrFn: Promise<T> | (() => Promise<T>)): Promise<T> => {
    try {
      setIsLoading(true);
      
      // Handle both promise and function that returns promise
      const result = typeof promiseOrFn === 'function' 
        ? await (promiseOrFn as () => Promise<T>)() 
        : await promiseOrFn;
        
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
  };
}; 