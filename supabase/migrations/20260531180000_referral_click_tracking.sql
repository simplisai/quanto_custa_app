-- Migration: Referral Click Tracking
-- Adiciona contador de cliques nos links de indicação e RPC para rastrear + retornar nome do indicador

-- 1. Coluna de cliques no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_click_count integer NOT NULL DEFAULT 0;

-- 2. RPC track_referral_click_and_get_user
-- Chamada por usuários anônimos (sem JWT), busca o código, incrementa cliques e retorna full_name
CREATE OR REPLACE FUNCTION public.track_referral_click_and_get_user(
  p_referral_code text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name       text;
  v_profile_id uuid;
BEGIN
  SELECT id, full_name
    INTO v_profile_id, v_name
    FROM public.profiles
   WHERE referral_code = lower(trim(p_referral_code))
   LIMIT 1;

  -- Código não encontrado → retorna NULL (front-end não salva nada)
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Incrementa contador de cliques
  UPDATE public.profiles
     SET referral_click_count = referral_click_count + 1
   WHERE id = v_profile_id;

  -- Retorna nome do indicador (fallback genérico se ainda não preencheu o nome)
  RETURN COALESCE(NULLIF(trim(v_name), ''), 'um usuário');
END $$;

-- Permite chamada anônima (usuário que clica no link antes de logar)
GRANT EXECUTE ON FUNCTION public.track_referral_click_and_get_user(text)
  TO anon, authenticated;
