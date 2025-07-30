import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const action = url.searchParams.get('action');

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Strava credentials not configured');
    }

    // Handle OAuth callback
    if (code) {
      console.log('Processing OAuth callback with code:', code);
      
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenResponse.json();
      console.log('Token response:', tokenData);

      if (!tokenData.access_token) {
        throw new Error('Failed to get access token');
      }

      // Fetch athlete's routes
      const routesResponse = await fetch('https://www.strava.com/api/v3/athlete/routes', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const routes = await routesResponse.json();
      console.log('Found routes:', routes.length);

      return new Response(JSON.stringify({
        success: true,
        routes: routes,
        athlete: tokenData.athlete
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle route details request
    if (action === 'get-route' && url.searchParams.get('route_id') && url.searchParams.get('access_token')) {
      const routeId = url.searchParams.get('route_id');
      const accessToken = url.searchParams.get('access_token');

      const routeResponse = await fetch(`https://www.strava.com/api/v3/routes/${routeId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const routeData = await routeResponse.json();
      
      return new Response(JSON.stringify(routeData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default response for initial auth
    const redirectUri = `${url.origin}/functions/v1/strava-auth`;
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read,activity:read_all`;
    
    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Strava auth error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});