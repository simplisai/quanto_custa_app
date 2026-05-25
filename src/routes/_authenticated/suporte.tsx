import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, MessageSquare } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/suporte')({
  component: SuportePage,
})

type Ticket = {
  id: string
  subject: string
  body: string
  priority: string
  status: string
  category: string | null
  admin_reply: string | null
  created_at: string
}

const emptyForm = { subject: '', body: '', priority: 'normal', category: '' }

const priorityLabel: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
const statusLabel: Record<string, string> = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado' }
const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' => {
  if (s === 'resolved' || s === 'closed') return 'secondary'
  if (s === 'in_progress') return 'default'
  return 'secondary'
}

function SuportePage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Ticket | null>(null)

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, body, priority, status, category, admin_reply, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTickets(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const submit = async () => {
    if (!user || !form.subject.trim() || !form.body.trim()) {
      toast.error('Assunto e mensagem são obrigatórios.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: form.subject.trim(),
      body: form.body.trim(),
      priority: form.priority,
      category: form.category.trim() || null,
    })
    if (error) {
      toast.error('Erro: ' + error.message)
    } else {
      toast.success('Ticket enviado com sucesso.')
      setOpen(false)
      setForm(emptyForm)
      load()
    }
    setSaving(false)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="ds-page">
      <header className="ds-page-header">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Suporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra tickets e acompanhe as respostas da equipe.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />Novo ticket
        </Button>
      </header>

        <Card>
          <CardHeader>
            <CardTitle>Meus tickets</CardTitle>
            <CardDescription>
              {loading ? 'Carregando…' : `${tickets.length} ticket(s) encontrado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-30" />
                <p>Nenhum ticket enviado ainda.</p>
                <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                  Abrir primeiro ticket
                </Button>
              </div>
            ) : (
              <>
                {/* ── Mobile: card list ───────────────────────────── */}
                <ul className="divide-y sm:hidden">
                  {tickets.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer active:bg-accent/50"
                      onClick={() => setSelected(t)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.subject}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {priorityLabel[t.priority] ?? t.priority}
                          </Badge>
                          <Badge variant={statusVariant(t.status)} className="text-[10px] px-1.5 py-0">
                            {statusLabel[t.status] ?? t.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="shrink-0 text-xs">Ver</Button>
                    </li>
                  ))}
                </ul>

                {/* ── Desktop: table ───────────────────────────────── */}
                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                        <TableCell className="font-medium">{t.subject}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{priorityLabel[t.priority] ?? t.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(t.status)}>
                            {statusLabel[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost">Ver</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

      {/* Novo ticket */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir ticket de suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assunto *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Descreva o problema brevemente" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Calculadora" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem *</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Descreva o problema com detalhes…"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</> : 'Enviar ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver ticket */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="secondary">{priorityLabel[selected.priority]}</Badge>
                <Badge variant={statusVariant(selected.status)}>{statusLabel[selected.status]}</Badge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Sua mensagem</p>
                <p>{selected.body}</p>
              </div>
              {selected.admin_reply ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="mb-1 text-xs font-semibold text-primary">Resposta da equipe</p>
                  <p>{selected.admin_reply}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aguardando resposta da equipe de suporte.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
