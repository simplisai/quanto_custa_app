-- Add Simplispay plan mapping columns to plans table
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS simplispay_plan_id integer,
  ADD COLUMN IF NOT EXISTS simplispay_internal_id text;

-- Update Mensal plan: Simplispay id=25709, R$99,00
UPDATE public.plans SET
  simplispay_plan_id     = SIMPLISPAY_PLAN_ID_MONTHLY_PLACEHOLDER,
  simplispay_internal_id = 'e21a17d7-80ee-47e4-8bef-4e1bac8f34a5',
  amount_cents           = 9900
WHERE billing_cycle = 'monthly' AND name = 'Mensal';

-- Update Anual plan: Simplispay id=25710, R$799,00
UPDATE public.plans SET
  simplispay_plan_id     = SIMPLISPAY_PLAN_ID_ANNUAL_PLACEHOLDER,
  simplispay_internal_id = 'd04bd73e-b825-48a5-8678-eca4279263e1',
  amount_cents           = 79900
WHERE billing_cycle = 'annual' AND name = 'Anual';

-- Seed the Simplispay gateway_tokens row (one row per provider, unique on provider)
INSERT INTO public.gateway_tokens (provider, token_value, token_expires_at, last_refresh_success)
VALUES ('simplispay', '', NOW() - INTERVAL '1 hour', false)
ON CONFLICT (provider) DO NOTHING;

-- Allow service role to bypass RLS on gateway_tokens (needed for edge functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gateway_tokens' AND policyname = 'service_role_gateway_tokens'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_gateway_tokens ON public.gateway_tokens FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule simplispay-refresh-token every 2 hours
SELECT cron.schedule(
  'simplispay-refresh-token',
  '0 */2 * * *',
  $$
  SELECT perform net.http_post(
    url := 'YOUR_SUPABASE_URL_PLACEHOLDER/functions/v1/simplispay-refresh-token',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
