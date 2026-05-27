export type FormCategory =
  | 'contato'
  | 'financeiro'
  | 'objetivo'
  | 'situacao'
  | 'consorcio'
  | 'pj'

export interface FormFieldDef {
  key: string
  label: string
  category: FormCategory
  type: 'text' | 'money' | 'percent' | 'int' | 'enum' | 'bool' | 'phone' | 'email'
  required?: boolean
  hint?: string
  options?: { value: string; label: string }[]
  mapsTo?: string
  fixed?: boolean // não pode ser removido (campos de contato)
}

export const CATEGORY_LABELS: Record<FormCategory, string> = {
  contato: 'Contato',
  financeiro: 'Financeiro',
  objetivo: 'Objetivo',
  situacao: 'Situação atual',
  consorcio: 'Consórcio',
  pj: 'Empresa (PJ)',
}

export const CATEGORY_ICONS: Record<FormCategory, string> = {
  contato: '👤',
  financeiro: '💰',
  objetivo: '🎯',
  situacao: '🏠',
  consorcio: '📋',
  pj: '🏢',
}

export const FORM_FIELDS_CATALOG: FormFieldDef[] = [
  // ── Contato (sempre incluídos) ────────────────────────────────────────────
  {
    key: 'nome',
    label: 'Qual é o seu nome completo?',
    category: 'contato',
    type: 'text',
    required: true,
    fixed: true,
    mapsTo: 'clients.name',
  },
  {
    key: 'email',
    label: 'Qual é o seu e-mail?',
    category: 'contato',
    type: 'email',
    required: true,
    fixed: true,
    hint: 'Usaremos para entrar em contato',
    mapsTo: 'clients.email',
  },
  {
    key: 'whatsapp',
    label: 'Qual é o seu WhatsApp?',
    category: 'contato',
    type: 'phone',
    required: true,
    fixed: true,
    hint: 'Com DDD, ex: (11) 99999-9999',
    mapsTo: 'clients.phone',
  },

  // ── Financeiro ────────────────────────────────────────────────────────────
  {
    key: 'rendaMensal',
    label: 'Qual é a sua renda mensal bruta?',
    category: 'financeiro',
    type: 'money',
    hint: 'Inclua salário, aluguéis, dividendos, etc.',
  },
  {
    key: 'rendaFamiliar',
    label: 'Qual é a renda familiar total?',
    category: 'financeiro',
    type: 'money',
    hint: 'Some a renda de todos que moram com você',
  },
  {
    key: 'reservaFinanceira',
    label: 'Você tem reserva disponível para dar de lance?',
    category: 'financeiro',
    type: 'money',
    hint: 'Valor aproximado que poderia usar como lance',
    mapsTo: 'lanceProprioR',
  },
  {
    key: 'saldoFGTS',
    label: 'Qual é o seu saldo estimado de FGTS?',
    category: 'financeiro',
    type: 'money',
    hint: 'Pode ser usado como lance em consórcio imobiliário',
  },
  {
    key: 'possuiRestricao',
    label: 'Possui restrição no nome (SPC/Serasa)?',
    category: 'financeiro',
    type: 'bool',
  },

  // ── Objetivo ──────────────────────────────────────────────────────────────
  {
    key: 'finalidade',
    label: 'Qual é o objetivo do consórcio?',
    category: 'objetivo',
    type: 'enum',
    options: [
      { value: 'moradia_propria', label: 'Moradia própria' },
      { value: 'investimento', label: 'Investimento / renda passiva' },
      { value: 'trocar_imovel', label: 'Trocar de imóvel' },
      { value: 'sair_aluguel', label: 'Sair do aluguel' },
    ],
  },
  {
    key: 'valorDesejado',
    label: 'Qual o valor do imóvel que você tem em mente?',
    category: 'objetivo',
    type: 'money',
    mapsTo: 'cartaCredito',
  },
  {
    key: 'tipoImovel',
    label: 'Que tipo de imóvel?',
    category: 'objetivo',
    type: 'enum',
    options: [
      { value: 'apartamento', label: 'Apartamento' },
      { value: 'casa', label: 'Casa' },
      { value: 'terreno', label: 'Terreno' },
      { value: 'comercial', label: 'Imóvel comercial' },
    ],
  },
  {
    key: 'regiaoInteresse',
    label: 'Qual região de interesse?',
    category: 'objetivo',
    type: 'text',
    hint: 'Cidade, bairro ou região',
  },
  {
    key: 'prazoNecessidade',
    label: 'Quando você precisa do imóvel?',
    category: 'objetivo',
    type: 'enum',
    options: [
      { value: 'ate_6m', label: 'Em até 6 meses' },
      { value: 'ate_12m', label: 'Em até 1 ano' },
      { value: 'ate_24m', label: 'Em até 2 anos' },
      { value: 'sem_pressa', label: 'Sem pressa — é investimento' },
    ],
  },

  // ── Situação atual ────────────────────────────────────────────────────────
  {
    key: 'situacaoMoradia',
    label: 'Qual sua situação de moradia atual?',
    category: 'situacao',
    type: 'enum',
    options: [
      { value: 'aluguel', label: 'Pago aluguel' },
      { value: 'propria_quitada', label: 'Tenho imóvel quitado' },
      { value: 'financiamento', label: 'Tenho financiamento ativo' },
      { value: 'familia', label: 'Moro com família' },
    ],
  },
  {
    key: 'valorAluguelAtual',
    label: 'Qual o valor do seu aluguel atual?',
    category: 'situacao',
    type: 'money',
    mapsTo: 'aluguelAtual',
  },
  {
    key: 'possuiFinanciamento',
    label: 'Você possui financiamento imobiliário ativo?',
    category: 'situacao',
    type: 'bool',
  },
  {
    key: 'saldoDevedorAtual',
    label: 'Qual é o saldo devedor do financiamento?',
    category: 'situacao',
    type: 'money',
    mapsTo: 'saldoDevedor',
  },
  {
    key: 'parcelaAtual',
    label: 'Qual é a parcela mensal do financiamento?',
    category: 'situacao',
    type: 'money',
    mapsTo: 'parcelaAtual',
  },
  {
    key: 'prazoRestanteFinanciamento',
    label: 'Quantos meses restam no financiamento?',
    category: 'situacao',
    type: 'int',
    mapsTo: 'prazoRestanteMeses',
  },

  // ── Consórcio ─────────────────────────────────────────────────────────────
  {
    key: 'valorCartaDesejada',
    label: 'Qual valor de carta de crédito te interessa?',
    category: 'consorcio',
    type: 'money',
    hint: 'Valor da carta, não do imóvel',
    mapsTo: 'cartaCredito',
  },
  {
    key: 'percLanceDisponivel',
    label: 'Você pretende dar lance? Qual % consegue?',
    category: 'consorcio',
    type: 'percent',
    hint: 'Porcentagem da carta que consegue dar de lance',
    mapsTo: 'percLance',
  },
  {
    key: 'prazoGrupoPreferido',
    label: 'Qual prazo de grupo você prefere?',
    category: 'consorcio',
    type: 'enum',
    options: [
      { value: '60', label: '5 anos (60 meses)' },
      { value: '120', label: '10 anos (120 meses)' },
      { value: '180', label: '15 anos (180 meses)' },
      { value: '200', label: '200 meses' },
    ],
    mapsTo: 'prazoMeses',
  },

  // ── PJ ────────────────────────────────────────────────────────────────────
  {
    key: 'possuiCNPJ',
    label: 'Você possui empresa (CNPJ)?',
    category: 'pj',
    type: 'bool',
  },
  {
    key: 'regimeTributario',
    label: 'Qual o regime tributário da empresa?',
    category: 'pj',
    type: 'enum',
    options: [
      { value: 'simples', label: 'Simples Nacional' },
      { value: 'lucro_presumido', label: 'Lucro Presumido' },
      { value: 'lucro_real', label: 'Lucro Real' },
      { value: 'mei', label: 'MEI' },
    ],
  },
]

// Campos fixos — sempre presentes, não podem ser removidos
export const FIXED_FIELD_KEYS = FORM_FIELDS_CATALOG
  .filter((f) => f.fixed)
  .map((f) => f.key)

// Catálogo agrupado por categoria
export function getCatalogByCategory(): Record<FormCategory, FormFieldDef[]> {
  const result: Record<FormCategory, FormFieldDef[]> = {
    contato: [],
    financeiro: [],
    objetivo: [],
    situacao: [],
    consorcio: [],
    pj: [],
  }
  for (const field of FORM_FIELDS_CATALOG) {
    result[field.category].push(field)
  }
  return result
}
