import { type FormFieldDef } from '@/lib/form-fields-catalog'

interface QuizInputProps {
  field: FormFieldDef
  value: string
  onChange: (value: string) => void
  error?: string
}

function formatMoney(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseMoney(formatted: string): string {
  return formatted.replace(/\D/g, '')
}

export function QuizInput({ field, value, onChange, error }: QuizInputProps) {
  const baseInputClass =
    'w-full rounded-2xl border-2 px-5 py-4 text-base font-medium outline-none transition-all ' +
    (error
      ? 'border-destructive bg-destructive/5 text-destructive placeholder:text-destructive/40'
      : 'border-border bg-card text-foreground placeholder:text-muted-foreground/50 focus:border-primary')

  if (field.type === 'bool') {
    return (
      <div className="flex gap-3 w-full">
        {[
          { val: 'true', label: '✓ Sim' },
          { val: 'false', label: '✗ Não' },
        ].map(({ val, label }) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`flex-1 rounded-2xl border-2 py-4 text-base font-bold transition-all ${
              value === val
                ? 'border-primary bg-primary text-primary-foreground scale-[1.02]'
                : 'border-border bg-card text-foreground hover:border-primary/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  if (field.type === 'enum' && field.options) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {field.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full rounded-2xl border-2 px-5 py-3.5 text-left text-sm font-medium transition-all ${
              value === opt.value
                ? 'border-primary bg-primary/10 text-primary scale-[1.01]'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  if (field.type === 'money') {
    return (
      <div className="relative w-full">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          value={value ? formatMoney(value) : ''}
          onChange={(e) => onChange(parseMoney(e.target.value))}
          className={baseInputClass + ' pl-12'}
        />
      </div>
    )
  }

  if (field.type === 'percent') {
    return (
      <div className="relative w-full">
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, '')
            if (parseFloat(v) <= 100 || v === '') onChange(v)
          }}
          className={baseInputClass + ' pr-12'}
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
          %
        </span>
      </div>
    )
  }

  if (field.type === 'int') {
    return (
      <input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className={baseInputClass}
      />
    )
  }

  if (field.type === 'phone') {
    const formatPhone = (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, 11)
      if (digits.length <= 2) return `(${digits}`
      if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
      if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    }
    return (
      <input
        type="tel"
        inputMode="numeric"
        placeholder="(11) 99999-9999"
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        className={baseInputClass}
      />
    )
  }

  if (field.type === 'email') {
    return (
      <input
        type="email"
        inputMode="email"
        placeholder="nome@exemplo.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseInputClass}
      />
    )
  }

  // Default: text
  return (
    <input
      type="text"
      placeholder="Digite sua resposta..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={baseInputClass}
    />
  )
}
