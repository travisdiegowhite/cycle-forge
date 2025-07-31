import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { StravaImport } from './StravaImport';
import { StravaRoutesViewer } from './StravaRoutesViewer';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "./ui/sidebar";
import { 
  MapPin, 
  Route, 
  Trash2, 
  Download, 
  Search, 
  Navigation, 
  Save, 
  FolderOpen,
  Settings
} from 'lucide-react';

interface RouteSidebarProps {
  // Location controls
  locationSearch: string;
  setLocationSearch: (value: string) => void;
  onSearchLocation: () => void;
  onGoToCurrentLocation: () => void;
  isLoadingLocation: boolean;
  useMetric: boolean;
  setUseMetric: (value: boolean) => void;
  
  // Route building
  isRouteMode: boolean;
  onToggleRouteMode: () => void;
  waypoints: any[];
  onClearWaypoints: () => void;
  routeGeometry: any;
  
  // Save/Load
  showSaveDialog: boolean;
  setShowSaveDialog: (show: boolean) => void;
  showLoadDialog: boolean;
  setShowLoadDialog: (show: boolean) => void;
  routeName: string;
  setRouteName: (name: string) => void;
  onSaveRoute: () => void;
  savedRoutes: any[];
  onLoadRoute: (id: string) => void;
  onExportGPX: () => void;
  
  // Strava
  stravaRoutes: any[];
  visibleStravaRoutes: Set<number>;
  onStravaRouteImported: (route: any) => void;
  onStravaRouteToggle: (id: number) => void;
  onStravaRouteFocus: (route: any) => void;
  
  // Waypoint management
  selectedWaypoint: string | null;
  onRemoveWaypoint: (id: string) => void;
}

const RouteSidebar: React.FC<RouteSidebarProps> = ({
  locationSearch,
  setLocationSearch,
  onSearchLocation,
  onGoToCurrentLocation,
  isLoadingLocation,
  useMetric,
  setUseMetric,
  isRouteMode,
  onToggleRouteMode,
  waypoints,
  onClearWaypoints,
  routeGeometry,
  showSaveDialog,
  setShowSaveDialog,
  showLoadDialog,
  setShowLoadDialog,
  routeName,
  setRouteName,
  onSaveRoute,
  savedRoutes,
  onLoadRoute,
  onExportGPX,
  stravaRoutes,
  visibleStravaRoutes,
  onStravaRouteImported,
  onStravaRouteToggle,
  onStravaRouteFocus,
  selectedWaypoint,
  onRemoveWaypoint,
}) => {
  return (
    <Sidebar className="w-80" collapsible="icon">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 p-4">
          <Route className="h-5 w-5 text-primary" />
          <span className="font-semibold">Route Builder</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Location & Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Location & Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-3 p-2">
              {/* Location Search */}
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Input
                    placeholder="Search location..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && onSearchLocation()}
                    className="flex-1"
                  />
                  <Button
                    onClick={onSearchLocation}
                    size="sm"
                    variant="outline"
                    disabled={isLoadingLocation}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button
                  onClick={onGoToCurrentLocation}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Go to My Location
                </Button>
              </div>

              {/* Units Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Units</span>
                <Button
                  onClick={() => setUseMetric(!useMetric)}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                >
                  {useMetric ? 'Metric' : 'Imperial'}
                </Button>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Route Building */}
        <SidebarGroup>
          <SidebarGroupLabel>Route Building</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-3 p-2">
              <Button
                onClick={onToggleRouteMode}
                variant={isRouteMode ? "default" : "outline"}
                className="w-full"
              >
                {isRouteMode ? 'Exit Route Mode' : 'Start Building Route'}
              </Button>

              {isRouteMode && (
                <p className="text-xs text-muted-foreground text-center">
                  Click on the map to add waypoints
                </p>
              )}

              {waypoints.length > 0 && (
                <Button
                  onClick={onClearWaypoints}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Clear All Waypoints
                </Button>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Waypoint Management */}
        {waypoints.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Waypoints ({waypoints.length})</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {waypoints.map((waypoint, index) => (
                  <SidebarMenuItem key={waypoint.id}>
                    <SidebarMenuButton
                      className={`justify-between ${
                        selectedWaypoint === waypoint.id ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span className="text-sm">{waypoint.name || `Point ${index + 1}`}</span>
                      </div>
                      <Button
                        onClick={() => onRemoveWaypoint(waypoint.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Route Management */}
        {routeGeometry && (
          <SidebarGroup>
            <SidebarGroupLabel>Route Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-2 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
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
                          <Button onClick={onSaveRoute} disabled={!routeName.trim()} className="flex-1">
                            Save Route
                          </Button>
                          <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        Load
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
                          <div className="space-y-2 max-h-60 overflow-y-auto">
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
                                  onClick={() => onLoadRoute(route.id)}
                                  size="sm"
                                >
                                  Load
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <Button
                  onClick={onExportGPX}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Download className="h-3 w-3 mr-2" />
                  Export GPX
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Strava Integration */}
        <SidebarGroup>
          <SidebarGroupLabel>Strava Integration</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-3 p-2">
              <StravaImport onRouteImported={onStravaRouteImported} />
              
              {stravaRoutes.length > 0 && (
                <StravaRoutesViewer 
                  routes={stravaRoutes}
                  visibleRoutes={visibleStravaRoutes}
                  onRouteToggle={onStravaRouteToggle}
                  onRouteFocus={onStravaRouteFocus}
                />
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default RouteSidebar;