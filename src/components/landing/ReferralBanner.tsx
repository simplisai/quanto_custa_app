/**
 * ReferralBanner — Banner VIP de Indicação
 *
 * Aparece fixo no topo (z-60, acima do pill nav z-50) quando o usuário
 * chegou via link de indicação válido. Usa glassmorphism dark para se
 * integrar ao hero escuro e chamar atenção sem poluir.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Sparkles } from "lucide-react";
import { useReferralStatus } from "@/hooks/useReferralStatus";

export function ReferralBanner() {
  const { isReferral, referralName } = useReferralStatus();
  const [dismissed, setDismissed] = useState(false);

  if (!isReferral || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -64, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="fixed inset-x-0 top-0 z-[60]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6"
          style={{
            background: "linear-gradient(90deg, #081a0d 0%, #0d2416 50%, #081a0d 100%)",
            borderBottom: "1px solid rgba(34,197,94,0.2)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 24px rgba(34,197,94,0.08), 0 1px 0 rgba(34,197,94,0.15)",
          }}
        >
          {/* Left: icon + message */}
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Pulsing gift icon */}
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-30"
                style={{ background: "rgba(34,197,94,0.4)" }} />
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <Gift className="h-3.5 w-3.5 text-green-400" />
              </span>
            </div>

            <p className="truncate text-[12.5px] font-medium leading-snug text-white/80 sm:text-[13px]">
              Você foi convidado por{" "}
              <strong className="font-bold text-green-400">{referralName}</strong>
              {" "}e desbloqueou{" "}
              <span className="inline-flex items-center gap-1 font-bold text-white">
                <Sparkles className="inline h-3 w-3 text-amber-400" />
                14 dias de acesso VIP gratuito
              </span>
              .
            </p>
          </div>

          {/* Right: dismiss */}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Fechar banner"
            className="ml-2 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/8 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
