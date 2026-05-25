-- =============================================================
-- ADMIN VIEWS AND RPCS
-- event_source enum: checkout | webhook | admin | system
-- subscription_event_type: checkout_initiated, checkout_failed,
--   trial_started, trial_ended, subscription_activated,
--   subscription_updated, subscription_past_due,
--   subscription_suspended, subscription_reactivated,
--   subscription_canceled, invoice_paid, invoice_failed,
--   invoice_refunded, webhook_received, admin_action
-- =============================================================

-- 1. admin_metrics VIEW
CREATE OR REPLACE VIEW public.admin_metrics AS
WITH
  sub_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')                         AS active_subscriptions,
      COUNT(*) FILTER (WHERE status = 'trialing')                       AS trialing_subscriptions,
      COUNT(*) FILTER (WHERE status = 'past_due')                       AS past_due_subscriptions,
      COUNT(*) FILTER (WHERE status = 'suspended')                      AS suspended_subscriptions,
      COUNT(*) FILTER (WHERE status IN ('canceled','expired'))          AS canceled_subscriptions,
      COALESCE(SUM(amount_cents) FILTER (
        WHERE status = 'active' AND billing_cycle = 'monthly'), 0)
      + COALESCE(SUM(amount_cents / 12) FILTER (
        WHERE status = 'active' AND billing_cycle = 'annual'), 0)       AS mrr_cents
    FROM public.subscriptions
  ),
  revenue AS (
    SELECT COALESCE(SUM(amount_cents), 0) AS total_revenue_cents
    FROM public.billing_invoices
    WHERE status = 'paid'
  ),
  webhooks AS (
    SELECT COUNT(*) AS webhooks_last_24h
    FROM public.subscription_ledger_events
    WHERE source = 'webhook'
      AND created_at > NOW() - INTERVAL '24 hours'
  ),
  trial_converts AS (
    SELECT COUNT(*) AS trials_converting_this_month
    FROM public.subscription_ledger_events
    WHERE event_type = 'subscription_activated'
      AND created_at > NOW() - INTERVAL '30 days'
  )
SELECT
  (SELECT COUNT(*) FROM public.profiles)              AS total_users,
  s.active_subscriptions,
  s.trialing_subscriptions,
  s.past_due_subscriptions,
  s.suspended_subscriptions,
  s.canceled_subscriptions,
  (SELECT COUNT(*) FROM public.simulations)           AS total_simulations,
  (SELECT COUNT(*) FROM public.support_tickets
   WHERE status IN ('open','in_progress'))            AS open_tickets,
  s.mrr_cents,
  s.mrr_cents * 12                                    AS arr_cents,
  r.total_revenue_cents,
  w.webhooks_last_24h,
  t.trials_converting_this_month
FROM sub_stats s, revenue r, webhooks w, trial_converts t;

GRANT SELECT ON public.admin_metrics TO authenticated;

-- 2. admin_subscription_overview VIEW
CREATE OR REPLACE VIEW public.admin_subscription_overview AS
SELECT
  s.id,
  s.user_id,
  s.plan_id,
  s.status,
  s.billing_cycle,
  s.amount_cents,
  s.trial_ends_at,
  s.current_period_start,
  s.current_period_end,
  s.canceled_at,
  s.started_at,
  s.updated_at,
  s.simplispay_subscription_id,
  s.card_last_four,
  s.card_brand,
  s.idempotency_key,
  p.email,
  p.full_name,
  pl.name AS plan_name
FROM public.subscriptions s
JOIN public.profiles p  ON p.id  = s.user_id
JOIN public.plans    pl ON pl.id = s.plan_id;

GRANT SELECT ON public.admin_subscription_overview TO authenticated;

-- 3. bootstrap_admin() RPC
CREATE OR REPLACE FUNCTION public.bootstrap_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin() TO authenticated;

-- 4. admin_update_subscription() RPC
CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _user_id       uuid,
  _plan_id       uuid   DEFAULT NULL,
  _status        text   DEFAULT NULL,
  _billing_cycle text   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  UPDATE public.subscriptions
  SET
    plan_id       = COALESCE(_plan_id, plan_id),
    status        = COALESCE(_status::subscription_status, status),
    billing_cycle = COALESCE(_billing_cycle::billing_cycle, billing_cycle),
    updated_at    = NOW()
  WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_subscription(uuid, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription(uuid, uuid, text, text) TO authenticated;

-- 5. admin_set_user_role() RPC
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _user_id uuid,
  _role    app_role,
  _grant   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = _role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role, boolean) TO authenticated;
