import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MapPin, Clock, TrendingUp, Upload, Plus, Link as LinkIcon, Activity, ExternalLink } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import LoadingSpinner from './LoadingSpinner';

interface StravaRoute {
  id: number;
  name: string;
  description: string;
  distance: number;
  elevation_gain: number;
  estimated_moving_time: number;
  type: number;
  sub_type: number;
  created_at: string;
  updated_at: string;
  private: boolean;
  starred: boolean;
  map?: {
    polyline?: string;
    summary_polyline?: string;
  };
}

interface RouteData {
  id: number;
  name: string;
  description: string;
  distance: number;
  elevation_gain: number;
  estimated_moving_time: number;
  coordinates?: Array<[number, number]>;
}

interface StravaImportProps {
  onRouteImported: (routeData: RouteData) => void;
}

export const StravaImport: React.FC<StravaImportProps> = ({ onRouteImported }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stravaRoutes, setStravaRoutes] = useState<StravaRoute[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [manualRoute, setManualRoute] = useState({
    name: '',
    description: '',
    distance: '',
    elevation: '',
    duration: ''
  });
  const { toast } = useToast();
  const { session } = useAuth();

  // Check for Strava authentication and load routes
  const loadStravaRoutes = useCallback(async () => {
    if (!session?.access_token) {
      console.log('No session available for Strava import');
      return;
    }

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Strava auth error:', error);
        
        // Check if this is a 502 error (likely missing credentials)
        if (error.message?.includes('502') || error.message?.includes('Bad Gateway')) {
          toast({
            title: "Strava Setup Required",
            description: "Strava API credentials need to be configured. Please contact your administrator to set up Strava integration.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(`Failed to connect to Strava: ${error.message}`);
      }

      console.log('Strava response:', data);

      if (data.authUrl) {
        // User needs to authenticate - redirect to Strava
        window.open(data.authUrl, '_blank');
        toast({
          title: "Strava Authentication",
          description: "Complete authentication in the new window, then try importing again.",
        });
        setIsAuthenticated(false);
      } else if (data.success && data.routes) {
        // Successfully got routes
        setStravaRoutes(data.routes);
        setIsAuthenticated(true);
        toast({
          title: "Strava Connected!",
          description: `Found ${data.routes.length} route(s) from your Strava account.`,
        });
      }
    } catch (error) {
      console.error('Error loading Strava routes:', error);
      
      // Check if the error response contains HTML (502 error page)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('<html>') || errorMessage.includes('502 Bad Gateway')) {
        toast({
          title: "Strava Setup Required",
          description: "Strava API credentials are not configured. The integration needs to be set up by your administrator.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Strava Connection Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, [session, toast]);

  // Handle Strava route import
  const handleStravaRouteImport = useCallback((stravaRoute: StravaRoute) => {
    const routeData: RouteData = {
      id: stravaRoute.id,
      name: stravaRoute.name,
      description: stravaRoute.description || '',
      distance: stravaRoute.distance,
      elevation_gain: stravaRoute.elevation_gain,
      estimated_moving_time: stravaRoute.estimated_moving_time,
    };

    onRouteImported(routeData);
    
    toast({
      title: "Route imported successfully",
      description: `Imported "${stravaRoute.name}" from Strava`,
    });
    
    setIsOpen(false);
  }, [onRouteImported, toast]);

  // Check for URL parameters on component mount (for OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stravaAuth = urlParams.get('strava_auth');
    const routesData = urlParams.get('routes');
    
    if (stravaAuth === 'success' && routesData) {
      try {
        const routes = JSON.parse(decodeURIComponent(routesData));
        setStravaRoutes(routes);
        setIsAuthenticated(true);
        toast({
          title: "Strava Connected!",
          description: `Successfully imported ${routes.length} route(s) from Strava.`,
        });
        
        // Clean up URL parameters
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } catch (error) {
        console.error('Error parsing Strava routes from URL:', error);
      }
    }
  }, [toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a GPX file exported from Strava",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      
      // Extract route data from GPX
      const trackPoints = xmlDoc.querySelectorAll('trkpt');
      const coordinates: Array<[number, number]> = [];
      let totalDistance = 0;
      let minElevation = Infinity;
      let maxElevation = -Infinity;

      trackPoints.forEach((point, index) => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lon = parseFloat(point.getAttribute('lon') || '0');
        const eleElement = point.querySelector('ele');
        const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : 0;
        
        coordinates.push([lon, lat]);
        
        if (elevation) {
          minElevation = Math.min(minElevation, elevation);
          maxElevation = Math.max(maxElevation, elevation);
        }

        // Calculate distance (simplified)
        if (index > 0) {
          const prevPoint = trackPoints[index - 1];
          const prevLat = parseFloat(prevPoint.getAttribute('lat') || '0');
          const prevLon = parseFloat(prevPoint.getAttribute('lon') || '0');
          
          // Haversine formula (simplified)
          const R = 6371000; // Earth's radius in meters
          const dLat = (lat - prevLat) * Math.PI / 180;
          const dLon = (lon - prevLon) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(prevLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          totalDistance += R * c;
        }
      });

      const elevationGain = maxElevation - minElevation;
      const routeName = xmlDoc.querySelector('name')?.textContent || file.name.replace('.gpx', '');
      const routeDescription = xmlDoc.querySelector('desc')?.textContent || '';

      const routeData: RouteData = {
        id: Date.now(),
        name: routeName,
        description: routeDescription,
        distance: totalDistance,
        elevation_gain: elevationGain > 0 ? elevationGain : 0,
        estimated_moving_time: Math.round(totalDistance / 5), // Rough estimate: 5 m/s average
        coordinates
      };

      onRouteImported(routeData);
      
      toast({
        title: "Route imported successfully",
        description: `Imported "${routeName}" from GPX file`,
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Error parsing GPX file:', error);
      toast({
        title: "Import failed",
        description: "Failed to parse GPX file. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualRoute.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a route name",
        variant: "destructive",
      });
      return;
    }

    const routeData: RouteData = {
      id: Date.now(),
      name: manualRoute.name,
      description: manualRoute.description,
      distance: parseFloat(manualRoute.distance) * 1000 || 0, // Convert km to meters
      elevation_gain: parseFloat(manualRoute.elevation) || 0,
      estimated_moving_time: parseFloat(manualRoute.duration) * 60 || 0 // Convert minutes to seconds
    };

    onRouteImported(routeData);
    
    toast({
      title: "Route created",
      description: `Created route "${routeData.name}"`,
    });
    
    // Reset form
    setManualRoute({
      name: '',
      description: '',
      distance: '',
      elevation: '',
      duration: ''
    });
    
    setIsOpen(false);
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
          <Activity className="h-4 w-4 mr-2" />
          Import from Strava
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import or Create Route</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="strava" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="strava">Import from Strava</TabsTrigger>
            <TabsTrigger value="file">Upload GPX File</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>
          
          <TabsContent value="strava" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Import from Strava
                </CardTitle>
                <CardDescription>
                  Connect your Strava account to import your saved routes directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isAuthenticated ? (
                  <div className="text-center space-y-4">
                    <p className="text-muted-foreground">
                      Connect to Strava to access your saved routes
                    </p>
                    <Button 
                      onClick={loadStravaRoutes} 
                      disabled={authLoading || !session}
                      className="w-full"
                    >
                      {authLoading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Connecting to Strava...
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4 mr-2" />
                          Connect to Strava
                        </>
                      )}
                    </Button>
                    {!session && (
                      <p className="text-sm text-destructive">
                        Please log in to connect your Strava account
                      </p>
                    )}
                    
                    <div className="mt-4 p-3 bg-muted/50 rounded-md text-left">
                      <p className="text-sm font-medium mb-2">Need to set up Strava integration?</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        If you get a "502 Bad Gateway" error, the Strava API credentials need to be configured:
                      </p>
                      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Strava API settings</a></li>
                        <li>Create a new API application</li>
                        <li>Set redirect URI to your Supabase function URL</li>
                        <li>Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to Supabase environment variables</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Your Strava Routes ({stravaRoutes.length})</h4>
                      <Button variant="outline" size="sm" onClick={loadStravaRoutes}>
                        Refresh
                      </Button>
                    </div>
                    
                    {stravaRoutes.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-2">No routes found</p>
                        <p className="text-sm text-muted-foreground">
                          Create some routes in Strava and then refresh this list
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {stravaRoutes.map((route) => (
                          <Card key={route.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium truncate">{route.name}</h5>
                                  {route.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {route.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
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
                                  <div className="flex gap-2 mt-2">
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
                                  onClick={() => handleStravaRouteImport(route)}
                                  className="ml-4"
                                >
                                  Import
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="file" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload GPX File
                </CardTitle>
                <CardDescription>
                  Export your route from Strava as a GPX file and upload it here.
                  <br />
                  <strong>How to export from Strava:</strong>
                  <ol className="list-decimal list-inside mt-2 text-sm">
                    <li>Go to your route on Strava</li>
                    <li>Click the "Actions" dropdown</li>
                    <li>Select "Export GPX"</li>
                    <li>Upload the downloaded file here</li>
                  </ol>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="gpx-file">GPX File</Label>
                  <Input
                    id="gpx-file"
                    type="file"
                    accept=".gpx"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                  {loading && (
                    <p className="text-sm text-muted-foreground">Processing file...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Route Manually
                </CardTitle>
                <CardDescription>
                  Enter route details manually to create a new route.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="route-name">Route Name *</Label>
                  <Input
                    id="route-name"
                    placeholder="Enter route name"
                    value={manualRoute.name}
                    onChange={(e) => setManualRoute(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="route-description">Description</Label>
                  <Input
                    id="route-description"
                    placeholder="Route description (optional)"
                    value={manualRoute.description}
                    onChange={(e) => setManualRoute(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="distance">Distance (km)</Label>
                    <Input
                      id="distance"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={manualRoute.distance}
                      onChange={(e) => setManualRoute(prev => ({ ...prev, distance: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="elevation">Elevation (m)</Label>
                    <Input
                      id="elevation"
                      type="number"
                      placeholder="0"
                      value={manualRoute.elevation}
                      onChange={(e) => setManualRoute(prev => ({ ...prev, elevation: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder="0"
                      value={manualRoute.duration}
                      onChange={(e) => setManualRoute(prev => ({ ...prev, duration: e.target.value }))}
                    />
                  </div>
                </div>
                
                <Button onClick={handleManualSubmit} className="w-full">
                  Create Route
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};