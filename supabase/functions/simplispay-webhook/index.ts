/**
 * simplispay-webhook
 * Receives POST events from Simplispay and keeps subscriptions/invoices in sync.
 * No JWT required — Simplispay calls this endpoint directly.
 *
 * Referral logic:
 *   - invoice.paid when sub was 'trialing' → mark referral as converted → grant credit to referrer (every 2)
 *   - invoice.paid when referrer has months_credit → postpone next billing via SimplisPay API
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SIMPLISPAY_BASE_URL = Deno.env.get('SIMPLISPAY_BASE_URL') ?? 'https://api.zsystems.com.br';
const SIMPLISPAY_EMAIL    = Deno.env.get('SIMPLISPAY_EMAIL') ?? '';
const SIMPLISPAY_PASSWORD = Deno.env.get('SIMPLISPAY_PASSWORD') ?? '';

// Map Simplispay status_assinatura_id → our subscription_status enum
const STATUS_MAP: Record<number, string> = {
  1: 'active',
  2: 'trialing',
  3: 'past_due',
  4: 'suspended',
  5: 'canceled',
  6: 'expired',
};

function toEventType(simplispayEvent: string): string {
  const map: Record<string, string> = {
    'subscription.activated':   'subscription_activated',
    'subscription.updated':     'subscription_updated',
    'subscription.suspended':   'subscription_suspended',
    'subscription.reactivated': 'subscription_reactivated',
    'subscription.cancelled':   'subscription_canceled',
    'subscription.canceled':    'subscription_canceled',
    'invoice.paid':             'invoice_paid',
    'invoice.failed':           'invoice_failed',
    'invoice.refunded':         'invoice_refunded',
    'trial.started':            'trial_started',
    'trial.ended':              'trial_ended',
  };
  return map[simplispayEvent] ?? 'webhook_received';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return new Response('Bad JSON', { status: 400 }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  console.log('[simplispay-webhook] Received:', JSON.stringify(payload));

  try { await handleWebhook(supabase, payload); }
  catch (err) { console.error('[simplispay-webhook] Handler error:', err); }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  const eventType          = String(payload.event ?? payload.tipo ?? 'webhook_received');
  const simplispaySubId    = String(payload.assinatura_id ?? payload.subscription_id ?? payload.id ?? '');
  const simplispayStatusId = Number(payload.status_assinatura_id ?? 0);
  const hookId             = Number(payload.hook_id ?? 0);

  // Look up our subscription (snapshot of current status before any updates)
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, status, referral_months_credit, simplispay_subscription_id, current_period_end')
    .eq('simplispay_subscription_id', simplispaySubId)
    .maybeSingle();

  // Always log the raw event
  await supabase.from('subscription_ledger_events').insert({
    subscription_id:            sub?.id ?? null,
    user_id:                    sub?.user_id ?? null,
    event_type:                 toEventType(eventType),
    source:                     'webhook',
    status_before:              sub?.status ?? null,
    simplispay_subscription_id: simplispaySubId || null,
    simplispay_event_status:    eventType,
    simplispay_status_id:       simplispayStatusId || null,
    hook_id:                    hookId || null,
    payload,
  });

  if (!sub) {
    console.warn('[simplispay-webhook] No matching subscription for id:', simplispaySubId);
    return;
  }

  // ── Invoice events ─────────────────────────────────────────────────────────
  if (eventType.startsWith('invoice.')) {
    const fatura   = payload.fatura as Record<string, unknown> ?? {};
    const faturaId = String(payload.fatura_id ?? fatura.id ?? '');
    const pedidoId = String(fatura.pedido_id ?? '');
    const amountRaw = Number(fatura.amount ?? payload.amount ?? 0);
    const status    = String(fatura.status ?? (eventType === 'invoice.paid' ? 'paid' : 'failed'));
    const paidAt    = eventType === 'invoice.paid'
      ? String(fatura.paid_at ?? new Date().toISOString()) : null;

    if (faturaId) {
      await supabase.from('billing_invoices').upsert({
        subscription_id:       sub.id,
        user_id:               sub.user_id,
        simplispay_invoice_id: faturaId,
        simplispay_pedido_id:  pedidoId || null,
        amount_cents:          amountRaw,
        status,
        date_invoice:  String(fatura.date_invoice ?? new Date().toISOString().slice(0, 10)),
        paid_at:       paidAt,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'simplispay_invoice_id', ignoreDuplicates: false });
    }
  }

  // ── Subscription status update ─────────────────────────────────────────────
  const newStatus = STATUS_MAP[simplispayStatusId];
  if (newStatus && newStatus !== sub.status) {
    const updateFields: Record<string, unknown> = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'canceled') updateFields.canceled_at = new Date().toISOString();
    if (newStatus === 'active') {
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      updateFields.current_period_start = new Date().toISOString();
      updateFields.current_period_end   = periodEnd.toISOString();
    }
    await supabase.from('subscriptions').update(updateFields).eq('id', sub.id);
    console.log('[simplispay-webhook] Status:', sub.status, '->', newStatus);
  }

  // ── Referral: detecta conversão de trial → pago ───────────────────────────
  // Snapshot `sub.status` = status BEFORE this event, so 'trialing' means trial→paid
  if (eventType === 'invoice.paid' && sub.status === 'trialing') {
    await handleReferralConversion(supabase, sub.user_id);
  }

  // ── Referral: aplica crédito de mês grátis quando o próprio referrer paga ─
  if (eventType === 'invoice.paid' && (sub.referral_months_credit ?? 0) > 0) {
    await applyReferralCredit(supabase, sub);
  }
}

// ── Referral: marca conversão e concede crédito ao referrer ──────────────────
async function handleReferralConversion(
  supabase: ReturnType<typeof createClient>,
  referredUserId: string,
) {
  // Marca o referral como convertido
  const { data: referral } = await supabase
    .from('referrals')
    .update({ status: 'converted', converted_at: new Date().toISOString() })
    .eq('referred_user_id', referredUserId)
    .eq('status', 'pending')
    .select('referrer_id')
    .maybeSingle();

  if (!referral?.referrer_id) {
    console.log('[referral] No pending referral found for user:', referredUserId);
    return;
  }

  const referrerId = referral.referrer_id;

  // Conta total de conversões do referrer
  const { count: totalConverted } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)
    .eq('status', 'converted');

  const converted = totalConverted ?? 0;
  console.log('[referral] Referrer', referrerId, 'total converted:', converted);

  // A cada 2 conversões → 1 mês de crédito (máximo 6 meses = 12 conversões)
  if (converted > 0 && converted % 2 === 0 && converted / 2 <= 6) {
    const { data: refSub } = await supabase
      .from('subscriptions')
      .select('id, referral_months_credit')
      .eq('user_id', referrerId)
      .single();

    const currentCredit = refSub?.referral_months_credit ?? 0;

    if (currentCredit < 6) {
      await supabase
        .from('subscriptions')
        .update({ referral_months_credit: currentCredit + 1 })
        .eq('user_id', referrerId);

      await supabase.from('subscription_ledger_events').insert({
        subscription_id: refSub?.id ?? null,
        user_id:         referrerId,
        event_type:      'referral_credit_granted',
        source:          'webhook',
        payload: {
          total_converted:    converted,
          new_credit:         currentCredit + 1,
          referred_user_id:   referredUserId,
        },
      });

      console.log('[referral] Granted 1 month credit to referrer:', referrerId, '→ total credit:', currentCredit + 1);
    } else {
      console.log('[referral] Referrer already at max 6 months credit, skipping.');
    }
  }
}

// ── Referral: adia a próxima cobrança quando há crédito disponível ────────────
async function applyReferralCredit(
  supabase: ReturnType<typeof createClient>,
  sub: { id: string; user_id: string; referral_months_credit: number; simplispay_subscription_id: string; current_period_end: string },
) {
  const currentCredit = sub.referral_months_credit;

  // Calcula nova data de fim do período: current_period_end + 30 dias
  const basePeriodEnd = sub.current_period_end
    ? new Date(sub.current_period_end)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const newPeriodEnd = new Date(basePeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
  const newDateStr   = newPeriodEnd.toISOString().slice(0, 10); // YYYY-MM-DD

  // Tenta adiar via SimplisPay API
  // Endpoint: PATCH /assinaturas/{id} com { dataProximaCobranca: "YYYY-MM-DD" }
  let simplispaySuccess = false;
  try {
    const token = await getOrRefreshToken(supabase);
    const res = await fetch(
      `${SIMPLISPAY_BASE_URL}/assinaturas/${sub.simplispay_subscription_id}`,
      {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ dataProximaCobranca: newDateStr }),
      },
    );
    const resText = await res.text();
    console.log('[referral] SimplisPay postpone response:', res.status, resText);
    simplispaySuccess = res.ok;
  } catch (err) {
    console.error('[referral] Failed to call SimplisPay postpone (non-fatal):', err);
    // Fallback: crédito é decrement do DB e current_period_end atualizado
    // O admin pode verificar via subscription_ledger_events se a API falhou
  }

  // Decrementa crédito e atualiza current_period_end no DB (mesmo se API falhar)
  await supabase.from('subscriptions').update({
    referral_months_credit: currentCredit - 1,
    current_period_end:     newPeriodEnd.toISOString(),
    updated_at:             new Date().toISOString(),
  }).eq('id', sub.id);

  await supabase.from('subscription_ledger_events').insert({
    subscription_id: sub.id,
    user_id:         sub.user_id,
    event_type:      'referral_credit_applied',
    source:          'webhook',
    payload: {
      new_period_end:     newPeriodEnd.toISOString(),
      simplispay_id:      sub.simplispay_subscription_id,
      simplispay_updated: simplispaySuccess,
      credit_remaining:   currentCredit - 1,
    },
  });

  console.log('[referral] Credit applied for user:', sub.user_id, '| new period end:', newDateStr, '| SimplisPay updated:', simplispaySuccess);
}

// ── Token helper (same as checkout-subscribe) ─────────────────────────────────
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
    throw new Error(`Simplispay createToken failed: ${JSON.stringify(data)}`);
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
