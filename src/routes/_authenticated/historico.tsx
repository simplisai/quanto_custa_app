import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calculator, RotateCcw, Loader2, Search, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { fmtBRL } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/historico')({
  component: HistoricoPage,
})

type Simulation = {
  id: string
  title: string | null
  created_at: string
  results: Record<string, unknown>
  clients: { name: string } | null
}

function HistoricoPage() {
  const { user } = useAuth()
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = () => {
    if (!user) return
    supabase
      .from('simulations')
      .select('id, title, created_at, results, clients(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setSimulations((data ?? []) as unknown as Simulation[])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [user])

  const remove = async (id: string) => {
    if (!confirm('Remover esta simulação do histórico?')) return
    setDeleting(id)
    const { error } = await supabase.from('simulations').delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Simulação removida.'); load() }
    setDeleting(null)
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  const resultSummary = (results: Record<string, unknown>) => {
    const parts: string[] = []
    if (results.tCons) parts.push(`Cons. ${fmtBRL(results.tCons as number)}`)
    if (results.tSAC) parts.push(`SAC ${fmtBRL(results.tSAC as number)}`)
    return parts.join(' · ') || '—'
  }

  const filtered = simulations.filter((s) =>
    !search ||
    (s.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.clients?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="ds-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="ds-page-header">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Histórico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? 'Carregando…' : `${simulations.length} simulação(ões) salva(s)`}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/app"><Calculator className="mr-2 h-4 w-4" />Nova simulação</Link>
        </Button>
      </header>

      <Card>
        {/* Search */}
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou cliente…"
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
            <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
              <Calculator className="h-10 w-10 opacity-30" />
              <p>{search ? 'Nenhuma simulação encontrada.' : 'Nenhuma simulação salva ainda.'}</p>
              {!search && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/app">Fazer primeira simulação</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile: card list ────────────────────────────── */}
              <ul className="divide-y sm:hidden">
                {filtered.map((sim) => (
                  <li key={sim.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-snug">
                        {sim.title ?? 'Sem título'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{fmtDate(sim.created_at)}</span>
                        {sim.clients?.name && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {sim.clients.name}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {resultSummary(sim.results)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button asChild size="icon" variant="ghost" className="h-9 w-9" title="Reabrir na calculadora">
                        <Link to="/app" search={{ load: sim.id }}>
                          <RotateCcw className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        title="Remover"
                        onClick={() => remove(sim.id)}
                        disabled={deleting === sim.id}
                      >
                        {deleting === sim.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4 text-destructive" />
                        }
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ── Desktop: table ───────────────────────────────── */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Resumo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sim) => (
                    <TableRow key={sim.id}>
                      <TableCell className="font-medium">{sim.title ?? 'Sem título'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sim.clients?.name
                          ? <Badge variant="secondary">{sim.clients.name}</Badge>
                          : <span className="text-xs">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{resultSummary(sim.results)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(sim.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button asChild size="icon" variant="ghost" title="Reabrir na calculadora">
                            <Link to="/app" search={{ load: sim.id }}>
                              <RotateCcw className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Remover"
                            onClick={() => remove(sim.id)}
                            disabled={deleting === sim.id}
                          >
                            {deleting === sim.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4 text-destructive" />
                            }
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
    </div>
  )
}
