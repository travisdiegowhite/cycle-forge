import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MapPin, Clock, TrendingUp, Upload, Plus, Link as LinkIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

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
  const [manualRoute, setManualRoute] = useState({
    name: '',
    description: '',
    distance: '',
    elevation: '',
    duration: ''
  });
  const { toast } = useToast();

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
          Import Route
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import or Create Route</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">Upload GPX File</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>
          
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