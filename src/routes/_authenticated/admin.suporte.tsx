import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/suporte')({
  component: AdminSuporte,
})

type Ticket = {
  id: string
  user_id: string
  subject: string
  body: string
  priority: string
  status: string
  category: string | null
  admin_reply: string | null
  created_at: string
  updated_at: string
  profiles: { email: string } | null
}

const priorityLabel: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }
const statusLabel: Record<string, string> = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado' }
const priorityVariant = (p: string): 'default' | 'secondary' | 'destructive' => {
  if (p === 'urgent') return 'destructive'
  if (p === 'high') return 'destructive'
  return 'secondary'
}
const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' => {
  if (s === 'resolved' || s === 'closed') return 'secondary'
  if (s === 'in_progress') return 'default'
  return 'secondary'
}

function AdminSuporte() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error("Error loading tickets:", error)
        toast.error("Erro ao carregar tickets: " + error.message)
        setTickets([])
        setLoading(false)
        return
      }

      // Fetch profiles for the tickets
      const userIds = [...new Set((data || []).map((t) => t.user_id))]
      
      let profilesMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
          
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.id] = p.email
            return acc
          }, {} as Record<string, string>)
        }
      }

      const ticketsWithProfiles = (data || []).map((t) => ({
        ...t,
        profiles: profilesMap[t.user_id] ? { email: profilesMap[t.user_id] } : null
      }))

      setTickets(ticketsWithProfiles as unknown as Ticket[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openTicket = (t: Ticket) => {
    setSelected(t)
    setReply(t.admin_reply ?? '')
    setNewStatus(t.status)
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    const update: Record<string, unknown> = { admin_reply: reply || null, status: newStatus }
    if (newStatus === 'resolved' && selected.status !== 'resolved') {
      update.resolved_at = new Date().toISOString()
    }
    const { error } = await supabase.from('support_tickets').update(update).eq('id', selected.id)
    if (error) {
      toast.error('Erro ao salvar: ' + error.message)
    } else {
      toast.success('Ticket atualizado.')
      setSelected(null)
      load()
    }
    setSaving(false)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  const byStatus = (s: string) => tickets.filter((t) => t.status === s).length

  return (
    <div className="min-h-[100svh] bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Suporte</h1>
          <p className="mt-1 text-muted-foreground">Fila de tickets e atendimento.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Abertos', value: byStatus('open') },
            { label: 'Em andamento', value: byStatus('in_progress') },
            { label: 'Resolvidos', value: byStatus('resolved') },
            { label: 'Fechados', value: byStatus('closed') },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  {kpi.label}
                </CardDescription>
                <CardTitle className="text-2xl">{loading ? '…' : kpi.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
            <CardDescription>
              {loading ? 'Carregando…' : `${tickets.length} ticket(s) no total`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhum ticket registrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.subject}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.profiles?.email ?? t.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(t.priority)}>
                          {priorityLabel[t.priority] ?? t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(t.status)}>
                          {statusLabel[t.status] ?? t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(t.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openTicket(t)}>
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {selected.profiles?.email} · {fmtDate(selected.created_at)}
                </p>
                <p>{selected.body}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Resposta interna</label>
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Digite a resposta para o usuário…"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
