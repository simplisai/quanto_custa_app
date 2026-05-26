import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Calculator, Clock, History, Users, FileText, MessageSquare, ArrowRight, Gift, Copy } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useReferralStats } from '@/hooks/useReferralStats'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, subscription } = useAuth()
  const { stats: referralStats, referralLink, loading: referralLoading } = useReferralStats(user?.id)
  const [simulationCount, setSimulationCount] = useState<number | null>(null)
  const [clientCount, setClientCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [simRes, clientRes] = await Promise.all([
          supabase.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        ])
        setSimulationCount(simRes.count ?? 0)
        setClientCount(clientRes.count ?? 0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Derive subscription display info from context (no extra network call)
  const planName = subscription?.plans?.name
    ?? (subscription?.billing_cycle === 'monthly' ? 'Mensal' : subscription?.billing_cycle === 'annual' ? 'Anual' : null)
    ?? 'Gratuito'

  // Trial ending banner: show when ≤ 3 days left
  const trialDaysLeft = subscription?.status === 'trialing' && subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null
  const showTrialBanner = trialDaysLeft !== null && trialDaysLeft <= 3

  // Payment issue banner
  const showPastDueBanner = subscription?.status === 'past_due'

  const stats = [
    { label: 'Simulações salvas', value: loading ? '…' : String(simulationCount ?? 0) },
    { label: 'Clientes cadastrados', value: loading ? '…' : String(clientCount ?? 0) },
    { label: 'Plano ativo', value: planName },
  ]

  const operations = [
    {
      title: 'Calculadora Patrimonial',
      description: 'Compare SAC, PRICE e consórcio com simulações completas mês a mês.',
      icon: Calculator,
      href: '/app',
      badge: 'Disponível',
    },
  ]

  const shortcuts = [
    { title: 'Histórico', description: 'Simulações salvas', icon: History, href: '/historico' },
    { title: 'Clientes', description: 'Gestão de clientes', icon: Users, href: '/clientes' },
    { title: 'Templates', description: 'Configurações salvas', icon: FileText, href: '/templates' },
    { title: 'Suporte', description: 'Abrir ticket', icon: MessageSquare, href: '/suporte' },
  ]

  return (
    // ds-page: sem padding próprio — o layout (_authenticated.tsx) já cuida disso
    <div className="ds-page">

      {/* Hero header */}
      <header className="rounded-2xl border bg-card p-5 md:p-6">
        <Badge variant="secondary" className="mb-3 text-xs">Área do usuário</Badge>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Olá{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Acompanhe simulações, clientes e o avanço do seu uso na plataforma.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/app"><Calculator className="mr-2 h-4 w-4" />Nova simulação</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/historico"><History className="mr-2 h-4 w-4" />Ver histórico</Link>
          </Button>
        </div>
      </header>

      {/* Trial ending banner */}
      {showTrialBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Trial expira em {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}.
            </span>{' '}
            <span className="text-amber-600 dark:text-amber-400">
              Adicione um cartão para continuar usando a plataforma sem interrupção.
            </span>
          </div>
          <Link
            to="/assinatura"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            Gerenciar
          </Link>
        </div>
      )}

      {/* Past-due payment banner */}
      {showPastDueBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-destructive">Pagamento com problema.</span>{' '}
            <span className="text-muted-foreground">
              Houve uma falha na cobrança da sua assinatura. Atualize seus dados para manter o acesso.
            </span>
          </div>
          <Link
            to="/assinatura"
            className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90"
          >
            Resolver
          </Link>
        </div>
      )}

      {/* Stats — ds-kpi-3: 1 col mobile → 3 col sm+ */}
      <section className="ds-kpi-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-3">
              <CardDescription className="text-xs">{stat.label}</CardDescription>
              <CardTitle className="ds-kpi-value">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      {/* Referral widget */}
      <section>
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-background p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                🎁
              </div>
              <div>
                <h3 className="text-sm font-extrabold">Indique e ganhe 1 mês grátis</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A cada 2 amigos que assinarem, você ganha 1 mês sem pagar. Até 6 meses grátis.
                  {(referralStats?.months_credit ?? 0) > 0 && (
                    <span className="ml-1 font-bold text-green-600 dark:text-green-400">
                      • {referralStats!.months_credit} {referralStats!.months_credit === 1 ? "mês" : "meses"} disponível!
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              to="/indicar"
              className="shrink-0 flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent transition-colors"
            >
              Ver programa <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Link copiável compacto */}
          <div className="mt-4 flex gap-2">
            {referralLoading ? (
              <div className="h-9 flex-1 rounded-xl bg-muted animate-pulse" />
            ) : (
              <div className="flex-1 min-w-0 rounded-xl border border-border bg-background/80 px-3 py-2 flex items-center">
                <code className="truncate text-[11px] font-mono text-muted-foreground">
                  {referralLink || "Gerando link…"}
                </code>
              </div>
            )}
            <button
              onClick={async () => {
                if (!referralLink) return;
                try {
                  await navigator.clipboard.writeText(referralLink);
                  toast.success("Link copiado!");
                } catch {
                  toast.error("Não foi possível copiar.");
                }
              }}
              disabled={!referralLink}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all active:scale-95"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copiar</span>
            </button>
          </div>

          {/* Mini-progresso */}
          {referralStats && (
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{referralStats.total_converted} / 12 conversões</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${Math.min((referralStats.total_converted / 12) * 100, 100)}%` }}
                />
              </div>
              <span className="font-bold text-primary">{referralStats.months_earned} / 6 meses</span>
            </div>
          )}
        </div>
      </section>

      {/* Operações — ds-cards-2: 1 col mobile → 2 col sm+ */}
      <section>
        <h2 className="mb-3 text-base font-semibold">Operações disponíveis</h2>
        <div className="ds-cards-2">
          {operations.map((op) => {
            const Icon = op.icon
            return (
              <Card key={op.title} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <Badge>{op.badge}</Badge>
                  </div>
                  <CardTitle className="text-base">{op.title}</CardTitle>
                  <CardDescription className="text-sm">{op.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Button asChild className="w-full" size="sm">
                    <Link to={op.href}>Abrir <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Atalhos — ds-cards-4: 2 col mobile → 4 col sm+ */}
      <section>
        <h2 className="mb-3 text-base font-semibold">Atalhos</h2>
        <div className="ds-cards-4">
          {shortcuts.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.title} to={s.href}>
                <Card className="transition-colors hover:bg-accent cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">{s.title}</CardTitle>
                    <CardDescription className="text-xs">{s.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

    </div>
  )
}
