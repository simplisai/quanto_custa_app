/**
 * Rota de indicação: quantocusta.pro/{codigo}
 *
 * Esta rota captura qualquer path de 8 caracteres hex não reconhecido pelas
 * outras rotas (login, checkout, signup, etc.) e o trata como código de indicação.
 *
 * Fluxo:
 *  1. Usuário acessa quantocusta.pro/ABCD1234
 *  2. Validamos que é um código de indicação (8 chars hex)
 *  3. Salvamos no localStorage com validade de 30 dias
 *  4. Redirecionamos para a landing page (/)
 *  5. No checkout, o código é lido e enviado automaticamente
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

// Padrão do código: 8 caracteres hexadecimais minúsculos (gerado do UUID do usuário)
const REFERRAL_CODE_REGEX = /^[0-9a-f]{8}$/i;

// Chave e validade no localStorage
export const REFERRAL_LS_KEY    = "qc_referral_code";
export const REFERRAL_LS_EXPIRY = "qc_referral_expiry";
const EXPIRY_DAYS = 30;

/** Salva o código no localStorage com expiração de 30 dias. */
export function saveReferralCode(code: string) {
  try {
    const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(REFERRAL_LS_KEY,    code.toLowerCase());
    localStorage.setItem(REFERRAL_LS_EXPIRY, String(expiry));
  } catch {
    // localStorage pode estar desabilitado em modo privado de alguns browsers
  }
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

/** Remove o código do localStorage após uso no checkout. */
export function clearReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_LS_KEY);
    localStorage.removeItem(REFERRAL_LS_EXPIRY);
  } catch { /* noop */ }
}

export const Route = createFileRoute("/$referralCode")({
  beforeLoad: ({ params }) => {
    const code = params.referralCode;

    if (REFERRAL_CODE_REGEX.test(code)) {
      // Código válido: salva e redireciona para a landing page
      saveReferralCode(code);
    }
    // Seja código válido ou path desconhecido, sempre redireciona para /
    throw redirect({ to: "/" });
  },
  // Componente nunca renderiza (sempre redireciona via beforeLoad)
  component: () => null,
});
