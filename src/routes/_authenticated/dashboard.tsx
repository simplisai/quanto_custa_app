import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Calculator, Clock, History, Users, FileText, MessageSquare, ArrowRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, subscription } = useAuth()
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
