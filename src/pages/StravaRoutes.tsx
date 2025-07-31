import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, TrendingUp, ArrowLeft } from "lucide-react";
import { StravaImport } from "@/components/StravaImport";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  // Handle Strava OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stravaSuccess = urlParams.get('strava_success');
    
    console.log('StravaRoutes callback check:', {
      url: window.location.href,
      stravaSuccess,
      hasParams: window.location.search.length > 0
    });
    
    if (stravaSuccess === 'true') {
      console.log('Processing Strava callback...');
      
      // Get routes from sessionStorage
      const routesData = sessionStorage.getItem('strava_routes');
      const athleteData = sessionStorage.getItem('strava_athlete');
      
      console.log('SessionStorage data:', {
        routesData: routesData ? routesData.substring(0, 100) + '...' : null,
        athleteData: athleteData ? athleteData.substring(0, 100) + '...' : null
      });
      
      if (routesData) {
        try {
          const routes = JSON.parse(routesData);
          const athlete = athleteData ? JSON.parse(athleteData) : null;
          
          console.log('Parsed data:', {
            routesCount: routes.length,
            athlete: athlete?.firstname || 'unknown'
          });
          
          setImportedRoutes(routes);
          
          // Clear stored data
          sessionStorage.removeItem('strava_routes');
          sessionStorage.removeItem('strava_athlete');
          sessionStorage.removeItem('strava_access_token');
          
          // Clean up URL
          window.history.replaceState({}, '', '/strava-routes');
          
          // Show success message
          toast({
            title: "Connected to Strava!",
            description: `Successfully imported ${routes.length} routes from ${athlete?.firstname || 'your'} Strava account.`,
          });
        } catch (error) {
          console.error('Error parsing Strava data:', error);
          toast({
            title: "Import Error",
            description: "Failed to process Strava data.",
            variant: "destructive",
          });
        }
      } else {
        console.error('No routes data found in sessionStorage');
      }
    }
  }, [toast]);

  // No authentication required for Strava import flow

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90">
        <div className="text-center">
          <div className="animate-pulse text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Show page regardless of authentication status for Strava flow

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Route Builder
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Strava Routes
              </h1>
              <p className="text-xl text-muted-foreground">
                Import and manage your Strava routes
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          )}
        </div>

        <div className="mb-6">
          <StravaImport />
        </div>

        {importedRoutes.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
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
  );
};

export default StravaRoutes;