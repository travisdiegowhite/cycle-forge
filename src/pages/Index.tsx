import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Route Builder</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>
          <button
            onClick={() => navigate("/strava-routes")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Strava Routes
          </button>
          <button
            onClick={handleSignOut}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <RouteMap />
    </div>
  );
};

export default Index;