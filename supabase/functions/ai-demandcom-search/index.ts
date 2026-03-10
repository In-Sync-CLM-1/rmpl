import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, radius } = await req.json()
    console.log('AI Search query:', query)
    console.log('Radius:', radius)

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const systemPrompt = `You are an AI assistant that extracts structured search criteria from natural language business contact queries.

Extract the following information from the query:
1. designations: Array of job titles/designations mentioned (e.g., ["CEO", "Manager", "Director"])
2. companies: Array of company names mentioned (e.g., ["Google", "Microsoft"])
3. industries: Array of industries mentioned (e.g., ["Technology", "Healthcare", "Finance"])
4. location: City and/or state mentioned (e.g., "Boston, MA" or "Boston" or "Massachusetts")

Return ONLY a JSON object with this exact format:
{
  "designations": ["title1", "title2"],
  "companies": ["company1", "company2"],
  "industries": ["industry1", "industry2"],
  "location": "City, State" or null
}

Examples:
- "CEOs in Boston" → {"designations": ["CEO"], "companies": [], "industries": [], "location": "Boston"}
- "Tech companies in California" → {"designations": [], "companies": [], "industries": ["Technology", "Tech"], "location": "California"}
- "Managers at Microsoft" → {"designations": ["Manager"], "companies": ["Microsoft"], "industries": [], "location": null}`

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Extract search criteria from this query: "${query}"` }
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('Anthropic API error:', aiResponse.status, errorText)
      throw new Error(`AI API error: ${aiResponse.status}`)
    }

    const aiResult = await aiResponse.json()
    const content = aiResult.content[0].text
    console.log('AI response:', content)

    let criteria: any = { designations: [], companies: [], industries: [], location: null }
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/s)
      if (jsonMatch) {
        criteria = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
    }

    console.log('Extracted criteria:', criteria)

    let query_builder = supabase
      .from('demandcom')
      .select('*')

    if (criteria.designations && criteria.designations.length > 0) {
      const conditions = criteria.designations
        .map((title: string) => `designation.ilike.%${title}%`)
        .join(',')
      query_builder = query_builder.or(conditions)
    }

    if (criteria.companies && criteria.companies.length > 0) {
      const conditions = criteria.companies
        .map((company: string) => `company_name.ilike.%${company}%`)
        .join(',')
      query_builder = query_builder.or(conditions)
    }

    if (criteria.industries && criteria.industries.length > 0) {
      const conditions = criteria.industries
        .map((industry: string) => `industry_type.ilike.%${industry}%,sub_industry.ilike.%${industry}%`)
        .join(',')
      query_builder = query_builder.or(conditions)
    }

    if (criteria.location) {
      const locationLower = criteria.location.toLowerCase()
      query_builder = query_builder.or(
        `city.ilike.%${locationLower}%,state.ilike.%${locationLower}%,location.ilike.%${locationLower}%`
      )
    }

    const { data: matchingContacts, error: searchError } = await query_builder

    if (searchError) {
      console.error('Search error:', searchError)
      throw searchError
    }

    console.log(`Found ${matchingContacts?.length || 0} matching contacts`)

    return new Response(
      JSON.stringify({
        contacts: matchingContacts || [],
        query,
        extractedCriteria: criteria,
        total: matchingContacts?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in ai-demandcom-search:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        contacts: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
