import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { Waypoint } from '@/types';

interface WaypointListProps {
  waypoints: Waypoint[];
  selectedWaypoint: string | null;
  setSelectedWaypoint: (id: string | null) => void;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
}

const WaypointList: React.FC<WaypointListProps> = ({
  waypoints,
  selectedWaypoint,
  setSelectedWaypoint,
  setWaypoints,
}) => {
  if (waypoints.length === 0) {
    return null;
  }

  const handleWaypointClick = (waypointId: string) => {
    setSelectedWaypoint(selectedWaypoint === waypointId ? null : waypointId);
  };

  const handleDeleteWaypoint = (waypointId: string) => {
    setWaypoints(prev => prev.filter(w => w.id !== waypointId));
    if (selectedWaypoint === waypointId) {
      setSelectedWaypoint(null);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 w-64 z-10">
      <Card className="p-4 shadow-card bg-background/10 backdrop-blur-md border-white/20">
        <h3 className="font-medium text-card-foreground mb-3">Waypoints</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {waypoints.map((waypoint, index) => (
            <div
              key={waypoint.id}
              className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                selectedWaypoint === waypoint.id 
                  ? 'bg-primary/20 border border-primary/30' 
                  : 'bg-secondary/50 hover:bg-secondary/70'
              }`}
              onClick={() => handleWaypointClick(waypoint.id)}
            >
              <span className="text-sm font-medium">
                {index + 1}. Waypoint {index + 1}
                {selectedWaypoint === waypoint.id && (
                  <span className="ml-2 text-xs text-primary">(selected)</span>
                )}
              </span>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteWaypoint(waypoint.id);
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
  );
};

export default WaypointList;