-- Migration: White-label Brand Settings
-- Permite que cada corretor personalize logo + cor no header de PDFs e formulários públicos.

-- 1a. Colunas de marca no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_color    text DEFAULT '#22c55e';

-- 1b. Bucket público brand_assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand_assets', 'brand_assets', true)
ON CONFLICT (id) DO NOTHING;

-- 1c. Storage RLS — leitura pública; write só na pasta {user_id}/
DROP POLICY IF EXISTS "brand_assets public read" ON storage.objects;
CREATE POLICY "brand_assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand_assets');

DROP POLICY IF EXISTS "brand_assets owner insert" ON storage.objects;
CREATE POLICY "brand_assets owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand_assets'
              AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "brand_assets owner update" ON storage.objects;
CREATE POLICY "brand_assets owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand_assets'
         AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "brand_assets owner delete" ON storage.objects;
CREATE POLICY "brand_assets owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand_assets'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- 1d. RPC para o quiz público (anon) ler SÓ marca de um dono — sem expor o profiles inteiro
CREATE OR REPLACE FUNCTION public.get_brand_settings(p_user_id uuid)
RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'brand_logo_url', brand_logo_url,
    'brand_color',    COALESCE(brand_color, '#22c55e')
  )
  FROM public.profiles WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_brand_settings(uuid) TO anon, authenticated;
