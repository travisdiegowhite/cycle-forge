import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  isReconnecting: boolean;
}

export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
    isReconnecting: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Back online');
      
      if (status.wasOffline) {
        setStatus(prev => ({ ...prev, isReconnecting: true }));
        
        // Brief reconnection period
        setTimeout(() => {
          setStatus({
            isOnline: true,
            wasOffline: false,
            isReconnecting: false,
          });
          
          toast({
            title: "Connection Restored",
            description: "You're back online. The app will automatically retry failed requests.",
            variant: "default",
          });
        }, 1000);
      } else {
        setStatus(prev => ({ ...prev, isOnline: true }));
      }
    };

    const handleOffline = () => {
      console.log('Network: Gone offline');
      setStatus({
        isOnline: false,
        wasOffline: true,
        isReconnecting: false,
      });
      
      toast({
        title: "Connection Lost",
        description: "You're currently offline. Some features may not work until you reconnect.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status.wasOffline, toast]);

  return status;
}

export default useOnlineStatus;