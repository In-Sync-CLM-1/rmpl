import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

// 1x1 transparent GIF
const TRACKING_PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3B,
])

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const recipientId = url.searchParams.get('recipient')

    if (!recipientId) {
      return new Response(TRACKING_PIXEL, {
        headers: { 'Content-Type': 'image/gif' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Update recipient opened_at (only if not already opened)
    const { data: recipient, error: fetchError } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('id', recipientId)
      .single()

    if (!fetchError && recipient && !recipient.opened_at) {
      await supabase
        .from('campaign_recipients')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', recipientId)

      // Increment campaign opened count
      await supabase
        .from('campaigns')
        .select('opened_count')
        .eq('id', recipient.campaign_id)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('campaigns')
              .update({ opened_count: (data.opened_count || 0) + 1 })
              .eq('id', recipient.campaign_id)
          }
        })

      console.log('Email opened:', recipientId)
    }

    return new Response(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error in track-email-open:', error)
    return new Response(TRACKING_PIXEL, {
      headers: { 'Content-Type': 'image/gif' },
    })
  }
})
