import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { MapPin, Clock, TrendingUp } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StravaRoute {
  id: number;
  name: string;
  description: string;
  distance: number;
  elevation_gain: number;
  type: number;
  sub_type: number;
  created_at: string;
  updated_at: string;
  private: boolean;
  starred: boolean;
  estimated_moving_time: number;
}

interface StravaImportProps {
  onRouteImported: (routeData: any) => void;
}

export const StravaImport: React.FC<StravaImportProps> = ({ onRouteImported }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [routes, setRoutes] = useState<StravaRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const { toast } = useToast();

  // Debug log to see current state
  console.log('StravaImport state:', { isOpen, routesCount: routes.length, loading, hasAccessToken: !!accessToken });

  const connectToStrava = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('strava-auth');
      
      if (error) throw error;

      if (data.authUrl) {
        console.log('🔥 Opening Strava auth window with URL:', data.authUrl);
        // Open Strava auth in new window
        const authWindow = window.open(data.authUrl, 'strava-auth', 'width=600,height=400,scrollbars=yes,resizable=yes');
        
        console.log('🔥 Auth window opened:', !!authWindow);
        console.log('🔥 Auth window location:', authWindow?.location);
        
        if (!authWindow) {
          throw new Error('Failed to open popup window. Please allow popups for this site.');
        }
        
        // Listen for the window to close or receive data
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            console.log('🔥 Auth window closed by user');
            clearInterval(checkClosed);
            setLoading(false);
          }
        }, 1000);

        // Listen for message from auth window
        const messageHandler = (event: MessageEvent) => {
          console.log('🔥 Received message from auth window:', event);
          console.log('🔥 Message data:', event.data);
          console.log('🔥 Message origin:', event.origin);
          console.log('🔥 Window origin:', window.location.origin);
          
          // Skip Lovable platform messages but log them for debugging
          if (event.data && (
            event.data.action === 'seFingerprint' ||
            event.data.type === 'lovable-message' ||
            event.data.lovable ||
            typeof event.data === 'string' && event.data.includes('lovable')
          )) {
            console.log('🔥 Skipping Lovable platform message:', event.data);
            return;
          }
          
          console.log('🔥 Event data type:', event.data?.type);
          console.log('🔥 Event data routes length:', event.data?.routes?.length);
          
          // Accept any message from Strava auth for debugging
          if (event.data && typeof event.data === 'object') {
            console.log('🔥 Processing message with type:', event.data?.type);
            
            if (event.data.type === 'STRAVA_AUTH_SUCCESS') {
              console.log('🔥 Strava auth success detected!');
              clearInterval(checkClosed);
              authWindow?.close();
              
              // The routes data should be in the routes property
              const routesData = event.data.routes || [];
              console.log('🔥 Routes data received:', routesData);
              console.log('🔥 Number of routes:', routesData.length);
              
              setRoutes(routesData);
              setAccessToken(event.data.accessToken || 'strava-token');
              setLoading(false);
              window.removeEventListener('message', messageHandler);
              
              toast({
                title: "Connected to Strava!",
                description: `Found ${routesData.length} routes.`
              });
            } else if (event.data.type === 'STRAVA_AUTH_ERROR') {
              console.log('🔥 Strava auth error detected!');
              clearInterval(checkClosed);
              authWindow?.close();
              setLoading(false);
              window.removeEventListener('message', messageHandler);
              
              toast({
                title: "Connection Failed",
                description: event.data.error,
                variant: "destructive"
              });
            } else {
              console.log('🔥 Unknown message type or structure:', event.data);
              console.log('🔥 Full event data object:', JSON.stringify(event.data, null, 2));
            }
          } else {
            console.log('🔥 Invalid message data:', event.data);
          }
        };

        window.addEventListener('message', messageHandler);
        
        // Test that message handler is set up
        console.log('🔥 Message handler registered, waiting for messages...');
      } else if (data.success && data.routes) {
        // Handle direct response with routes
        setRoutes(data.routes);
        setLoading(false);
        
        toast({
          title: "Connected to Strava!",
          description: `Found ${data.routes.length} routes.`
        });
      }
    } catch (error) {
      console.error('Strava connection error:', error);
      setLoading(false);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Strava",
        variant: "destructive"
      });
    }
  };

  const importRoute = async (route: StravaRoute) => {
    try {
      console.log('Importing route:', route.name);
      
      // Pass the full route data including the map polyline
      onRouteImported(route);
      
      toast({
        title: "Route Imported",
        description: `Successfully imported "${route.name}" from Strava`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Error importing route:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import route from Strava",
        variant: "destructive",
      });
    }
  };

  const formatDistance = (distance: number) => {
    return `${(distance / 1000).toFixed(1)} km`;
  };

  const formatElevation = (elevation: number) => {
    return `${Math.round(elevation)} m`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Import from Strava
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Route from Strava</DialogTitle>
        </DialogHeader>
        
        {routes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Connect your Strava account to import your saved routes.
            </p>
            <Button onClick={connectToStrava} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect to Strava'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Found {routes.length} routes
              </p>
              <Button variant="outline" size="sm" onClick={() => {
                setRoutes([]);
                setAccessToken('');
                setIsOpen(false);
              }}>
                Disconnect
              </Button>
            </div>
            
            <div className="grid gap-3">
              {routes.map((route) => (
                <Card key={route.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">{route.name}</h3>
                        {route.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {route.description}
                          </p>
                        )}
                        
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {formatDistance(route.distance)}
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {formatElevation(route.elevation_gain)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(route.estimated_moving_time)}
                          </div>
                        </div>
                        
                        <div className="flex gap-1 mt-2">
                          {route.starred && (
                            <Badge variant="secondary" className="text-xs">
                              ⭐ Starred
                            </Badge>
                          )}
                          {route.private && (
                            <Badge variant="outline" className="text-xs">
                              Private
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => importRoute(route)}
                        disabled={loading}
                      >
                        Import
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};