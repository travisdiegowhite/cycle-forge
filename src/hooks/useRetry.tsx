import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface RetryConfig {
  maxAttempts?: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  onRetry?: (attempt: number, error: Error) => void;
  onMaxAttemptsReached?: (error: Error) => void;
}

interface RetryState {
  isLoading: boolean;
  attempt: number;
  error: Error | null;
  isRetrying: boolean;
}

export function useRetry<T>(
  asyncFn: () => Promise<T>,
  config: RetryConfig = {}
) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    onRetry,
    onMaxAttemptsReached,
  } = config;

  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();
  const [state, setState] = useState<RetryState>({
    isLoading: false,
    attempt: 0,
    error: null,
    isRetrying: false,
  });

  const calculateDelay = (attempt: number): number => {
    if (backoff === 'exponential') {
      return delay * Math.pow(2, attempt - 1);
    }
    return delay * attempt;
  };

  const execute = useCallback(async (): Promise<T | null> => {
    // Don't retry if offline
    if (!isOnline) {
      toast({
        title: "No Internet Connection",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      throw new Error('No internet connection');
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setState(prev => ({
          ...prev,
          attempt,
          isRetrying: attempt > 1,
        }));

        const result = await asyncFn();
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          isRetrying: false,
          error: null,
        }));

        return result;
      } catch (error) {
        const err = error as Error;
        
        setState(prev => ({
          ...prev,
          error: err,
        }));

        if (attempt < maxAttempts) {
          onRetry?.(attempt, err);
          
          toast({
            title: "Retrying...",
            description: `Attempt ${attempt} failed. Retrying in ${calculateDelay(attempt)}ms...`,
            variant: "default",
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, calculateDelay(attempt)));
        } else {
          // Max attempts reached
          setState(prev => ({
            ...prev,
            isLoading: false,
            isRetrying: false,
          }));

          onMaxAttemptsReached?.(err);
          
          toast({
            title: "Operation Failed",
            description: `Failed after ${maxAttempts} attempts. Please try again later.`,
            variant: "destructive",
          });

          throw err;
        }
      }
    }

    return null;
  }, [asyncFn, maxAttempts, delay, backoff, onRetry, onMaxAttemptsReached, toast]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      attempt: 0,
      error: null,
      isRetrying: false,
    });
  }, []);

  return {
    execute,
    reset,
    ...state,
  };
}

// Higher-order function for creating retry-enabled API calls
export function withRetry<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig = {}
) {
  return async (...args: T): Promise<R> => {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = 'exponential',
    } = config;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const delayMs = backoff === 'exponential' 
            ? delay * Math.pow(2, attempt - 1)
            : delay * attempt;
            
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  };
}

// Specific retry hook for network requests
export function useNetworkRetry() {
  const isOnline = navigator.onLine;
  
  return useRetry(
    () => Promise.resolve(),
    {
      maxAttempts: isOnline ? 3 : 1,
      delay: 1000,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`Network retry attempt ${attempt}:`, error.message);
      },
      onMaxAttemptsReached: (error) => {
        console.error('Network request failed after max attempts:', error);
      },
    }
  );
}