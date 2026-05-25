/**
 * process-subscription
 * Receives checkout form data, calls Simplispay to create a subscription,
 * and persists the result in Supabase.
 *
 * Requires: valid Supabase JWT in Authorization header.
 *
 * Request body (JSON):
 *   idempotencyKey  string             — UUID generated client-side per checkout attempt
 *   billingCycle    'monthly'|'annual'
 *   customer        { name, email, cpf, birthDate, phone }
 *   address         { street, number, complement?, neighborhood, city, state, zipCode }
 *   card            { holderName, number, securityCode, expiry }  // expiry = MM/AAAA
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SIMPLISPAY_BASE_URL = Deno.env.get('SIMPLISPAY_BASE_URL') ?? 'https://api.zsystems.com.br';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SIMPLISPAY_EMAIL    = Deno.env.get('SIMPLISPAY_EMAIL') ?? '';
const SIMPLISPAY_PASSWORD = Deno.env.get('SIMPLISPAY_PASSWORD') ?? '';

// Simplispay internal UUIDs — used as planoId in /planos/assinar
const PLAN_SIMPLISPAY_UUID: Record<string, string> = {
  monthly: 'e21a17d7-80ee-47e4-8bef-4e1bac8f34a5',
  annual:  'd04bd73e-b825-48a5-8678-eca4279263e1',
};

// Simplispay numeric IDs — stored in subscriptions.simplispay_plan_id
const PLAN_NUMERIC_ID: Record<string, number> = {
  monthly: 25709,
  annual:  25710,
};

// Supabase plans table UUIDs
const PLAN_UUID: Record<string, string> = {
  monthly: '648d550d-07cc-4812-938f-7638b372cb33',
  annual:  '10d6cafa-42d9-4279-8615-13b46fa2af77',
};

const PLAN_AMOUNT_CENTS: Record<string, number> = {
  monthly:  9900,
  annual:  79900,
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const userToken = authHeader.replace('Bearer ', '').trim();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(userToken);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: {
    idempotencyKey: string;
    billingCycle: 'monthly' | 'annual';
    customer: { name: string; email: string; cpf: string; birthDate: string; phone: string };
    address: { street: string; number: string; complement?: string; neighborhood: string; city: string; state: string; zipCode: string };
    card: { holderName: string; number: string; securityCode: string; expiry: string };
  };

  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { idempotencyKey, billingCycle, customer, address, card } = body;
  if (!idempotencyKey || !billingCycle || !customer || !address || !card) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (!PLAN_SIMPLISPAY_UUID[billingCycle]) return json({ error: 'Invalid billingCycle' }, 400);

  // ── Idempotency check ─────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return json({ subscriptionId: existing.id, alreadyExists: true });

  // ── Check for existing active subscription ────────────────────────────────────
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', user.id)
    .not('status', 'in', '("canceled","expired")')
    .maybeSingle();
  if (activeSub) {
    return json({ error: 'User already has an active subscription', subscriptionId: activeSub.id }, 409);
  }

  // ── Get or refresh Simplispay token ───────────────────────────────────────────
  let simplispayToken: string;
  try { simplispayToken = await getOrRefreshToken(supabase); }
  catch (err) {
    console.error('[process-subscription] Token error:', err);
    return json({ error: 'Payment gateway unavailable. Please try again.' }, 503);
  }

  // ── Log checkout_initiated ────────────────────────────────────────────────────
  await supabase.from('subscription_ledger_events').insert({
    user_id: user.id, event_type: 'checkout_initiated', source: 'checkout',
    payload: { billing_cycle: billingCycle, idempotency_key: idempotencyKey },
  });

  // ── Build Simplispay payload ──────────────────────────────────────────────────
  // Card expiry: frontend sends MM/AAAA, Simplispay expects MM/AA
  const expiryParts = card.expiry.split('/');
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

  // ── Call Simplispay ───────────────────────────────────────────────────────────
  let simplispayRes: Response;
  let simplispayData: { success: boolean; message?: string; data?: { id: number; [k: string]: unknown } };

  try {
    simplispayRes = await fetch(`${SIMPLISPAY_BASE_URL}/planos/assinar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${simplispayToken}` },
      body: JSON.stringify(simplispayPayload),
    });
    simplispayData = await simplispayRes.json();
  } catch (err) {
    console.error('[process-subscription] Simplispay fetch error:', err);
    await logCheckoutFailed(supabase, user.id, String(err));
    return json({ error: 'Payment gateway connection error' }, 503);
  }

  if (!simplispayRes.ok || !simplispayData.success || !simplispayData.data?.id) {
    const errMsg = simplispayData.message ?? `HTTP ${simplispayRes.status}`;
    console.error('[process-subscription] Simplispay error:', errMsg, simplispayData);
    await logCheckoutFailed(supabase, user.id, errMsg);
    return json({ error: errMsg }, 422);
  }

  const simplispaySubId = String(simplispayData.data.id);

  // ── Persist subscription ──────────────────────────────────────────────────────
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newSub, error: subErr } = await supabase
    .from('subscriptions')
    .insert({
      user_id:                    user.id,
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
    console.error('[process-subscription] DB insert error:', subErr);
    await logCheckoutFailed(supabase, user.id,
      `DB error after Simplispay success: ${subErr.message}. SimplispayId=${simplispaySubId}`);
    return json({ error: 'Subscription created at gateway but not saved. Contact support.' }, 500);
  }

  // ── Log trial_started ─────────────────────────────────────────────────────────
  await supabase.from('subscription_ledger_events').insert({
    user_id:                    user.id,
    subscription_id:            newSub.id,
    event_type:                 'trial_started',
    source:                     'checkout',
    status_after:               'trialing',
    simplispay_subscription_id: simplispaySubId,
    payload:                    { billing_cycle: billingCycle, simplispay_plan_id: PLAN_NUMERIC_ID[billingCycle] },
  });

  console.log('[process-subscription] Success. SubId:', newSub.id, 'SimplispayId:', simplispaySubId);
  return json({ success: true, subscriptionId: newSub.id });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

async function getOrRefreshToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: tokenRow } = await supabase
    .from('gateway_tokens')
    .select('token_value, token_expires_at')
    .eq('provider', 'simplispay')
    .single();

  // Use cached token if it expires more than 15 min from now
  if (tokenRow?.token_value) {
    const expiresAt = new Date(tokenRow.token_expires_at).getTime();
    if (expiresAt > Date.now() + 15 * 60 * 1000) return tokenRow.token_value;
  }

  // Refresh inline
  const res = await fetch(`${SIMPLISPAY_BASE_URL}/createToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SIMPLISPAY_EMAIL, password: SIMPLISPAY_PASSWORD }),
  });
  const data = await res.json() as { success: boolean; token?: string };
  if (!data.success || !data.token) {
    throw new Error(`Simplispay createToken failed: ${JSON.stringify(data)}`);
  }

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  await supabase.from('gateway_tokens').upsert({
    provider: 'simplispay', token_value: data.token,
    token_expires_at: expiresAt, last_refresh_at: new Date().toISOString(),
    last_refresh_success: true, consecutive_failures: 0, updated_at: new Date().toISOString(),
  }, { onConflict: 'provider' });

  return data.token;
}

async function logCheckoutFailed(
  supabase: ReturnType<typeof createClient>, userId: string, errMsg: string,
) {
  await supabase.from('subscription_ledger_events').insert({
    user_id: userId, event_type: 'checkout_failed', source: 'checkout', error_message: errMsg,
  });
}
