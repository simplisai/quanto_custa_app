import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type FormFieldDef } from '@/lib/form-fields-catalog'

interface QuizPreviewProps {
  fields: FormFieldDef[]
  title: string
  description?: string
}

export function QuizPreview({ fields, title, description }: QuizPreviewProps) {
  const [step, setStep] = useState(-1) // -1 = tela de entrada

  const allFields = fields
  const current = allFields[step]
  const total = allFields.length

  const handleStart = () => setStep(0)
  const handleNext = () => { if (step < total - 1) setStep(step + 1) }
  const handlePrev = () => { if (step > 0) { setStep(step - 1) } else { setStep(-1) } }
  const isLast = step === total - 1
  const isComplete = step >= total

  return (
    <div className="h-full flex flex-col rounded-2xl border border-border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preview</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {/* Tela de entrada */}
        {step === -1 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
            <div className="text-4xl">📋</div>
            <div>
              <h2 className="text-base font-extrabold">{title || 'Seu Formulário'}</h2>
              {description && (
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={total === 0}
              className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {total === 0 ? 'Adicione perguntas' : 'Começar →'}
            </button>
            {total > 0 && (
              <p className="text-xs text-muted-foreground">{total} {total === 1 ? 'pergunta' : 'perguntas'}</p>
            )}
          </div>
        )}

        {/* Tela de conclusão */}
        {isComplete && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
            <div className="text-4xl">✅</div>
            <div>
              <h2 className="text-base font-extrabold">Obrigado!</h2>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Em breve vamos entrar em contato com você.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(-1)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Reiniciar preview
            </button>
          </div>
        )}

        {/* Pergunta atual */}
        {step >= 0 && !isComplete && current && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{step + 1} de {total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((step + 1) / total) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="flex-1 flex flex-col gap-3">
              <label className="text-sm font-semibold leading-snug">
                {current.label}
                {current.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {current.hint && (
                <p className="text-xs text-muted-foreground -mt-1">{current.hint}</p>
              )}

              {/* Input preview by type */}
              {(current.type === 'text' || current.type === 'email' || current.type === 'phone') && (
                <input
                  type="text"
                  disabled
                  placeholder={current.type === 'email' ? 'nome@exemplo.com' : current.type === 'phone' ? '(11) 99999-9999' : 'Digite sua resposta...'}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 w-full"
                />
              )}
              {current.type === 'money' && (
                <div className="flex items-center rounded-xl border border-border bg-background px-4 py-3">
                  <span className="text-sm text-muted-foreground mr-2">R$</span>
                  <input type="text" disabled placeholder="0,00" className="flex-1 text-sm bg-transparent placeholder:text-muted-foreground/50 outline-none" />
                </div>
              )}
              {current.type === 'percent' && (
                <div className="flex items-center rounded-xl border border-border bg-background px-4 py-3">
                  <input type="text" disabled placeholder="0" className="flex-1 text-sm bg-transparent placeholder:text-muted-foreground/50 outline-none" />
                  <span className="text-sm text-muted-foreground ml-2">%</span>
                </div>
              )}
              {current.type === 'int' && (
                <input
                  type="number"
                  disabled
                  placeholder="0"
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 w-full"
                />
              )}
              {current.type === 'bool' && (
                <div className="flex gap-3">
                  {['Sim', 'Não'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled
                      className="flex-1 rounded-xl border border-border bg-background py-3 text-sm font-medium text-muted-foreground"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {current.type === 'enum' && current.options && (
                <div className="space-y-2">
                  {current.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left text-sm text-foreground"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-2 mt-auto pt-2">
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={isLast ? () => setStep(total) : handleNext}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all"
              >
                {isLast ? 'Enviar' : 'Próxima'}
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
