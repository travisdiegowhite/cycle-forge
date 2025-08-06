import React from 'react';
import { WifiOff, Wifi, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  showAlert?: boolean;
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showAlert = true,
  className,
}) => {
  const { isOnline, isReconnecting } = useOnlineStatus();

  if (isOnline && !isReconnecting) {
    return null;
  }

  if (showAlert) {
    return (
      <Alert className={cn('border-destructive', className)}>
        <div className="flex items-center gap-2">
          {isReconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <AlertDescription>
            {isReconnecting
              ? 'Reconnecting to the internet...'
              : 'You are currently offline. Some features may not work until you reconnect.'}
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  // Compact indicator for use in headers/navbars
  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {isReconnecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
          <span className="text-yellow-600">Reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-destructive">Offline</span>
        </>
      )}
    </div>
  );
};

// Online status indicator component
export const OnlineStatusIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline, isReconnecting } = useOnlineStatus();

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {isReconnecting ? (
        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
      ) : isOnline ? (
        <Wifi className="h-3 w-3 text-green-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-destructive" />
      )}
    </div>
  );
};

export default OfflineIndicator;