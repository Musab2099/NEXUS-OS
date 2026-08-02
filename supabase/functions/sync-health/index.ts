import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-health-sync-token',
}

function suppliedToken(request: Request): string {
  const customToken = request.headers.get('x-health-sync-token')
  if (customToken && customToken.trim() !== '') {
    return customToken.trim()
  }
  const authorization = request.headers.get('authorization') || ''
  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim()
  }
  return ''
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Secret Token
    const secretToken = Deno.env.get('APPLE_HEALTH_SYNC_TOKEN') || ''
    const clientToken = suppliedToken(req)

    if (!secretToken || clientToken !== secretToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse Body
    const body = await req.json()
    const samples = body.samples || body.data || (Array.isArray(body) ? body : [body])

    if (!Array.isArray(samples) || samples.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No samples provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Map Payload (Force snake_case for Postgres)
    const recordsToInsert = samples.map((sample: any) => ({
      id: sample.id,
      sample_id: sample.sample_id || sample.id,
      name: sample.name || sample.type,
      start_date: sample.startDate || sample.start_date, // Mapped camelCase -> snake_case
      end_date: sample.endDate || sample.end_date,       // Mapped camelCase -> snake_case
      qty: sample.qty ?? sample.value,
      units: sample.units || sample.unit,
      data: sample.data || null,
      metadata: sample.metadata || null
    }))

    // 4. Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 5. Database Upsert
    const { data, error } = await supabase
      .from('health_logs')
      .upsert(recordsToInsert, { onConflict: 'sample_id' })

    if (error) {
      console.error('--> Supabase DB Insert Error:', error)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: error.message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, count: recordsToInsert.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('--> Unexpected Function Error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})