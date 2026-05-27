import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Save, Copy, ExternalLink } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { FieldCatalog } from '@/components/form-builder/FieldCatalog'
import { FieldList } from '@/components/form-builder/FieldList'
import { QuizPreview } from '@/components/form-builder/QuizPreview'
import { FORM_FIELDS_CATALOG, FIXED_FIELD_KEYS, type FormFieldDef } from '@/lib/form-fields-catalog'

export const Route = createFileRoute('/_authenticated/formularios/$id')({
  component: FormEditorPage,
})

const APP_URL = 'https://quantocusta.pro'

function FormEditorPage() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [fields, setFields] = useState<FormFieldDef[]>([])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    loadForm()
  }, [user, id])

  async function loadForm() {
    setLoading(true)
    const { data, error } = await supabase
      .from('form_templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .maybeSingle()

    if (error || !data) {
      toast.error('Formulário não encontrado')
      navigate({ to: '/formularios' })
      return
    }

    setTitle(data.title)
    setDescription(data.description ?? '')
    setSlug(data.slug)
    setIsActive(data.is_active)
    // Restore FormFieldDef objects from stored JSON
    const stored = (data.fields as unknown as FormFieldDef[]) ?? []
    const restored = stored.map((sf) => {
      const full = FORM_FIELDS_CATALOG.find((f) => f.key === sf.key)
      return full ?? sf
    })
    setFields(restored)
    setLoading(false)
  }

  const selectedKeys = fields.map((f) => f.key)

  const handleToggleField = useCallback((field: FormFieldDef) => {
    setFields((prev) => {
      const isSelected = prev.some((f) => f.key === field.key)
      if (isSelected) {
        return prev.filter((f) => f.key !== field.key)
      } else {
        return [...prev, field]
      }
    })
  }, [])

  const handleRemove = useCallback((key: string) => {
    if (FIXED_FIELD_KEYS.includes(key)) return
    setFields((prev) => prev.filter((f) => f.key !== key))
  }, [])

  const handleMoveUp = useCallback((index: number) => {
    setFields((prev) => {
      if (index === 0) return prev
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }, [])

  const handleMoveDown = useCallback((index: number) => {
    setFields((prev) => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }, [])

  async function save() {
    if (!title.trim()) { toast.error('Título é obrigatório'); return }
    if (fields.length < 1) { toast.error('Adicione pelo menos um campo'); return }

    setSaving(true)
    const { error } = await supabase
      .from('form_templates')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        fields: fields as unknown as import('@/integrations/supabase/types').Json,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar formulário')
    } else {
      toast.success('Formulário salvo!')
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${APP_URL}/f/${slug}`)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  if (loading) {
    return (
      <div className="ds-page">
        <div className="h-10 w-48 rounded-xl bg-muted animate-pulse" />
        <div className="h-80 rounded-2xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="ds-page">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link to="/formularios">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do formulário"
            className="w-full rounded-xl border border-border bg-card px-4 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar link
          </button>
          <a
            href={`/f/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </a>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Description */}
      <div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (opcional) — aparece na tela de boas-vindas do formulário"
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* 3-panel editor */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
        {/* Left: Field catalog */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-extrabold">Catálogo de perguntas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Clique para adicionar/remover</p>
          </div>
          <div className="overflow-y-auto p-3 max-h-[calc(100vh-280px)]">
            <FieldCatalog selectedKeys={selectedKeys} onToggle={handleToggleField} />
          </div>
        </div>

        {/* Center: Selected fields */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold">Perguntas do formulário</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fields.length} {fields.length === 1 ? 'pergunta' : 'perguntas'} selecionadas
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Ativo
            </label>
          </div>
          <div className="overflow-y-auto p-3 max-h-[calc(100vh-280px)]">
            <FieldList
              fields={fields}
              onRemove={handleRemove}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          </div>
        </div>

        {/* Right: Quiz preview */}
        <div className="rounded-2xl overflow-hidden" style={{ minHeight: 500 }}>
          <QuizPreview fields={fields} title={title} description={description} />
        </div>
      </div>
    </div>
  )
}
