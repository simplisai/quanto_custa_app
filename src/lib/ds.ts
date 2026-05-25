/**
 * Design System — Quanto custa?
 *
 * REGRAS FUNDAMENTAIS:
 * 1. O layout (_authenticated.tsx) é o único responsável por padding e max-width.
 *    Páginas NUNCA adicionam padding próprio nem min-h-screen.
 * 2. Toda página começa com <div className={ds.page}> como raiz.
 * 3. Grids usam classes ds.grid* — NUNCA grid-cols avulsos.
 * 4. Tabelas SEMPRE dentro de <div className={ds.tableWrap}>.
 * 5. Headers de página SEMPRE com ds.pageHeader para comportamento flex responsivo.
 *
 * BREAKPOINTS (Tailwind defaults):
 *   sm  = 640px  — primeiro ponto multi-coluna
 *   md  = 768px  — sidebar aparece, layout muda
 *   lg  = 1024px — desktop completo
 */

// ─────────────────────────────────────────────────────────────────────────────
// Layout de página — root de cada route component
// ─────────────────────────────────────────────────────────────────────────────

/** Raiz de qualquer página — espaçamento vertical consistente */
export const page = 'space-y-5 md:space-y-6'

/** Header com título + ação(s) — empilha no mobile, linha no desktop */
export const pageHeader = 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'

/** Título principal da página */
export const pageTitle = 'text-2xl font-bold tracking-tight leading-none'

/** Subtítulo / descrição abaixo do título */
export const pageSub = 'text-sm text-muted-foreground mt-1'

// ─────────────────────────────────────────────────────────────────────────────
// Grids de KPI (cards de métricas)
// ─────────────────────────────────────────────────────────────────────────────

/** 4 KPIs — 2 colunas mobile, 4 no sm+ */
export const kpi4 = 'grid gap-3 grid-cols-2 sm:grid-cols-4'

/** 3 KPIs — 1 coluna mobile, 3 no sm+ */
export const kpi3 = 'grid gap-3 grid-cols-1 sm:grid-cols-3'

/** 5 KPIs (assinaturas) — 2 mobile, 3 tablet, 5 desktop */
export const kpi5 = 'grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'

// ─────────────────────────────────────────────────────────────────────────────
// Grids de conteúdo (cards de navegação / módulos)
// ─────────────────────────────────────────────────────────────────────────────

/** 2 cards — 1 col mobile, 2 col sm+ */
export const cards2 = 'grid gap-4 grid-cols-1 sm:grid-cols-2'

/** 3 cards — 1 col mobile, 2 col sm, 3 col lg */
export const cards3 = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

/** 4 shortcuts — 2 col mobile, 4 col sm+ */
export const cards4 = 'grid gap-3 grid-cols-2 sm:grid-cols-4'

// ─────────────────────────────────────────────────────────────────────────────
// Tabelas — OBRIGATÓRIO envolver em tableWrap para evitar overflow
// ─────────────────────────────────────────────────────────────────────────────

/** Wrapper de tabela com scroll horizontal seguro */
export const tableWrap = 'w-full overflow-x-auto'

// ─────────────────────────────────────────────────────────────────────────────
// Seções dentro de página
// ─────────────────────────────────────────────────────────────────────────────

/** Bloco de seção com espaçamento vertical interno */
export const section = 'space-y-3'

/** Título de seção */
export const sectionTitle = 'text-base font-semibold'

/** Descrição de seção */
export const sectionSub = 'text-xs text-muted-foreground'

// ─────────────────────────────────────────────────────────────────────────────
// Estado de carregamento e vazio
// ─────────────────────────────────────────────────────────────────────────────

/** Container de loading spinner */
export const loadingCenter = 'flex items-center justify-center py-12'

/** Mensagem de estado vazio */
export const emptyState = 'py-12 text-center text-sm text-muted-foreground'

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card internals — valores de tipografia
// ─────────────────────────────────────────────────────────────────────────────

/** Valor numérico grande em KPI card */
export const kpiValue = 'text-2xl font-bold tabular-nums'

/** Label do KPI card */
export const kpiLabel = 'text-xs text-muted-foreground'

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários compostos — objetos de convenência
// ─────────────────────────────────────────────────────────────────────────────

/** Namespace completo — use import * as ds from '@/lib/ds' */
export const ds = {
  page,
  pageHeader,
  pageTitle,
  pageSub,
  kpi4,
  kpi3,
  kpi5,
  cards2,
  cards3,
  cards4,
  tableWrap,
  section,
  sectionTitle,
  sectionSub,
  loadingCenter,
  emptyState,
  kpiValue,
  kpiLabel,
} as const
