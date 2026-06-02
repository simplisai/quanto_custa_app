-- Migration: Rastreabilidade de visualizações de simulações
--
-- Registra cada vez que um usuário abre um simulador salvo,
-- incluindo a origem (painel de cliente, histórico, link direto).
-- Permite auditoria e análise de quais simulações são mais acessadas.

CREATE TABLE IF NOT EXISTS public.simulation_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid        NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL,
  viewed_at     timestamptz NOT NULL DEFAULT now(),
  source        text        NOT NULL DEFAULT 'direct' -- 'direct' | 'client_panel' | 'historico'
);

CREATE INDEX IF NOT EXISTS simulation_views_sim_idx  ON public.simulation_views (simulation_id);
CREATE INDEX IF NOT EXISTS simulation_views_user_idx ON public.simulation_views (user_id, viewed_at DESC);

ALTER TABLE public.simulation_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own simulation views"
  ON public.simulation_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own simulation views"
  ON public.simulation_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);
