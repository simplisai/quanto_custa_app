import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { QuizShell } from '@/components/quiz/QuizShell'
import { QuizStep } from '@/components/quiz/QuizStep'
import { QuizComplete } from '@/components/quiz/QuizComplete'
import { QuizBrandHeader } from '@/components/quiz/QuizBrandHeader'
import { useBrandSettings } from '@/hooks/useBrandSettings'
import type { FormFieldDef } from '@/lib/form-fields-catalog'

export const Route = createFileRoute('/f/$slug')({
  component: PublicQuizPage,
})

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : 'https://seu-projeto.supabase.co/functions/v1'; // fallback genérico para tipagem

interface FormTemplate {
  id: string
  user_id: string
  title: string
  description: string | null
  slug: string
  fields: FormFieldDef[]
  theme_color: string
  is_active: boolean
}

function PublicQuizPage() {
  const { slug } = Route.useParams()
  const [form, setForm] = useState<FormTemplate | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'not_found' | 'inactive' | 'ready'>('loading')
  const [quizState, setQuizState] = useState<'intro' | 'quiz' | 'complete'>('intro')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const brand = useBrandSettings(form?.user_id)

  useEffect(() => {
    loadForm()
  }, [slug])

  async function loadForm() {
    if (!/^\d{4}$/.test(slug)) {
      setLoadState('not_found')
      return
    }

    const { data, error } = await supabase
      .from('form_templates')
      .select('id, user_id, title, description, slug, fields, theme_color, is_active')
      .eq('slug', slug)
      .maybeSingle()

    if (error || !data) {
      setLoadState('not_found')
      return
    }
    if (!data.is_active) {
      setLoadState('inactive')
      return
    }
    setForm(data as unknown as FormTemplate)
    setLoadState('ready')
  }

  function validateStep(field: FormFieldDef, value: string): string | undefined {
    if (field.required && !value.trim()) {
      return 'Este campo é obrigatório'
    }
    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) return 'E-mail inválido'
    }
    if (field.type === 'phone' && value) {
      const digits = value.replace(/\D/g, '')
      if (digits.length < 10) return 'Telefone inválido — mínimo 10 dígitos'
    }
    return undefined
  }

  function handleNext() {
    if (!form) return
    const current = form.fields[step]
    const value = answers[current.key] ?? ''
    const validationError = validateStep(current, value)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(undefined)

    if (step === form.fields.length - 1) {
      submitForm()
    } else {
      setStep((s) => s + 1)
    }
  }

  function handlePrev() {
    setError(undefined)
    if (step === 0) {
      setQuizState('intro')
    } else {
      setStep((s) => s - 1)
    }
  }

  function handleChange(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setError(undefined)
  }

  async function submitForm() {
    if (!form) return
    setSubmitting(true)
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/submit-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formSlug: slug, responses: answers }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao enviar')
      }
      setQuizState('complete')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (loadState === 'not_found') {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-background px-5">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold">Formulário não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O link que você acessou não existe ou foi removido.
          </p>
        </div>
      </div>
    )
  }

  // ── Inactive ──────────────────────────────────────────────────────────────
  if (loadState === 'inactive') {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-background px-5">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold">Formulário inativo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este formulário foi desativado. Entre em contato com quem enviou o link.
          </p>
        </div>
      </div>
    )
  }

  if (!form) return null

  // ── Tela de entrada ───────────────────────────────────────────────────────
  if (quizState === 'intro') {
    return (
      <div
        className="min-h-[100svh] flex flex-col bg-background"
        style={{ '--quiz-color': form.theme_color } as React.CSSProperties}
      >
        <QuizBrandHeader brand={brand} title={form.title} />
        <div className="flex flex-1 flex-col items-center justify-center px-5">
        <div className="w-full max-w-lg text-center flex flex-col gap-6 animate-in fade-in duration-500">
          {brand.isCustomLogo ? (
            <div className="mx-auto flex h-16 items-center justify-center">
              <img src={brand.logoUrl} alt={form.title} className="h-14 max-w-[200px] object-contain" />
            </div>
          ) : (
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg"
              style={{ backgroundColor: form.theme_color + '20', color: form.theme_color }}
            >
              📋
            </div>
          )}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {form.title}
            </h1>
            {form.description && (
              <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                {form.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => { setQuizState('quiz'); setStep(0) }}
              className="w-full max-w-xs rounded-2xl py-4 px-8 text-base font-extrabold text-white shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ backgroundColor: form.theme_color }}
            >
              Começar →
            </button>
            <p className="text-xs text-muted-foreground">
              {form.fields.length} {form.fields.length === 1 ? 'pergunta' : 'perguntas'} • Menos de 3 minutos
            </p>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // ── Quiz completo ─────────────────────────────────────────────────────────
  if (quizState === 'complete') {
    return (
      <div className="min-h-[100svh] flex flex-col bg-background">
        <QuizBrandHeader brand={brand} title={form.title} />
        <div className="flex flex-1 items-center justify-center px-5">
          <QuizComplete formTitle={form.title} />
        </div>
      </div>
    )
  }

  // ── Pergunta atual ────────────────────────────────────────────────────────
  const current = form.fields[step]
  if (!current) return null

  return (
    <QuizShell step={step} total={form.fields.length} themeColor={form.theme_color} brandHeader={<QuizBrandHeader brand={brand} title={form.title} />}>
      <QuizStep
        field={current}
        value={answers[current.key] ?? ''}
        onChange={(val) => handleChange(current.key, val)}
        onNext={handleNext}
        onPrev={handlePrev}
        canGoBack={step > 0 || quizState === 'quiz'}
        isLast={step === form.fields.length - 1}
        isSubmitting={submitting}
        error={error}
      />
    </QuizShell>
  )
}
