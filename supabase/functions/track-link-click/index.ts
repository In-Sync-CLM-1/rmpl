import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const shortCode = url.searchParams.get('code')

    if (!shortCode) {
      return new Response('Invalid request', { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Look up the link
    const { data: link, error: linkError } = await supabase
      .from('campaign_links')
      .select('*')
      .eq('short_code', shortCode)
      .single()

    if (linkError || !link) {
      console.error('Link not found:', linkError)
      return new Response('Link not found', { status: 404 })
    }

    // Increment click count
    await supabase
      .from('campaign_links')
      .update({ click_count: (link.click_count || 0) + 1 })
      .eq('id', link.id)

    // Update campaign clicked count
    await supabase
      .from('campaigns')
      .select('clicked_count')
      .eq('id', link.campaign_id)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase
            .from('campaigns')
            .update({ clicked_count: (data.clicked_count || 0) + 1 })
            .eq('id', link.campaign_id)
        }
      })

    // Try to find and update recipient record
    // Note: We can't directly know which recipient clicked without more tracking
    // This is a simplified version
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('campaign_id', link.campaign_id)
      .is('clicked_at', null)
      .limit(1)

    if (recipients && recipients.length > 0) {
      await supabase
        .from('campaign_recipients')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', recipients[0].id)
    }

    console.log('Link clicked:', shortCode, '→', link.original_url)

    // Redirect to original URL
    return Response.redirect(link.original_url, 302)
  } catch (error) {
    console.error('Error in track-link-click:', error)
    return new Response('Internal error', { status: 500 })
  }
})
