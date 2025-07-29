import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './ui/use-toast';
import { Activity, MapPin, Clock, Mountain } from 'lucide-react';

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  start_date: string;
  map: {
    polyline: string;
    summary_polyline: string;
  };
}

interface StravaImportProps {
  onRouteImported: (routeData: any) => void;
}

export function StravaImport({ onRouteImported }: StravaImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for Strava auth code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      exchangeStravaToken(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const connectStrava = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { action: 'getAuthUrl' }
      });

      if (error) throw error;

      // Redirect to Strava authorization
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Strava. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exchangeStravaToken = async (code: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { action: 'exchangeToken', code }
      });

      if (error) throw error;

      setAccessToken(data.access_token);
      await fetchActivities(data.access_token);
      
      toast({
        title: "Connected to Strava",
        description: `Welcome, ${data.athlete.firstname}! Loading your activities...`
      });
    } catch (error) {
      console.error('Error exchanging token:', error);
      toast({
        title: "Authentication Failed",
        description: "Failed to authenticate with Strava. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { action: 'getActivities', accessToken: token }
      });

      if (error) throw error;

      setActivities(data.activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: "Failed to Load Activities",
        description: "Could not load your Strava activities. Please try again.",
        variant: "destructive"
      });
    }
  };

  const importActivity = async (activity: StravaActivity) => {
    try {
      setLoading(true);
      
      // Get detailed activity data including full polyline
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { 
          action: 'getActivityDetails', 
          accessToken: accessToken,
          activityId: activity.id 
        }
      });

      if (error) throw error;

      const detailedActivity = data.activity;
      
      // Convert Strava activity to our route format
      const routeData = {
        name: activity.name,
        waypoints: [], // Strava doesn't provide waypoints, just the route
        route_geometry: {
          polyline: detailedActivity.map?.polyline || activity.map?.polyline,
          summary_polyline: activity.map?.summary_polyline
        },
        route_stats: {
          distance: activity.distance,
          duration: activity.moving_time,
          elevation_gain: activity.total_elevation_gain,
          imported_from: 'strava',
          strava_activity_id: activity.id
        }
      };

      onRouteImported(routeData);
      setIsOpen(false);
      
      toast({
        title: "Route Imported",
        description: `"${activity.name}" has been imported from Strava.`
      });
    } catch (error) {
      console.error('Error importing activity:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import the activity. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters: number) => {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(1)} mi`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatElevation = (meters: number) => {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Activity className="w-4 h-4 mr-2" />
          Import from Strava
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Routes from Strava</DialogTitle>
        </DialogHeader>
        
        {!accessToken ? (
          <div className="text-center py-8">
            <Activity className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Connect to Strava</h3>
            <p className="text-muted-foreground mb-6">
              Connect your Strava account to import your cycling activities as routes.
            </p>
            <Button onClick={connectStrava} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect to Strava'}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground mb-4">
              Select a cycling activity to import as a route:
            </p>
            
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No cycling activities found.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {activities.map((activity) => (
                  <Card key={activity.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{activity.name}</CardTitle>
                          <CardDescription>
                            {new Date(activity.start_date).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => importActivity(activity)}
                          disabled={loading}
                        >
                          Import
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {formatDistance(activity.distance)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(activity.moving_time)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Mountain className="w-3 h-3" />
                          {formatElevation(activity.total_elevation_gain)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}