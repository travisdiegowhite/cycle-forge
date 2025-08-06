import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import RecoveryErrorBoundary from "@/components/RecoveryErrorBoundary";
import AppLayout from "@/components/layout/AppLayout";
import RouteBuilderSidebar from "@/components/layout/RouteBuilderSidebar";
import RouteMapSimple from "@/components/RouteMapSimple";
import { Waypoint, RouteStats, ElevationPoint, StravaRoute, MapboxRoute } from "@/types";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Route building state
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<MapboxRoute['geometry'] | null>(null);
  const [routeStats, setRouteStats] = useState<RouteStats>({
    distance: 0,
    duration: 0,
    elevationGain: 0,
    maxElevation: 0
  });
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  
  // UI state
  const [locationSearch, setLocationSearch] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [useMetric, setUseMetric] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Strava state
  const [stravaRoutes, setStravaRoutes] = useState<StravaRoute[]>([]);
  const [visibleStravaRoutes, setVisibleStravaRoutes] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Redirect to auth page if not authenticated
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Route building handlers
  const handleToggleRouteMode = useCallback(() => {
    setIsRouteMode(prev => !prev);
    if (isRouteMode) {
      setSelectedWaypoint(null);
    }
  }, [isRouteMode]);

  const handleClearWaypoints = useCallback(() => {
    setWaypoints([]);
    setSelectedWaypoint(null);
    setRouteGeometry(null);
    setRouteStats({ distance: 0, duration: 0, elevationGain: 0, maxElevation: 0 });
    setElevationProfile([]);
    setHasUnsavedChanges(false);
  }, []);

  const handleDeleteWaypoint = useCallback((waypointId: string) => {
    setWaypoints(prev => prev.filter(wp => wp.id !== waypointId));
    if (selectedWaypoint === waypointId) {
      setSelectedWaypoint(null);
    }
    setHasUnsavedChanges(true);
  }, [selectedWaypoint]);

  // Location search handlers
  const handleLocationSearch = useCallback(async () => {
    if (!locationSearch.trim()) return;
    
    setIsLoadingLocation(true);
    try {
      // Implement location search logic here
      toast({
        title: "Search",
        description: `Searching for: ${locationSearch}`,
      });
    } catch (error) {
      toast({
        title: "Search Error",
        description: "Failed to search location",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocation(false);
    }
  }, [locationSearch, toast]);

  const handleGoToCurrentLocation = useCallback(() => {
    // This will be handled by the map component
    toast({
      title: "Location",
      description: "Centering on your location",
    });
  }, [toast]);

  // Route management handlers
  const handleSaveRoute = useCallback(() => {
    toast({
      title: "Save Route",
      description: "Route saving functionality to be implemented",
    });
  }, [toast]);

  const handleLoadRoute = useCallback(() => {
    toast({
      title: "Load Route",
      description: "Route loading functionality to be implemented",
    });
  }, [toast]);

  const handleExportRoute = useCallback(() => {
    toast({
      title: "Export Route",
      description: "GPX export functionality to be implemented",
    });
  }, [toast]);

  // Strava handlers
  const handleStravaImport = useCallback(() => {
    navigate('/strava-routes');
  }, [navigate]);

  const handleStravaRouteToggle = useCallback((routeId: number) => {
    setVisibleStravaRoutes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      return newSet;
    });
  }, []);

  const handleStravaRouteFocus = useCallback((routeId: number) => {
    // Focus on specific Strava route
    toast({
      title: "Strava Route",
      description: `Focusing on route ${routeId}`,
    });
  }, [toast]);

  // Update unsaved changes when waypoints change
  useEffect(() => {
    if (waypoints.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [waypoints]);

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90">
        <div className="text-center">
          <div className="animate-pulse text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  const sidebar = (
    <RouteBuilderSidebar
      isRouteMode={isRouteMode}
      onToggleRouteMode={handleToggleRouteMode}
      waypoints={waypoints}
      onClearWaypoints={handleClearWaypoints}
      selectedWaypoint={selectedWaypoint}
      onSelectWaypoint={setSelectedWaypoint}
      onDeleteWaypoint={handleDeleteWaypoint}
      locationSearch={locationSearch}
      onLocationSearchChange={setLocationSearch}
      onLocationSearch={handleLocationSearch}
      isLoadingLocation={isLoadingLocation}
      onGoToCurrentLocation={handleGoToCurrentLocation}
      routeStats={routeStats}
      useMetric={useMetric}
      onToggleMetric={() => setUseMetric(prev => !prev)}
      onSaveRoute={handleSaveRoute}
      onLoadRoute={handleLoadRoute}
      onExportRoute={handleExportRoute}
      hasUnsavedChanges={hasUnsavedChanges}
      onStravaImport={handleStravaImport}
      stravaRoutes={stravaRoutes}
    />
  );

  return (
    <AppLayout sidebar={sidebar} sidebarWidth="lg">
      <RecoveryErrorBoundary
        autoRecovery={true}
        showDetails={process.env.NODE_ENV === 'development'}
        onError={(error, errorInfo) => {
          console.error('RouteMap Error:', error, errorInfo);
        }}
        onRecoveryAttempt={async () => {
          console.log('Attempting to recover RouteMap...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
        fallback={
          <div className="h-full flex items-center justify-center bg-muted">
            <div className="text-center p-8">
              <div className="text-lg text-foreground mb-2">Map Unavailable</div>
              <div className="text-sm text-muted-foreground mb-4">
                We're having trouble loading the map. This could be due to network issues or browser compatibility.
              </div>
            </div>
          </div>
        }
      >
        <RouteMapSimple
          isRouteMode={isRouteMode}
          waypoints={waypoints}
          setWaypoints={setWaypoints}
          selectedWaypoint={selectedWaypoint}
          setSelectedWaypoint={setSelectedWaypoint}
          routeGeometry={routeGeometry}
          setRouteGeometry={setRouteGeometry}
          routeStats={routeStats}
          setRouteStats={setRouteStats}
          elevationProfile={elevationProfile}
          setElevationProfile={setElevationProfile}
          useMetric={useMetric}
          onLocationSearch={handleLocationSearch}
          onGoToCurrentLocation={handleGoToCurrentLocation}
          stravaRoutes={stravaRoutes}
          visibleStravaRoutes={visibleStravaRoutes}
          onStravaRouteToggle={handleStravaRouteToggle}
          onStravaRouteFocus={handleStravaRouteFocus}
        />
      </RecoveryErrorBoundary>
    </AppLayout>
  );
};

export default Index;