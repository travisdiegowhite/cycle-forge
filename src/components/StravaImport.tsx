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
      
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { app_origin: window.location.origin }
      });
      
      if (error) {
        console.error('Error invoking Strava auth:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to Strava. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const authUrl = data?.authUrl;
      if (!authUrl) {
        console.error('No auth URL received:', data);
        toast({
          title: "Configuration Error", 
          description: "Strava authentication is not properly configured.",
          variant: "destructive",
        });
        return;
      }

      // Direct redirect to Strava auth (no popup)
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast({
        title: "Connection Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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