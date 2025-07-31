import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const StravaImport: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Debug log to see current state
  console.log('StravaImport state:', { isOpen, loading });

  const connectToStrava = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { app_origin: window.location.origin }
      });
      
      if (error) {
        console.error('Error invoking Strava auth:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to Strava. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const authUrl = data?.authUrl;
      if (!authUrl) {
        console.error('No auth URL received:', data);
        toast({
          title: "Configuration Error", 
          description: "Strava authentication is not properly configured.",
          variant: "destructive",
        });
        return;
      }

      // Direct redirect to Strava auth (no popup)
      window.location.href = authUrl;
      // Don't set loading to false here since we're redirecting
      
    } catch (error) {
      console.error('Error connecting to Strava:', error);
      toast({
        title: "Connection Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Import from Strava
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Route from Strava</DialogTitle>
        </DialogHeader>
        
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Connect your Strava account to import your saved routes.
          </p>
          <Button onClick={connectToStrava} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect to Strava'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};