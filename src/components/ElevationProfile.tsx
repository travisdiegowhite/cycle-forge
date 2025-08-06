import React from 'react';

interface ElevationPoint {
  distance: number;
  elevation: number;
}

interface ElevationProfileProps {
  elevationProfile: ElevationPoint[];
  useMetric: boolean;
}

const ElevationProfile: React.FC<ElevationProfileProps> = ({
  elevationProfile,
  useMetric,
}) => {
  if (elevationProfile.length === 0) {
    return null;
  }

  return (
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
  );
};

export default ElevationProfile;