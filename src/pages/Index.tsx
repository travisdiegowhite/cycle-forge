import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { MapToolbar } from "@/components/MapToolbar";
import RouteMap from "@/components/RouteMap";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isRouteMode, setIsRouteMode] = useState(false);

  // Expose toggle function for MapToolbar
  useEffect(() => {
    (window as any).toggleRouteMode = () => {
      console.log('Toggle route mode called from global function');
      setIsRouteMode(prev => !prev);
    };
  }, []);

  useEffect(() => {
    // Redirect to auth page if not authenticated
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    <div className="min-h-screen w-full bg-background relative">
      <AppHeader />
      <MapToolbar />
      <RouteMap isRouteMode={isRouteMode} setIsRouteMode={setIsRouteMode} />
    </div>
  );
};

export default Index;