// supabase/functions/reset-weekly-uploads/index.ts
// This runs on the 1st of every month at 00:00 UTC via a Supabase cron job
// Set up in Supabase dashboard: Database → Extensions → pg_cron
// SQL: select cron.schedule('reset-uploads', '0 0 1 * *', 'select net.http_post(...)');

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

serve(async (req) => {
  // Simple secret check to prevent unauthorized calls
  const secret = req.headers.get('x-cron-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { error, count } = await supabase
    .from('profiles')
    .update({
      uploads_this_week: 0,
      xp_this_week: 0,
      week_reset_at: new Date().toISOString(),
    })
    .gte('id', '00000000-0000-0000-0000-000000000000') // update all rows

  if (error) {
    console.error('Reset error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`Reset ${count} profiles`)
  return new Response(JSON.stringify({ ok: true, reset: count }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
