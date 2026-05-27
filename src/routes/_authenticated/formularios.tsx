import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Copy, ExternalLink, ToggleLeft, ToggleRight, Trash2, Edit3, ClipboardList, FileText } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/formularios')({
  component: FormulariosPage,
})

interface FormTemplate {
  id: string
  title: string
  description: string | null
  slug: string
  is_active: boolean
  submission_count: number
  created_at: string
}

const APP_URL = 'https://quantocusta.pro'

function FormulariosPage() {
  const { user } = useAuth()
  const [forms, setForms] = useState<FormTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user) return
    loadForms()
  }, [user])

  async function loadForms() {
    setLoading(true)
    const { data } = await supabase
      .from('form_templates')
      .select('id, title, description, slug, is_active, submission_count, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    setForms((data as FormTemplate[]) ?? [])
    setLoading(false)
  }

  async function createForm() {
    if (!user) return
    setCreating(true)
    try {
      // Generate slug via RPC
      const { data: slug } = await supabase.rpc('generate_form_slug', {
        p_title: 'Novo Formulário',
        p_user_id: user.id,
      })

      const { data, error } = await supabase
        .from('form_templates')
        .insert({
          user_id: user.id,
          title: 'Novo Formulário',
          slug: slug as string,
          fields: [
            { key: 'nome', label: 'Qual é o seu nome completo?', category: 'contato', type: 'text', required: true, fixed: true },
            { key: 'email', label: 'Qual é o seu e-mail?', category: 'contato', type: 'email', required: true, fixed: true, hint: 'Usaremos para entrar em contato' },
            { key: 'whatsapp', label: 'Qual é o seu WhatsApp?', category: 'contato', type: 'phone', required: true, fixed: true, hint: 'Com DDD, ex: (11) 99999-9999' },
          ],
        })
        .select('id')
        .single()

      if (error) throw error
      // Navigate to editor
      window.location.href = `/formularios/${data.id}`
    } catch {
      toast.error('Erro ao criar formulário')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(form: FormTemplate) {
    const { error } = await supabase
      .from('form_templates')
      .update({ is_active: !form.is_active })
      .eq('id', form.id)
    if (error) {
      toast.error('Erro ao atualizar formulário')
    } else {
      toast.success(form.is_active ? 'Formulário desativado' : 'Formulário ativado')
      setForms((prev) => prev.map((f) => f.id === form.id ? { ...f, is_active: !form.is_active } : f))
    }
  }

  async function deleteForm(id: string) {
    if (!confirm('Tem certeza? As respostas também serão excluídas.')) return
    const { error } = await supabase.from('form_templates').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao excluir formulário')
    } else {
      toast.success('Formulário excluído')
      setForms((prev) => prev.filter((f) => f.id !== id))
    }
  }

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(`${APP_URL}/f/${slug}`)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <div className="ds-page">
      {/* Header */}
      <header className="rounded-2xl border bg-card p-5 md:p-6">
        <Badge variant="secondary" className="mb-3 text-xs">Captação de leads</Badge>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Meus Formulários</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Crie formulários quiz e envie o link para seus prospects. Quando preencherem, o cliente é cadastrado automaticamente.
        </p>
        <div className="mt-4">
          <Button size="sm" onClick={createForm} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? 'Criando...' : 'Novo formulário'}
          </Button>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && forms.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Nenhum formulário ainda</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Crie seu primeiro formulário para captar dados dos clientes antes da reunião de simulação.
            </p>
          </div>
          <Button size="sm" onClick={createForm} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro formulário
          </Button>
        </div>
      )}

      {/* Forms grid */}
      {!loading && forms.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {forms.map((form) => (
            <Card key={form.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{form.title}</CardTitle>
                    {form.description && (
                      <CardDescription className="text-xs mt-1 truncate">{form.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={form.is_active ? 'default' : 'secondary'} className="shrink-0 text-xs">
                    {form.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {form.submission_count} {form.submission_count === 1 ? 'resposta' : 'respostas'}
                  </span>
                  <span>
                    {new Date(form.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                {/* Link */}
                <div className="mt-2 flex items-center gap-1 rounded-xl bg-muted/50 px-3 py-1.5">
                  <code className="flex-1 text-[10px] font-mono text-muted-foreground truncate">
                    {APP_URL}/f/{form.slug}
                  </code>
                  <button
                    onClick={() => copyLink(form.slug)}
                    className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                    title="Copiar link"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <a
                    href={`${APP_URL}/f/${form.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                    title="Abrir link"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </div>
              </CardHeader>

              <CardContent className="mt-auto pt-0">
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to="/formularios/$id" params={{ id: form.id }}>
                      <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Link>
                  </Button>
                  <button
                    onClick={() => toggleActive(form)}
                    title={form.is_active ? 'Desativar' : 'Ativar'}
                    className="rounded-lg border border-border p-2 hover:bg-accent transition-colors"
                  >
                    {form.is_active
                      ? <ToggleRight className="h-4 w-4 text-primary" />
                      : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    }
                  </button>
                  <button
                    onClick={() => deleteForm(form.id)}
                    title="Excluir"
                    className="rounded-lg border border-border p-2 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
