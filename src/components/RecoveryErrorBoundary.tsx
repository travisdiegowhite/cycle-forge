import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { AlertTriangle, RefreshCw, Home, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { getUserFriendlyError, isRecoverableError } from '@/utils/errorMessages';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  autoRecovery?: boolean;
  onRecoveryAttempt?: () => Promise<void>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
  recoveryAttempts: number;
  lastRecoveryTime: number | null;
}

export class RecoveryErrorBoundary extends Component<Props, State> {
  private maxRecoveryAttempts = 3;
  private recoveryDelay = 2000;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoveryAttempts: 0,
      lastRecoveryTime: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Recovery Error Boundary caught an error:', error, errorInfo);
    }

    // Attempt auto-recovery for recoverable errors
    if (this.props.autoRecovery && isRecoverableError(error)) {
      this.scheduleRecovery();
    }
  }

  scheduleRecovery = () => {
    if (this.state.recoveryAttempts >= this.maxRecoveryAttempts) {
      return;
    }

    setTimeout(() => {
      this.attemptRecovery();
    }, this.recoveryDelay);
  };

  attemptRecovery = async () => {
    if (this.state.recoveryAttempts >= this.maxRecoveryAttempts) {
      return;
    }

    this.setState(prev => ({
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1,
    }));

    try {
      // Call custom recovery function if provided
      if (this.props.onRecoveryAttempt) {
        await this.props.onRecoveryAttempt();
      }

      // Wait a bit to ensure recovery is complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false,
        lastRecoveryTime: Date.now(),
      });
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      
      this.setState(prev => ({
        isRecovering: false,
        error: recoveryError as Error,
      }));

      // Schedule next recovery attempt if we haven't reached the max
      if (this.state.recoveryAttempts < this.maxRecoveryAttempts) {
        this.scheduleRecovery();
      }
    }
  };

  handleManualRecovery = () => {
    this.attemptRecovery();
  };

  handleGoHome = () => {
    // Reset error state and navigate to home
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoveryAttempts: 0,
      lastRecoveryTime: null,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { title, description, action } = getUserFriendlyError(this.state.error!);
      const canRecover = isRecoverableError(this.state.error!) && 
                        this.state.recoveryAttempts < this.maxRecoveryAttempts;

      // Default error UI with recovery
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background/95 to-background/90">
          <Card className="max-w-2xl w-full p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-4">
              {title}
            </h1>

            <p className="text-muted-foreground mb-6">
              {description}
            </p>

            {/* Recovery Status */}
            {this.state.isRecovering && (
              <Alert className="mb-6">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertTitle>Attempting Recovery</AlertTitle>
                <AlertDescription>
                  Please wait while we try to fix the issue automatically...
                  (Attempt {this.state.recoveryAttempts} of {this.maxRecoveryAttempts})
                </AlertDescription>
              </Alert>
            )}

            {/* Auto-recovery info */}
            {canRecover && this.props.autoRecovery && !this.state.isRecovering && (
              <Alert className="mb-6">
                <Zap className="h-4 w-4" />
                <AlertTitle>Auto-Recovery Available</AlertTitle>
                <AlertDescription>
                  This error appears to be recoverable. The system will automatically attempt to fix it,
                  or you can try manual recovery below.
                </AlertDescription>
              </Alert>
            )}

            {this.props.showDetails && this.state.error && (
              <Alert className="mb-6 text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">
                      Click to view technical details
                    </summary>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm font-mono">
                      <div className="mb-2">
                        <strong>Error:</strong> {this.state.error.message}
                      </div>
                      <div className="mb-2">
                        <strong>Recovery Attempts:</strong> {this.state.recoveryAttempts}/{this.maxRecoveryAttempts}
                      </div>
                      <div className="mb-2">
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap text-xs mt-1">
                          {this.state.error.stack}
                        </pre>
                      </div>
                      {this.state.errorInfo && (
                        <div>
                          <strong>Component Stack:</strong>
                          <pre className="whitespace-pre-wrap text-xs mt-1">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {canRecover && (
                <Button
                  onClick={this.handleManualRecovery}
                  disabled={this.state.isRecovering}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${this.state.isRecovering ? 'animate-spin' : ''}`} />
                  {this.state.isRecovering ? 'Recovering...' : action || 'Try Recovery'}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Home
              </Button>

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </Button>
            </div>

            {this.state.recoveryAttempts >= this.maxRecoveryAttempts && (
              <p className="text-sm text-muted-foreground mt-4">
                Maximum recovery attempts reached. Please try reloading the page or contact support if the problem persists.
              </p>
            )}

            {this.state.lastRecoveryTime && (
              <p className="text-sm text-green-600 mt-4">
                Last successful recovery: {new Date(this.state.lastRecoveryTime).toLocaleTimeString()}
              </p>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RecoveryErrorBoundary;