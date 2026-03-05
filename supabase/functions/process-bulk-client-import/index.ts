import { corsHeaders } from '../_shared/cors-headers.ts';

// Background processor placeholder for large client imports
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ message: 'Background processing not yet implemented' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
