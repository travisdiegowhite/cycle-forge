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
      
      const redirectUri = `https://kmyjfflvxgllibbybwbs.supabase.co/functions/v1/strava-auth`;
      console.log('Using redirect URI:', redirectUri);
      console.log('Using client ID:', clientId);
      console.log('Client secret exists:', !!clientSecret);
      
      const tokenPayload = {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      };
      
      console.log('Token request payload:', { ...tokenPayload, client_secret: '[HIDDEN]' });
      
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenPayload)
      });

      const tokenData = await tokenResponse.json();
      console.log('Token response status:', tokenResponse.status);
      console.log('Token response:', tokenData);

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error('Token exchange failed:', tokenData);
        throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
      }

      // Fetch athlete's routes
      const routesResponse = await fetch('https://www.strava.com/api/v3/athlete/routes', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const routes = await routesResponse.json();
      console.log('Found routes:', routes.length);

      // Store auth data in URL and redirect back to app
      const appOrigin = url.searchParams.get('app_origin') || 'https://8523dd48-6a5c-4647-b24a-1fd9b88b27fd.lovableproject.com';
      const callbackUrl = new URL('/strava-routes', appOrigin);
      
      // Add auth data as URL parameters (encode for safety)
      callbackUrl.searchParams.set('strava_success', 'true');
      callbackUrl.searchParams.set('access_token', tokenData.access_token);
      callbackUrl.searchParams.set('athlete_id', tokenData.athlete.id.toString());
      callbackUrl.searchParams.set('routes_count', routes.length.toString());
      
      // Store routes data in sessionStorage via a redirect page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Strava Auth Success</title>
        </head>
        <body>
          <p>Authentication successful! Redirecting...</p>
          <script>
            // Store routes data in sessionStorage
            const routesData = ${JSON.stringify(routes)};
            const athleteData = ${JSON.stringify(tokenData.athlete)};
            
            sessionStorage.setItem('strava_routes', JSON.stringify(routesData));
            sessionStorage.setItem('strava_athlete', JSON.stringify(athleteData));
            sessionStorage.setItem('strava_access_token', '${tokenData.access_token}');
            
            // Redirect to app
            window.location.href = '${callbackUrl.toString()}';
          </script>
        </body>
        </html>
      `;

      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
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
    const appOrigin = url.searchParams.get('app_origin') || req.headers.get('referer') || 'https://8523dd48-6a5c-4647-b24a-1fd9b88b27fd.lovableproject.com';
    const redirectUri = `https://kmyjfflvxgllibbybwbs.supabase.co/functions/v1/strava-auth?app_origin=${encodeURIComponent(appOrigin)}`;
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