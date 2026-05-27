-- Extende clients com dados de perfil financeiro
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profile_data jsonb DEFAULT '{}';

-- Tabela de formulários (um vendedor pode ter N formulários)
CREATE TABLE IF NOT EXISTS public.form_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  description      text,
  slug             text        NOT NULL UNIQUE,
  fields           jsonb       NOT NULL DEFAULT '[]',
  theme_color      text        NOT NULL DEFAULT '#6366f1',
  is_active        boolean     NOT NULL DEFAULT true,
  submission_count integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_templates_user_idx ON public.form_templates (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS form_templates_slug_idx ON public.form_templates (slug) WHERE is_active = true;

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own forms"
  ON public.form_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read active forms"
  ON public.form_templates FOR SELECT
  USING (is_active = true);

-- Tabela de respostas
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid        NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  owner_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  responses       jsonb       NOT NULL,
  submitted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_submissions_form_idx   ON public.form_submissions (form_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS form_submissions_owner_idx  ON public.form_submissions (owner_user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS form_submissions_client_idx ON public.form_submissions (client_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert submissions"
  ON public.form_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owner reads submissions"
  ON public.form_submissions FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Trigger: incrementa submission_count
CREATE OR REPLACE FUNCTION public.inc_submission_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.form_templates
    SET submission_count = submission_count + 1,
        updated_at = now()
   WHERE id = NEW.form_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS form_submission_count ON public.form_submissions;
CREATE TRIGGER form_submission_count
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.inc_submission_count();

-- Geração de slug automático a partir do título
CREATE OR REPLACE FUNCTION public.generate_form_slug(p_title text, p_user_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_base text;
  v_slug text;
  v_suffix text;
  v_counter int := 0;
BEGIN
  v_base := lower(regexp_replace(
    translate(p_title,
      'àáâãäåèéêëìíîïòóôõöùúûüýÁÂÃÄÅÀÉÊËÈÍÎÏÌÓÔÕÖÒÚÛÜÙÝçÇ',
      'aaaaaaeeeeiiiioooouuuuyAAAAAEEEEIIIIOOOOOUUUUYcC'),
    '[^a-z0-9\s-]', '', 'g'));
  v_base := regexp_replace(trim(v_base), '\s+', '-', 'g');
  v_base := substr(v_base, 1, 30);

  LOOP
    v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_slug := v_base || '-' || v_suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.form_templates WHERE slug = v_slug);
    v_counter := v_counter + 1;
    EXIT WHEN v_counter > 10;
  END LOOP;

  RETURN v_slug;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_form_slug(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_form_slug(text, uuid) TO anon;
