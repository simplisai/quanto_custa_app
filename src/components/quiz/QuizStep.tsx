import { ChevronLeft } from 'lucide-react'
import { type FormFieldDef } from '@/lib/form-fields-catalog'
import { QuizInput } from './QuizInput'

interface QuizStepProps {
  field: FormFieldDef
  value: string
  onChange: (value: string) => void
  onNext: () => void
  onPrev: () => void
  canGoBack: boolean
  isLast: boolean
  isSubmitting?: boolean
  error?: string
}

export function QuizStep({
  field,
  value,
  onChange,
  onNext,
  onPrev,
  canGoBack,
  isLast,
  isSubmitting,
  error,
}: QuizStepProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && field.type !== 'enum' && field.type !== 'bool') {
      onNext()
    }
  }

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl font-extrabold leading-snug text-foreground">
          {field.label}
          {field.required && <span className="text-primary ml-1">*</span>}
        </h2>
        {field.hint && (
          <p className="mt-2 text-sm text-muted-foreground">{field.hint}</p>
        )}
      </div>

      {/* Input */}
      <div onKeyDown={handleKeyDown}>
        <QuizInput field={field} value={value} onChange={onChange} error={error} />
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-destructive font-medium">{error}</p>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center gap-3">
        {canGoBack && (
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl bg-primary px-6 py-3.5 text-base font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {isSubmitting ? 'Enviando...' : isLast ? 'Enviar ✓' : 'Próxima →'}
        </button>
      </div>

      {/* Hint for desktop */}
      {field.type !== 'enum' && field.type !== 'bool' && (
        <p className="mt-3 text-center text-xs text-muted-foreground/60 hidden sm:block">
          Pressione Enter para continuar
        </p>
      )}
    </div>
  )
}
