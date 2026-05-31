// ─── Legenda de Campos Canônicos ──────────────────────────────────────────────
//
// Dicionário normalizado de TODOS os campos usados nos 8 simuladores.
// Qualquer especialista financeiro sem conhecimento de código pode auditar aqui:
//   - o nome canônico (padrão ouro)
//   - a fórmula matemática
//   - a diretriz de referência
//   - quais simuladores usam o campo
//   - aliases antigos que foram descontinuados

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

interface CanonicalField {
  campo: string;
  label: string;
  formula: string;
  diretriz?: string;
  unidade: string;
  simuladores: string[];
  aliasesAntigos?: string[];
  descricao: string;
}

const CANONICAL_FIELDS: CanonicalField[] = [
  // ── Diretrizes A–F ────────────────────────────────────────────────────────
  {
    campo: "cartaCorrigida",
    label: "Carta Corrigida pelo INCC",
    formula: "C_n × (1+INCC)^⌊Tm/12⌋",
    diretriz: "A",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "meta-patrimonial", "calculadora-patrimonial"],
    aliasesAntigos: ["creditoAtualizado", "creditoAtualizadoContemplacao", "cartaAtualizada"],
    descricao: "Valor nominal da carta corrigido pela taxa INCC. Convenção discreta: o INCC é aplicado em saltos nos aniversários do grupo (meses 12, 24, 36…), equivalente ao expoente inteiro ⌊meses/12⌋. Diretriz A.",
  },
  {
    campo: "lanceEmbutidoR",
    label: "Lance Embutido (R$)",
    formula: "C_atualizado × L%",
    diretriz: "B",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "meta-patrimonial", "calculadora-patrimonial", "consorcio-cnpj"],
    aliasesAntigos: ["lanceEmbR", "valorEmbVisual"],
    descricao: "Valor em reais do lance embutido, calculado sobre a carta CORRIGIDA (não nominal). Não sai do bolso — é descontado do crédito recebido.",
  },
  {
    campo: "poderDeCompra",
    label: "Poder de Compra Líquido",
    formula: "C_atualizado − L_embutido",
    diretriz: "C",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "calculadora-patrimonial"],
    aliasesAntigos: ["creditoLiquido", "poderCompraLiquido"],
    descricao: "Capital realmente disponível para compra do imóvel após o lance embutido. É o que o cliente tem 'na mão' no ato da contemplação.",
  },
  {
    campo: "saldoCaixa",
    label: "Saldo de Caixa (Sobra/Déficit)",
    formula: "P_liq − V_a_corrigido",
    diretriz: "D",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio"],
    descricao: "Diferença entre o poder de compra e o custo do imóvel-alvo corrigido. Positivo = sobra de crédito. Negativo = precisa de complemento em caixa.",
  },
  {
    campo: "custoGlobal",
    label: "Custo Total do Plano",
    formula: "ΣP_pre + L_rp + ΣP_pos",
    diretriz: "E",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "meta-patrimonial", "calculadora-patrimonial", "consorcio-cnpj"],
    aliasesAntigos: ["totalConsorcio", "custoGlobal_v1", "desembolsoTotal"],
    descricao: "SNAPSHOT na contemplação: parcelas pagas até a contemplação + lance próprio + saldo devedor pós-lance. Gabarito do Validador Matemático. Usado no Simulador de Lance. DIFERENTE de totalPagamentos (soma do plano inteiro), usado nos demais simuladores.",
  },
  {
    campo: "valorFuturo",
    label: "Valor Futuro do Imóvel",
    formula: "V_a × (1+V_imm)^(T_total/12)",
    diretriz: "F",
    unidade: "R$",
    simuladores: ["aluguel-vs-consorcio", "meta-patrimonial", "renda-passiva-consorcio", "saida-financiamento", "calculadora-patrimonial"],
    aliasesAntigos: ["imovelNoFuturo", "valorImovelFinal"],
    descricao: "Projeção do valor do imóvel ao final do horizonte, usando juros compostos padrão. Substitui qualquer conversão linear incorreta.",
  },

  // ── Campos de parcelas ────────────────────────────────────────────────────
  {
    campo: "parcelaNominal",
    label: "Parcela Nominal (mês 1)",
    formula: "(C_n × (1+TA)) / N",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "meta-patrimonial", "calculadora-patrimonial", "consorcio-cnpj"],
    aliasesAntigos: ["parcelaPadrao", "parcelaConsorcio", "parcelaBrutaConsorcio"],
    descricao: "Parcela inicial do consórcio antes de qualquer reajuste INCC ou lance. Calculada sobre o valor NOMINAL da carta.",
  },
  {
    campo: "parcelaReduzida",
    label: "Parcela Reduzida (pós-lance)",
    formula: "saldo_plano_pós_lance / meses_restantes",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "meta-patrimonial", "consorcio-cnpj"],
    aliasesAntigos: ["parcelaPosLance", "parcelaBrutaPosLance"],
    descricao: "Parcela após o abatimento do lance embutido e/ou próprio no saldo do plano.",
  },
  {
    campo: "parcelasAteContemplacao",
    label: "Soma de Parcelas Pré-Contemplação",
    formula: "Σ parcela(m) para m = 1 até mc",
    unidade: "R$",
    simuladores: ["simulador-lance", "calculadora-patrimonial"],
    descricao: "Somatório de todas as parcelas efetivamente pagas desde o início até o mês da contemplação (inclusive).",
  },

  // ── Campos de lance ───────────────────────────────────────────────────────
  {
    campo: "lanceProprioR",
    label: "Lance Próprio (R$)",
    formula: "Cash saído do bolso no mês mc",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "meta-patrimonial"],
    aliasesAntigos: ["lanceProprio"],
    descricao: "Valor em dinheiro pago diretamente pelo cotista no mês da contemplação para reduzir o saldo devedor. ESTE valor sai do bolso.",
  },
  {
    campo: "lanceTotalR",
    label: "Lance Total (R$)",
    formula: "lanceEmbutidoR + lanceProprioR",
    unidade: "R$",
    simuladores: ["simulador-lance"],
    descricao: "Soma do lance embutido (da carta) com o lance próprio (do bolso).",
  },
  {
    campo: "percLanceTotalSobreCarta",
    label: "Lance Total sobre a Carta (%)",
    formula: "lanceTotalR / C_atualizado × 100",
    unidade: "%",
    simuladores: ["simulador-lance"],
    descricao: "Percentual total do lance (embutido + próprio) sobre a carta corrigida. Indica a força do lance na assembleia.",
  },

  // ── Campos de saldo ───────────────────────────────────────────────────────
  {
    campo: "saldoDevedor",
    label: "Saldo Devedor (pós-lance)",
    formula: "saldo_plano − L_embutido − L_próprio",
    unidade: "R$",
    simuladores: ["simulador-lance", "aluguel-vs-consorcio", "renda-passiva-consorcio", "saida-financiamento", "calculadora-patrimonial"],
    aliasesAntigos: ["saldoDevedorPosLance"],
    descricao: "Saldo restante do plano após o abatimento dos lances. É o valor que o cotista ainda deverá pagar em parcelas.",
  },
  {
    campo: "saldoAntesLance",
    label: "Saldo Antes do Lance",
    formula: "saldo_plano no mês mc (antes do lance)",
    unidade: "R$",
    simuladores: ["simulador-lance"],
    aliasesAntigos: ["saldoDevedorContemplacao"],
    descricao: "Saldo do plano ANTES do abatimento dos lances. Útil para verificar o impacto real do lance.",
  },
  {
    campo: "prazoPosLance",
    label: "Prazo Pós-Lance (meses)",
    formula: "N − mc  (ou meses para zerar o saldo)",
    unidade: "meses",
    simuladores: ["simulador-lance", "saida-financiamento"],
    descricao: "Quantos meses restam de pagamento após a contemplação e aplicação do lance.",
  },

  // ── Campos do Flip de Cota ────────────────────────────────────────────────
  {
    campo: "parcelaCheia",
    label: "Parcela Cheia do Flip",
    formula: "C × (1+(TA+FR)/100) / N",
    unidade: "R$",
    simuladores: ["flip-cota"],
    descricao: "Parcela integral do plano de consórcio no flip. Modelo NOMINAL — sem INCC, pois o flip é uma operação de curto prazo.",
  },
  {
    campo: "parcelaEfetiva",
    label: "Parcela Efetiva do Flip",
    formula: "meiaParcela ? cheia/2 : cheia",
    unidade: "R$",
    simuladores: ["flip-cota"],
    descricao: "Valor real da parcela paga. Com meia parcela (benefício comum no mercado) é 50% da parcela cheia.",
  },
  {
    campo: "desembolsoTotal",
    label: "Desembolso Total do Flip",
    formula: "valorPagoParcelas + desembolsoLance",
    unidade: "R$",
    simuladores: ["flip-cota"],
    aliasesAntigos: ["custoGlobal"],
    descricao: "Total investido na operação de flip: o que saiu do bolso em parcelas + o lance próprio (se houver).",
  },
  {
    campo: "valorVenda",
    label: "Receita do Ágio (Flip)",
    formula: "creditoLiquido × (ágio% / 100)",
    unidade: "R$",
    simuladores: ["flip-cota"],
    descricao: "Ganho obtido na venda da cota contemplada com ágio sobre o crédito líquido.",
  },
  {
    campo: "lucroLiquido",
    label: "Lucro Líquido do Flip",
    formula: "valorVenda − desembolsoTotal",
    unidade: "R$",
    simuladores: ["flip-cota"],
    descricao: "Lucro real da operação de flip: receita do ágio menos o total investido.",
  },
  {
    campo: "tirMensal",
    label: "TIR Mensal",
    formula: "(valorVenda/desembolso)^(1/mc) − 1",
    unidade: "%",
    simuladores: ["flip-cota"],
    descricao: "Taxa interna de retorno mensal da operação de flip, calculada como a taxa que transforma o desembolso no valor de venda no prazo de contemplação.",
  },

  // ── Campos de comparativos ────────────────────────────────────────────────
  {
    campo: "economia",
    label: "Economia com o Lance",
    formula: "custoGlobal_semLance − custoGlobal_comLance",
    unidade: "R$",
    simuladores: ["simulador-lance"],
    descricao: "Diferença de custo total entre contemplar sem lance vs com lance. Mostra o real benefício financeiro da estratégia de lance.",
  },
  {
    campo: "totalAluguel",
    label: "Total Gasto em Aluguel",
    formula: "Σ aluguelMes(m) com reajuste anual",
    unidade: "R$",
    simuladores: ["aluguel-vs-consorcio"],
    descricao: "Soma total de todos os aluguéis pagos no horizonte, com reajuste anual pelo percentual configurado.",
  },
  {
    campo: "vantagemPatrimonial",
    label: "Vantagem Patrimonial",
    formula: "V_futuro − custoConsórcio + totalAluguel",
    unidade: "R$",
    simuladores: ["aluguel-vs-consorcio"],
    descricao: "Diferença patrimonial a favor do consórcio: imóvel valorizado + economia vs pagar aluguel por anos.",
  },
  {
    campo: "capitalLiquidoVenda",
    label: "Capital Líquido da Venda",
    formula: "V_imovel × (1−custos%) − saldo_devedor",
    unidade: "R$",
    simuladores: ["saida-financiamento"],
    descricao: "Dinheiro disponível ao vender o imóvel atual, líquido dos custos de transação e do saldo devedor do financiamento.",
  },

  // ── Campos CDI / Renda Passiva ────────────────────────────────────────────
  {
    campo: "creditoFinalComCDI",
    label: "Crédito Final Rendendo CDI",
    formula: "C_atualizado × (1+CDI_mensal)^(N−mc)",
    unidade: "R$",
    simuladores: ["renda-passiva-consorcio"],
    descricao: "Valor do crédito contemplado caso o cotista o aplique no CDI pelo restante do prazo do plano. Base = carta CORRIGIDA pelo INCC.",
  },
  {
    campo: "roiAnual",
    label: "ROI Anual",
    formula: "(patrimonioFinal/totalInvestido)^(12/N) − 1",
    unidade: "%",
    simuladores: ["renda-passiva-consorcio", "flip-cota"],
    descricao: "Retorno anualizado do investimento, convertendo o ROI total para taxa equivalente anual.",
  },

  // ── Campos CNPJ ───────────────────────────────────────────────────────────
  {
    campo: "economiaFiscalMensal",
    label: "Economia Fiscal Mensal",
    formula: "parcelaBruta × fracTA × (IRPJ+CSLL)",
    unidade: "R$",
    simuladores: ["consorcio-cnpj"],
    descricao: "Redução do custo real da parcela graças à dedução da taxa de administração como despesa operacional no Lucro Real.",
  },
  {
    campo: "totalEconomiaFiscalConsorcio",
    label: "Economia Fiscal Total",
    formula: "Σ economiaFiscalMes ao longo do plano",
    unidade: "R$",
    simuladores: ["consorcio-cnpj", "meta-patrimonial"],
    descricao: "Total acumulado de benefício fiscal ao longo de todo o prazo do consórcio.",
  },

  // ── Meta Patrimonial ──────────────────────────────────────────────────────
  {
    campo: "numCotas",
    label: "Número de Cotas Necessárias",
    formula: "⌈patrimonioAlvo / V_futuro⌉",
    unidade: "n",
    simuladores: ["meta-patrimonial"],
    descricao: "Quantidade mínima de cotas para atingir o patrimônio-alvo. Calculada como o teto da divisão do objetivo pelo valor futuro de cada cota.",
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

const SIMULADORES = [
  { slug: "simulador-lance",         label: "Simulador de Lance" },
  { slug: "flip-cota",               label: "Flip de Cota" },
  { slug: "aluguel-vs-consorcio",    label: "Aluguel vs Consórcio" },
  { slug: "renda-passiva-consorcio", label: "Renda Passiva" },
  { slug: "saida-financiamento",     label: "Saída do Financiamento" },
  { slug: "meta-patrimonial",        label: "Meta Patrimonial" },
  { slug: "consorcio-cnpj",          label: "Consórcio CNPJ" },
  { slug: "calculadora-patrimonial", label: "Calculadora Patrimonial" },
];

const DIRETRIZ_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  B: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  C: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  D: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  E: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  F: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};

export function CanonicalFieldsTable({ filterSlug }: { filterSlug?: string }) {
  const [search, setSearch] = useState("");
  const [simFilter, setSimFilter] = useState(filterSlug ?? "all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return CANONICAL_FIELDS.filter((f) => {
      const matchSearch = !q ||
        f.campo.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q) ||
        f.formula.toLowerCase().includes(q) ||
        (f.aliasesAntigos ?? []).some((a) => a.toLowerCase().includes(q));
      const matchSim = simFilter === "all" || f.simuladores.includes(simFilter);
      return matchSearch && matchSim;
    });
  }, [search, simFilter]);

  return (
    <div className="space-y-4">
      {/* ── Diretrizes de referência ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { id: "A", label: "INCC Discreto", formula: "C×(1+i)^⌊T/12⌋" },
          { id: "B", label: "Lance Embutido R$", formula: "C_atu×L%" },
          { id: "C", label: "Poder de Compra", formula: "C_atu−L_emb" },
          { id: "D", label: "Saldo Caixa", formula: "P_liq−V_a" },
          { id: "E", label: "Custo Total Real", formula: "ΣPpre+Lrp+ΣPpos" },
          { id: "F", label: "Valor Futuro", formula: "V×(1+v)^(T/12)" },
        ].map((d) => (
          <div key={d.id} className={`rounded-xl p-3 ${DIRETRIZ_COLORS[d.id] ?? "bg-muted"}`}>
            <p className="text-xs font-extrabold">Diretriz {d.id}</p>
            <p className="text-[11px] font-bold">{d.label}</p>
            <code className="text-[10px] opacity-70">{d.formula}</code>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar campo, fórmula ou alias antigo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <select
          value={simFilter}
          onChange={(e) => setSimFilter(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        >
          <option value="all">Todos os simuladores</option>
          {SIMULADORES.map((s) => (
            <option key={s.slug} value={s.slug}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Campo Canônico</th>
              <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Fórmula</th>
              <th className="px-4 py-3 text-center text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Dir.</th>
              <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Unidade</th>
              <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Simuladores</th>
              <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Aliases Antigos (descontinuados)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((field) => (
              <tr key={field.campo} className="border-b border-border last:border-0 hover:bg-accent/20">
                {/* Campo */}
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-bold text-foreground">{field.campo}</p>
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                </td>

                {/* Fórmula */}
                <td className="px-4 py-3">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{field.formula}</code>
                  <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">{field.descricao}</p>
                </td>

                {/* Diretriz */}
                <td className="px-4 py-3 text-center">
                  {field.diretriz ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold ${DIRETRIZ_COLORS[field.diretriz] ?? "bg-muted text-foreground"}`}>
                      {field.diretriz}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Unidade */}
                <td className="px-4 py-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono font-bold">{field.unidade}</span>
                </td>

                {/* Simuladores */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {field.simuladores.map((s) => (
                      <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {SIMULADORES.find((x) => x.slug === s)?.label ?? s}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Aliases */}
                <td className="px-4 py-3">
                  {field.aliasesAntigos?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {field.aliasesAntigos.map((a) => (
                        <span key={a} className="rounded-full bg-red-100 px-2 py-0.5 font-mono text-[10px] text-red-700 line-through dark:bg-red-950 dark:text-red-400">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum campo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {filtered.length} de {CANONICAL_FIELDS.length} campos canônicos
      </p>
    </div>
  );
}
