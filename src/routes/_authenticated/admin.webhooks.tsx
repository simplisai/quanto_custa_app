import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2, Radio, ShoppingCart, XCircle, Target, CheckCircle,
  DollarSign, Ban, PauseCircle, PlayCircle, Activity, AlertTriangle,
  Wallet, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/admin/webhooks')({
  component: AdminWebhooks,
})

type LedgerRow = {
  id: string
  event_type: string
  source: string
  subscription_id: string | null
  user_id: string | null
  payload: unknown
  created_at: string
  email?: string
  simplispay_subscription_id?: string | null
}

type SourceFilter = 'all' | 'webhook' | 'system' | 'checkout' | 'admin'

const EVENT_LABEL: Record<string, string> = {
  checkout_initiated: 'Checkout iniciado',
  checkout_failed: 'Checkout falhou',
  trial_started: 'Trial iniciado',
  trial_ended: 'Trial encerrado',
  subscription_activated: 'Assinatura ativada',
  subscription_updated: 'Assinatura atualizada',
  subscription_past_due: 'Pagamento atrasado',
  subscription_suspended: 'Assinatura suspensa',
  subscription_reactivated: 'Assinatura reativada',
  subscription_canceled: 'Assinatura cancelada',
  invoice_paid: 'Fatura paga',
  invoice_failed: 'Fatura falhou',
  invoice_refunded: 'Fatura estornada',
  webhook_received: 'Webhook recebido',
  admin_action: 'Ação admin',
}

const EVENT_ICON: Record<string, React.ElementType> = {
  checkout_initiated: ShoppingCart,
  checkout_failed: XCircle,
  trial_started: Target,
  trial_ended: Target,
  subscription_activated: CheckCircle,
  subscription_updated: Activity,
  subscription_past_due: AlertTriangle,
  subscription_suspended: PauseCircle,
  subscription_reactivated: PlayCircle,
  subscription_canceled: Ban,
  invoice_paid: DollarSign,
  invoice_failed: XCircle,
  invoice_refunded: Wallet,
  webhook_received: Radio,
  admin_action: Activity,
}

const SOURCE_COLOR: Record<string, string> = {
  webhook: 'bg-blue-100 text-blue-700',
  system: 'bg-gray-100 text-gray-600',
  checkout: 'bg-green-100 text-green-700',
  admin: 'bg-orange-100 text-orange-700',
}
const SOURCE_LABEL: Record<string, string> = {
  webhook: 'Webhook', system: 'Sistema', checkout: 'Checkout', admin: 'Admin',
}

function AdminWebhooks() {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [viewingPayload, setViewingPayload] = useState<unknown>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    const { data: events } = await supabase
      .from('subscription_ledger_events')
      .select('id, event_type, source, subscription_id, user_id, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    const rawEvents = (events ?? []) as LedgerRow[]

    const subIds = [...new Set(rawEvents.map((e) => e.subscription_id).filter(Boolean))] as string[]
    const userIds = [...new Set(rawEvents.map((e) => e.user_id).filter(Boolean))] as string[]

    const [subsRes, profilesRes] = await Promise.all([
      subIds.length > 0
        ? supabase.from('subscriptions').select('id, simplispay_subscription_id').in('id', subIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('profiles').select('id, email').in('id', userIds)
        : Promise.resolve({ data: [] }),
    ])

    const subMap = new Map((subsRes.data ?? []).map((s) => [s.id, s.simplispay_subscription_id]))
    const emailMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.email]))

    setRows(rawEvents.map((e) => ({
      ...e,
      email: e.user_id ? emailMap.get(e.user_id) : undefined,
      simplispay_subscription_id: e.subscription_id ? (subMap.get(e.subscription_id) ?? null) : undefined,
    })) as LedgerRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const now = Date.now()
  const last24h = rows.filter((r) => now - new Date(r.created_at).getTime() < 86_400_000)

  const kpis = [
    { label: 'Eventos (24h)', value: last24h.length, color: '' },
    { label: 'Webhooks recebidos', value: rows.filter((r) => r.source === 'webhook').length, color: 'text-blue-600' },
    { label: 'Erros', value: rows.filter((r) => r.event_type.includes('failed')).length, color: 'text-red-600' },
    { label: 'Última atualização', value: rows[0] ? new Date(rows[0].created_at).toLocaleTimeString('pt-BR') : '—', color: '' },
  ]

  const filtered = sourceFilter === 'all' ? rows : rows.filter((r) => r.source === sourceFilter)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Webhooks & Eventos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor de eventos do ledger — atualização automática a cada 30s.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Radio className="h-3.5 w-3.5" /> {k.label}
              </CardDescription>
              <CardTitle className={`text-2xl ${k.color}`}>
                {loading ? '…' : k.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="webhook">Webhooks</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Events table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Eventos</CardTitle>
          <CardDescription>
            {loading ? 'Carregando…' : `${filtered.length} evento(s) — últimos 200 registros`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Timestamp</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Subscription ID</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ev) => {
                  const Icon = EVENT_ICON[ev.event_type] ?? Activity
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_COLOR[ev.source] ?? 'bg-muted text-muted-foreground'}`}>
                          {SOURCE_LABEL[ev.source] ?? ev.source}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {ev.simplispay_subscription_id
                          ? ev.simplispay_subscription_id.slice(0, 12) + '…'
                          : ev.subscription_id
                          ? ev.subscription_id.slice(0, 8) + '…'
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ev.email ?? (ev.user_id ? ev.user_id.slice(0, 8) + '…' : '—')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setViewingPayload(ev.payload)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payload viewer dialog */}
      <Dialog open={viewingPayload !== null} onOpenChange={() => setViewingPayload(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload do evento</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <pre className="rounded bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(viewingPayload, null, 2)}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
