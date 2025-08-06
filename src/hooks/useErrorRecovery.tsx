import React, { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isRecoverableError } from '@/utils/errorMessages';

interface RecoveryState {
  hasError: boolean;
  error: Error | null;
  recoveryAttempts: number;
  isRecovering: boolean;
  lastRecoveryTime: number | null;
}

interface RecoveryConfig {
  maxRecoveryAttempts?: number;
  recoveryDelay?: number;
  autoRecovery?: boolean;
  onRecoveryAttempt?: (attempt: number) => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailed?: (error: Error) => void;
}

export function useErrorRecovery(
  recoveryAction: () => Promise<void> | void,
  config: RecoveryConfig = {}
) {
  const {
    maxRecoveryAttempts = 3,
    recoveryDelay = 2000,
    autoRecovery = false,
    onRecoveryAttempt,
    onRecoverySuccess,
    onRecoveryFailed,
  } = config;

  const { toast } = useToast();
  const { isOnline, wasOffline } = useOnlineStatus();
  const [state, setState] = useState<RecoveryState>({
    hasError: false,
    error: null,
    recoveryAttempts: 0,
    isRecovering: false,
    lastRecoveryTime: null,
  });

  const attemptRecovery = useCallback(async () => {
    if (!state.error || state.recoveryAttempts >= maxRecoveryAttempts) {
      return false;
    }

    // Don't attempt recovery if offline
    if (!isOnline) {
      toast({
        title: "Recovery Paused",
        description: "Recovery will resume when you're back online.",
        variant: "default",
      });
      return false;
    }

    setState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1,
    }));

    try {
      onRecoveryAttempt?.(state.recoveryAttempts + 1);
      
      toast({
        title: "Attempting Recovery",
        description: `Trying to recover... (Attempt ${state.recoveryAttempts + 1}/${maxRecoveryAttempts})`,
        variant: "default",
      });

      await recoveryAction();

      // Recovery successful
      setState({
        hasError: false,
        error: null,
        recoveryAttempts: 0,
        isRecovering: false,
        lastRecoveryTime: Date.now(),
      });

      onRecoverySuccess?.();
      
      toast({
        title: "Recovery Successful",
        description: "The issue has been resolved and the app is working normally again.",
        variant: "default",
      });

      return true;
    } catch (error) {
      const err = error as Error;
      
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: err,
      }));

      if (state.recoveryAttempts + 1 >= maxRecoveryAttempts) {
        onRecoveryFailed?.(err);
        
        toast({
          title: "Recovery Failed",
          description: "Unable to recover automatically. Please try refreshing the page or contact support.",
          variant: "destructive",
        });
      } else {
        // Schedule next recovery attempt
        setTimeout(() => {
          if (autoRecovery && isRecoverableError(err)) {
            attemptRecovery();
          }
        }, recoveryDelay);
      }

      return false;
    }
  }, [
    state.error,
    state.recoveryAttempts,
    maxRecoveryAttempts,
    isOnline,
    recoveryAction,
    recoveryDelay,
    autoRecovery,
    onRecoveryAttempt,
    onRecoverySuccess,
    onRecoveryFailed,
    toast,
  ]);

  const reportError = useCallback((error: Error) => {
    console.error('Error reported to recovery system:', error);
    
    setState(prev => ({
      ...prev,
      hasError: true,
      error,
      recoveryAttempts: 0,
    }));

    // Attempt auto-recovery for recoverable errors
    if (autoRecovery && isRecoverableError(error) && isOnline) {
      setTimeout(() => {
        attemptRecovery();
      }, recoveryDelay);
    }
  }, [autoRecovery, isOnline, recoveryDelay, attemptRecovery]);

  const reset = useCallback(() => {
    setState({
      hasError: false,
      error: null,
      recoveryAttempts: 0,
      isRecovering: false,
      lastRecoveryTime: null,
    });
  }, []);

  // Auto-attempt recovery when coming back online
  const handleOnlineRecovery = useCallback(() => {
    if (wasOffline && state.hasError && isRecoverableError(state.error!)) {
      toast({
        title: "Connection Restored",
        description: "Attempting to recover from previous errors...",
        variant: "default",
      });
      
      setTimeout(() => {
        attemptRecovery();
      }, 1000);
    }
  }, [wasOffline, state.hasError, state.error, attemptRecovery, toast]);

  // Trigger online recovery when connection is restored
  React.useEffect(() => {
    if (isOnline && wasOffline) {
      handleOnlineRecovery();
    }
  }, [isOnline, wasOffline, handleOnlineRecovery]);

  return {
    ...state,
    attemptRecovery,
    reportError,
    reset,
    canRecover: state.hasError && 
                 state.recoveryAttempts < maxRecoveryAttempts && 
                 isRecoverableError(state.error!) &&
                 isOnline,
  };
}

export default useErrorRecovery;