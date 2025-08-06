import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Route, 
  Navigation, 
  Search, 
  MapPin,
  Plus,
  Trash2,
  Save,
  Download,
  FolderOpen,
  Activity,
  TrendingUp,
  Clock,
  Mountain
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Waypoint, RouteStats } from '@/types';
import { cn } from '@/lib/utils';

interface RouteBuilderSidebarProps {
  // Route Building
  isRouteMode: boolean;
  onToggleRouteMode: () => void;
  waypoints: Waypoint[];
  onClearWaypoints: () => void;
  selectedWaypoint: string | null;
  onSelectWaypoint: (id: string | null) => void;
  onDeleteWaypoint: (id: string) => void;

  // Location Search
  locationSearch: string;
  onLocationSearchChange: (value: string) => void;
  onLocationSearch: () => void;
  isLoadingLocation: boolean;
  onGoToCurrentLocation: () => void;

  // Route Stats
  routeStats: RouteStats;
  useMetric: boolean;
  onToggleMetric: () => void;

  // Route Management
  onSaveRoute: () => void;
  onLoadRoute: () => void;
  onExportRoute: () => void;
  hasUnsavedChanges: boolean;

  // Strava Integration
  onStravaImport: () => void;
  stravaRoutes: { id: number; name: string }[];
}

const RouteBuilderSidebar: React.FC<RouteBuilderSidebarProps> = ({
  isRouteMode,
  onToggleRouteMode,
  waypoints,
  onClearWaypoints,
  selectedWaypoint,
  onSelectWaypoint,
  onDeleteWaypoint,
  locationSearch,
  onLocationSearchChange,
  onLocationSearch,
  isLoadingLocation,
  onGoToCurrentLocation,
  routeStats,
  useMetric,
  onToggleMetric,
  onSaveRoute,
  onLoadRoute,
  onExportRoute,
  hasUnsavedChanges,
  onStravaImport,
  stravaRoutes,
}) => {
  const hasRoute = waypoints.length >= 2;

  return (
    <div className="space-y-6">
      {/* Route Building Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Route className="h-5 w-5 text-primary" />
            Route Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Route Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onToggleRouteMode}
              variant={isRouteMode ? "default" : "outline"}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isRouteMode ? 'Exit Route Mode' : 'Start Building'}
            </Button>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">
                Unsaved
              </Badge>
            )}
          </div>

          {isRouteMode && (
            <div className="p-3 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 inline mr-1" />
                Click on the map to add waypoints
              </p>
            </div>
          )}

          {/* Location Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Location</label>
            <div className="flex gap-2">
              <Input
                placeholder="Search for a place..."
                value={locationSearch}
                onChange={(e) => onLocationSearchChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onLocationSearch()}
                className="flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onLocationSearch}
                    variant="outline"
                    size="icon"
                    disabled={isLoadingLocation || !locationSearch.trim()}
                  >
                    {isLoadingLocation ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search Location</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onGoToCurrentLocation}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  My Location
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go to current location</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Waypoints Section */}
      {waypoints.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Waypoints ({waypoints.length})
              </CardTitle>
              <Button
                onClick={onClearWaypoints}
                variant="outline"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {waypoints.map((waypoint, index) => (
                <div
                  key={waypoint.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors",
                    selectedWaypoint === waypoint.id 
                      ? "bg-accent border border-accent-foreground/20" 
                      : "bg-muted/50 hover:bg-muted"
                  )}
                  onClick={() => onSelectWaypoint(
                    selectedWaypoint === waypoint.id ? null : waypoint.id
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {waypoint.name || `Waypoint ${index + 1}`}
                      </div>
                      {selectedWaypoint === waypoint.id && (
                        <div className="text-xs text-muted-foreground">
                          {waypoint.coordinates[1].toFixed(4)}, {waypoint.coordinates[0].toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteWaypoint(waypoint.id);
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
          </CardContent>
        </Card>
      )}

      {/* Route Stats Section */}
      {hasRoute && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Route Stats
              </CardTitle>
              <Button
                onClick={onToggleMetric}
                variant="outline"
                size="sm"
              >
                {useMetric ? 'km' : 'mi'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Distance</div>
                <div className="font-semibold">
                  {routeStats.distance} {useMetric ? 'km' : 'mi'}
                </div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="font-semibold flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  {routeStats.duration}m
                </div>
              </div>
              {routeStats.elevationGain !== undefined && (
                <>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">Elevation Gain</div>
                    <div className="font-semibold text-green-600 flex items-center justify-center gap-1">
                      <Mountain className="h-3 w-3" />
                      +{useMetric 
                        ? Math.round(routeStats.elevationGain) 
                        : Math.round(routeStats.elevationGain * 3.28084)
                      }{useMetric ? 'm' : 'ft'}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">Max Elevation</div>
                    <div className="font-semibold">
                      {useMetric 
                        ? Math.round(routeStats.maxElevation || 0) 
                        : Math.round((routeStats.maxElevation || 0) * 3.28084)
                      }{useMetric ? 'm' : 'ft'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Route Actions */}
      {hasRoute && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onSaveRoute} variant="outline" size="sm">
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save Route</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onExportRoute} variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export GPX</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onLoadRoute} variant="outline" size="sm">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Load Route</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strava Integration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Strava Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={onStravaImport} variant="outline" className="w-full">
            <Activity className="h-4 w-4 mr-2" />
            Import from Strava
          </Button>
          {stravaRoutes.length > 0 && (
            <div className="mt-3 p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground">
                {stravaRoutes.length} route(s) imported
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteBuilderSidebar;