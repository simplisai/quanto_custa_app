-- Migration: Atribuição de indicação na CRIAÇÃO DA CONTA (server-side)
--
-- Problema corrigido: a indicação só era registrada no checkout pago, dependendo
-- de um código em localStorage sobreviver de clique→cadastro→checkout. Agora o
-- vínculo indicador→indicado é gravado atomicamente quando a conta nasce, lendo
-- o referral_code do user_metadata. Imune a localStorage expirar/limpar.

-- ── 1. Tabela de auditoria de atribuição (diagnóstico de indicações perdidas) ──
CREATE TABLE IF NOT EXISTS public.referral_attribution_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id  uuid        NOT NULL,
  referral_code     text,
  referrer_id       uuid,
  outcome           text        NOT NULL, -- attributed | invalid_code | self_referral | no_code | already_exists | error
  source            text        NOT NULL DEFAULT 'signup', -- signup | client | checkout
  detail            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_attr_log_user_idx ON public.referral_attribution_log (referred_user_id);
ALTER TABLE public.referral_attribution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read attribution log" ON public.referral_attribution_log;
CREATE POLICY "Admins read attribution log"
  ON public.referral_attribution_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ── 2. RPC: atribui a indicação e registra o resultado (idempotente, auditável) ─
-- Substitui o apply_referral silencioso por uma versão que loga o desfecho.
-- Remove o overload antigo de 2 args para que toda chamada use a versão com log
-- (o 3º parâmetro p_source tem default, então chamadas com 2 args continuam OK).
DROP FUNCTION IF EXISTS public.apply_referral(text, uuid);

CREATE OR REPLACE FUNCTION public.apply_referral(
  p_referral_code    text,
  p_referred_user_id uuid,
  p_source           text DEFAULT 'checkout'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code        text := lower(trim(coalesce(p_referral_code, '')));
  v_referrer_id uuid;
  v_inserted    boolean := false;
BEGIN
  IF v_code = '' THEN
    INSERT INTO public.referral_attribution_log (referred_user_id, referral_code, outcome, source)
      VALUES (p_referred_user_id, NULL, 'no_code', p_source);
    RETURN;
  END IF;

  SELECT id INTO v_referrer_id
    FROM public.profiles
   WHERE referral_code = v_code
   LIMIT 1;

  IF v_referrer_id IS NULL THEN
    INSERT INTO public.referral_attribution_log (referred_user_id, referral_code, outcome, source)
      VALUES (p_referred_user_id, v_code, 'invalid_code', p_source);
    RETURN;
  END IF;

  IF v_referrer_id = p_referred_user_id THEN
    INSERT INTO public.referral_attribution_log (referred_user_id, referral_code, referrer_id, outcome, source)
      VALUES (p_referred_user_id, v_code, v_referrer_id, 'self_referral', p_source);
    RETURN;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_user_id)
    VALUES (v_referrer_id, p_referred_user_id)
    ON CONFLICT (referred_user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.referral_attribution_log (referred_user_id, referral_code, referrer_id, outcome, source)
    VALUES (
      p_referred_user_id, v_code, v_referrer_id,
      CASE WHEN v_inserted THEN 'attributed' ELSE 'already_exists' END,
      p_source
    );
END $$;

GRANT EXECUTE ON FUNCTION public.apply_referral(text, uuid, text) TO authenticated;

-- ── 3. handle_new_user: atribui a indicação a partir do user_metadata ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_plan_id uuid;
  v_ref_code      text;
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  SELECT id INTO default_plan_id FROM public.plans WHERE name = 'Teste' LIMIT 1;
  IF default_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions(user_id, plan_id) VALUES (new.id, default_plan_id);
  END IF;

  IF new.email = 'dalviseguroprev@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'admin');
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user');
  END IF;

  -- Atribuição da indicação na criação da conta (nunca pode quebrar o signup).
  BEGIN
    v_ref_code := new.raw_user_meta_data->>'referral_code';
    IF v_ref_code IS NOT NULL AND length(trim(v_ref_code)) > 0 THEN
      PERFORM public.apply_referral(v_ref_code, new.id, 'signup');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.referral_attribution_log (referred_user_id, referral_code, outcome, source, detail)
      VALUES (new.id, v_ref_code, 'error', 'signup', SQLERRM);
  END;

  RETURN new;
END $$;
