import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/assinatura")({ component: AssinaturaPage });

type SubscriptionStatus = "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "annual";
  amount_cents: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  started_at: string;
  card_last_four: string | null;
  card_brand: string | null;
  simplispay_subscription_id: string | null;
  plans: { name: string } | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

const STATUS_LABEL: Record<SubscriptionStatus, { label: string; color: string }> = {
  trialing:  { label: "Trial ativo",   color: "bg-success/15 text-success-foreground" },
  active:    { label: "Ativa",          color: "bg-primary/15 text-primary" },
  past_due:  { label: "Pagamento atrasado", color: "bg-warning/15 text-warning-foreground" },
  suspended: { label: "Suspensa",       color: "bg-muted text-muted-foreground" },
  canceled:  { label: "Cancelada",      color: "bg-danger/15 text-danger" },
  expired:   { label: "Expirada",       color: "bg-muted text-muted-foreground" },
};

function Badge({ status }: { status: SubscriptionStatus }) {
  const { label, color } = STATUS_LABEL[status] ?? { label: status, color: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${color}`}>
      {label}
    </span>
  );
}

function AssinaturaPage() {
  const { user, isAccessBlocked, refreshSubscription } = useAuth();
  const nav = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadSub = () => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("*, plans(name)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setSub(data as Subscription | null);
        setLoading(false);
      });
  };

  useEffect(() => { loadSub(); }, [user]);

  const handleCancel = async () => {
    if (!sub || canceling) return;
    setCanceling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "cancel" }),
        }
      );

      const body = await res.json() as { error?: string };
      if (!res.ok) { toast.error(body.error ?? "Erro ao cancelar"); return; }

      toast.success("Assinatura cancelada.");
      setSub((prev) => prev ? { ...prev, status: "canceled", canceled_at: new Date().toISOString() } : prev);
      setShowConfirm(false);
      // Sync context so the access guard updates immediately
      refreshSubscription();
    } catch (e) {
      toast.error((e as Error).message || "Erro inesperado");
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Carregando assinatura…
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="text-4xl">📋</div>
        <h1 className="text-2xl font-extrabold">Sem assinatura ativa</h1>
        <p className="text-sm text-muted-foreground">
          Você ainda não possui uma assinatura. Experimente 14 dias grátis.
        </p>
        <Link
          to="/assinar"
          className="inline-block rounded-xl bg-primary px-8 py-4 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant hover:opacity-95"
        >
          Assinar agora
        </Link>
      </div>
    );
  }

  const isTrialing = sub.status === "trialing";
  const isActive = sub.status === "active";
  const isPastDue = sub.status === "past_due";
  const isCanceled = sub.status === "canceled" || sub.status === "expired";
  const canCancel = !isCanceled && sub.status !== "suspended";

  const trialDays = daysLeft(sub.trial_ends_at);
  const cyclePt = sub.billing_cycle === "monthly" ? "Mensal" : "Anual";
  const planName = sub.plans?.name ?? cyclePt;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Minha Assinatura</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie seu plano e dados de cobrança.</p>
      </header>

      {/* Access blocked banner */}
      {isAccessBlocked && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/8 px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-bold text-destructive">Acesso bloqueado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sua assinatura está{" "}
                {sub ? STATUS_LABEL[sub.status]?.label.toLowerCase() : "inativa"}.
                {" "}Renove para continuar usando a plataforma.
              </p>
            </div>
          </div>
          <Link
            to="/assinar"
            className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant hover:opacity-95"
          >
            Renovar assinatura agora
          </Link>
        </div>
      )}

      {/* Status card */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Plano</div>
            <div className="mt-1 text-2xl font-extrabold">{planName}</div>
            <div className="text-sm text-muted-foreground">{fmtBRL(sub.amount_cents)} / {sub.billing_cycle === "monthly" ? "mês" : "ano"}</div>
          </div>
          <Badge status={sub.status} />
        </div>

        <div className="h-px bg-border" />

        <div className="grid gap-4 md:grid-cols-2">
          {isTrialing && sub.trial_ends_at && (
            <InfoRow
              label="Trial gratuito até"
              value={fmtDate(sub.trial_ends_at)}
              highlight={trialDays <= 3 ? "warning" : "success"}
              detail={`${trialDays} ${trialDays === 1 ? "dia" : "dias"} restantes`}
            />
          )}
          {(isActive || isPastDue) && sub.current_period_end && (
            <InfoRow
              label="Próxima cobrança"
              value={fmtDate(sub.current_period_end)}
              highlight={isPastDue ? "danger" : undefined}
            />
          )}
          {isCanceled && sub.canceled_at && (
            <InfoRow label="Cancelada em" value={fmtDate(sub.canceled_at)} highlight="danger" />
          )}
          <InfoRow label="Assinante desde" value={fmtDate(sub.started_at)} />
          <InfoRow label="Ciclo" value={cyclePt} />
          {sub.card_last_four && (
            <InfoRow
              label="Cartão"
              value={`•••• •••• •••• ${sub.card_last_four}`}
              detail={sub.card_brand ? sub.card_brand.charAt(0).toUpperCase() + sub.card_brand.slice(1) : undefined}
            />
          )}
        </div>
      </section>

      {/* Alerts */}
      {isTrialing && trialDays <= 3 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning-foreground">
          Seu trial termina em {trialDays} {trialDays === 1 ? "dia" : "dias"}. Após isso, {fmtBRL(sub.amount_cents)} será cobrado no cartão cadastrado.
        </div>
      )}
      {isPastDue && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          Há um problema com seu pagamento. Atualize seus dados de cartão para manter o acesso.
        </div>
      )}

      {/* Cancel flow */}
      {canCancel && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">
            <span>Gerenciar assinatura</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              Cancelar assinatura
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-danger/40 bg-danger/5 p-4">
              <p className="text-sm font-semibold">
                Tem certeza? Você perderá o acesso ao final do período {isTrialing ? "de trial" : "já pago"}.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={canceling}
                  className="rounded-lg bg-danger px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {canceling ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-accent"
                >
                  Manter assinatura
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {isCanceled && (
        <div className="text-center">
          <Link
            to="/assinar"
            className="inline-block rounded-xl bg-primary px-8 py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant hover:opacity-95"
          >
            Reativar assinatura
          </Link>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label, value, detail, highlight,
}: {
  label: string; value: string; detail?: string;
  highlight?: "success" | "warning" | "danger";
}) {
  const valueColor =
    highlight === "success" ? "text-success font-bold"
    : highlight === "warning" ? "text-warning-foreground font-bold"
    : highlight === "danger" ? "text-danger font-bold"
    : "text-foreground font-semibold";

  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${valueColor}`}>{value}</div>
      {detail && <div className="text-[11px] text-muted-foreground capitalize">{detail}</div>}
    </div>
  );
}
