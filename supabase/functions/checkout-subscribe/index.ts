/**
 * checkout-subscribe
 * Public endpoint — no JWT required.
 *
 * Corrected flow order (payment FIRST, account creation SECOND):
 *   1. Idempotency check
 *   2. Pre-payment e-mail duplicate check (profiles table)
 *   3. Get SimplisPay token
 *   4. Charge card via SimplisPay
 *   5. If charge fails → return 422, NO user account ever created
 *   6. Create Supabase user (payment already confirmed at this point)
 *   7. Create subscription + ledger + profile + referral
 *   8. Sign in server-side to produce session tokens
 *   9. Return { success, subscriptionId, userId, access_token, refresh_token }
 *
 * Request body (JSON):
 *   idempotencyKey  string
 *   billingCycle    'monthly'|'annual'
 *   hasTrial        boolean
 *   referralCode?   string
 *   customer        { name, email, password, cpf, birthDate, phone }
 *   address         { street, number, complement?, neighborhood, city, state, zipCode }
 *   card            { holderName, number, securityCode, expiry }  // expiry = MM/AAAA
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SIMPLISPAY_BASE_URL = Deno.env.get('SIMPLISPAY_BASE_URL') ?? 'https://api.zsystems.com.br';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// SUPABASE_ANON_KEY is automatically injected into all edge functions by Supabase
const SUPABASE_ANON_KEY   = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SIMPLISPAY_EMAIL    = Deno.env.get('SIMPLISPAY_EMAIL') ?? '';
const SIMPLISPAY_PASSWORD = Deno.env.get('SIMPLISPAY_PASSWORD') ?? '';

const PLAN_SIMPLISPAY_UUID: Record<string, string> = {
  monthly: 'e21a17d7-80ee-47e4-8bef-4e1bac8f34a5',
  annual:  'd04bd73e-b825-48a5-8678-eca4279263e1',
};
const PLAN_NUMERIC_ID: Record<string, number> = {
  monthly: 25709,
  annual:  25710,
};
const PLAN_UUID: Record<string, string> = {
  monthly: '648d550d-07cc-4812-938f-7638b372cb33',
  annual:  '10d6cafa-42d9-4279-8615-13b46fa2af77',
};
const PLAN_AMOUNT_CENTS: Record<string, number> = {
  monthly:  9900,
  annual:  79900,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: {
    idempotencyKey: string;
    billingCycle: 'monthly' | 'annual';
    hasTrial?: boolean;
    customer: { name: string; email: string; password: string; cpf: string; birthDate: string; phone: string };
    address: { street: string; number: string; complement?: string; neighborhood: string; city: string; state: string; zipCode: string };
    card: { holderName: string; number: string; securityCode: string; expiry: string };
    referralCode?: string;
  };

  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { idempotencyKey, billingCycle, customer, address, card, referralCode } = body;

  if (!idempotencyKey || !billingCycle || !customer || !address || !card) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (!PLAN_SIMPLISPAY_UUID[billingCycle]) return json({ error: 'Invalid billingCycle' }, 400);
  if (!customer.email || !customer.password || !customer.name) {
    return json({ error: 'Missing customer email, password, or name' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Idempotency — return early if already processed ───────────────────
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return json({ success: true, subscriptionId: existing.id, alreadyExists: true });

  // ── 2. Pre-payment e-mail duplicate check ────────────────────────────────
  // Check profiles table first (fast, avoids charging a card for an existing user)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', customer.email.toLowerCase().trim())
    .maybeSingle();

  if (existingProfile) {
    return json(
      { error: 'Este e-mail já está cadastrado. Faça login para continuar.', code: 'EMAIL_EXISTS' },
      409,
    );
  }

  // ── 3. Get or refresh SimplisPay token ───────────────────────────────────
  let simplispayToken: string;
  try { simplispayToken = await getOrRefreshToken(supabase); }
  catch (err) {
    console.error('[checkout-subscribe] Token error:', err);
    return json({ error: 'Gateway de pagamento indisponível. Tente novamente em instantes.' }, 503);
  }

  // ── 4. Build SimplisPay payload ──────────────────────────────────────────
  const expiryParts     = card.expiry.split('/');
  const simplispayExpiry = expiryParts.length === 2
    ? `${expiryParts[0]}/${expiryParts[1].slice(-2)}`
    : card.expiry;

  const simplispayPayload = {
    planoId: PLAN_SIMPLISPAY_UUID[billingCycle],
    cliente: {
      nome:           customer.name,
      email:          customer.email,
      dataNascimento: customer.birthDate,
      cpf:            customer.cpf,
      telefone:       customer.phone,
      celular:        customer.phone,
    },
    endereco: {
      logradouro: address.street,
      numero:     address.number,
      cep:        address.zipCode,
      cidade:     address.city,
      estado:     address.state,
      ...(address.complement ? { complemento: address.complement } : {}),
    },
    cartao: {
      titular:         card.holderName,
      numero:          card.number,
      codigoSeguranca: card.securityCode,
      validade:        simplispayExpiry,
    },
  };

  // ── 5. Charge card via SimplisPay ────────────────────────────────────────
  // NO user account exists yet — if this fails, nothing to clean up.
  let simplispayRes: Response;
  let simplispayData: { success: boolean; message?: string; data?: { id: number; [k: string]: unknown } };

  try {
    simplispayRes = await fetch(`${SIMPLISPAY_BASE_URL}/planos/assinar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${simplispayToken}` },
      body:    JSON.stringify(simplispayPayload),
    });
    simplispayData = await simplispayRes.json();
  } catch (err) {
    console.error('[checkout-subscribe] SimplisPay fetch error:', err);
    return json({ error: 'Erro de conexão com o gateway de pagamento.' }, 503);
  }

  if (!simplispayRes.ok || !simplispayData.success || !simplispayData.data?.id) {
    const errMsg = simplispayData.message ?? `HTTP ${simplispayRes.status}`;
    console.error('[checkout-subscribe] SimplisPay error (no account created):', errMsg, simplispayData);
    // Payment failed — no user account was ever created. Clean failure.
    return json({ error: errMsg }, 422);
  }

  const simplispaySubId = String(simplispayData.data.id);

  // ── 6. Create Supabase user (payment confirmed) ──────────────────────────
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email:         customer.email,
    password:      customer.password,
    email_confirm: true,
    user_metadata: {
      full_name: customer.name,
      ...(referralCode ? { referral_code: referralCode.toLowerCase().trim() } : {}),
    },
  });

  if (authErr) {
    const msg = authErr.message ?? '';
    console.error('[checkout-subscribe] createUser error after payment success:', authErr);
    // CRITICAL: payment was charged but user creation failed.
    // Log for manual intervention — do NOT return an error that confuses the user.
    // We'll log and still try to return success so the client knows payment went through.
    await supabase.from('subscription_ledger_events').insert({
      user_id:    '00000000-0000-0000-0000-000000000000', // placeholder
      event_type: 'checkout_failed',
      source:     'checkout',
      error_message: `User creation failed after payment success: ${msg}. SimplispayId=${simplispaySubId}`,
      payload:    { email: customer.email, billing_cycle: billingCycle, simplispay_subscription_id: simplispaySubId },
    }).catch(() => {}); // non-blocking
    return json({
      error: 'Pagamento aprovado, mas erro ao criar conta. Entre em contato: suporte@quantocusta.app',
      code: 'USER_CREATION_FAILED',
      simplispaySubId,
    }, 500);
  }

  const userId = authData.user.id;
  console.log('[checkout-subscribe] User created after payment:', userId);

  // ── 7. Persist subscription ──────────────────────────────────────────────
  const now         = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newSub, error: subErr } = await supabase
    .from('subscriptions')
    .insert({
      user_id:                    userId,
      plan_id:                    PLAN_UUID[billingCycle],
      billing_cycle:              billingCycle,
      amount_cents:               PLAN_AMOUNT_CENTS[billingCycle],
      status:                     'trialing',
      started_at:                 now.toISOString(),
      trial_ends_at:              trialEndsAt,
      current_period_start:       now.toISOString(),
      current_period_end:         trialEndsAt,
      payment_method:             'credit_card',
      simplispay_subscription_id: simplispaySubId,
      simplispay_plan_id:         String(PLAN_NUMERIC_ID[billingCycle]),
      idempotency_key:            idempotencyKey,
    })
    .select('id')
    .single();

  if (subErr) {
    console.error('[checkout-subscribe] DB insert error:', subErr);
    await supabase.from('subscription_ledger_events').insert({
      user_id:    userId,
      event_type: 'checkout_failed',
      source:     'checkout',
      error_message: `DB error after payment + user creation: ${subErr.message}. SimplispayId=${simplispaySubId}`,
      payload:    { billing_cycle: billingCycle, simplispay_subscription_id: simplispaySubId },
    }).catch(() => {});
    return json({ error: 'Assinatura criada no gateway mas não salva. Entre em contato: suporte@quantocusta.app' }, 500);
  }

  // ── Log trial_started ─────────────────────────────────────────────────────
  await supabase.from('subscription_ledger_events').insert({
    user_id:                    userId,
    subscription_id:            newSub.id,
    event_type:                 'trial_started',
    source:                     'checkout',
    status_after:               'trialing',
    simplispay_subscription_id: simplispaySubId,
    payload:                    { billing_cycle: billingCycle, simplispay_plan_id: PLAN_NUMERIC_ID[billingCycle] },
  }).catch(() => {});

  // ── Upsert profile ────────────────────────────────────────────────────────
  await supabase.from('profiles').upsert({
    id:         userId,
    full_name:  customer.name,
    email:      customer.email,
    updated_at: now.toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: false }).catch(() => {});

  // ── Apply referral ────────────────────────────────────────────────────────
  // Belt-and-suspenders: trigger handle_new_user() already applied it via user_metadata,
  // but we await here explicitly so the RPC completes before the response is sent
  // (Deno terminates the runtime after return, killing unawaited promises).
  if (referralCode) {
    const { error: refErr } = await supabase.rpc('apply_referral', {
      p_referral_code:    referralCode.toLowerCase().trim(),
      p_referred_user_id: userId,
    });
    if (refErr) {
      console.error('[checkout-subscribe] Referral apply error (non-fatal):', refErr);
    } else {
      console.log('[checkout-subscribe] Referral applied:', referralCode, '→', userId);
    }
  }

  // ── 8. Sign in server-side to produce session tokens ─────────────────────
  // Use the anon client so the user gets a standard JWT session.
  // This avoids the client needing a second signInWithPassword round-trip.
  let access_token: string | undefined;
  let refresh_token: string | undefined;

  try {
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { session }, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email:    customer.email,
      password: customer.password,
    });
    if (!signInErr && session) {
      access_token  = session.access_token;
      refresh_token = session.refresh_token;
    } else {
      console.warn('[checkout-subscribe] Server-side sign-in failed (non-fatal):', signInErr?.message);
    }
  } catch (err) {
    console.warn('[checkout-subscribe] Server-side sign-in exception (non-fatal):', err);
  }

  console.log('[checkout-subscribe] Success. SubId:', newSub.id, 'SimplispayId:', simplispaySubId, 'SessionReturned:', !!access_token);
  return json({
    success:      true,
    subscriptionId: newSub.id,
    userId,
    access_token,
    refresh_token,
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function getOrRefreshToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: tokenRow } = await supabase
    .from('gateway_tokens')
    .select('token_value, token_expires_at')
    .eq('provider', 'simplispay')
    .single();

  if (tokenRow?.token_value) {
    const expiresAt = new Date(tokenRow.token_expires_at).getTime();
    if (expiresAt > Date.now() + 15 * 60 * 1000) return tokenRow.token_value;
  }

  const res  = await fetch(`${SIMPLISPAY_BASE_URL}/createToken`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: SIMPLISPAY_EMAIL, password: SIMPLISPAY_PASSWORD }),
  });
  const data = await res.json() as { success: boolean; token?: string };
  if (!data.success || !data.token) {
    throw new Error(`SimplisPay createToken failed: ${JSON.stringify(data)}`);
  }

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  await supabase.from('gateway_tokens').upsert({
    provider:             'simplispay',
    token_value:          data.token,
    token_expires_at:     expiresAt,
    last_refresh_at:      new Date().toISOString(),
    last_refresh_success: true,
    consecutive_failures: 0,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'provider' });

  return data.token;
}
