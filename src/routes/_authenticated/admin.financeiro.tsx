import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Loader2, TrendingUp, Receipt, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/admin/financeiro')({
  component: AdminFinanceiro,
})

type AdminMetricsSlice = {
  mrr_cents: number
  arr_cents: number
  total_revenue_cents: number
}

type Invoice = {
  id: string
  user_id: string
  subscription_id: string
  status: string
  amount_cents: number
  currency: string
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  simplispay_invoice_id: string | null
  created_at: string
  email?: string
}

type Transaction = {
  id: string
  user_id: string
  type: string
  status: string
  amount: number
  currency: string
  description: string | null
  created_at: string
  profiles: { email: string } | null
}

const fmtCents = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—'

const INVOICE_STATUS_COLOR: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}
const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', overdue: 'Vencido', refunded: 'Estornado',
}

function AdminFinanceiro() {
  const [mrrData, setMrrData] = useState<AdminMetricsSlice | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [metricsRes, invoicesRes, txRes] = await Promise.all([
        supabase.from('admin_metrics').select('mrr_cents, arr_cents, total_revenue_cents').single(),
        supabase
          .from('billing_invoices')
          .select('id, user_id, subscription_id, status, amount_cents, currency, period_start, period_end, paid_at, simplispay_invoice_id, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('financial_transactions')
          .select('*, profiles(email)')
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (metricsRes.data) setMrrData(metricsRes.data as unknown as AdminMetricsSlice)

      const rawInvoices = (invoicesRes.data ?? []) as Invoice[]
      const userIds = [...new Set(rawInvoices.map((i) => i.user_id).filter(Boolean))]
      let emailMap = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
        emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]))
      }
      setInvoices(rawInvoices.map((inv) => ({ ...inv, email: emailMap.get(inv.user_id) })))
      setTransactions((txRes.data ?? []) as unknown as Transaction[])
      setLoading(false)
    }
    load()
  }, [])

  const invoiceTotals = {
    paid: invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount_cents, 0),
    pending: invoices.filter((i) => i.status === 'pending').reduce((sum, i) => sum + i.amount_cents, 0),
    failed: invoices.filter((i) => ['failed', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.amount_cents, 0),
  }

  const txTotals = {
    approved: transactions.filter((t) => t.status === 'approved').reduce((sum, t) => sum + t.amount, 0),
    pending: transactions.filter((t) => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
    failed: transactions.filter((t) => t.status === 'failed').reduce((sum, t) => sum + t.amount, 0),
  }

  const txTypeLabel: Record<string, string> = {
    payment: 'Pagamento', refund: 'Estorno', chargeback: 'Chargeback', credit: 'Crédito',
  }
  const txStatusLabel: Record<string, string> = {
    approved: 'Aprovado', pending: 'Pendente', failed: 'Falha', refunded: 'Estornado',
  }
  const txStatusVariant = (s: string): 'default' | 'secondary' | 'destructive' => {
    if (s === 'approved') return 'default'
    if (s === 'failed') return 'destructive'
    return 'secondary'
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">Receita, faturas e histórico de transações.</p>
      </header>

      {/* MRR / ARR */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[
          { label: 'MRR', value: mrrData ? fmtCents(mrrData.mrr_cents) : '…', icon: TrendingUp, color: 'text-green-600', sub: 'Receita mensal recorrente' },
          { label: 'ARR', value: mrrData ? fmtCents(mrrData.arr_cents) : '…', icon: ArrowUpRight, color: 'text-green-600', sub: 'Projeção anual' },
          { label: 'Receita total', value: mrrData ? fmtCents(mrrData.total_revenue_cents) : '…', icon: Receipt, color: '', sub: 'Faturas pagas' },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Icon className="h-3.5 w-3.5" /> {kpi.label}
                </CardDescription>
                <CardTitle className={`text-2xl ${kpi.color}`}>{kpi.value}</CardTitle>
                <p className="text-[11px] text-muted-foreground">{kpi.sub}</p>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      {/* Billing Invoices */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Faturas (billing_invoices)</h2>
            <p className="text-xs text-muted-foreground">Cobranças processadas pelo gateway SimplisPay</p>
          </div>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Pago', value: invoiceTotals.paid, color: 'text-green-600' },
            { label: 'Pendente', value: invoiceTotals.pending, color: 'text-yellow-600' },
            { label: 'Falha / Vencido', value: invoiceTotals.failed, color: 'text-red-600' },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{k.label}</CardDescription>
                <CardTitle className={`text-xl ${k.color}`}>
                  {loading ? '…' : fmtCents(k.value)}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de faturas</CardTitle>
            <CardDescription>
              {loading ? 'Carregando…' : `${invoices.length} registro(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma fatura registrada. As faturas são criadas automaticamente pelo gateway de pagamento.
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>ID Gateway</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.email ?? inv.user_id.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="font-medium">{fmtCents(inv.amount_cents)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.period_start ? `${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}` : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_COLOR[inv.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.paid_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.simplispay_invoice_id ? inv.simplispay_invoice_id.slice(0, 12) + '…' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Legacy Transactions */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-muted-foreground">Registros legados (financial_transactions)</h2>
          <p className="text-xs text-muted-foreground">Transações manuais e entradas anteriores ao sistema de faturas</p>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Aprovado', value: txTotals.approved, color: 'text-green-600' },
            { label: 'Pendente', value: txTotals.pending, color: 'text-yellow-600' },
            { label: 'Falha', value: txTotals.failed, color: 'text-red-600' },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{k.label}</CardDescription>
                <CardTitle className={`text-xl ${k.color}`}>
                  {loading ? '…' : fmtBRL(k.value)}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma transação registrada.</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.profiles?.email ?? tx.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{txTypeLabel[tx.type] ?? tx.type}</TableCell>
                      <TableCell>
                        <Badge variant={txStatusVariant(tx.status)}>
                          {txStatusLabel[tx.status] ?? tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{fmtBRL(tx.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.description ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(tx.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
