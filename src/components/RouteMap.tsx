import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { MapPin, Route, Trash2, Download } from 'lucide-react';

// You'll need to provide your Mapbox token
const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN'; // Replace with your actual token

interface Waypoint {
  id: string;
  coordinates: [number, number];
  name?: string;
}

interface RouteStats {
  distance: number;
  duration: number;
  waypointCount: number;
}

const RouteMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routeStats, setRouteStats] = useState<RouteStats>({ distance: 0, duration: 0, waypointCount: 0 });
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [mapboxToken, setMapboxToken] = useState(MAPBOX_TOKEN);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || mapboxToken === 'YOUR_MAPBOX_TOKEN') return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 12,
      pitch: 0,
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add map click handler for adding waypoints
    map.current.on('click', handleMapClick);

    // Add sources and layers when map loads
    map.current.on('load', () => {
      // Add waypoints source
      map.current!.addSource('waypoints', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Add route source
      map.current!.addSource('route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Add waypoint layer
      map.current!.addLayer({
        id: 'waypoints',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 8,
          'circle-color': 'hsl(45, 93%, 58%)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Add waypoint numbers
      map.current!.addLayer({
        id: 'waypoint-labels',
        type: 'symbol',
        source: 'waypoints',
        layout: {
          'text-field': ['get', 'number'],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Add route layer
      map.current!.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': 'hsl(142, 76%, 36%)',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isRouteMode) return;

    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      coordinates,
      name: `Waypoint ${waypoints.length + 1}`
    };

    setWaypoints(prev => [...prev, newWaypoint]);
  }, [isRouteMode, waypoints.length]);

  // Update waypoints on map
  useEffect(() => {
    if (!map.current || !map.current.getSource('waypoints')) return;

    const waypointFeatures = waypoints.map((waypoint, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: waypoint.coordinates
      },
      properties: {
        id: waypoint.id,
        number: (index + 1).toString(),
        name: waypoint.name
      }
    }));

    (map.current.getSource('waypoints') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: waypointFeatures
    });

    // Generate route if we have 2+ waypoints
    if (waypoints.length >= 2) {
      generateRoute();
    } else {
      clearRoute();
    }
  }, [waypoints]);

  const generateRoute = async () => {
    if (waypoints.length < 2 || !mapboxToken || mapboxToken === 'YOUR_MAPBOX_TOKEN') return;

    const coordinates = waypoints.map(w => w.coordinates.join(',')).join(';');
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinates}?steps=true&geometries=geojson&access_token=${mapboxToken}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        setRouteGeometry(route.geometry);
        setRouteStats({
          distance: Math.round(route.distance / 1000 * 10) / 10, // km
          duration: Math.round(route.duration / 60), // minutes
          waypointCount: waypoints.length
        });

        // Update route on map
        if (map.current && map.current.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: route.geometry,
              properties: {}
            }]
          });
        }
      }
    } catch (error) {
      console.error('Error generating route:', error);
    }
  };

  const clearRoute = () => {
    if (map.current && map.current.getSource('route')) {
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
    setRouteGeometry(null);
    setRouteStats({ distance: 0, duration: 0, waypointCount: 0 });
  };

  const clearAllWaypoints = () => {
    setWaypoints([]);
    clearRoute();
  };

  const exportRoute = () => {
    if (!routeGeometry || waypoints.length === 0) return;

    const gpxData = {
      waypoints,
      route: routeGeometry,
      stats: routeStats,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(gpxData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycling-route-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_TOKEN') {
    return (
      <div className="min-h-screen bg-gradient-map flex items-center justify-center p-4">
        <Card className="p-6 max-w-md w-full shadow-card">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Mapbox Token Required</h2>
            <p className="text-muted-foreground text-sm">
              To use the route builder, please enter your Mapbox public token.
              Get yours at <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com</a>
            </p>
            <input
              type="text"
              placeholder="Enter your Mapbox token..."
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              onChange={(e) => setMapboxToken(e.target.value)}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-background">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Control Panel */}
      <div className="absolute top-4 left-4 space-y-4 z-10">
        <Card className="p-4 shadow-card bg-card/95 backdrop-blur-sm">
          <div className="space-y-3">
            <h2 className="font-semibold text-card-foreground flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              Route Builder
            </h2>
            
            <Button
              onClick={() => setIsRouteMode(!isRouteMode)}
              variant={isRouteMode ? "default" : "outline"}
              className="w-full"
            >
              {isRouteMode ? 'Exit Route Mode' : 'Start Building Route'}
            </Button>

            {isRouteMode && (
              <p className="text-xs text-muted-foreground">
                Click on the map to add waypoints
              </p>
            )}

            {waypoints.length > 0 && (
              <div className="space-y-2">
                <Button
                  onClick={clearAllWaypoints}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
                
                {routeGeometry && (
                  <Button
                    onClick={exportRoute}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export Route
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Route Stats */}
        {routeStats.waypointCount > 0 && (
          <Card className="p-4 shadow-card bg-card/95 backdrop-blur-sm">
            <div className="space-y-2">
              <h3 className="font-medium text-card-foreground">Route Stats</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium">{routeStats.distance} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Time:</span>
                  <span className="font-medium">{routeStats.duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waypoints:</span>
                  <span className="font-medium">{routeStats.waypointCount}</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Waypoint List */}
      {waypoints.length > 0 && (
        <div className="absolute top-4 right-4 w-64 z-10">
          <Card className="p-4 shadow-card bg-card/95 backdrop-blur-sm">
            <h3 className="font-medium text-card-foreground mb-3">Waypoints</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {waypoints.map((waypoint, index) => (
                <div
                  key={waypoint.id}
                  className="flex items-center justify-between p-2 bg-secondary/50 rounded-md"
                >
                  <span className="text-sm font-medium">
                    {index + 1}. {waypoint.name}
                  </span>
                  <Button
                    onClick={() => {
                      setWaypoints(prev => prev.filter(w => w.id !== waypoint.id));
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RouteMap;