import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { withRetry } from "@/hooks/useRetry";
import LoadingSpinner from "./LoadingSpinner";
import { MapSkeleton } from "./LoadingSkeleton";
import { formatErrorForToast } from "@/utils/errorMessages";
import { decodePolyline, calculateCenter, calculateBounds } from '@/utils/polylineDecoder';
import { Waypoint, RouteStats, ElevationPoint, StravaRoute, SavedRoute, MapboxRoute, SurfaceSegments, SurfaceSegment } from '@/types';

interface RouteMapSimpleProps {
  // Route Building
  isRouteMode: boolean;
  waypoints: Waypoint[];
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  selectedWaypoint: string | null;
  setSelectedWaypoint: (id: string | null) => void;
  
  // Route Data
  routeGeometry: MapboxRoute['geometry'] | null;
  setRouteGeometry: React.Dispatch<React.SetStateAction<MapboxRoute['geometry'] | null>>;
  routeStats: RouteStats;
  setRouteStats: React.Dispatch<React.SetStateAction<RouteStats>>;
  elevationProfile: ElevationPoint[];
  setElevationProfile: React.Dispatch<React.SetStateAction<ElevationPoint[]>>;
  useMetric: boolean;

  // Location Search
  onLocationSearch: (searchTerm: string) => Promise<void>;
  onGoToCurrentLocation: () => void;

  // Strava Integration
  stravaRoutes: StravaRoute[];
  visibleStravaRoutes: Set<number>;
  onStravaRouteToggle: (routeId: number) => void;
  onStravaRouteFocus: (routeId: number) => void;
}

const RouteMapSimple: React.FC<RouteMapSimpleProps> = ({
  isRouteMode,
  waypoints,
  setWaypoints,
  selectedWaypoint,
  setSelectedWaypoint,
  routeGeometry,
  setRouteGeometry,
  routeStats,
  setRouteStats,
  elevationProfile,
  setElevationProfile,
  useMetric,
  onLocationSearch,
  onGoToCurrentLocation,
  stravaRoutes,
  visibleStravaRoutes,
  onStravaRouteToggle,
  onStravaRouteFocus,
}) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const isRouteModeRef = useRef(false);
  const isDraggingRef = useRef(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  // Function to snap waypoints to the generated route
  const snapWaypointsToRoute = useCallback((routeGeometry: MapboxRoute['geometry']) => {
    if (!routeGeometry || routeGeometry.type !== 'LineString' || !routeGeometry.coordinates) {
      return;
    }

    const routeCoordinates = routeGeometry.coordinates;
    
    // Function to find the closest point on the route to a waypoint
    const findClosestPointOnRoute = (waypointCoords: [number, number]): [number, number] => {
      let closestPoint = routeCoordinates[0];
      let minDistance = calculateDistance(waypointCoords, routeCoordinates[0]);

      for (let i = 1; i < routeCoordinates.length; i++) {
        const distance = calculateDistance(waypointCoords, routeCoordinates[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = routeCoordinates[i];
        }
      }

      return closestPoint as [number, number];
    };

    // Calculate distance between two coordinates (Haversine formula)
    const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
      const [lon1, lat1] = coord1;
      const [lon2, lat2] = coord2;
      
      const R = 6371e3; // Earth's radius in meters
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in meters
    };

    // Only snap waypoints that are not the first or last (preserve start/end points)
    const snappedWaypoints = waypoints.map((waypoint, index) => {
      // Skip snapping for first and last waypoints to preserve route endpoints
      if (index === 0 || index === waypoints.length - 1) {
        return waypoint;
      }

      const closestPoint = findClosestPointOnRoute(waypoint.coordinates);
      const distance = calculateDistance(waypoint.coordinates, closestPoint);
      
      // Only snap if the closest point is within 100 meters
      if (distance < 100) {
        return {
          ...waypoint,
          coordinates: closestPoint
        };
      }
      
      return waypoint;
    });

    // Update waypoints if any were snapped
    const hasChanged = snappedWaypoints.some((waypoint, index) => 
      waypoint.coordinates[0] !== waypoints[index].coordinates[0] ||
      waypoint.coordinates[1] !== waypoints[index].coordinates[1]
    );

    if (hasChanged) {
      setIsSnapping(true);
      setWaypoints(snappedWaypoints);
      // Reset snapping flag after a brief delay to prevent infinite loops
      setTimeout(() => setIsSnapping(false), 100);
    }
  }, [waypoints, setWaypoints]);

  // Generate route between waypoints
  const generateRoute = useCallback(async () => {
    if (waypoints.length < 2 || !mapboxToken) return;
    
    const coordinates = waypoints.map(w => w.coordinates.join(',')).join(';');
    
    try {
      console.log('Fetching route for coordinates:', coordinates);
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinates}?steps=true&geometries=geojson&overview=full&annotations=maxspeed,duration,distance&access_token=${mapboxToken}`
      );
      
      const data = await response.json();
      console.log('Route API response:', { 
        status: response.status, 
        hasRoutes: !!data.routes, 
        routeCount: data.routes?.length || 0
      });

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteGeometry(route.geometry);
        
        // Calculate route stats
        const distance = useMetric 
          ? (route.distance / 1000).toFixed(2) 
          : ((route.distance * 0.000621371).toFixed(2));
        const duration = Math.round(route.duration / 60);
        
        // Get elevation data if available
        let elevationGain = 0;
        let maxElevation = 0;
        const elevationPoints: ElevationPoint[] = [];
        
        if (route.legs) {
          route.legs.forEach((leg: { annotation?: { elevation_gain?: number; max_elevation?: number } }) => {
            if (leg.annotation) {
              elevationGain += leg.annotation.elevation_gain || 0;
              maxElevation = Math.max(maxElevation, leg.annotation.max_elevation || 0);
            }
          });
        }

        setRouteStats({
          distance: parseFloat(distance),
          duration,
          elevationGain,
          maxElevation
        });
        
        setElevationProfile(elevationPoints);
        
        // Snap waypoints to the route (exclude start and end points)
        try {
          snapWaypointsToRoute(route.geometry);
        } catch (snapError) {
          console.warn('Waypoint snapping failed:', snapError);
          // Continue without snapping if there's an error
        }
      }
    } catch (error) {
      console.error('Error generating route:', error);
      const { title, description } = formatErrorForToast(error as Error);
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  }, [waypoints, mapboxToken, useMetric, setRouteGeometry, setRouteStats, setElevationProfile, toast, snapWaypointsToRoute]);

  // Update route mode ref when prop changes
  useEffect(() => {
    isRouteModeRef.current = isRouteMode;
  }, [isRouteMode]);

  // Create retry-enabled API functions
  const getMapboxTokenWithRetry = withRetry(
    async () => {
      if (!session?.access_token) {
        throw new Error('No session or access token available');
      }

      const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(`Failed to get Mapbox token: ${error.message}`);
      }

      if (!data?.token) {
        throw new Error('No token received from server');
      }

      return data.token;
    },
    {
      maxAttempts: 3,
      delay: 1000,
      backoff: 'exponential',
    }
  );

  // Get Mapbox token from edge function
  useEffect(() => {
    const getMapboxToken = async () => {
      console.log('RouteMapSimple: Attempting to get Mapbox token, session:', !!session, 'access_token:', !!session?.access_token);
      if (!session?.access_token) {
        console.log('RouteMapSimple: No session or access token available');
        setIsLoadingToken(false);
        return;
      }

      try {
        const token = await getMapboxTokenWithRetry();
        console.log('RouteMapSimple: Successfully received Mapbox token:', !!token);
        setMapboxToken(token);
      } catch (error) {
        console.error('Error getting Mapbox token after retries:', error);
        const { title, description } = formatErrorForToast(error as Error);
        toast({
          title,
          description,
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
    if (!mapContainer.current || !mapboxToken || !currentLocation) return;

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
      if (isDraggingRef.current) {
        return;
      }
      
      handleMapClick(e);
    };
    
    map.current.on('click', clickHandler);

    // Add sources and layers when map loads
    map.current.on('load', () => {
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
      setupWaypointInteractions();
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, currentLocation]);

  // Setup waypoint drag and click interactions
  const setupWaypointInteractions = () => {
    if (!map.current) return;

    // Waypoint click handler
    map.current.on('click', 'waypoints', (e) => {
      if (e.features && e.features[0]) {
        const waypointId = e.features[0].properties?.id;
        if (waypointId) {
          setSelectedWaypoint(selectedWaypoint === waypointId ? null : waypointId);
        }
      }
      e.preventDefault();
    });

    // Make waypoints draggable
    map.current.on('mousedown', 'waypoints', (e) => {
      if (e.features && e.features[0]) {
        const waypointId = e.features[0].properties?.id;
        setSelectedWaypoint(waypointId);
        
        e.preventDefault();
        map.current!.getCanvas().style.cursor = 'grab';
        isDraggingRef.current = true;

        const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
          if (!isDraggingRef.current) return;
          
          map.current!.getCanvas().style.cursor = 'grabbing';
          
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
  };

  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isRouteModeRef.current) {
      return;
    }

    setSelectedWaypoint(null);

    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      coordinates,
      name: `Waypoint ${waypoints.length + 1}`
    };

    setWaypoints(prev => [...prev, newWaypoint]);
  }, [waypoints.length, setWaypoints, setSelectedWaypoint]);

  // Update waypoints on map (simplified version of the original)
  useEffect(() => {
    if (!map.current || !map.current.getSource('waypoints')) {
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

    (map.current.getSource('waypoints') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: waypointFeatures
    });
  }, [waypoints]);

  // Generate route when waypoints change
  useEffect(() => {
    if (waypoints.length >= 2 && !isSnapping) {
      generateRoute();
    } else if (waypoints.length < 2) {
      // Clear route if less than 2 waypoints
      setRouteGeometry(null);
      setRouteStats({ distance: 0, duration: 0, elevationGain: 0, maxElevation: 0 });
      setElevationProfile([]);
    }
  }, [waypoints, generateRoute, isSnapping, setRouteGeometry, setRouteStats, setElevationProfile]);

  // Update waypoint styling when selection changes
  useEffect(() => {
    if (!map.current || !map.current.getLayer('waypoints')) return;

    map.current.setPaintProperty('waypoints', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedWaypoint || ''],
      12,
      8
    ]);

    map.current.setPaintProperty('waypoints', 'circle-color', [
      'case',
      ['==', ['get', 'id'], selectedWaypoint || ''],
      'hsl(25, 95%, 53%)',
      'hsl(45, 93%, 58%)'
    ]);
  }, [selectedWaypoint]);

  // Update route geometry on map
  useEffect(() => {
    if (!map.current || !routeGeometry) return;

    const surfaceColors = {
      'paved': 'hsl(142, 76%, 36%)',
      'unpaved': 'hsl(30, 100%, 50%)',
      'path': 'hsl(45, 93%, 58%)',
      'ferry': 'hsl(200, 100%, 50%)',
      'default': 'hsl(142, 76%, 36%)'
    };

    // Clear existing route data
    Object.keys(surfaceColors).forEach(surfaceType => {
      const source = map.current!.getSource(`route-${surfaceType}`) as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    });

    if (routeGeometry.type === 'LineString') {
      // Simple route without surface data
      const source = map.current.getSource('route-default') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: routeGeometry,
            properties: {}
          }]
        });
      }
    }

    // Fit map to route bounds
    if (routeGeometry.coordinates && routeGeometry.coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      routeGeometry.coordinates.forEach((coord: [number, number]) => {
        bounds.extend(coord);
      });
      
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  }, [routeGeometry]);

  // Handle Strava routes visibility
  useEffect(() => {
    if (!map.current || !stravaRoutes.length) return;

    stravaRoutes.forEach((route) => {
      const sourceId = `strava-route-${route.id}`;
      const layerId = `strava-route-${route.id}`;

      // Check if source exists, if not create it
      if (!map.current!.getSource(sourceId)) {
        map.current!.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': 'hsl(220, 70%, 50%)',
            'line-width': 3,
            'line-opacity': 0.7
          }
        });
      }

      // Update visibility
      const isVisible = visibleStravaRoutes.has(route.id);
      if (map.current!.getLayer(layerId)) {
        map.current!.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
      }

      // Update route data if visible and has polyline
      if (isVisible && route.map?.summary_polyline) {
        try {
          const coordinates = decodePolyline(route.map.summary_polyline);
          const source = map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource;
          source.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates
              },
              properties: {
                name: route.name,
                id: route.id
              }
            }]
          });
        } catch (error) {
          console.error('Error decoding Strava route polyline:', error);
        }
      }
    });
  }, [stravaRoutes, visibleStravaRoutes]);

  // Expose map methods to parent
  useEffect(() => {
    if (map.current && onGoToCurrentLocation) {
      const goToLocation = () => {
        if (currentLocation && map.current) {
          map.current.flyTo({
            center: currentLocation,
            zoom: 14,
            duration: 2000
          });
        }
      };
      
      // This is a bit of a hack to expose the method
      (onGoToCurrentLocation as unknown as { _mapMethod?: () => void })._mapMethod = goToLocation;
    }
  }, [currentLocation, onGoToCurrentLocation]);

  // Show loading state while getting token
  if (isLoadingToken) {
    return (
      <div className="relative w-full h-full">
        <MapSkeleton className="h-full" />
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mb-4" />
            <div className="text-lg text-foreground mb-2">Loading map...</div>
            <div className="text-sm text-muted-foreground">Initializing secure connection</div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no token
  if (!mapboxToken) {
    return (
      <div className="relative w-full h-full bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-foreground mb-2">Map Unavailable</div>
          <div className="text-sm text-muted-foreground">Please contact support if this persists</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg overflow-hidden" />
    </div>
  );
};

export default RouteMapSimple;