import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Plus, Search, Pencil, Trash2, Users, ChevronDown, ChevronUp, Calculator, RotateCcw } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { fmtBRL } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/clientes')({
  component: ClientesPage,
})

type Client = {
  id: string
  name: string
  document: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

type Simulation = {
  id: string
  title: string | null
  created_at: string
  results: Record<string, unknown>
}

type FormField = {
  key: string
  label: string
  type: string
  options?: { label: string; value: string }[]
}

type FormSubmission = {
  id: string
  form_id: string
  submitted_at: string
  responses: Record<string, unknown>
  form_templates: { title: string; fields: FormField[] } | null
}

const emptyForm = { name: '', document: '', email: '', phone: '', notes: '' }

function renderResponseValue(value: unknown, field?: FormField): string {
  if (value === null || value === undefined || value === '') return '—';
  // Money fields are stored as centavos string, e.g. "50000000" = R$ 500.000,00
  if (field?.type === 'money' && typeof value === 'string') {
    const num = parseInt(value, 10);
    if (!isNaN(num)) return (num / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  // Enum fields: resolve raw value to human-readable option label
  if (field?.type === 'enum' && field.options) {
    const opt = field.options.find(o => o.value === String(value));
    if (opt) return opt.label;
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function ClientesPage() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [simsByClient, setSimsByClient] = useState<Record<string, Simulation[]>>({})
  const [subsByClient, setSubsByClient] = useState<Record<string, FormSubmission[]>>({})
  const [loadingSims, setLoadingSims] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('name')
    setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const toggleExpand = async (clientId: string) => {
    if (expandedId === clientId) { setExpandedId(null); return }
    setExpandedId(clientId)
    if (simsByClient[clientId] && subsByClient[clientId]) return
    setLoadingSims(clientId)
    
    const [simsRes, subsRes] = await Promise.all([
      supabase
        .from('simulations')
        .select('id, title, created_at, results')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('form_submissions')
        .select('id, form_id, submitted_at, responses, form_templates(title, fields)')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false })
    ])
    
    setSimsByClient((prev) => ({ ...prev, [clientId]: (simsRes.data ?? []) as Simulation[] }))
    setSubsByClient((prev) => ({ ...prev, [clientId]: (subsRes.data ?? []) as FormSubmission[] }))
    setLoadingSims(null)
  }

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, document: c.document ?? '', email: c.email ?? '', phone: c.phone ?? '', notes: c.notes ?? '' })
    setOpen(true)
  }

  const save = async () => {
    if (!user || !form.name.trim()) { toast.error('Nome é obrigatório.'); return }
    setSaving(true)
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      document: form.document.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('clients').update(payload).eq('id', editing.id)
      : await supabase.from('clients').insert(payload)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success(editing ? 'Cliente atualizado.' : 'Cliente criado.'); setOpen(false); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Remover este cliente? As simulações vinculadas serão desvinculadas.')) return
    setDeleting(id)
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Cliente removido.'); load() }
    setDeleting(null)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  const simSummary = (results: Record<string, unknown>) => {
    const parts: string[] = []
    if (results.tCons) parts.push(`Cons. ${fmtBRL(results.tCons as number)}`)
    if (results.tSAC) parts.push(`SAC ${fmtBRL(results.tSAC as number)}`)
    return parts.join(' · ') || '—'
  }

  const filtered = clients.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="ds-page">
      <header className="ds-page-header">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? 'Carregando…' : `${clients.length} cliente(s) cadastrado(s)`}
          </p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
      </header>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou e-mail…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 opacity-30" />
                <p>{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
                {!search && <Button size="sm" variant="outline" onClick={openNew}>Cadastrar primeiro cliente</Button>}
              </div>
            ) : (
              <div>
                {filtered.map((c) => (
                  <div key={c.id} className="border-b last:border-0">
                    {/* Linha do cliente */}
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button
                        className="flex flex-1 items-center gap-3 text-left"
                        onClick={() => toggleExpand(c.id)}
                      >
                        {expandedId === c.id
                          ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        }
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[c.email, c.phone, c.document].filter(Boolean).join(' · ') || 'Sem contato'}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground hidden md:block">{fmtDate(c.created_at)}</span>
                      </button>
                      <div className="flex gap-1">
                        <Button asChild size="icon" variant="ghost" title="Nova simulação para este cliente">
                          <Link to="/app" search={{ client: c.id }}>
                            <Calculator className="h-4 w-4 text-primary" />
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(c.id)} disabled={deleting === c.id}>
                          {deleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                        </Button>
                      </div>
                    </div>

                    {/* Simulações do cliente (expandido) */}
                    {expandedId === c.id && (
                      <div className="border-t bg-muted/20 px-6 py-6 space-y-6">
                        {c.notes && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Observações / Resumo</h4>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{c.notes}</p>
                          </div>
                        )}

                        {/* Formulários Respondidos */}
                        <div>
                          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Formulários Respondidos
                          </h4>
                          {loadingSims === c.id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />Carregando…
                            </div>
                          ) : (subsByClient[c.id] ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum formulário respondido.</p>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {(subsByClient[c.id] ?? []).map((sub) => (
                                <Card key={sub.id} className="bg-card shadow-sm">
                                  <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm font-semibold">{sub.form_templates?.title ?? 'Formulário'}</CardTitle>
                                    <CardDescription className="text-xs">{fmtDateTime(sub.submitted_at)}</CardDescription>
                                  </CardHeader>
                                  <CardContent className="py-3 px-4 border-t text-sm bg-muted/5">
                                    <dl className="space-y-2">
                                      {(sub.form_templates?.fields && sub.form_templates.fields.length > 0
                                        ? sub.form_templates.fields
                                        : Object.keys(sub.responses).map(k => ({ key: k, label: k, type: 'text', options: undefined }))
                                      ).map((field) => (
                                        <div key={field.key} className="flex flex-col">
                                          <dt className="font-medium text-muted-foreground text-xs uppercase tracking-wider">{field.label}</dt>
                                          <dd className="font-semibold">{renderResponseValue(sub.responses[field.key], field)}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Simulações Vinculadas */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              Simulações vinculadas
                            </h4>
                            <Button asChild size="sm" variant="outline">
                              <Link to="/app" search={{ client: c.id }}>
                                <Calculator className="mr-1.5 h-3 w-3" />Nova simulação
                              </Link>
                            </Button>
                          </div>
                          {loadingSims === c.id ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />Carregando…
                            </div>
                          ) : (simsByClient[c.id] ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma simulação vinculada a este cliente.</p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Resumo</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(simsByClient[c.id] ?? []).map((sim) => (
                                    <TableRow key={sim.id}>
                                      <TableCell className="text-sm font-medium">{sim.title ?? 'Sem título'}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{simSummary(sim.results)}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{fmtDateTime(sim.created_at)}</TableCell>
                                      <TableCell>
                                        <Button asChild size="icon" variant="ghost" title="Reabrir na calculadora">
                                          <Link to="/app" search={{ load: sim.id, client: c.id }}>
                                            <RotateCcw className="h-4 w-4 text-primary" />
                                          </Link>
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ</Label>
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
