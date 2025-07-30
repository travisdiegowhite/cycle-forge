import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { MapPin, Clock, TrendingUp, Eye, EyeOff, Navigation } from 'lucide-react';

interface StravaRoute {
  id: number;
  name: string;
  description: string;
  distance: number;
  elevation_gain: number;
  estimated_moving_time: number;
  map: {
    summary_polyline: string;
  };
  starred: boolean;
  private: boolean;
}

interface StravaRoutesViewerProps {
  routes: StravaRoute[];
  visibleRoutes: Set<number>;
  onRouteToggle: (routeId: number) => void;
  onRouteFocus: (routeId: number) => void;
}

export const StravaRoutesViewer: React.FC<StravaRoutesViewerProps> = ({
  routes,
  visibleRoutes,
  onRouteToggle,
  onRouteFocus,
}) => {
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

  if (routes.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Strava Routes ({routes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        {routes.map((route) => (
          <div
            key={route.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">{route.name}</h4>
                {route.starred && (
                  <Badge variant="secondary" className="text-xs">
                    ⭐
                  </Badge>
                )}
                {route.private && (
                  <Badge variant="outline" className="text-xs">
                    Private
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatDistance(route.distance)}
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {formatElevation(route.elevation_gain)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(route.estimated_moving_time)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRouteFocus(route.id)}
                disabled={!visibleRoutes.has(route.id)}
              >
                <Navigation className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                {visibleRoutes.has(route.id) ? (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                )}
                <Switch
                  checked={visibleRoutes.has(route.id)}
                  onCheckedChange={() => onRouteToggle(route.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};