/**
 * Hook: useReferralStatus
 *
 * Lê o localStorage para verificar se o usuário chegou via link de indicação válido.
 * `isReferral` só é true quando AMBOS código + nome estão presentes e não-expirados,
 * garantindo que usuários sem indicação (ou com código falso) não acessem o Trial VIP.
 */
import {
  readReferralCode,
  readReferralName,
  clearReferralCode,
} from "@/routes/$referralCode";

export interface ReferralStatus {
  /** true apenas se código + nome válidos existirem no localStorage */
  isReferral: boolean;
  /** Código hex de 8 chars do indicador, ou null */
  referralCode: string | null;
  /** Nome do indicador (vindo do DB via RPC), ou null */
  referralName: string | null;
  /** Limpa código + nome + expiração do localStorage */
  clear: () => void;
}

export function useReferralStatus(): ReferralStatus {
  const code = readReferralCode();
  const name = readReferralName();

  // Dupla verificação: ambos devem existir (anti-fraude mínimo front-end)
  // O backend (Edge Function) é o validador final via apply_referral()
  const isReferral = !!code && !!name;

  return {
    isReferral,
    referralCode: isReferral ? code : null,
    referralName: isReferral ? name : null,
    clear: clearReferralCode,
  };
}
