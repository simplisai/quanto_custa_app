import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { formSlug, responses } = body as {
      formSlug: string
      responses: Record<string, unknown>
    }

    if (!formSlug || !responses) {
      return new Response(JSON.stringify({ error: 'formSlug and responses are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role key — safe because we only receive data, not expose it
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Fetch the form template
    const { data: form, error: formError } = await supabase
      .from('form_templates')
      .select('id, user_id, title, is_active')
      .eq('slug', formSlug)
      .eq('is_active', true)
      .maybeSingle()

    if (formError || !form) {
      return new Response(JSON.stringify({ error: 'Form not found or inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Extract contact fields
    const nome = String(responses.nome ?? '').trim()
    const email = String(responses.email ?? '').trim().toLowerCase()
    const whatsapp = String(responses.whatsapp ?? '').trim()

    if (!nome) {
      return new Response(JSON.stringify({ error: 'Nome é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build profile_data: everything except the contact fields
    const { nome: _n, email: _e, whatsapp: _w, ...profileData } = responses

    // Format all responses to be appended to notes
    const formattedResponses = Object.entries(responses)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    
    const newNotes = `Respostas do formulário (${form.title}):\n${formattedResponses}`

    // 3. Upsert client (match by email + owner)
    let clientId: string | null = null

    if (email) {
      // Try to find existing client with same email
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, notes')
        .eq('user_id', form.user_id)
        .eq('email', email)
        .maybeSingle()

      if (existingClient) {
        // Update existing client with new data
        const { error: updateErr } = await supabase
          .from('clients')
          .update({
            name: nome,
            phone: whatsapp || null,
            profile_data: profileData,
            notes: existingClient.notes ? `${existingClient.notes}\n\n${newNotes}` : newNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingClient.id)

        if (!updateErr) clientId = existingClient.id
      } else {
        // Create new client
        const { data: newClient, error: insertErr } = await supabase
          .from('clients')
          .insert({
            user_id: form.user_id,
            name: nome,
            email: email || null,
            phone: whatsapp || null,
            profile_data: profileData,
            notes: newNotes,
          })
          .select('id')
          .single()

        if (!insertErr && newClient) clientId = newClient.id
      }
    } else {
      // No email — create client without email
      const { data: newClient, error: insertErr } = await supabase
        .from('clients')
        .insert({
          user_id: form.user_id,
          name: nome,
          phone: whatsapp || null,
          profile_data: profileData,
          notes: newNotes,
        })
        .select('id')
        .single()

      if (!insertErr && newClient) clientId = newClient.id
    }

    // 4. Insert submission
    const { error: submissionError } = await supabase
      .from('form_submissions')
      .insert({
        form_id: form.id,
        owner_user_id: form.user_id,
        client_id: clientId,
        responses,
      })

    if (submissionError) {
      console.error('[submit-form] submission insert error:', submissionError)
      // Don't fail — client was created, submission logging failed
    }

    return new Response(
      JSON.stringify({ success: true, clientId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[submit-form] unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
