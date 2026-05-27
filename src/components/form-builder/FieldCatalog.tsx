import { FORM_FIELDS_CATALOG, CATEGORY_LABELS, CATEGORY_ICONS, FIXED_FIELD_KEYS, getCatalogByCategory, type FormFieldDef, type FormCategory } from '@/lib/form-fields-catalog'

interface FieldCatalogProps {
  selectedKeys: string[]
  onToggle: (field: FormFieldDef) => void
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

export function FieldCatalog({ selectedKeys, onToggle }: FieldCatalogProps) {
  const byCategory = getCatalogByCategory()
  const categories = Object.keys(byCategory) as FormCategory[]

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const fields = byCategory[cat]
        if (!fields.length) return null
        return (
          <div key={cat}>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>{CATEGORY_ICONS[cat]}</span>
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="space-y-1">
              {fields.map((field) => {
                const isFixed = FIXED_FIELD_KEYS.includes(field.key)
                const isSelected = selectedKeys.includes(field.key)
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => !isFixed && onToggle(field)}
                    disabled={isFixed}
                    className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent text-foreground'
                    } ${isFixed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                    <span className="flex-1 leading-tight">{field.label}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {TYPE_LABEL[field.type] ?? field.type}
                    </span>
                    {isFixed && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">fixo</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
