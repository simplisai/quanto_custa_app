/**
 * Rota de indicação: quantocusta.pro/{codigo}
 *
 * Fluxo:
 *  1. Usuário acessa quantocusta.pro/ABCD1234
 *  2. Validamos formato (8 chars hex)
 *  3. Chamamos o Supabase RPC para validar no DB e obter nome do indicador
 *  4. Se válido: salvamos código + nome no localStorage (30 dias)
 *  5. Redirecionamos para a landing page (/)
 *  6. No checkout, o código + flag hasTrial são enviados automaticamente
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Padrão do código: 8 caracteres hexadecimais (gerado do UUID do usuário)
const REFERRAL_CODE_REGEX = /^[0-9a-f]{8}$/i;

// Chaves do localStorage
export const REFERRAL_LS_KEY    = "qc_referral_code";
export const REFERRAL_LS_NAME   = "qc_referral_name";
export const REFERRAL_LS_EXPIRY = "qc_referral_expiry";
const EXPIRY_DAYS = 30;

/** Salva código + nome do indicador no localStorage com expiração de 30 dias. */
export function saveReferralData(code: string, name: string) {
  try {
    const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(REFERRAL_LS_KEY,    code.toLowerCase());
    localStorage.setItem(REFERRAL_LS_NAME,   name);
    localStorage.setItem(REFERRAL_LS_EXPIRY, String(expiry));
  } catch {
    // localStorage pode estar desabilitado em modo privado
  }
}

/**
 * Mantido por compatibilidade com signup.tsx e outros que ainda chamam.
 * Salva apenas o código (sem nome), mas garante que o nome não fica stale.
 */
export function saveReferralCode(code: string) {
  try {
    const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(REFERRAL_LS_KEY,    code.toLowerCase());
    localStorage.setItem(REFERRAL_LS_EXPIRY, String(expiry));
    // Remove nome para não deixar dado inconsistente
    localStorage.removeItem(REFERRAL_LS_NAME);
  } catch { /* noop */ }
}

/** Lê o código do localStorage. Retorna null se expirado ou ausente. */
export function readReferralCode(): string | null {
  try {
    const code   = localStorage.getItem(REFERRAL_LS_KEY);
    const expiry = parseInt(localStorage.getItem(REFERRAL_LS_EXPIRY) ?? "0", 10);
    if (!code || Date.now() > expiry) return null;
    return code;
  } catch {
    return null;
  }
}

/** Lê o nome do indicador. Só retorna se o código também for válido. */
export function readReferralName(): string | null {
  try {
    const code   = localStorage.getItem(REFERRAL_LS_KEY);
    const expiry = parseInt(localStorage.getItem(REFERRAL_LS_EXPIRY) ?? "0", 10);
    if (!code || Date.now() > expiry) return null;
    return localStorage.getItem(REFERRAL_LS_NAME);
  } catch {
    return null;
  }
}

/** Remove código, nome e expiração do localStorage após uso no checkout. */
export function clearReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_LS_KEY);
    localStorage.removeItem(REFERRAL_LS_NAME);
    localStorage.removeItem(REFERRAL_LS_EXPIRY);
  } catch { /* noop */ }
}

export const Route = createFileRoute("/$referralCode")({
  beforeLoad: async ({ params }) => {
    const code = params.referralCode;

    if (REFERRAL_CODE_REGEX.test(code)) {
      // Valida no DB, registra o clique e obtém o nome do indicador
      const { data: referralName } = await supabase.rpc(
        "track_referral_click_and_get_user",
        { p_referral_code: code }
      );

      if (referralName) {
        // Código válido: persiste código + nome para uso no checkout e banner
        saveReferralData(code, referralName as string);
      }
      // Se null → código inválido, não salva nada (checkout sem trial)
    }

    // Sempre redireciona para a landing page
    throw redirect({ to: "/" });
  },
  // Componente nunca renderiza (beforeLoad sempre redireciona)
  component: () => null,
});
