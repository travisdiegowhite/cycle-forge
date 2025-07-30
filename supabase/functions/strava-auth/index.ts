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

      // Return HTML with JavaScript to communicate with parent window
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Strava Auth Success</title>
        </head>
        <body>
          <p>Authentication successful! Closing window...</p>
          <script>
            if (window.opener) {
              // Post message to all possible parent origins
              const possibleOrigins = [
                'https://8523dd48-6a5c-4647-b24a-1fd9b88b27fd.lovableproject.com',
                'https://lovable.dev',
                'http://localhost:3000',
                '*'
              ];
              
              const messageData = {
                type: 'STRAVA_AUTH_SUCCESS',
                routes: ${JSON.stringify(routes)},
                accessToken: '${tokenData.access_token}',
                athlete: ${JSON.stringify(tokenData.athlete)}
              };
              
              // Try posting to each possible origin
              possibleOrigins.forEach(origin => {
                try {
                  window.opener.postMessage(messageData, origin);
                } catch (e) {
                  console.log('Failed to post to origin:', origin, e);
                }
              });
              
              // Also try posting to the referrer if available
              if (document.referrer) {
                try {
                  const referrerOrigin = new URL(document.referrer).origin;
                  window.opener.postMessage(messageData, referrerOrigin);
                } catch (e) {
                  console.log('Failed to post to referrer origin:', e);
                }
              }
              
              window.close();
            } else {
              // Fallback for when popup blocker prevents window.opener
              document.body.innerHTML = '<p>Authentication successful! You can close this window.</p>';
            }
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
    const redirectUri = `https://kmyjfflvxgllibbybwbs.supabase.co/functions/v1/strava-auth`;
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