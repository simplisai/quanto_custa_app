-- =====================================================================
-- simulator_configs: versioned formula config per simulator
-- Each row = one version of one simulator's formula definition.
-- Only one version per slug can be published at a time (partial unique index).
-- =====================================================================

CREATE TABLE public.simulator_configs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        NOT NULL,
  version_number  integer     NOT NULL,
  version_label   text        NOT NULL DEFAULT '',
  notes           text,
  config          jsonb       NOT NULL,
  is_published    boolean     NOT NULL DEFAULT false,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT simulator_configs_slug_version_key UNIQUE (slug, version_number)
);

-- Ensures only one published version per simulator slug
CREATE UNIQUE INDEX simulator_configs_one_published
  ON public.simulator_configs (slug)
  WHERE is_published = true;

-- Fast lookup for latest versions per slug
CREATE INDEX simulator_configs_slug_idx
  ON public.simulator_configs (slug, version_number DESC);

-- ── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.simulator_configs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read published configs (needed at runtime in simulators)
CREATE POLICY "read published configs"
  ON public.simulator_configs FOR SELECT
  TO authenticated
  USING (is_published = true OR has_role(auth.uid(), 'admin'));

-- Only admins can insert / update / delete
CREATE POLICY "admins manage configs"
  ON public.simulator_configs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── Helper RPC: publish a version (handles the unique index swap atomically) ──

CREATE OR REPLACE FUNCTION public.publish_simulator_config(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_slug text;
BEGIN
  -- Admin check
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT slug INTO v_slug FROM public.simulator_configs WHERE id = p_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'Config not found';
  END IF;

  -- Unpublish all versions for this slug first
  UPDATE public.simulator_configs
    SET is_published = false
    WHERE slug = v_slug AND is_published = true;

  -- Publish the target version
  UPDATE public.simulator_configs
    SET is_published = true
    WHERE id = p_id;
END;
$$;

-- ── Helper RPC: duplicate a version as a new draft ──────────────────

CREATE OR REPLACE FUNCTION public.duplicate_simulator_config(p_id uuid, p_label text DEFAULT 'Nova versão')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id    uuid;
  v_next_ver  integer;
  v_slug      text;
  v_config    jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT slug, config INTO v_slug, v_config
    FROM public.simulator_configs WHERE id = p_id;

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_ver
    FROM public.simulator_configs
    WHERE slug = v_slug;

  INSERT INTO public.simulator_configs (slug, version_number, version_label, config, is_published, created_by)
    VALUES (v_slug, v_next_ver, p_label, v_config, false, auth.uid())
    RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
