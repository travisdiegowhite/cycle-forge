import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { MapPin, Route, Trash2, Download, Search, Navigation, Save, FolderOpen } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from "@/integrations/supabase/client";
import { StravaImport } from './StravaImport';
import { StravaRoutesViewer } from './StravaRoutesViewer';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { decodePolyline, calculateCenter, calculateBounds } from '@/utils/polylineDecoder';

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
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [useMetric, setUseMetric] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [stravaRoutes, setStravaRoutes] = useState<any[]>([]);
  const [visibleStravaRoutes, setVisibleStravaRoutes] = useState<Set<number>>(new Set());

  // Get Mapbox token from edge function
  useEffect(() => {
    const getMapboxToken = async () => {
      console.log('getMapboxToken called', { 
        hasSession: !!session, 
        hasAccessToken: !!session?.access_token,
        isLoadingToken 
      });
      
      if (!session?.access_token) {
        console.log('No session or access token, setting loading to false');
        setIsLoadingToken(false);
        return;
      }

      try {
        console.log('Calling get-mapbox-token function...');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log('get-mapbox-token response:', { data, error });

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
          console.log('Mapbox token received, setting token');
          setMapboxToken(data.token);
        } else {
          console.log('No token in response data:', data);
        }
      } catch (error) {
        console.error('Error calling get-mapbox-token function:', error);
        toast({
          title: "Map Error", 
          description: "Failed to load map configuration. Please try again.",
          variant: "destructive",
        });
      } finally {
        console.log('Setting isLoadingToken to false');
        setIsLoadingToken(false);
      }
    };

    getMapboxToken();
  }, [session, toast]);

  // Load saved routes from Supabase
  useEffect(() => {
    const loadSavedRoutes = async () => {
      if (!session?.user) return;

      try {
        const { data, error } = await supabase
          .from('routes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading routes:', error);
          return;
        }

        setSavedRoutes(data || []);
      } catch (error) {
        console.error('Error loading routes:', error);
      }
    };

    loadSavedRoutes();
  }, [session]);

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
            console.log('Current location:', coords);
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
  }, [session, toast]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !currentLocation) return;

    console.log('Initializing map with secure token and location:', currentLocation);
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: currentLocation, // Use current location
      zoom: 14, // Zoom in more for current location
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
  }, [mapboxToken, currentLocation]);

  // Search for a location using Mapbox Geocoding API
  const searchLocation = async () => {
    if (!locationSearch.trim() || !mapboxToken) return;
    
    setIsLoadingLocation(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationSearch)}.json?access_token=${mapboxToken}&limit=1`
      );
      
      const data = await response.json();
      
      if (data.features && data.features[0]) {
        const [lng, lat] = data.features[0].center;
        
        // Fly to the location
        if (map.current) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: 14,
            duration: 2000
          });
        }
        
        toast({
          title: "Location Found",
          description: `Navigated to ${data.features[0].place_name}`,
        });
      } else {
        toast({
          title: "Location Not Found",
          description: "Please try a different search term.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error searching location:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Go to current location
  const goToCurrentLocation = () => {
    if (currentLocation && map.current) {
      map.current.flyTo({
        center: currentLocation,
        zoom: 14,
        duration: 2000
      });
    }
  };

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
      console.log('Fetching route for coordinates:', coordinates);
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinates}?steps=true&geometries=geojson&overview=full&annotations=maxspeed,duration,distance&access_token=${mapboxToken}`
      );
      
      console.log('Route response status:', response.status);
      
      const data = await response.json();
      console.log('Route API response:', { 
        status: response.status, 
        hasRoutes: !!data.routes, 
        routeCount: data.routes?.length || 0,
        firstRoute: data.routes?.[0] ? { hasGeometry: !!data.routes[0].geometry, hasLegs: !!data.routes[0].legs } : null
      });
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        console.log('Processing route geometry:', { 
          hasGeometry: !!route.geometry, 
          coordinateCount: route.geometry?.coordinates?.length || 0 
        });
        setRouteGeometry(route.geometry);
        const distanceInKm = route.distance / 1000;
        const distance = useMetric 
          ? Math.round(distanceInKm * 10) / 10
          : Math.round(distanceInKm * 0.621371 * 10) / 10; // Convert to miles

        // Set initial route stats
        setRouteStats({
          distance,
          duration: Math.round(route.duration / 60), // minutes
          waypointCount: waypoints.length,
          elevationGain: 0,
          elevationLoss: 0,
          maxElevation: 0,
          minElevation: 0
        });

        // Get elevation data for the route
        await getElevationProfile(route.geometry.coordinates);
        
        // Automatically snap waypoints to the route
        snapWaypointsToRoute(route.geometry);

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
         console.log('Surface segments to render:', Object.keys(surfaceSegments).map(type => ({
           type,
           featureCount: surfaceSegments[type as keyof typeof surfaceSegments].length
         })));
         
         Object.keys(surfaceSegments).forEach(surfaceType => {
           if (map.current && map.current.getSource(`route-${surfaceType}`)) {
             const features = surfaceSegments[surfaceType as keyof typeof surfaceSegments];
             console.log(`Setting ${features.length} features for surface type: ${surfaceType}`);
             (map.current.getSource(`route-${surfaceType}`) as mapboxgl.GeoJSONSource).setData({
               type: 'FeatureCollection',
               features: features
             });
           } else {
             console.warn(`Route source route-${surfaceType} not found on map`);
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

  // Function to snap waypoints to the route
  const snapWaypointsToRoute = useCallback((routeGeometry: any) => {
    if (!routeGeometry || !routeGeometry.coordinates || isSnapping) return;
    
    setIsSnapping(true);
    const routeCoords = routeGeometry.coordinates;
    
    setWaypoints(prev => prev.map(waypoint => {
      let closestPoint = waypoint.coordinates;
      let minDistance = Infinity;
      
      // Find the closest point on the route to this waypoint
      for (const coord of routeCoords) {
        const distance = calculateDistance(
          [waypoint.coordinates[1], waypoint.coordinates[0]], 
          [coord[1], coord[0]]
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = [coord[0], coord[1]] as [number, number];
        }
      }
      
      return {
        ...waypoint,
        coordinates: closestPoint
      };
    }));
    
    // Reset snapping flag after a short delay
    setTimeout(() => setIsSnapping(false), 100);
  }, [isSnapping]);

  // Get elevation profile using Open Elevation API
  const getElevationProfile = async (coordinates: number[][]) => {
    try {
      // Sample coordinates along the route (max 100 points to avoid API limits)
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
        
        // Calculate elevation statistics
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

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (coord1: [number, number], coord2: [number, number]) => {
    const R = 6371; // Earth's radius in km
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

    // Generate route if we have 2+ waypoints and we're not currently snapping
    if (waypoints.length >= 2 && !isSnapping) {
      console.log('Generating route for', waypoints.length, 'waypoints');
      generateRoute();
    } else {
      console.log('Clearing route - insufficient waypoints or currently snapping');
      if (waypoints.length < 2) {
        clearRoute();
      }
    }
  }, [waypoints, generateRoute, isSnapping]);

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
    setElevationProfile([]);
  };

  const clearAllWaypoints = () => {
    setWaypoints([]);
    setSelectedWaypoint(null);
    clearRoute();
  };

  const saveRoute = async () => {
    if (!routeGeometry || waypoints.length === 0 || !session?.user || !routeName.trim()) {
      toast({
        title: "Cannot Save Route",
        description: "Please ensure you have a valid route and enter a name.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('routes')
        .insert({
          user_id: session.user.id,
          name: routeName,
          waypoints: waypoints as any,
          route_geometry: routeGeometry as any,
          route_stats: routeStats as any
        });

      if (error) {
        console.error('Error saving route:', error);
        toast({
          title: "Save Failed",
          description: "Failed to save route. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Refresh saved routes list
      const { data } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false });
      
      setSavedRoutes(data || []);
      setShowSaveDialog(false);
      setRouteName('');

      toast({
        title: "Route Saved",
        description: `Route "${routeName}" has been saved successfully.`,
      });
    } catch (error) {
      console.error('Error saving route:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save route. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadRoute = async (routeId: string) => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();

      if (error || !data) {
        console.error('Error loading route:', error);
        toast({
          title: "Load Failed",
          description: "Failed to load route. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Load route data
      setWaypoints((data.waypoints as unknown as Waypoint[]) || []);
      setRouteGeometry(data.route_geometry);
      setRouteStats((data.route_stats as unknown as RouteStats) || { distance: 0, duration: 0, waypointCount: 0 });
      setShowLoadDialog(false);

      toast({
        title: "Route Loaded",
        description: `Route "${data.name}" has been loaded successfully.`,
      });

      // Center map on route
      if (data.waypoints && Array.isArray(data.waypoints) && data.waypoints.length > 0 && map.current) {
        const bounds = new mapboxgl.LngLatBounds();
        (data.waypoints as unknown as Waypoint[]).forEach((waypoint: Waypoint) => {
          bounds.extend(waypoint.coordinates);
        });
        map.current.fitBounds(bounds, { padding: 50 });
      }
    } catch (error) {
      console.error('Error loading route:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load route. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStravaRouteImported = (routeData: any) => {
    setStravaRoutes(prev => [...prev, routeData]);
  };

  const handleStravaRouteToggle = (routeId: number) => {
    setVisibleStravaRoutes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
        removeStravaRouteFromMap(routeId);
      } else {
        newSet.add(routeId);
        addStravaRouteToMap(routeId);
      }
      return newSet;
    });
  };

  const handleStravaRouteFocus = (routeId: number) => {
    const route = stravaRoutes.find(r => r.id === routeId);
    if (route && route.map?.summary_polyline && map.current) {
      const coordinates = decodePolyline(route.map.summary_polyline);
      const bounds = calculateBounds(coordinates);
      
      map.current.fitBounds([bounds[0], bounds[1]], { padding: 50 });
    }
  };

  const addStravaRouteToMap = (routeId: number) => {
    const route = stravaRoutes.find(r => r.id === routeId);
    if (!route || !route.map?.summary_polyline || !map.current) return;

    const coordinates = decodePolyline(route.map.summary_polyline);
    
    map.current.addSource(`strava-route-${routeId}`, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: { id: routeId, name: route.name },
        geometry: {
          type: 'LineString',
          coordinates
        }
      }
    });

    map.current.addLayer({
      id: `strava-route-${routeId}`,
      type: 'line',
      source: `strava-route-${routeId}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': 'hsl(210, 100%, 50%)',
        'line-width': 3,
        'line-opacity': 0.7
      }
    });
  };

  const removeStravaRouteFromMap = (routeId: number) => {
    if (!map.current) return;

    const sourceId = `strava-route-${routeId}`;
    
    if (map.current.getLayer(sourceId)) {
      map.current.removeLayer(sourceId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }
  };

  const exportRoute = () => {
    if (!routeGeometry || waypoints.length === 0) return;

    const timestamp = new Date().toISOString();
    const routeName = `Cycling Route ${new Date().toISOString().split('T')[0]}`;
    
    // Generate GPX content
    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Route Builder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${routeName}</name>
    <desc>Cycling route with ${waypoints.length} waypoints, ${routeStats.distance}${useMetric ? 'km' : 'mi'} distance</desc>
    <time>${timestamp}</time>
  </metadata>
`;

    // Add waypoints
    waypoints.forEach((waypoint, index) => {
      gpxContent += `  <wpt lat="${waypoint.coordinates[1]}" lon="${waypoint.coordinates[0]}">
    <name>Waypoint ${index + 1}</name>
    <desc>${waypoint.name || `Waypoint ${index + 1}`}</desc>
  </wpt>
`;
    });

    // Add route track
    if (routeGeometry && routeGeometry.coordinates) {
      gpxContent += `  <trk>
    <name>${routeName}</name>
    <desc>Generated cycling route</desc>
    <trkseg>
`;
      
      routeGeometry.coordinates.forEach((coord: [number, number]) => {
        gpxContent += `      <trkpt lat="${coord[1]}" lon="${coord[0]}"></trkpt>
`;
      });
      
      gpxContent += `    </trkseg>
  </trk>
`;
    }

    gpxContent += `</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycling-route-${new Date().toISOString().split('T')[0]}.gpx`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Route Exported",
      description: "GPX file has been downloaded successfully.",
    });
  };

  // Show loading state while getting token
  if (isLoadingToken) {
    console.log('Still loading token...', { isLoadingToken, session: !!session });
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
    console.log('No mapbox token available', { mapboxToken, isLoadingToken, session: !!session });
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
    <div className="w-full h-full bg-background relative">
        {/* Elevation Profile Panel */}
        {routeGeometry && elevationProfile.length > 0 && (
          <div className="absolute top-4 right-4 w-80 z-10">
            <Card className="p-4 shadow-card bg-background/95 backdrop-blur-md border">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-card-foreground">Route Analysis</h3>
                  <Button
                    onClick={() => setUseMetric(!useMetric)}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    {useMetric ? 'km' : 'mi'}
                  </Button>
                </div>
                  <div className="p-4 space-y-4">
                    {/* Route Statistics */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-card-foreground">Route Statistics</h3>
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
                        <div className="text-center p-2 bg-muted/30 rounded">
                          <div className="text-xs text-muted-foreground">Max Elevation</div>
                          <div className="font-medium">
                            {useMetric 
                              ? (routeStats.maxElevation || 0) 
                              : Math.round((routeStats.maxElevation || 0) * 3.28084)
                            }{useMetric ? 'm' : 'ft'}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-muted/30 rounded">
                          <div className="text-xs text-muted-foreground">Min Elevation</div>
                          <div className="font-medium">
                            {useMetric 
                              ? (routeStats.minElevation || 0) 
                              : Math.round((routeStats.minElevation || 0) * 3.28084)
                            }{useMetric ? 'm' : 'ft'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Elevation Profile Chart */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-card-foreground">Elevation Profile</h4>
                      <div className="h-32 w-full bg-muted/30 rounded-md relative overflow-hidden">
                        <svg
                          width="100%"
                          height="100%"
                          viewBox="0 0 400 128"
                          className="absolute inset-0"
                        >
                          {/* Grid lines */}
                          <defs>
                            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.3"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#grid)" />
                          
                          {/* Elevation curve */}
                          {elevationProfile.length > 1 && (
                            <polyline
                              fill="none"
                              stroke="hsl(var(--primary))"
                              strokeWidth="2"
                              points={elevationProfile.map((point, index) => {
                                const x = (index / (elevationProfile.length - 1)) * 400;
                                const minElev = Math.min(...elevationProfile.map(p => p.elevation));
                                const maxElev = Math.max(...elevationProfile.map(p => p.elevation));
                                const elevRange = maxElev - minElev || 1;
                                const y = 128 - ((point.elevation - minElev) / elevRange) * 110 - 9;
                                return `${x},${y}`;
                              }).join(' ')}
                            />
                          )}
                          
                          {/* Fill area under curve */}
                          {elevationProfile.length > 1 && (
                            <polygon
                              fill="hsl(var(--primary))"
                              fillOpacity="0.2"
                              points={[
                                ...elevationProfile.map((point, index) => {
                                  const x = (index / (elevationProfile.length - 1)) * 400;
                                  const minElev = Math.min(...elevationProfile.map(p => p.elevation));
                                  const maxElev = Math.max(...elevationProfile.map(p => p.elevation));
                                  const elevRange = maxElev - minElev || 1;
                                  const y = 128 - ((point.elevation - minElev) / elevRange) * 110 - 9;
                                  return `${x},${y}`;
                                }),
                                '400,128',
                                '0,128'
                              ].join(' ')}
                            />
                          )}
                        </svg>
                      </div>
                    </div>

                    {/* Surface Legend */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-card-foreground">Surface Types</h4>
                      <div className="space-y-2">
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
                  </div>
              </div>
            </Card>
          </div>
        )}

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />
          
        
          {/* Route Builder Tools - Top Left */}
          <div className="absolute top-4 left-4 space-y-4 z-20">
            <Card className="p-4 shadow-card bg-background/10 backdrop-blur-md border-white/20">
              <div className="space-y-3">
                <h2 className="font-semibold text-card-foreground flex items-center gap-2">
                  <Route className="h-4 w-4 text-primary" />
                  Route Builder
                </h2>
                
                <div className="space-y-2">
                  <Button
                    onClick={goToCurrentLocation}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Go to My Location
                  </Button>
                  
                  <StravaImport onRouteImported={handleStravaRouteImported} />
                  
                  {stravaRoutes.length > 0 && (
                    <StravaRoutesViewer 
                      routes={stravaRoutes}
                      visibleRoutes={visibleStravaRoutes}
                      onRouteToggle={handleStravaRouteToggle}
                      onRouteFocus={handleStravaRouteFocus}
                    />
                  )}
                  
                </div>
                
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

                {/* Load Route - Always Available */}
                <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Load Saved Route
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Load Saved Route</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {savedRoutes.length === 0 ? (
                        <p className="text-muted-foreground">No saved routes found.</p>
                      ) : (
                        <div className="space-y-2">
                          {savedRoutes.map((route) => (
                            <div
                              key={route.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{route.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(route.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <Button
                                onClick={() => loadRoute(route.id)}
                                size="sm"
                              >
                                Load
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" onClick={() => setShowLoadDialog(false)} className="w-full">
                        Cancel
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

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
                    <div className="flex gap-2">
                      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Route</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Input
                              placeholder="Enter route name..."
                              value={routeName}
                              onChange={(e) => setRouteName(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button onClick={saveRoute} disabled={!routeName.trim()} className="flex-1">
                                Save Route
                              </Button>
                              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        onClick={exportRoute}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </Card>

            {/* Route Stats - Compact version when sidebar is not available */}
            {routeStats.waypointCount > 0 && !(routeGeometry && elevationProfile.length > 0) && (
              <Card className="p-4 shadow-card bg-background/10 backdrop-blur-md border-white/20">
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
                  </div>
                </div>
              </Card>
            )}
          </div>
          
          {/* Waypoint List */}
          {waypoints.length > 0 && (
            <div className="absolute bottom-4 right-4 w-64 z-10">
              <Card className="p-4 shadow-card bg-background/10 backdrop-blur-md border-white/20">
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