// supabase/functions/create-portal-session/index.ts
// Deploy with: supabase functions deploy create-portal-session

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@13'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const cl = parseInt(req.headers.get('content-length') ?? '0', 10)
    if (cl > 4_096) return json({ error: 'Payload too large' }, 413)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    // Fetch profile including Education fields
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, is_education, education_group_id, is_pro')
      .eq('id', user.id)
      .single()

    if (profileError) throw new Error('Failed to load profile')

    let customerId = profile?.stripe_customer_id ?? null

    // Fallback: if profiles.stripe_customer_id is missing but the education group still has it
    if (!customerId && profile?.is_education && profile?.education_group_id) {
      const { data: group } = await supabase
        .from('education_groups')
        .select('stripe_customer_id')
        .eq('id', profile.education_group_id)
        .single()
      customerId = group?.stripe_customer_id ?? null
    }

    if (!customerId) {
      await resetSubscription(user.id, profile)
      return json({ error: 'No active subscription found. Your account has been reset — please subscribe again.' }, 400)
    }

    const { returnUrl } = await req.json()

    let portalSession
    try {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || 'https://your-app.vercel.app/settings',
      })
    } catch (stripeErr: any) {
      if (stripeErr?.code === 'resource_missing') {
        await resetSubscription(user.id, profile)
        return json({ error: 'Your billing record was not found (possible test/live mode mismatch). Your account has been reset — please subscribe again.' }, 400)
      }
      throw stripeErr
    }

    return json({ url: portalSession.url })
  } catch (err: any) {
    console.error('Portal session error:', err.message)
    return json({ error: err.message }, 400)
  }
})

async function resetSubscription(userId: string, profile: any) {
  const resetFields: Record<string, unknown> = {
    stripe_customer_id: null,
    is_pro: false,
    pro_expires_at: null,
  }

  if (profile?.is_education) {
    resetFields.is_education = false
    resetFields.education_group_id = null
    resetFields.role = 'free'

    if (profile.education_group_id) {
      await supabase
        .from('education_groups')
        .update({ is_active: false })
        .eq('id', profile.education_group_id)
    }
  }

  await supabase.from('profiles').update(resetFields).eq('id', userId)
}
