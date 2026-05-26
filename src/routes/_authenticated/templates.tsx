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
import { Loader2, Plus, Pencil, Trash2, FileText, ExternalLink, Sparkles } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { OPERATIONS } from '@/lib/operations'
import { maskMoney, maskPercent } from '@/lib/format'
import { toast } from 'sonner'
import { SIMULATOR_FIELD_GROUPS, SEED_TEMPLATES, type FieldType } from '@/lib/template-fields'

export const Route = createFileRoute('/_authenticated/templates')({
  component: TemplatesPage,
})

type FieldPayload = Record<string, string>

type Template = {
  id: string
  operation_slug: string
  name: string
  payload: FieldPayload
  is_default: boolean
  created_at: string
}

const emptyForm = { name: '', operation_slug: OPERATIONS[0]?.slug ?? '', is_default: false }
const emptyPayload = (): FieldPayload => ({})

function maskField(v: string, type: FieldType): string {
  if (type === 'money') return maskMoney(v)
  if (type === 'percent') return maskPercent(v)
  return v.replace(/\D/g, '')
}

// ─── Templates Page ───────────────────────────────────────────────────────────
function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [payload, setPayload] = useState<FieldPayload>(emptyPayload())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

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

  const setField = (key: string, rawInput: string, type: FieldType) => {
    const masked = maskField(rawInput, type)
    setPayload((prev) => ({ ...prev, [key]: masked }))
  }

  // Reset payload when operation changes
  const handleOperationChange = (slug: string) => {
    setForm((f) => ({ ...f, operation_slug: slug }))
    setPayload(emptyPayload())
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

  const seedTemplates = async () => {
    if (!user) return
    if (!confirm(`Criar ${SEED_TEMPLATES.length} templates de exemplo para todos os simuladores?`)) return
    setSeeding(true)
    const rows = SEED_TEMPLATES.map((t) => ({ ...t, user_id: user.id }))
    const { error } = await supabase.from('templates').insert(rows)
    if (error) toast.error('Erro ao criar exemplos: ' + error.message)
    else { toast.success(`${SEED_TEMPLATES.length} templates de exemplo criados!`); load() }
    setSeeding(false)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const opName = (slug: string) => OPERATIONS.find((o) => o.slug === slug)?.name ?? slug
  const opRoute = (slug: string) => OPERATIONS.find((o) => o.slug === slug)?.route ?? '/simuladores'
  const opIcon = (slug: string) => OPERATIONS.find((o) => o.slug === slug)?.icon ?? '📋'

  const filledCount = (t: Template) =>
    Object.values(t.payload as Record<string, string>).filter((v) => v && v !== '').length

  // Field groups for current operation in form
  const currentFieldGroups = SIMULATOR_FIELD_GROUPS[form.operation_slug] ?? []

  // Group templates by operation
  const templatesByOp = OPERATIONS.filter((op) => op.isActive).map((op) => ({
    op,
    list: templates.filter((t) => t.operation_slug === op.slug),
  })).filter(({ list }) => list.length > 0)

  return (
    <div className="ds-page space-y-6 pb-20">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg">
            Pré-configure campos de qualquer simulador para reutilizar em reuniões. Aplique com 1 clique diretamente do simulador.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {templates.length === 0 && (
            <Button onClick={seedTemplates} disabled={seeding} variant="outline" size="sm">
              {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Criar exemplos
            </Button>
          )}
          <Button onClick={openNew} size="sm">
            <Plus className="mr-2 h-4 w-4" />Novo template
          </Button>
        </div>
      </header>

      {/* ── Seed CTA when empty ─────────────────────────────────────── */}
      {!loading && templates.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">Nenhum template criado ainda</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Templates pre-configuram campos de simuladores para reutilizar em reuniões com clientes.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={seedTemplates} disabled={seeding}>
                {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Criar {SEED_TEMPLATES.length} templates de exemplo
              </Button>
              <Button variant="outline" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />Criar manualmente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Templates por operação ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templatesByOp.length > 0 && (
        <div className="space-y-6">
          {templatesByOp.map(({ op, list }) => (
            <Card key={op.slug}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{op.icon}</span>
                  {op.name}
                  <Badge variant="secondary" className="ml-auto">{list.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile */}
                <ul className="divide-y sm:hidden">
                  {list.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{t.name}</span>
                          {t.is_default && <Badge className="text-[10px] px-1.5 py-0">Padrão</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{filledCount(t)} campo(s) · {fmtDate(t.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" className="h-9 w-9" title="Abrir simulador com template" asChild>
                          <Link to={opRoute(t.operation_slug) as never} search={{ template: t.id } as never}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
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

                {/* Desktop */}
                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Campos</TableHead>
                      <TableHead>Padrão</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{filledCount(t)} campo(s)</span>
                        </TableCell>
                        <TableCell>
                          {t.is_default ? <Badge>Padrão</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="Abrir simulador com template" asChild>
                              <Link to={opRoute(t.operation_slug) as never} search={{ template: t.id } as never}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
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
              </CardContent>
            </Card>
          ))}

          {/* Seed button when there are templates */}
          <div className="flex justify-center">
            <Button onClick={seedTemplates} disabled={seeding} variant="outline" size="sm">
              {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Adicionar templates de exemplo
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialog: criar / editar ──────────────────────────────────── */}
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
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Caixa 10% a.a. — Padrão"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Simulador</Label>
                <Select value={form.operation_slug} onValueChange={handleOperationChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATIONS.filter((op) => op.isActive).map((op) => (
                      <SelectItem key={op.slug} value={op.slug}>
                        {op.icon} {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                  id="is_default"
                />
                <Label htmlFor="is_default">Template padrão</Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Preencha apenas os campos que deseja pré-configurar. Campos vazios serão ignorados ao aplicar o template.
            </p>

            {/* Campos dinâmicos por simulador */}
            {currentFieldGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Selecione um simulador para ver os campos disponíveis.
              </p>
            ) : (
              currentFieldGroups.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {group.title}
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.fields.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-xs">
                          {f.label}
                          {f.hint && (
                            <span className="ml-1.5 text-muted-foreground font-normal">
                              ({f.hint})
                            </span>
                          )}
                        </Label>
                        <Input
                          value={(payload[f.key] as string) ?? ''}
                          onChange={(e) => setField(f.key, e.target.value, f.type)}
                          placeholder={
                            f.type === 'money' ? '0,00' :
                            f.type === 'percent' ? '0,00' : '0'
                          }
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</>
                : 'Salvar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
