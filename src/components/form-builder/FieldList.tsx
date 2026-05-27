import { GripVertical, X } from 'lucide-react'
import { FIXED_FIELD_KEYS, type FormFieldDef } from '@/lib/form-fields-catalog'

interface FieldListProps {
  fields: FormFieldDef[]
  onRemove: (key: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}

const TYPE_LABEL: Record<string, string> = {
  text: 'texto',
  email: 'e-mail',
  phone: 'telefone',
  money: 'valor',
  percent: '%',
  int: 'número',
  bool: 'sim/não',
  enum: 'escolha',
}

export function FieldList({ fields, onRemove, onMoveUp, onMoveDown }: FieldListProps) {
  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
        <div className="text-4xl">📋</div>
        <p className="text-sm">
          Selecione perguntas do catálogo ao lado para montar seu formulário.
        </p>
        <p className="text-xs">
          Os campos de contato (nome, e-mail, WhatsApp) sempre aparecem no início.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {fields.map((field, idx) => {
        const isFixed = FIXED_FIELD_KEYS.includes(field.key)
        return (
          <div
            key={field.key}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
              isFixed ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'
            }`}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <span className="flex-1 text-sm leading-tight">{field.label}</span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {TYPE_LABEL[field.type] ?? field.type}
            </span>
            {isFixed ? (
              <span className="shrink-0 text-[10px] text-muted-foreground px-1">fixo</span>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveUp(idx)}
                  disabled={idx === 0}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30 text-muted-foreground text-xs"
                  title="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(idx)}
                  disabled={idx === fields.length - 1}
                  className="rounded p-1 hover:bg-accent disabled:opacity-30 text-muted-foreground text-xs"
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(field.key)}
                  className="rounded p-1 hover:bg-destructive/10 text-destructive/70 hover:text-destructive"
                  title="Remover campo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
