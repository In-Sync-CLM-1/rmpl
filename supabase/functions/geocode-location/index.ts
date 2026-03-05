import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = MAX_RETRY_ATTEMPTS,
  delayMs = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      console.warn(`Geocoding attempt ${attempt} failed:`, error)
      
      if (attempt < maxAttempts) {
        const waitTime = delayMs * Math.pow(2, attempt - 1)
        console.log(`Waiting ${waitTime}ms before retry...`)
        await delay(waitTime)
      }
    }
  }
  
  throw lastError
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { location } = await req.json()
    console.log('Geocoding location:', location)

    // Use OpenStreetMap Nominatim with retry logic
    const data = await retryWithBackoff(async () => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
        {
          headers: {
            'User-Agent': 'UHC-Staffing-App/1.0'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`)
      }

      return await response.json()
    })

    console.log('Geocoding response:', data)

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Location not found',
          latitude: null,
          longitude: null
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const result = data[0]
    return new Response(
      JSON.stringify({ 
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        display_name: result.display_name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in geocode-location after retries:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        latitude: null,
        longitude: null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
