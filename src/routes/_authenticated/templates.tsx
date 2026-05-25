import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Pencil, Trash2, FileText, ExternalLink } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { OPERATIONS } from '@/lib/operations'
import { maskMoney, maskPercent } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/templates')({
  component: TemplatesPage,
})

// Campos da Calculadora Patrimonial
const FIELD_GROUPS = [
  {
    title: 'Dados Iniciais',
    fields: [
      { key: 'valorImovel', label: 'Valor do Imóvel Alvo (R$)', type: 'money' as const },
      { key: 'entrada', label: 'Entrada Própria Disponível (R$)', type: 'money' as const },
    ],
  },
  {
    title: 'Financiamento Bancário',
    fields: [
      { key: 'prazoF', label: 'Prazo do Financiamento (meses)', type: 'int' as const },
      { key: 'jFinAnual', label: 'Taxa de Juros Anual (%)', type: 'percent' as const },
      { key: 'trAnual', label: 'Estimativa de TR / Ajuste (%)', type: 'percent' as const },
    ],
  },
  {
    title: 'Consórcio',
    fields: [
      { key: 'creditoCons', label: 'Valor de Crédito da Carta (R$)', type: 'money' as const },
      { key: 'percLanceEmb', label: 'Lance Embutido (%)', type: 'int' as const },
      { key: 'lanceProprio', label: 'Lance Recurso Próprio (R$)', type: 'money' as const },
      { key: 'tAdm', label: 'Taxa de Administração (%)', type: 'percent' as const },
      { key: 'prazoC', label: 'Prazo do Plano (meses)', type: 'int' as const },
      { key: 'inccAnual', label: 'INCC / Reajuste (%)', type: 'percent' as const },
      { key: 'percReducao', label: 'Redução Parcela Inicial (%)', type: 'int' as const },
      { key: 'mesContemplacao', label: 'Contemplação (mês)', type: 'int' as const },
    ],
  },
  {
    title: 'Premissas Avançadas',
    fields: [
      { key: 'aluguel', label: 'Custo de Aluguel (R$/mês)', type: 'money' as const },
      { key: 'taxaOportunidadeMensal', label: 'CDI (% ao mês)', type: 'percent' as const },
      { key: 'valorizacaoAnual', label: 'Valorização do Imóvel (% a.a.)', type: 'percent' as const },
      { key: 'percItbi', label: 'ITBI/Cartório (%)', type: 'percent' as const },
    ],
  },
]

type FieldPayload = Record<string, string>
type TogglePayload = {
  baseLance?: 'credito' | 'plano'
  usoCredito?: 'comprar' | 'patrimonio'
  amortTipo?: 'prazo' | 'parcela'
}

type Template = {
  id: string
  operation_slug: string
  name: string
  payload: FieldPayload & TogglePayload
  is_default: boolean
  created_at: string
}

const emptyForm = { name: '', operation_slug: OPERATIONS[0]?.slug ?? '', is_default: false }
const emptyPayload = (): FieldPayload & TogglePayload => ({})

function maskField(v: string, type: 'money' | 'percent' | 'int'): string {
  if (type === 'money') return maskMoney(v)
  if (type === 'percent') return maskPercent(v)
  return v.replace(/\D/g, '')
}

function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [payload, setPayload] = useState<FieldPayload & TogglePayload>(emptyPayload())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('templates').select('*').eq('user_id', user.id).order('operation_slug').order('name')
    setTemplates((data ?? []) as unknown as Template[])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setPayload(emptyPayload())
    setOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditing(t)
    setForm({ name: t.name, operation_slug: t.operation_slug, is_default: t.is_default })
    setPayload({ ...t.payload })
    setOpen(true)
  }

  const setField = (key: string, rawInput: string, type: 'money' | 'percent' | 'int') => {
    const masked = maskField(rawInput, type)
    setPayload((prev) => ({ ...prev, [key]: masked }))
  }

  const save = async () => {
    if (!user || !form.name.trim()) { toast.error('Nome é obrigatório.'); return }
    setSaving(true)
    const cleanPayload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (v !== '' && v !== undefined) cleanPayload[k] = v
    }
    const row = {
      user_id: user.id,
      name: form.name.trim(),
      operation_slug: form.operation_slug,
      is_default: form.is_default,
      payload: cleanPayload,
    }
    const { error } = editing
      ? await supabase.from('templates').update(row).eq('id', editing.id)
      : await supabase.from('templates').insert(row)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success(editing ? 'Template atualizado.' : 'Template criado.'); setOpen(false); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Remover este template?')) return
    setDeleting(id)
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Template removido.'); load() }
    setDeleting(null)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const opName = (slug: string) => OPERATIONS.find((o) => o.slug === slug)?.name ?? slug

  const filledCount = (t: Template) => {
    const p = t.payload as Record<string, string>
    return Object.values(p).filter((v) => v && typeof v === 'string' && v !== '').length
  }

  return (
    <div className="ds-page">
      <header className="ds-page-header">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pré-configure campos da calculadora para reutilizar rapidamente.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-2 h-4 w-4" />Novo template
        </Button>
      </header>

        <Card>
          <CardHeader>
            <CardTitle>Seus templates</CardTitle>
            <CardDescription>
              {loading ? 'Carregando…' : `${templates.length} template(s) cadastrado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 opacity-30" />
                <p>Nenhum template criado ainda.</p>
                <p className="text-xs max-w-sm">
                  Templates permitem salvar combinações de campos da calculadora. Ex: taxas de uma operadora específica.
                </p>
                <Button size="sm" variant="outline" onClick={openNew}>Criar primeiro template</Button>
              </div>
            ) : (
              <>
                {/* ── Mobile: card list ───────────────────────────── */}
                <ul className="divide-y sm:hidden">
                  {templates.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{t.name}</span>
                          {t.is_default && <Badge className="text-[10px] px-1.5 py-0">Padrão</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{opName(t.operation_slug)}</Badge>
                          <span className="text-xs text-muted-foreground">{filledCount(t)} campo(s)</span>
                          <span className="text-xs text-muted-foreground">· {fmtDate(t.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" className="h-9 w-9" title="Aplicar na calculadora" asChild>
                          <Link to="/app" search={{ template: t.id }}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => remove(t.id)} disabled={deleting === t.id}>
                          {deleting === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* ── Desktop: table ───────────────────────────────── */}
                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Campos</TableHead>
                      <TableHead>Padrão</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell><Badge variant="secondary">{opName(t.operation_slug)}</Badge></TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{filledCount(t)} campo(s)</span>
                        </TableCell>
                        <TableCell>
                          {t.is_default ? <Badge>Padrão</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="Aplicar na calculadora" asChild>
                              <Link to="/app" search={{ template: t.id }}><ExternalLink className="h-4 w-4" /></Link>
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(t.id)} disabled={deleting === t.id}>
                              {deleting === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar template' : 'Novo template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Info básica */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Taxa Itaú — Padrão 2025" />
              </div>
              <div className="space-y-1.5">
                <Label>Operação</Label>
                <Select value={form.operation_slug} onValueChange={(v) => setForm({ ...form, operation_slug: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATIONS.map((op) => <SelectItem key={op.slug} value={op.slug}>{op.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} id="is_default" />
                <Label htmlFor="is_default">Template padrão desta operação</Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Preencha apenas os campos que deseja pré-configurar. Campos vazios serão ignorados ao aplicar o template.
            </p>

            {/* Campos por grupo */}
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{group.title}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        value={(payload[f.key] as string) ?? ''}
                        onChange={(e) => setField(f.key, e.target.value, f.type)}
                        placeholder={f.type === 'money' ? '0,00' : f.type === 'percent' ? '0,00' : '0'}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Toggles */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Configurações</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Base do Lance</Label>
                  <Select value={payload.baseLance} onValueChange={(v) => setPayload((p) => ({ ...p, baseLance: v as 'credito' | 'plano' }))}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Não definido" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Sobre Crédito</SelectItem>
                      <SelectItem value="plano">Sobre Plano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Uso do Crédito</Label>
                  <Select value={payload.usoCredito} onValueChange={(v) => setPayload((p) => ({ ...p, usoCredito: v as 'comprar' | 'patrimonio' }))}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Não definido" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprar">Comprar Imóvel</SelectItem>
                      <SelectItem value="patrimonio">Render Patrimônio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amortização</Label>
                  <Select value={payload.amortTipo} onValueChange={(v) => setPayload((p) => ({ ...p, amortTipo: v as 'prazo' | 'parcela' }))}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Não definido" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prazo">Reduzir Prazo</SelectItem>
                      <SelectItem value="parcela">Reduzir Parcela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : 'Salvar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
