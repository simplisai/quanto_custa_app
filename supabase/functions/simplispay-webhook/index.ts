/**
 * simplispay-webhook
 * Receives POST events from Simplispay and keeps subscriptions/invoices in sync.
 * No JWT required — Simplispay calls this endpoint directly.
 * URL configured at Simplispay: https://gkudaozyixdtywgucddv.supabase.co/functions/v1/simplispay-webhook
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  // Look up our subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, status')
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
}
