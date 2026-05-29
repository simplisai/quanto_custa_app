import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useReferralStats } from "@/hooks/useReferralStats";
import {
  Gift, Copy, Share2, CheckCircle2, Clock, Users, Star,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { copyToClipboard } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/indicar")({
  component: IndicarPage,
});

function IndicarPage() {
  const { user } = useAuth();
  const { stats, loading, referralLink, refresh } = useReferralStats(user?.id);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleCopy = async () => {
    if (!referralLink) {
      toast.error("Link ainda não carregado. Tente novamente.");
      return;
    }
    setIsCopying(true);
    try {
      const success = await copyToClipboard(referralLink);
      if (success) {
        toast.success("Link copiado!");
      } else {
        toast.error("Não foi possível copiar. Selecione e copie manualmente.");
      }
    } catch (err) {
      console.error("[Copy Error]", err);
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    } finally {
      setIsCopying(false);
    }
  };

  const handleShare = async () => {
    if (!referralLink) {
      toast.error("Link ainda não carregado. Tente novamente.");
      return;
    }
    setIsSharing(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Quanto Custa — Calculadora para Consórcio",
            text: "Use meu link e teste grátis por 14 dias. Ferramentas essenciais para vendedores de consórcio.",
            url: referralLink,
          });
        } catch (err) {
          // User cancelled share
          console.log("[Share] User cancelled or failed");
        }
      } else {
        // Fallback to copy
        await handleCopy();
      }
    } catch (err) {
      console.error("[Share Error]", err);
      toast.error("Não foi possível compartilhar.");
    } finally {
      setIsSharing(false);
    }
  };

  const totalConverted = stats?.total_converted ?? 0;
  const monthsCredit   = stats?.months_credit ?? 0;
  const monthsEarned   = stats?.months_earned ?? 0;
  const maxConversions = 12; // 6 meses × 2 conversões
  const progress       = Math.min((totalConverted / maxConversions) * 100, 100);

  const faqs = [
    {
      q: "Quando a indicação conta?",
      a: "Quando o amigo indicado assinar um plano (mensal ou anual) e completar o período de teste de 14 dias, realizando o primeiro pagamento efetivo. Indicações que ficam apenas no trial não contam.",
    },
    {
      q: "Como recebo o mês grátis?",
      a: "A cada 2 indicações convertidas, seu próximo pagamento é automaticamente adiado em 30 dias. Você recebe até 6 meses grátis (12 indicações).",
    },
    {
      q: "O limite é de 6 meses?",
      a: "Sim. O programa dá até 6 meses grátis por conta. Isso equivale a 12 indicações convertidas com sucesso.",
    },
    {
      q: "O que acontece se meu indicado cancelar antes do fim do trial?",
      a: "A indicação permanece como 'pendente' e não conta para o seu benefício. Somente conversões reais (pós-trial pago) são computadas.",
    },
    {
      q: "Posso indicar a mim mesmo?",
      a: "Não. Indicações para o mesmo e-mail ou conta são desconsideradas automaticamente.",
    },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl shadow-lg">
            🎁
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Indique e ganhe 1 mês grátis
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg">
              A cada <strong className="text-foreground">2 amigos</strong> que assinarem e completarem
              o trial, você ganha <strong className="text-foreground">1 mês sem pagar</strong>.
              Acumule até <strong className="text-foreground">6 meses grátis</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Link de indicação ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-extrabold">Seu link de indicação</h2>
        </div>

        {loading ? (
          <div className="h-12 rounded-xl bg-muted animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-border bg-muted/50 px-4 py-3">
              <code className="block truncate text-xs sm:text-sm font-mono text-foreground">
                {referralLink || "Carregando…"}
              </code>
            </div>
            <button
              onClick={handleCopy}
              disabled={loading || isCopying || !referralLink}
              title="Copiar link"
              className="shrink-0 flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCopying ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isCopying ? "Copiando…" : "Copiar"}</span>
            </button>
            <button
              onClick={handleShare}
              disabled={loading || isSharing || !referralLink}
              title="Compartilhar"
              className="shrink-0 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSharing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isSharing ? "Compartilhando…" : "Compartilhar"}</span>
            </button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Quando seu amigo acessar este link ele é redirecionado para o site e o código fica salvo por 30 dias — mesmo que ele demore para assinar, a indicação vai contar.
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Indicações pendentes",
            value: loading ? "…" : String(stats?.total_pending ?? 0),
            icon: <Clock className="h-4 w-4" />,
            color: "text-yellow-500",
            bg: "bg-yellow-500/10",
          },
          {
            label: "Conversões confirmadas",
            value: loading ? "…" : String(totalConverted),
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: "text-green-500",
            bg: "bg-green-500/10",
          },
          {
            label: "Meses ganhos",
            value: loading ? "…" : String(monthsEarned),
            icon: <Star className="h-4 w-4" />,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Crédito disponível",
            value: loading ? "…" : `${monthsCredit} ${monthsCredit === 1 ? "mês" : "meses"}`,
            icon: <Gift className="h-4 w-4" />,
            color: "text-primary",
            bg: "bg-primary/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-4 space-y-2"
          >
            <div className={`inline-flex items-center justify-center rounded-xl p-2 ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="text-[11px] text-muted-foreground leading-tight">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Barra de progresso ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">Progresso do programa</span>
          <span className="text-muted-foreground text-xs">
            {totalConverted} / {maxConversions} conversões → {Math.floor(totalConverted / 2)} meses grátis
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0 meses</span>
          <span className="text-primary font-bold">6 meses grátis</span>
        </div>
        {monthsCredit > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Você tem {monthsCredit} {monthsCredit === 1 ? "mês" : "meses"} de crédito disponível.
            {monthsCredit === 1 ? " Será aplicado automaticamente no próximo pagamento." : " Serão aplicados nos próximos pagamentos."}
          </div>
        )}
      </div>

      {/* ── Como funciona ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold">Como funciona</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Compartilhe seu link",
              desc: "Envie seu link único para amigos vendedores de consórcio ou corretores de imóveis.",
              icon: <Share2 className="h-5 w-5" />,
            },
            {
              step: "02",
              title: "Amigo assina e usa",
              desc: "Seu amigo cria a conta pelo seu link, testa por 14 dias e confirma a assinatura.",
              icon: <Users className="h-5 w-5" />,
            },
            {
              step: "03",
              title: "Você ganha 1 mês grátis",
              desc: "A cada 2 assinaturas confirmadas, seu próximo pagamento é adiado em 30 dias. Automático.",
              icon: <Gift className="h-5 w-5" />,
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-border bg-card p-5 space-y-3 relative overflow-hidden"
            >
              <span className="absolute top-3 right-4 text-4xl font-extrabold text-muted/20 select-none">
                {item.step}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {item.icon}
              </div>
              <p className="font-extrabold text-sm">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Botão de ação rápida ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-extrabold text-primary-foreground">Pronto para compartilhar?</p>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            Cada indicação vale dinheiro. Comece agora.
          </p>
        </div>
        <button
          onClick={handleShare}
          disabled={loading || isSharing || !referralLink}
          className="shrink-0 flex items-center gap-2 rounded-xl bg-primary-foreground text-primary px-4 py-2.5 text-sm font-extrabold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSharing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Compartilhando…
            </>
          ) : (
            <>
              Compartilhar <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold">Perguntas frequentes</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-accent/50 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="text-sm font-medium">{faq.q}</span>
                {openFaq === i
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                }
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-xs text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
