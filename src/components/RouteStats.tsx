import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface RouteStats {
  distance: number;
  duration: number;
  waypointCount: number;
  elevationGain?: number;
  elevationLoss?: number;
  maxElevation?: number;
  minElevation?: number;
}

interface RouteStatsProps {
  routeStats: RouteStats;
  useMetric: boolean;
  setUseMetric: (metric: boolean) => void;
  showCompact?: boolean;
}

const RouteStats: React.FC<RouteStatsProps> = ({
  routeStats,
  useMetric,
  setUseMetric,
  showCompact = false,
}) => {
  if (showCompact && routeStats.waypointCount > 0) {
    return (
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
    );
  }

  return (
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
  );
};

export default RouteStats;