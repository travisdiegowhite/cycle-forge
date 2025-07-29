import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { action } = await req.json()
    const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')
    const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Strava credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (action === 'getAuthUrl') {
      const redirectUri = `${req.headers.get('origin')}/`
      const scope = 'read,activity:read_all'
      const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${user.id}`
      
      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'exchangeToken') {
      const { code } = await req.json()
      
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          grant_type: 'authorization_code'
        })
      })

      const tokenData = await tokenResponse.json()
      
      if (!tokenResponse.ok) {
        throw new Error(tokenData.message || 'Failed to exchange token')
      }

      // Store the access token (in a real app, you'd store this securely)
      return new Response(
        JSON.stringify({ 
          access_token: tokenData.access_token,
          athlete: tokenData.athlete 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'getActivities') {
      const { accessToken } = await req.json()
      
      const activitiesResponse = await fetch(
        'https://www.strava.com/api/v3/athlete/activities?per_page=50&page=1',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      const activities = await activitiesResponse.json()
      
      if (!activitiesResponse.ok) {
        throw new Error('Failed to fetch activities')
      }

      // Filter for cycling activities and format them
      const cyclingActivities = activities
        .filter((activity: any) => activity.type === 'Ride')
        .map((activity: any) => ({
          id: activity.id,
          name: activity.name,
          distance: activity.distance,
          moving_time: activity.moving_time,
          total_elevation_gain: activity.total_elevation_gain,
          start_date: activity.start_date,
          map: activity.map
        }))

      return new Response(
        JSON.stringify({ activities: cyclingActivities }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'getActivityDetails') {
      const { accessToken, activityId } = await req.json()
      
      const activityResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=false`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      const activity = await activityResponse.json()
      
      if (!activityResponse.ok) {
        throw new Error('Failed to fetch activity details')
      }

      return new Response(
        JSON.stringify({ activity }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Strava auth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})