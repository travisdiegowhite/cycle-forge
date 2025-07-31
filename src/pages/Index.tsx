import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import RouteMap from "@/components/RouteMap";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

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

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background/95 to-background/90">
        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-bold text-foreground">Route Builder</h1>
                <p className="text-sm text-muted-foreground">Plan your perfect route</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/strava-routes')}>
                Strava Routes
              </Button>
              <span className="text-sm text-muted-foreground">
                Welcome, {user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 pt-16">
          <RouteMap />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;