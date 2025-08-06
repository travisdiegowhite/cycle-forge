// Core types for the application

export interface Waypoint {
  id: string;
  coordinates: [number, number];
  name?: string;
}

export interface RouteStats {
  distance: number;
  duration: number;
  waypointCount: number;
  elevationGain?: number;
  elevationLoss?: number;
  maxElevation?: number;
  minElevation?: number;
}

export interface ElevationPoint {
  distance: number;
  elevation: number;
}

// Strava Types
export interface StravaMap {
  id: string;
  summary_polyline: string;
  resource_state: number;
}

export interface StravaRoute {
  id: number;
  name: string;
  description?: string;
  distance: number;
  elevation_gain: number;
  map: StravaMap;
  type: number;
  sub_type: number;
  created_at: string;
  updated_at: string;
  estimated_moving_time: number;
  segments: StravaSegment[];
}

export interface StravaSegment {
  id: number;
  name: string;
  activity_type: string;
  distance: number;
  average_grade: number;
  maximum_grade: number;
  elevation_high: number;
  elevation_low: number;
}

// Mapbox Types
export interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs: MapboxLeg[];
}

export interface MapboxLeg {
  distance: number;
  duration: number;
  steps: MapboxStep[];
}

export interface MapboxStep {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  name: string;
  ref?: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
  intersections?: MapboxIntersection[];
}

export interface MapboxIntersection {
  location: [number, number];
  bearings: number[];
  classes?: string[];
}

// Database Types
export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;
  waypoints: Waypoint[];
  route_geometry: MapboxRoute['geometry'];
  route_stats: RouteStats;
  created_at: string;
  updated_at: string;
}

// Surface type for route segments
export type SurfaceType = 'paved' | 'unpaved' | 'path' | 'ferry' | 'default';

export interface SurfaceSegment {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    surface: SurfaceType;
    name?: string;
    distance?: number;
  };
}

export interface SurfaceSegments {
  paved: SurfaceSegment[];
  unpaved: SurfaceSegment[];
  path: SurfaceSegment[];
  ferry: SurfaceSegment[];
  default: SurfaceSegment[];
}