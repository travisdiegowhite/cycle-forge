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

    // Get the user from the request
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

    // Step 1: Get authorization code using device flow approach
    // We'll use a temporary code approach - generate a state and redirect URL
    const state = crypto.randomUUID();
    const redirectUri = `https://kmyjfflvxgllibbybwbs.supabase.co/functions/v1/strava-auth/callback`;
    
    // Check if this is a callback request
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (code && returnedState) {
      // This is the callback - exchange code for token
      console.log('Processing OAuth callback with code:', code);
      
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

      // Store the access token in the user's profile for future use
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          // Store Strava token securely (you might want to encrypt this)
          strava_access_token: tokenData.access_token,
          strava_refresh_token: tokenData.refresh_token,
          strava_token_expires_at: new Date(tokenData.expires_at * 1000).toISOString()
        });

      if (updateError) {
        console.error('Failed to store Strava token:', updateError);
        // Don't fail the request if we can't store the token
      }

      return new Response(JSON.stringify({
        success: true,
        routes: routes,
        accessToken: tokenData.access_token
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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