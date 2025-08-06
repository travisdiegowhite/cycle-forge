import React from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Route, Navigation, Search, FolderOpen, Trash2, Save, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { StravaImport } from './StravaImport';
import { StravaRoutesViewer } from './StravaRoutesViewer';
import LoadingSpinner from './LoadingSpinner';
import { Waypoint, StravaRoute, SavedRoute, MapboxRoute } from '@/types';

interface MapControlsProps {
  isRouteMode: boolean;
  setIsRouteMode: (mode: boolean) => void;
  isRouteModeRef: React.MutableRefObject<boolean>;
  waypoints: Waypoint[];
  routeGeometry: MapboxRoute['geometry'] | null;
  goToCurrentLocation: () => void;
  handleStravaRouteImported: (routeData: StravaRoute) => void;
  stravaRoutes: StravaRoute[];
  visibleStravaRoutes: Set<number>;
  handleStravaRouteToggle: (routeId: number) => void;
  handleStravaRouteFocus: (routeId: number) => void;
  clearAllWaypoints: () => void;
  showSaveDialog: boolean;
  setShowSaveDialog: (show: boolean) => void;
  showLoadDialog: boolean;
  setShowLoadDialog: (show: boolean) => void;
  routeName: string;
  setRouteName: (name: string) => void;
  saveRoute: () => void;
  exportRoute: () => void;
  savedRoutes: SavedRoute[];
  loadRoute: (routeId: string) => void;
  locationSearch: string;
  setLocationSearch: (search: string) => void;
  searchLocation: () => void;
  isLoadingLocation: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  isRouteMode,
  setIsRouteMode,
  isRouteModeRef,
  waypoints,
  routeGeometry,
  goToCurrentLocation,
  handleStravaRouteImported,
  stravaRoutes,
  visibleStravaRoutes,
  handleStravaRouteToggle,
  handleStravaRouteFocus,
  clearAllWaypoints,
  showSaveDialog,
  setShowSaveDialog,
  showLoadDialog,
  setShowLoadDialog,
  routeName,
  setRouteName,
  saveRoute,
  exportRoute,
  savedRoutes,
  loadRoute,
  locationSearch,
  setLocationSearch,
  searchLocation,
  isLoadingLocation,
}) => {
  return (
    <div className="absolute top-4 left-4 space-y-4 z-20">
      <Card className="p-4 shadow-card bg-background/10 backdrop-blur-md border-white/20">
        <div className="space-y-3">
          <h2 className="font-semibold text-card-foreground flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            Route Builder
          </h2>
          
          {/* Location Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search location..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
              className="text-xs"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={searchLocation}
                  variant="outline"
                  size="icon"
                  disabled={isLoadingLocation}
                  className="h-8 w-8"
                >
                  {isLoadingLocation ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search Location</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={goToCurrentLocation}
                  variant="outline"
                  size="icon"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Go to My Location</p>
              </TooltipContent>
            </Tooltip>
            
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
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  console.log('Route mode button clicked, current state:', isRouteMode);
                  const newRouteMode = !isRouteMode;
                  setIsRouteMode(newRouteMode);
                  isRouteModeRef.current = newRouteMode;
                  console.log('Route mode will be:', newRouteMode);
                }}
                variant={isRouteMode ? "default" : "outline"}
                size="icon"
              >
                <Route className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isRouteMode ? 'Exit Route Mode' : 'Start Building Route'}</p>
            </TooltipContent>
          </Tooltip>

          {isRouteMode && (
            <p className="text-xs text-muted-foreground">
              Click on the map to add waypoints
            </p>
          )}

          {/* Load Route - Always Available */}
          <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
            <DialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Load Saved Route</p>
                </TooltipContent>
              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={clearAllWaypoints}
                    variant="outline"
                    size="icon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear All</p>
                </TooltipContent>
              </Tooltip>
              
            {routeGeometry && (
              <div className="flex gap-2 justify-center">
                <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                  <DialogTrigger asChild>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save</p>
                      </TooltipContent>
                    </Tooltip>
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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={exportRoute}
                      variant="outline"
                      size="icon"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MapControls;