import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, CreditCard, Copy, BookOpen, Activity } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/assinaturas')({
  component: AdminAssinaturas,
})

type SubRow = {
  id: string
  user_id: string
  email: string
  full_name: string | null
  plan_id: string
  plan_name: string
  status: string
  billing_cycle: string
  amount_cents: number
  trial_ends_at: string | null
  current_period_end: string | null
  canceled_at: string | null
  started_at: string
  simplispay_subscription_id: string | null
}

type LedgerEvent = {
  id: string
  event_type: string
  source: string
  payload: unknown
  created_at: string
}

type Plan = { id: string; name: string; amount_cents: number | null; billing_cycle: string | null }

type StatusFilter = 'all' | 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled'

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Trial', active: 'Ativo', past_due: 'Inadimplente',
  suspended: 'Suspenso', canceled: 'Cancelado', expired: 'Expirado',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-gray-100 text-gray-600',
  canceled: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
}

const EVENT_LABEL: Record<string, string> = {
  checkout_initiated: 'Checkout iniciado', checkout_failed: 'Checkout falhou',
  trial_started: 'Trial iniciado', trial_ended: 'Trial encerrado',
  subscription_activated: 'Ativada', subscription_updated: 'Atualizada',
  subscription_past_due: 'Inadimplente', subscription_suspended: 'Suspensa',
  subscription_reactivated: 'Reativada', subscription_canceled: 'Cancelada',
  invoice_paid: 'Fatura paga', invoice_failed: 'Fatura falhou',
  invoice_refunded: 'Estorno', webhook_received: 'Webhook', admin_action: 'Ação admin',
}

const SOURCE_COLOR: Record<string, string> = {
  webhook: 'bg-blue-100 text-blue-700', system: 'bg-gray-100 text-gray-600',
  checkout: 'bg-green-100 text-green-700', admin: 'bg-orange-100 text-orange-700',
}

const fmtCents = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—'

const daysLeft = (iso: string | null) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[status] ?? 'bg-muted text-muted-foreground'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function AdminAssinaturas() {
  const [subs, setSubs] = useState<SubRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<SubRow | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editCycle, setEditCycle] = useState('')
  const [saving, setSaving] = useState(false)
  const [ledgerSub, setLedgerSub] = useState<SubRow | null>(null)
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const load = async () => {
    const [subsRes, plansRes] = await Promise.all([
      supabase.from('admin_subscription_overview').select('*').order('started_at', { ascending: false }),
      supabase.from('plans').select('id, name, amount_cents, billing_cycle').eq('is_active', true),
    ])
    setSubs((subsRes.data ?? []) as unknown as SubRow[])
    setPlans((plansRes.data ?? []) as Plan[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (s: SubRow) => {
    setEditing(s)
    setEditPlan(s.plan_id)
    setEditStatus(s.status)
    setEditCycle(s.billing_cycle)
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    const { error } = await supabase.rpc('admin_update_subscription', {
      _user_id: editing.user_id,
      _plan_id: editPlan || null,
      _status: editStatus || null,
      _billing_cycle: editCycle || null,
    })
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success('Assinatura atualizada.')
      setEditing(null)
      load()
    }
    setSaving(false)
  }

  const openLedger = async (s: SubRow) => {
    setLedgerSub(s)
    setLedgerLoading(true)
    const { data } = await supabase
      .from('subscription_ledger_events')
      .select('id, event_type, source, payload, created_at')
      .eq('subscription_id', s.id)
      .order('created_at', { ascending: false })
    setLedgerEvents((data ?? []) as LedgerEvent[])
    setLedgerLoading(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copiado!'))
  }

  const byStatus = (s: string) => subs.filter((r) => r.status === s).length

  const filtered = subs.filter((s) => {
    const matchSearch = !search ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const kpis = [
    { label: 'Trial', value: byStatus('trialing'), color: 'text-blue-600' },
    { label: 'Ativo', value: byStatus('active'), color: 'text-green-600' },
    { label: 'Inadimplente', value: byStatus('past_due'), color: 'text-yellow-600' },
    { label: 'Suspenso', value: byStatus('suspended'), color: 'text-gray-500' },
    { label: 'Cancelado', value: byStatus('canceled') + byStatus('expired'), color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Assinaturas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? 'Carregando…' : `${subs.length} assinatura(s) no total`}
        </p>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <CreditCard className="h-3.5 w-3.5" /> {k.label}
              </CardDescription>
              <CardTitle className={`text-2xl ${k.color}`}>
                {loading ? '…' : k.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="trialing">Trial</TabsTrigger>
            <TabsTrigger value="past_due">Inadimplentes</TabsTrigger>
            <TabsTrigger value="suspended">Suspensos</TabsTrigger>
            <TabsTrigger value="canceled">Cancelados</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma assinatura encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Trial / Próx. cobrança</TableHead>
                  <TableHead>ID Gateway</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const days = daysLeft(s.trial_ends_at)
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.full_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{s.plan_name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {s.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{fmtCents(s.amount_cents)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.status === 'trialing' && days !== null
                          ? <span className={days <= 3 ? 'font-semibold text-yellow-600' : ''}>
                              {days} {days === 1 ? 'dia' : 'dias'} restantes
                            </span>
                          : s.status === 'active' && s.current_period_end
                          ? fmtDate(s.current_period_end)
                          : s.status === 'canceled' && s.canceled_at
                          ? `Canc. ${fmtDate(s.canceled_at)}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {s.simplispay_subscription_id ? (
                          <button
                            onClick={() => copyToClipboard(s.simplispay_subscription_id!)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title={s.simplispay_subscription_id}
                          >
                            {s.simplispay_subscription_id.slice(0, 10)}…
                            <Copy className="h-3 w-3" />
                          </button>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Editar</Button>
                          <Button size="sm" variant="ghost" onClick={() => openLedger(s)} title="Ver ledger">
                            <BookOpen className="h-4 w-4" />
                          </Button>
                        </div>
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

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar assinatura</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editing.email}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Plano</label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trialing">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="past_due">Inadimplente</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="canceled">Cancelado</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ciclo de cobrança</label>
                <Select value={editCycle} onValueChange={setEditCycle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger dialog */}
      <Dialog open={!!ledgerSub} onOpenChange={() => setLedgerSub(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Ledger — {ledgerSub?.email}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            {ledgerLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : ledgerEvents.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_COLOR[ev.source] ?? 'bg-muted text-muted-foreground'}`}>
                          {ev.source}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
