import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Users, Wallet, MessageSquare, TrendingUp, CreditCard, Radio,
  ShoppingCart, XCircle, Target, CheckCircle, DollarSign, Ban,
  PauseCircle, PlayCircle, AlertTriangle, Activity, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminHome,
})

type AdminMetrics = {
  total_users: number
  active_subscriptions: number
  trialing_subscriptions: number
  past_due_subscriptions: number
  suspended_subscriptions: number
  canceled_subscriptions: number
  total_simulations: number
  open_tickets: number
  mrr_cents: number
  arr_cents: number
  total_revenue_cents: number
  webhooks_last_24h: number
  trials_converting_this_month: number
}

type LedgerEvent = {
  id: string
  event_type: string
  source: string
  subscription_id: string | null
  user_id: string | null
  created_at: string
  email?: string
}

const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EVENT_LABEL: Record<string, string> = {
  checkout_initiated: 'Checkout iniciado', checkout_failed: 'Checkout falhou',
  trial_started: 'Trial iniciado', trial_ended: 'Trial encerrado',
  subscription_activated: 'Assinatura ativada', subscription_updated: 'Assinatura atualizada',
  subscription_past_due: 'Pagamento atrasado', subscription_suspended: 'Assinatura suspensa',
  subscription_reactivated: 'Assinatura reativada', subscription_canceled: 'Assinatura cancelada',
  invoice_paid: 'Fatura paga', invoice_failed: 'Fatura falhou',
  invoice_refunded: 'Fatura estornada', webhook_received: 'Webhook recebido',
  admin_action: 'Ação admin',
}

const EVENT_ICON: Record<string, React.ElementType> = {
  checkout_initiated: ShoppingCart, checkout_failed: XCircle,
  trial_started: Target, trial_ended: Target,
  subscription_activated: CheckCircle, subscription_updated: Activity,
  subscription_past_due: AlertTriangle, subscription_suspended: PauseCircle,
  subscription_reactivated: PlayCircle, subscription_canceled: Ban,
  invoice_paid: DollarSign, invoice_failed: XCircle,
  invoice_refunded: Wallet, webhook_received: Radio, admin_action: Users,
}

const SOURCE_COLOR: Record<string, string> = {
  webhook: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  system: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  checkout: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  admin: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
}

const SOURCE_LABEL: Record<string, string> = { webhook: 'Webhook', system: 'Sistema', checkout: 'Checkout', admin: 'Admin' }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function KpiCard({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardDescription className="text-xs leading-none">{label}</CardDescription>
        <CardTitle className={`ds-kpi-value mt-1 ${color}`}>{value}</CardTitle>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{sub}</p>}
      </CardHeader>
    </Card>
  )
}

function KpiSkeleton({ count }: { count: number }) {
  return (
    <div className="ds-kpi-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-16 animate-pulse rounded bg-muted mt-2" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function AdminHome() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [events, setEvents] = useState<LedgerEvent[]>([])
  const [bootstrapping, setBootstrapping] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [metricsRes, eventsRes] = await Promise.all([
      supabase.from('admin_metrics').select('*').single(),
      supabase.from('subscription_ledger_events')
        .select('id, event_type, source, subscription_id, user_id, created_at')
        .order('created_at', { ascending: false }).limit(20),
    ])
    if (metricsRes.data) setMetrics(metricsRes.data as unknown as AdminMetrics)
    const rawEvents = (eventsRes.data ?? []) as LedgerEvent[]
    const userIds = [...new Set(rawEvents.map((e) => e.user_id).filter(Boolean))] as string[]
    let emailMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds)
      emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]))
    }
    setEvents(rawEvents.map((e) => ({ ...e, email: e.user_id ? emailMap.get(e.user_id) : undefined })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const bootstrap = async () => {
    setBootstrapping(true)
    const { error } = await supabase.rpc('bootstrap_admin')
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Você é administrador. Recarregue.'); setTimeout(() => window.location.reload(), 1500) }
    setBootstrapping(false)
  }

  const modules = [
    { title: 'Usuários', description: 'Planos, roles e uso', href: '/admin/usuarios', icon: Users },
    { title: 'Assinaturas', description: 'Status e ledger', href: '/admin/assinaturas', icon: CreditCard },
    { title: 'Financeiro', description: 'Faturas e MRR', href: '/admin/financeiro', icon: Wallet },
    { title: 'Suporte', description: 'Tickets', href: '/admin/suporte', icon: MessageSquare },
    { title: 'Webhooks', description: 'Eventos', href: '/admin/webhooks', icon: Radio },
  ]

  return (
    <div className="ds-page">

      {/* Header */}
      <div className="ds-page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de operações</h1>
          <p className="text-sm text-muted-foreground mt-1">Métricas em tempo real, assinaturas e eventos.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(!metrics || metrics.total_users === 0) && (
            <Button variant="outline" size="sm" onClick={bootstrap} disabled={bootstrapping}>
              {bootstrapping ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bootstrap admin'}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Área do usuário</Link>
          </Button>
        </div>
      </div>

      {/* KPI row 1 — ds-kpi-4 */}
      {loading ? <KpiSkeleton count={4} /> : (
        <div className="ds-kpi-4">
          <KpiCard label="MRR" value={fmt(metrics!.mrr_cents)} sub={`ARR: ${fmt(metrics!.arr_cents)}`} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Assinaturas ativas" value={String(metrics!.active_subscriptions)} sub={`${metrics!.trialing_subscriptions} em trial`} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Receita total" value={fmt(metrics!.total_revenue_cents)} sub="faturas pagas" />
          <KpiCard label="Conversões 30d" value={String(metrics!.trials_converting_this_month)} sub="trial → ativo" />
        </div>
      )}

      {/* KPI row 2 — ds-kpi-4 */}
      {loading ? <KpiSkeleton count={4} /> : (
        <div className="ds-kpi-4">
          <KpiCard label="Inadimplentes" value={String(metrics!.past_due_subscriptions)} sub={`${metrics!.suspended_subscriptions} suspensos`} color={metrics!.past_due_subscriptions > 0 ? 'text-red-600 dark:text-red-400' : ''} />
          <KpiCard label="Usuários" value={String(metrics!.total_users)} sub={`${metrics!.total_simulations} simulações`} />
          <KpiCard label="Tickets abertos" value={String(metrics!.open_tickets)} color={metrics!.open_tickets > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''} />
          <KpiCard label="Webhooks 24h" value={String(metrics!.webhooks_last_24h)} color="text-blue-600 dark:text-blue-400" />
        </div>
      )}

      {/* Activity + modules — 2/3 + 1/3 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

        {/* Activity feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Atividade recente</CardTitle>
            <CardDescription className="text-xs">Últimos 20 eventos do ledger</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-7 w-7 animate-pulse rounded-full bg-muted shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <p className="ds-empty-state py-10">Nenhum evento registrado ainda.</p>
              ) : (
                <div className="divide-y divide-border">
                  {events.map((ev) => {
                    const Icon = EVENT_ICON[ev.event_type] ?? Activity
                    return (
                      <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium leading-none">
                              {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_COLOR[ev.source] ?? 'bg-muted text-muted-foreground'}`}>
                              {SOURCE_LABEL[ev.source] ?? ev.source}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground mt-0.5">
                            {ev.email ?? (ev.user_id ? ev.user_id.slice(0, 8) + '…' : 'sistema')}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {relativeTime(ev.created_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Módulos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {modules.map((m) => {
              const Icon = m.icon
              return (
                <Button key={m.title} asChild variant="outline" className="w-full justify-start gap-3 h-auto py-2.5 px-3">
                  <Link to={m.href}>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold leading-none">{m.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-none">{m.description}</div>
                    </div>
                  </Link>
                </Button>
              )
            })}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
