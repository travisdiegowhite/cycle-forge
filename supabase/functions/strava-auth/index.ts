import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Strava credentials not configured');
    }

    // Check if this is a callback request first (before auth check)
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (code && returnedState) {
      // This is the OAuth callback from Strava - handle without user auth
      console.log('Processing OAuth callback with code:', code);
      
      const redirectUri = `https://kmyjfflvxgllibbybwbs.supabase.co/functions/v1/strava-auth`;
      const tokenPayload = {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      };
      
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenPayload)
      });

      const tokenData = await tokenResponse.json();
      console.log('Token response status:', tokenResponse.status);

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

      if (!routesResponse.ok) {
        throw new Error('Failed to fetch routes from Strava');
      }

      const routes = await routesResponse.json();
      console.log('Found routes:', routes.length);

      // For the callback, redirect back to the main app with success data
      const baseUrl = 'https://8523dd48-6a5c-4647-b24a-1fd9b88b27fd.lovableproject.com';
      const routesData = encodeURIComponent(JSON.stringify(routes));
      const accessToken = encodeURIComponent(tokenData.access_token);
      const athleteData = encodeURIComponent(JSON.stringify(tokenData.athlete));
      
      const redirectUrl = `${baseUrl}/?strava_auth=success&routes=${routesData}&access_token=${accessToken}&athlete=${athleteData}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': redirectUrl
        }
      });
    }

    // For non-callback requests, require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('Authenticated user:', user.id);

    const state = crypto.randomUUID();
    const redirectUri = `https://kmyjfflvxgllibbybwbs.supabase.co/functions/v1/strava-auth`;

    // Check if user already has a stored Strava token
    const { data: profile } = await supabase
      .from('profiles')
      .select('strava_access_token, strava_refresh_token, strava_token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (profile?.strava_access_token) {
      // Check if token is still valid
      const expiresAt = new Date(profile.strava_token_expires_at);
      const now = new Date();
      
      let accessToken = profile.strava_access_token;
      
      // If token is expired, try to refresh it
      if (expiresAt <= now && profile.strava_refresh_token) {
        console.log('Refreshing expired Strava token');
        
        const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: profile.strava_refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;
          
          // Update stored tokens
          await supabase
            .from('profiles')
            .update({
              strava_access_token: refreshData.access_token,
              strava_refresh_token: refreshData.refresh_token,
              strava_token_expires_at: new Date(refreshData.expires_at * 1000).toISOString()
            })
            .eq('user_id', user.id);
        }
      }
      
      // Try to fetch routes with current/refreshed token
      const routesResponse = await fetch('https://www.strava.com/api/v3/athlete/routes', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (routesResponse.ok) {
        const routes = await routesResponse.json();
        console.log('Found routes using stored token:', routes.length);
        
        return new Response(JSON.stringify({
          success: true,
          routes: routes,
          accessToken: accessToken
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // No valid token - return auth URL for user to complete OAuth
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read,activity:read_all&state=${state}`;
    
    return new Response(JSON.stringify({ 
      authUrl,
      message: 'Please complete Strava authorization'
    }), {
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