import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { MapPin, Route, Trash2, Download } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
  const { session } = useAuth();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const isRouteModeRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routeStats, setRouteStats] = useState<RouteStats>({ distance: 0, duration: 0, waypointCount: 0 });
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [useMetric, setUseMetric] = useState(true);

  // Get Mapbox token from edge function
  useEffect(() => {
    const getMapboxToken = async () => {
      if (!session?.access_token) {
        setIsLoadingToken(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error('Error getting Mapbox token:', error);
          toast({
            title: "Map Error",
            description: "Failed to load map configuration. Please try again.",
            variant: "destructive",
          });
          return;
        }

        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error calling get-mapbox-token function:', error);
        toast({
          title: "Map Error", 
          description: "Failed to load map configuration. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingToken(false);
      }
    };

    getMapboxToken();
  }, [session, toast]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    console.log('Initializing map with secure token');
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
    const clickHandler = (e: mapboxgl.MapMouseEvent) => {
      // Don't add waypoints if we're dragging
      if (isDraggingRef.current) {
        return;
      }
      
      console.log('Map clicked:', { 
        isRouteMode: isRouteModeRef.current, 
        coordinates: [e.lngLat.lng, e.lngLat.lat],
        currentWaypointCount: waypoints.length 
      });
      handleMapClick(e);
    };
    
    map.current.on('click', clickHandler);

    // Add sources and layers when map loads
    map.current.on('load', () => {
      console.log('Map loaded successfully');
      
      if (!map.current) return;
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

      // Add waypoint layer - make it interactive
      map.current!.addLayer({
        id: 'waypoints',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedWaypoint || ''],
            12, // Larger when selected
            8   // Normal size
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'id'], selectedWaypoint || ''],
            'hsl(25, 95%, 53%)', // Orange when selected
            'hsl(45, 93%, 58%)'  // Yellow normally
          ],
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

      // Add route layers for different surface types
      const surfaceColors = {
        'paved': 'hsl(142, 76%, 36%)',      // Green for paved roads
        'unpaved': 'hsl(30, 100%, 50%)',   // Orange for unpaved/gravel
        'path': 'hsl(45, 93%, 58%)',       // Yellow for paths/trails
        'ferry': 'hsl(200, 100%, 50%)',    // Blue for ferry routes
        'default': 'hsl(142, 76%, 36%)'    // Default green
      };

      // Add sources for each surface type
      Object.keys(surfaceColors).forEach(surfaceType => {
        map.current!.addSource(`route-${surfaceType}`, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.current!.addLayer({
          id: `route-${surfaceType}`,
          type: 'line',
          source: `route-${surfaceType}`,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': surfaceColors[surfaceType as keyof typeof surfaceColors],
            'line-width': 4,
            'line-opacity': 0.8
          }
        });
      });

      // Add waypoint click and drag handlers
      map.current.on('click', 'waypoints', (e) => {
        if (e.features && e.features[0]) {
          const waypointId = e.features[0].properties?.id;
          if (waypointId) {
            setSelectedWaypoint(selectedWaypoint === waypointId ? null : waypointId);
            console.log('Waypoint selected:', waypointId);
          }
        }
        e.preventDefault();
      });

      // Make waypoints draggable
      map.current.on('mousedown', 'waypoints', (e) => {
        if (e.features && e.features[0]) {
          const waypointId = e.features[0].properties?.id;
          setSelectedWaypoint(waypointId);
          
          // Prevent the default map drag behavior
          e.preventDefault();
          
          map.current!.getCanvas().style.cursor = 'grab';
          isDraggingRef.current = true;

          const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
            if (!isDraggingRef.current) return;
            
            map.current!.getCanvas().style.cursor = 'grabbing';
            
            // Update waypoint position
            setWaypoints(prev => prev.map(wp => 
              wp.id === waypointId 
                ? { ...wp, coordinates: [e.lngLat.lng, e.lngLat.lat] as [number, number] }
                : wp
            ));
          };

          const onMouseUp = () => {
            isDraggingRef.current = false;
            map.current!.getCanvas().style.cursor = '';
            map.current!.off('mousemove', onMouseMove);
            map.current!.off('mouseup', onMouseUp);
          };

          map.current!.on('mousemove', onMouseMove);
          map.current!.on('mouseup', onMouseUp);
        }
      });

      // Change cursor on waypoint hover
      map.current.on('mouseenter', 'waypoints', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'waypoints', () => {
        map.current!.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    console.log('handleMapClick called:', { 
      isRouteMode: isRouteModeRef.current, 
      waypointCount: waypoints.length,
      coordinates: [e.lngLat.lng, e.lngLat.lat]
    });
    
    if (!isRouteModeRef.current) {
      console.log('Not in route mode, ignoring click');
      return;
    }

    // Clear any selected waypoint when adding a new one
    setSelectedWaypoint(null);

    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      coordinates,
      name: `Waypoint ${waypoints.length + 1}`
    };

    console.log('Adding new waypoint:', newWaypoint);
    setWaypoints(prev => {
      const updated = [...prev, newWaypoint];
      console.log('Updated waypoints:', updated);
      return updated;
    });
  }, [waypoints.length]);

  const generateRoute = useCallback(async () => {
    if (waypoints.length < 2 || !mapboxToken) return;

    const coordinates = waypoints.map(w => w.coordinates.join(',')).join(';');
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinates}?steps=true&geometries=geojson&overview=full&annotations=maxspeed,duration,distance&access_token=${mapboxToken}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        setRouteGeometry(route.geometry);
        const distanceInKm = route.distance / 1000;
        const distance = useMetric 
          ? Math.round(distanceInKm * 10) / 10
          : Math.round(distanceInKm * 0.621371 * 10) / 10; // Convert to miles
        
        setRouteStats({
          distance,
          duration: Math.round(route.duration / 60), // minutes
          waypointCount: waypoints.length
        });

        // Process route segments by surface type
        const surfaceSegments = {
          'paved': [] as any[],
          'unpaved': [] as any[],
          'path': [] as any[],
          'ferry': [] as any[],
          'default': [] as any[]
        };

        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs.forEach((leg: any) => {
            leg.steps.forEach((step: any) => {
              let surfaceType = 'default';
              
              // Determine surface type based on road class and maneuver type
              if (step.maneuver?.modifier === 'ferry') {
                surfaceType = 'ferry';
              } else if (step.intersections && step.intersections[0]?.classes) {
                const classes = step.intersections[0].classes;
                if (classes.includes('path') || classes.includes('trail') || classes.includes('cycleway')) {
                  surfaceType = 'path';
                } else if (classes.includes('track') || classes.includes('service')) {
                  surfaceType = 'unpaved';
                } else if (classes.includes('trunk') || classes.includes('primary') || classes.includes('secondary')) {
                  surfaceType = 'paved';
                }
              } else {
                // Fallback: use road name/type hints
                const name = step.name?.toLowerCase() || '';
                const ref = step.ref?.toLowerCase() || '';
                if (name.includes('trail') || name.includes('path') || name.includes('cycleway')) {
                  surfaceType = 'path';
                } else if (name.includes('track') || name.includes('service') || name.includes('unpaved')) {
                  surfaceType = 'unpaved';
                } else if (ref || name.includes('highway') || name.includes('street') || name.includes('road')) {
                  surfaceType = 'paved';
                }
              }

              if (step.geometry && step.geometry.coordinates) {
                surfaceSegments[surfaceType as keyof typeof surfaceSegments].push({
                  type: 'Feature',
                  geometry: step.geometry,
                  properties: { 
                    surface: surfaceType,
                    name: step.name || 'Unnamed',
                    distance: step.distance 
                  }
                });
              }
            });
          });
        } else {
          // Fallback: treat entire route as default surface
          surfaceSegments.default.push({
            type: 'Feature',
            geometry: route.geometry,
            properties: { surface: 'default' }
          });
        }

        // Update each surface layer on map
        Object.keys(surfaceSegments).forEach(surfaceType => {
          if (map.current && map.current.getSource(`route-${surfaceType}`)) {
            (map.current.getSource(`route-${surfaceType}`) as mapboxgl.GeoJSONSource).setData({
              type: 'FeatureCollection',
              features: surfaceSegments[surfaceType as keyof typeof surfaceSegments]
            });
          }
        });
      }
    } catch (error) {
      console.error('Error generating route:', error);
      toast({
        title: "Route Error",
        description: "Failed to generate route. Please try again.",
        variant: "destructive",
      });
    }
  }, [waypoints, mapboxToken, useMetric, toast]);

  // Update waypoints on map
  useEffect(() => {
    console.log('Waypoints updated:', waypoints);
    if (!map.current || !map.current.getSource('waypoints')) {
      console.log('Map or waypoints source not ready');
      return;
    }

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

    console.log('Setting waypoint features on map:', waypointFeatures);
    (map.current.getSource('waypoints') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: waypointFeatures
    });

    // Generate route if we have 2+ waypoints
    if (waypoints.length >= 2) {
      console.log('Generating route for', waypoints.length, 'waypoints');
      generateRoute();
    } else {
      console.log('Clearing route - insufficient waypoints');
      clearRoute();
    }
  }, [waypoints, generateRoute]);

  // Update waypoint styling when selection changes
  useEffect(() => {
    if (!map.current || !map.current.getLayer('waypoints')) return;

    map.current.setPaintProperty('waypoints', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedWaypoint || ''],
      12, // Larger when selected
      8   // Normal size
    ]);

    map.current.setPaintProperty('waypoints', 'circle-color', [
      'case',
      ['==', ['get', 'id'], selectedWaypoint || ''],
      'hsl(25, 95%, 53%)', // Orange when selected
      'hsl(45, 93%, 58%)'  // Yellow normally
    ]);
  }, [selectedWaypoint]);


  const clearRoute = () => {
    // Clear all surface-specific route layers
    const surfaceTypes = ['paved', 'unpaved', 'path', 'ferry', 'default'];
    surfaceTypes.forEach(surfaceType => {
      if (map.current && map.current.getSource(`route-${surfaceType}`)) {
        (map.current.getSource(`route-${surfaceType}`) as mapboxgl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    });
    setRouteGeometry(null);
    setRouteStats({ distance: 0, duration: 0, waypointCount: 0 });
  };

  const clearAllWaypoints = () => {
    setWaypoints([]);
    setSelectedWaypoint(null);
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

  // Show loading state while getting token
  if (isLoadingToken) {
    return (
      <div className="relative w-full h-[600px] bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-lg text-muted-foreground mb-2">Loading map...</div>
          <div className="text-sm text-muted-foreground">Initializing secure connection</div>
        </div>
      </div>
    );
  }

  // Show error state if no token
  if (!mapboxToken) {
    return (
      <div className="relative w-full h-[600px] bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-foreground mb-2">Map Unavailable</div>
          <div className="text-sm text-muted-foreground">Please contact support if this persists</div>
        </div>
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
              onClick={() => {
                console.log('Route mode button clicked, current state:', isRouteMode);
                const newRouteMode = !isRouteMode;
                setIsRouteMode(newRouteMode);
                isRouteModeRef.current = newRouteMode;
                console.log('Route mode will be:', newRouteMode);
              }}
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-card-foreground">Route Stats</h3>
                <Button
                  onClick={() => setUseMetric(!useMetric)}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  {useMetric ? 'km' : 'mi'}
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-medium">{routeStats.distance} {useMetric ? 'km' : 'mi'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Time:</span>
                  <span className="font-medium">{routeStats.duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waypoints:</span>
                  <span className="font-medium">{routeStats.waypointCount}</span>
                </div>

                {/* Surface Legend */}
                {routeGeometry && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <h4 className="text-xs font-medium text-card-foreground mb-2">Surface Types</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-1 bg-green-600 rounded"></div>
                        <span className="text-muted-foreground">Paved Roads</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-1 bg-orange-500 rounded"></div>
                        <span className="text-muted-foreground">Unpaved/Gravel</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-1 bg-yellow-500 rounded"></div>
                        <span className="text-muted-foreground">Paths/Trails</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-1 bg-blue-500 rounded"></div>
                        <span className="text-muted-foreground">Ferry Routes</span>
                      </div>
                    </div>
                  </div>
                )}
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
                  className={`flex items-center justify-between p-2 rounded-md transition-colors ${
                    selectedWaypoint === waypoint.id 
                      ? 'bg-primary/20 border border-primary/30' 
                      : 'bg-secondary/50 hover:bg-secondary/70'
                  }`}
                  onClick={() => setSelectedWaypoint(selectedWaypoint === waypoint.id ? null : waypoint.id)}
                >
                   <span className="text-sm font-medium cursor-pointer">
                     {index + 1}. Waypoint {index + 1}
                     {selectedWaypoint === waypoint.id && <span className="ml-2 text-xs text-primary">(selected)</span>}
                  </span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWaypoints(prev => prev.filter(w => w.id !== waypoint.id));
                      if (selectedWaypoint === waypoint.id) {
                        setSelectedWaypoint(null);
                      }
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