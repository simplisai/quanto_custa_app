-- Migration: Referral Program (Member Get Member)
-- A cada 2 indicados convertidos (trial → pago), o indicador ganha 1 mês grátis (máx 6 meses)

-- 1. Adiciona referral_code único ao profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Preenche referral_code para usuários existentes
UPDATE public.profiles
  SET referral_code = substr(replace(id::text, '-', ''), 1, 8)
  WHERE referral_code IS NULL;

-- Trigger para preencher automaticamente em novos usuários
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON public.profiles;
CREATE TRIGGER profiles_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- 2. Tabela de referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'pending', -- pending | converted | expired
  created_at        timestamptz NOT NULL DEFAULT now(),
  converted_at      timestamptz,
  CONSTRAINT referrals_referred_user_unique UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, status);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referrals" ON public.referrals;
CREATE POLICY "Users view own referrals"
  ON public.referrals FOR SELECT
  USING (
    auth.uid() = referrer_id
    OR auth.uid() = referred_user_id
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins manage referrals" ON public.referrals;
CREATE POLICY "Admins manage referrals"
  ON public.referrals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Coluna de créditos de meses grátis no subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS referral_months_credit integer NOT NULL DEFAULT 0;

-- 4. RPC: registra a indicação no momento do checkout
CREATE OR REPLACE FUNCTION public.apply_referral(
  p_referral_code    text,
  p_referred_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  -- Encontra o referrer pelo código
  SELECT id INTO v_referrer_id
    FROM public.profiles
   WHERE referral_code = lower(trim(p_referral_code))
   LIMIT 1;

  -- Sem referrer ou auto-indicação: ignora silenciosamente
  IF v_referrer_id IS NULL THEN RETURN; END IF;
  IF v_referrer_id = p_referred_user_id THEN RETURN; END IF;

  INSERT INTO public.referrals (referrer_id, referred_user_id)
    VALUES (v_referrer_id, p_referred_user_id)
    ON CONFLICT (referred_user_id) DO NOTHING;
END $$;

-- 5. RPC: retorna stats do programa de indicação para um usuário
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code       text;
  v_pending    bigint := 0;
  v_converted  bigint := 0;
  v_credit     integer := 0;
BEGIN
  SELECT referral_code INTO v_code FROM public.profiles WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_pending   FROM public.referrals WHERE referrer_id = p_user_id AND status = 'pending';
  SELECT COUNT(*) INTO v_converted FROM public.referrals WHERE referrer_id = p_user_id AND status = 'converted';
  SELECT referral_months_credit INTO v_credit FROM public.subscriptions WHERE user_id = p_user_id;

  RETURN json_build_object(
    'referral_code',   v_code,
    'total_pending',   COALESCE(v_pending, 0),
    'total_converted', COALESCE(v_converted, 0),
    'months_earned',   (COALESCE(v_converted, 0) / 2)::integer,
    'months_credit',   COALESCE(v_credit, 0),
    'max_months',      6
  );
END $$;

-- Grant execute to authenticated users (SECURITY DEFINER functions still need execute grant)
GRANT EXECUTE ON FUNCTION public.apply_referral(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(uuid) TO authenticated;
