import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, TrendingUp } from "lucide-react";
import { StravaImport } from "@/components/StravaImport";
import AppLayout from "@/components/layout/AppLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

interface StravaRoute {
  id: number;
  name: string;
  description: string;
  distance: number;
  elevation_gain: number;
  type: number;
  sub_type: number;
  created_at: string;
  updated_at: string;
  private: boolean;
  starred: boolean;
  estimated_moving_time: number;
  map?: {
    polyline?: string;
    summary_polyline?: string;
  };
}

const StravaRoutes = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [importedRoutes, setImportedRoutes] = useState<StravaRoute[]>([]);

  useEffect(() => {
    // Redirect to auth page if not authenticated
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleRouteImported = (route: StravaRoute) => {
    setImportedRoutes(prev => [...prev, route]);
  };

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

  // Show loading while checking auth state
  if (loading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mb-4" />
            <div className="text-lg text-muted-foreground">Loading...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Strava Routes
              </h1>
              <p className="text-lg text-muted-foreground">
                Import and manage your Strava routes
              </p>
            </div>

            <StravaImport onRouteImported={handleRouteImported} />
          </div>

          {importedRoutes.length > 0 ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Imported Routes ({importedRoutes.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {importedRoutes.map((route) => (
                  <Card key={route.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{route.name}</CardTitle>
                      {route.description && (
                        <CardDescription className="line-clamp-2">
                          {route.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span>{formatDistance(route.distance)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span>{formatElevation(route.elevation_gain)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>{formatTime(route.estimated_moving_time)}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          {route.starred && (
                            <Badge variant="secondary">
                              ⭐ Starred
                            </Badge>
                          )}
                          {route.private && (
                            <Badge variant="outline">
                              Private
                            </Badge>
                          )}
                        </div>
                        
                        <Button variant="outline" className="w-full">
                          View on Map
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No routes imported yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Use the "Import from Strava" button above to connect your Strava account and import your saved routes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default StravaRoutes;