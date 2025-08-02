
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
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
  elevationGain?: number;
  elevationLoss?: number;
  maxElevation?: number;
  minElevation?: number;
}

interface ElevationPoint {
  distance: number;
  elevation: number;
}

interface RouteMapProps {
  onToggleRouteMode?: () => void;
}

const RouteMap: React.FC<RouteMapProps> = ({ onToggleRouteMode }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routeStats, setRouteStats] = useState<RouteStats>({ distance: 0, duration: 0, waypointCount: 0 });
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [useMetric, setUseMetric] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Get Mapbox token from edge function
  useEffect(() => {
    const getMapboxToken = async () => {
      if (!session?.access_token) {
        console.log('No session or access token available');
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

  // Get user's current location
  useEffect(() => {
    const getCurrentLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords: [number, number] = [
              position.coords.longitude,
              position.coords.latitude
            ];
            setCurrentLocation(coords);
          },
          (error) => {
            console.warn('Error getting location:', error);
            // Fallback to San Francisco
            setCurrentLocation([-122.4194, 37.7749]);
          }
        );
      } else {
        console.warn('Geolocation is not supported');
        // Fallback to San Francisco
        setCurrentLocation([-122.4194, 37.7749]);
      }
    };

    getCurrentLocation();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !currentLocation) {
      return;
    }

    // Clear any existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    console.log('Initializing map with token and location:', currentLocation);
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: currentLocation,
        zoom: 14,
        pitch: 0,
        bearing: 0
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add map click handler for adding waypoints
      const clickHandler = (e: mapboxgl.MapMouseEvent) => {
        if (!isRouteMode) return;
        
        // Clear any selected waypoint when adding a new one
        setSelectedWaypoint(null);

        const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const newWaypoint: Waypoint = {
          id: `waypoint-${Date.now()}`,
          coordinates,
          name: `Waypoint ${waypoints.length + 1}`
        };

        setWaypoints(prev => [...prev, newWaypoint]);
      };
      
      map.current.on('click', clickHandler);

      // Add sources and layers when map loads
      map.current.on('load', () => {
        console.log('Map loaded successfully');
        
        if (!map.current) return;
        
        // Add waypoints source
        map.current.addSource('waypoints', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Add waypoint layer
        map.current.addLayer({
          id: 'waypoints',
          type: 'circle',
          source: 'waypoints',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'id'], selectedWaypoint || ''],
              12,
              8
            ],
            'circle-color': [
              'case',
              ['==', ['get', 'id'], selectedWaypoint || ''],
              'hsl(25, 95%, 53%)',
              'hsl(45, 93%, 58%)'
            ],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Add waypoint numbers
        map.current.addLayer({
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
          'paved': 'hsl(142, 76%, 36%)',
          'unpaved': 'hsl(30, 100%, 50%)',
          'path': 'hsl(45, 93%, 58%)',
          'ferry': 'hsl(200, 100%, 50%)',
          'default': 'hsl(142, 76%, 36%)'
        };

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

        // Add waypoint interaction handlers
        map.current.on('click', 'waypoints', (e) => {
          if (e.features && e.features[0]) {
            const waypointId = e.features[0].properties?.id;
            if (waypointId) {
              setSelectedWaypoint(selectedWaypoint === waypointId ? null : waypointId);
            }
          }
          e.preventDefault();
        });

        map.current.on('mouseenter', 'waypoints', () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'waypoints', () => {
          map.current!.getCanvas().style.cursor = '';
        });

        setMapInitialized(true);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: "Map Error",
        description: "Failed to initialize map. Please refresh the page.",
        variant: "destructive",
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, currentLocation, toast]);

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
          : Math.round(distanceInKm * 0.621371 * 10) / 10;

        setRouteStats({
          distance,
          duration: Math.round(route.duration / 60),
          waypointCount: waypoints.length,
          elevationGain: 0,
          elevationLoss: 0,
          maxElevation: 0,
          minElevation: 0
        });

        // Get elevation data for the route
        await getElevationProfile(route.geometry.coordinates);

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
                const name = step.name?.toLowerCase() || '';
                if (name.includes('trail') || name.includes('path') || name.includes('cycleway')) {
                  surfaceType = 'path';
                } else if (name.includes('track') || name.includes('service') || name.includes('unpaved')) {
                  surfaceType = 'unpaved';
                } else if (name.includes('highway') || name.includes('street') || name.includes('road')) {
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
          surfaceSegments.default.push({
            type: 'Feature',
            geometry: route.geometry,
            properties: { surface: 'default' }
          });
        }

        // Update each surface layer on map
        Object.keys(surfaceSegments).forEach(surfaceType => {
          if (map.current && map.current.getSource(`route-${surfaceType}`)) {
            const features = surfaceSegments[surfaceType as keyof typeof surfaceSegments];
            (map.current.getSource(`route-${surfaceType}`) as mapboxgl.GeoJSONSource).setData({
              type: 'FeatureCollection',
              features: features
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

  // Get elevation profile using Open Elevation API
  const getElevationProfile = async (coordinates: number[][]) => {
    try {
      const maxPoints = 100;
      const step = Math.max(1, Math.floor(coordinates.length / maxPoints));
      const sampledCoords = coordinates.filter((_, index) => index % step === 0);
      
      const locations = sampledCoords.map(coord => `${coord[1]},${coord[0]}`).join('|');
      
      const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locations}`);
      const elevationData = await response.json();
      
      if (elevationData.results) {
        let cumulativeDistance = 0;
        const profile: ElevationPoint[] = elevationData.results.map((point: any, index: number) => {
          if (index > 0) {
            const prevCoord = sampledCoords[index - 1];
            const currCoord = sampledCoords[index];
            const dist = calculateDistance(
              [prevCoord[1], prevCoord[0]], 
              [currCoord[1], currCoord[0]]
            );
            cumulativeDistance += dist;
          }
          
          return {
            distance: cumulativeDistance,
            elevation: point.elevation
          };
        });
        
        setElevationProfile(profile);
        
        const elevations = profile.map(p => p.elevation);
        const maxElevation = Math.max(...elevations);
        const minElevation = Math.min(...elevations);
        
        let elevationGain = 0;
        let elevationLoss = 0;
        
        for (let i = 1; i < profile.length; i++) {
          const diff = profile[i].elevation - profile[i - 1].elevation;
          if (diff > 0) {
            elevationGain += diff;
          } else {
            elevationLoss += Math.abs(diff);
          }
        }
        
        setRouteStats(prev => ({
          ...prev,
          elevationGain: Math.round(elevationGain),
          elevationLoss: Math.round(elevationLoss),
          maxElevation: Math.round(maxElevation),
          minElevation: Math.round(minElevation)
        }));
      }
    } catch (error) {
      console.error('Error getting elevation data:', error);
    }
  };

  const calculateDistance = (coord1: [number, number], coord2: [number, number]) => {
    const R = 6371;
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Update waypoints on map
  useEffect(() => {
    if (!map.current || !map.current.getSource('waypoints') || !mapInitialized) return;

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

    if (waypoints.length >= 2) {
      generateRoute();
    } else if (waypoints.length < 2) {
      clearRoute();
    }
  }, [waypoints, generateRoute, mapInitialized]);

  const clearRoute = () => {
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
    setElevationProfile([]);
  };

  const clearAllWaypoints = () => {
    setWaypoints([]);
    setSelectedWaypoint(null);
    clearRoute();
  };

  const toggleRouteMode = () => {
    setIsRouteMode(prev => !prev);
  };

  // Expose toggle function to parent
  useEffect(() => {
    if (onToggleRouteMode) {
      (window as any).toggleRouteMode = toggleRouteMode;
    }
  }, [onToggleRouteMode]);

  // Show loading state while getting token
  if (isLoadingToken) {
    return (
      <div className="relative w-full h-screen bg-muted rounded-lg flex items-center justify-center">
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
      <div className="relative w-full h-screen bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-foreground mb-2">Map Unavailable</div>
          <div className="text-sm text-muted-foreground">Please contact support if this persists</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background relative">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Route Statistics Panel */}
      {routeGeometry && (
        <div className="absolute top-4 right-4 w-80 z-10">
          <Card className="p-4 shadow-card bg-background/95 backdrop-blur-md border">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-card-foreground">Route Statistics</h3>
                <Button
                  onClick={() => setUseMetric(!useMetric)}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  {useMetric ? 'km' : 'mi'}
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center p-2 bg-muted/30 rounded">
                  <div className="text-xs text-muted-foreground">Distance</div>
                  <div className="font-medium">{routeStats.distance} {useMetric ? 'km' : 'mi'}</div>
                </div>
                <div className="text-center p-2 bg-muted/30 rounded">
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="font-medium">{routeStats.duration} min</div>
                </div>
                {routeStats.elevationGain !== undefined && (
                  <>
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">Elevation Gain</div>
                      <div className="font-medium text-green-600">
                        +{useMetric 
                          ? (routeStats.elevationGain || 0) 
                          : Math.round((routeStats.elevationGain || 0) * 3.28084)
                        }{useMetric ? 'm' : 'ft'}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">Elevation Loss</div>
                      <div className="font-medium text-red-600">
                        -{useMetric 
                          ? (routeStats.elevationLoss || 0) 
                          : Math.round((routeStats.elevationLoss || 0) * 3.28084)
                        }{useMetric ? 'm' : 'ft'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Waypoint List */}
      {waypoints.length > 0 && (
        <div className="absolute bottom-4 right-4 w-64 z-10">
          <Card className="p-4 shadow-card bg-background/95 backdrop-blur-md border">
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
            {waypoints.length > 0 && (
              <Button
                onClick={clearAllWaypoints}
                variant="outline"
                size="sm"
                className="w-full mt-3"
              >
                Clear All Waypoints
              </Button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default RouteMap;
