import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search, ShieldCheck, ShieldOff, Settings } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/usuarios')({
  component: AdminUsuarios,
})

type Plan = { id: string; name: string; amount_cents: number | null; billing_cycle: string | null }

type UserRow = {
  id: string
  email: string
  full_name: string | null
  created_at: string
  isAdmin: boolean
  plan_id: string | null
  plan_name: string | null
  sub_status: string | null
  billing_cycle: string | null
  trial_ends_at: string | null
  amount_cents: number | null
  sim_count: number
  last_sim_at: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', canceled: 'Cancelado', past_due: 'Inadimplente',
  trialing: 'Trial', suspended: 'Suspenso', expired: 'Expirado',
  'sem assinatura': 'Sem plano',
}
const STATUS_VARIANT = (s: string | null): 'default' | 'secondary' | 'destructive' => {
  if (s === 'active') return 'default'
  if (s === 'canceled') return 'destructive'
  return 'secondary'
}

const daysLeft = (iso: string | null) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—'

function AdminUsuarios() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editCycle, setEditCycle] = useState('monthly')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [profilesRes, rolesRes, subsRes, simsRes, plansRes] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
      supabase.from('subscriptions').select('user_id, status, plan_id, billing_cycle, trial_ends_at, amount_cents, plans(id, name)'),
      supabase.from('simulations').select('user_id, created_at').order('created_at', { ascending: false }),
      supabase.from('plans').select('id, name, amount_cents, billing_cycle').eq('is_active', true),
    ])

    const profiles = profilesRes.data ?? []
    const adminIds = new Set((rolesRes.data ?? []).map((r) => r.user_id))

    interface SubData { user_id: string; status: string; plan_id: string; billing_cycle: string | null; trial_ends_at: string | null; amount_cents: number | null; plans: { id: string; name: string } | null }
    const subsMap = new Map<string, SubData>((subsRes.data ?? []).map((s) => [s.user_id, s as unknown as SubData]))

    // Build sim count and last sim date per user
    const simCountMap = new Map<string, number>()
    const lastSimMap = new Map<string, string>()
    for (const s of (simsRes.data ?? [])) {
      simCountMap.set(s.user_id, (simCountMap.get(s.user_id) ?? 0) + 1)
      if (!lastSimMap.has(s.user_id)) lastSimMap.set(s.user_id, s.created_at)
    }

    const rows: UserRow[] = profiles.map((p) => {
      const sub = subsMap.get(p.id)
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        isAdmin: adminIds.has(p.id),
        plan_id: sub?.plan_id ?? null,
        plan_name: sub?.plans?.name ?? null,
        sub_status: sub?.status ?? null,
        billing_cycle: sub?.billing_cycle ?? null,
        trial_ends_at: sub?.trial_ends_at ?? null,
        amount_cents: sub?.amount_cents ?? null,
        sim_count: simCountMap.get(p.id) ?? 0,
        last_sim_at: lastSimMap.get(p.id) ?? null,
      }
    })
    setUsers(rows)
    setPlans((plansRes.data ?? []) as Plan[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (u: UserRow) => {
    setEditing(u)
    setEditPlan(u.plan_id ?? '')
    setEditStatus(u.sub_status ?? 'active')
    setEditCycle(u.billing_cycle ?? 'monthly')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      if (editPlan && editStatus) {
        const { error } = await supabase.rpc('admin_update_subscription', {
          _user_id: editing.id,
          _plan_id: editPlan || null,
          _status: editStatus || null,
          _billing_cycle: editCycle || null,
        })
        if (error) throw error
      }
      toast.success('Assinatura atualizada.')
      setEditing(null)
      load()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
    setSaving(false)
  }

  const toggleAdmin = async (u: UserRow) => {
    if (u.id === me?.id && u.isAdmin) {
      toast.error('Você não pode remover sua própria permissão de admin.')
      return
    }
    const { error } = await supabase.rpc('admin_set_user_role', {
      _user_id: u.id,
      _role: 'admin',
      _grant: !u.isAdmin,
    })
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success(u.isAdmin ? 'Permissão de admin removida.' : 'Usuário promovido a admin.')
      load()
    }
  }

  const filtered = users.filter(
    (u) => !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Gestão de usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? 'Carregando…' : `${users.length} usuário(s) cadastrado(s)`}
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Trial restante</TableHead>
                  <TableHead>Simulações</TableHead>
                  <TableHead>Última sim.</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const days = daysLeft(u.trial_ends_at)
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{u.plan_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT(u.sub_status)}>
                          {STATUS_LABEL[u.sub_status ?? 'sem assinatura'] ?? u.sub_status ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.billing_cycle === 'monthly' ? 'Mensal' : u.billing_cycle === 'annual' ? 'Anual' : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.sub_status === 'trialing' && days !== null
                          ? <span className={days <= 3 ? 'font-semibold text-yellow-600' : 'text-muted-foreground'}>
                              {days}d
                            </span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-sm">{u.sim_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(u.last_sim_at)}</TableCell>
                      <TableCell>
                        {u.isAdmin
                          ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
                          : <span className="text-xs text-muted-foreground">Usuário</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(u.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" title="Editar assinatura" onClick={() => openEdit(u)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={u.isAdmin ? 'Remover admin' : 'Tornar admin'}
                            onClick={() => toggleAdmin(u)}
                          >
                            {u.isAdmin
                              ? <ShieldOff className="h-4 w-4 text-destructive" />
                              : <ShieldCheck className="h-4 w-4 text-primary" />
                            }
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
                  <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
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
    </div>
  )
}
