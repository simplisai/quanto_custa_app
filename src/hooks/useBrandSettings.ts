/**
 * Hook: useBrandSettings
 *
 * Resolve a marca (logo + cor) de um corretor com fallback inviolável.
 * - Com `userId`  → usado no quiz público (anon). Lê via RPC SECURITY DEFINER
 *                   `get_brand_settings`, que expõe apenas logo + cor.
 * - Sem `userId`  → área logada / PDF do próprio corretor. Lê o próprio profiles.
 *
 * Se o usuário não tiver logo/cor custom, retorna os valores oficiais da
 * plataforma "Quanto Custa".
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_BRAND_COLOR = "#22c55e";
/** Logo oficial raster — funciona tanto no PDF (react-pdf) quanto no quiz (HTML). */
export const DEFAULT_BRAND_LOGO = "/logo-dark.png";

export interface BrandSettings {
  /** Sempre resolvido: URL custom ou logo oficial. */
  logoUrl: string;
  /** Sempre resolvido: HEX custom ou cor oficial. */
  color: string;
  /** true apenas se o corretor subiu uma logo. */
  isCustomLogo: boolean;
  /** true apenas se o corretor escolheu uma cor diferente da padrão. */
  isCustomColor: boolean;
  loading: boolean;
}

interface RawBrand {
  brand_logo_url: string | null;
  brand_color: string | null;
}

function resolve(raw: RawBrand | null, loading: boolean): BrandSettings {
  const logo = raw?.brand_logo_url?.trim() || null;
  const color = raw?.brand_color?.trim() || null;
  return {
    logoUrl: logo ?? DEFAULT_BRAND_LOGO,
    color: color ?? DEFAULT_BRAND_COLOR,
    isCustomLogo: !!logo,
    isCustomColor: !!color && color.toLowerCase() !== DEFAULT_BRAND_COLOR,
    loading,
  };
}

export function useBrandSettings(userId?: string): BrandSettings {
  const [raw, setRaw] = useState<RawBrand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        if (userId) {
          // Quiz público (anon) — RPC que só devolve logo + cor
          const { data } = await supabase.rpc("get_brand_settings", {
            p_user_id: userId,
          });
          if (active) setRaw((data as RawBrand) ?? null);
        } else {
          // Próprio corretor (autenticado)
          const { data: userData } = await supabase.auth.getUser();
          const uid = userData.user?.id;
          if (!uid) {
            if (active) setRaw(null);
            return;
          }
          const { data } = await supabase
            .from("profiles")
            .select("brand_logo_url, brand_color")
            .eq("id", uid)
            .maybeSingle();
          if (active) setRaw((data as RawBrand) ?? null);
        }
      } catch {
        if (active) setRaw(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    // userId === undefined é válido (modo "próprio usuário").
    // Só evita rodar enquanto o caller ainda não resolveu o userId esperado
    // (ele passa string vazia/undefined conscientemente).
    load();

    return () => {
      active = false;
    };
  }, [userId]);

  return resolve(raw, loading);
}
