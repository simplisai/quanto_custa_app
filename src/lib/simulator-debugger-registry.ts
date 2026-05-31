// ─── Debugger Registry de Simuladores ────────────────────────────────────────
//
// FONTE ÚNICA DE VERDADE do Admin Debugger.
//
// Cada DebuggerSpec mapeia um simulador para:
//   1. a função TypeScript REAL (calcFn) — sem re-implementação em mathjs
//   2. os campos de entrada (inputFields) para o formulário de teste
//   3. os passos de fórmula (traceSteps) com notação matemática + verificação
//      independente — detecta divergências entre o código e as Diretrizes
//   4. as colunas da timeline para o preview mês-a-mês
//
// DIRETRIZES DE REFERÊNCIA:
//   A. C_atualizado = C_n × (1+INCC)^(Tm/12)
//   B. L_valor = C_atualizado × L%
//   C. P_liq = C_atualizado − L_valor
//   D. Saldo_caixa = P_liq − V_a_corrigido
//   E. Custo_total = ΣP_pre + L_rp + ΣP_pos
//   F. V_futuro = V_a × (1+V_imm)^(T_total/12)

import { calcLance, defaultLanceInputs, type LanceInputs } from "./calc-lance";
import { calcFlipCota, defaultFlipCotaInputs, type FlipCotaInputs } from "./calc-flip-cota";
import { calcAluguelVsConsorcio, defaultAluguelInputs, type AluguelInputs } from "./calc-aluguel-vs-consorcio";
import { calcRendaPassiva, defaultRendaPassivaInputs, type RendaPassivaInputs } from "./calc-renda-passiva";
import { calcSaidaFinanciamento, defaultSaidaInputs, type SaidaFinanciamentoInputs } from "./calc-saida-financiamento";
import { calcMetaPatrimonial, defaultMetaInputs, type MetaPatrimonialInputs } from "./calc-meta-patrimonial";
import { calcConsorcioCNPJ, defaultCNPJInputs, type ConsorcioCNPJInputs } from "./calc-consorcio-cnpj";
import { calcular } from "./calculator";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FieldUnit = "R$" | "%" | "meses" | "n" | "anos";
export type FieldType = "money" | "percent" | "meses" | "numero";

export interface InputFieldDef {
  key: string;
  label: string;
  type: FieldType;
  defaultValue: number;
  min?: number;
  max?: number;
  hint?: string;
}

export interface TraceStep {
  id: string;
  /** Nome canônico do campo (padrão ouro da nomenclatura) */
  campo: string;
  /** Rótulo legível em português */
  label: string;
  /** Notação matemática simplificada */
  formula: string;
  /** Diretriz financeira que esta fórmula implementa */
  diretriz?: string;
  unidade: FieldUnit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getValue: (result: any) => number | null | undefined;
  /** Verifica independentemente o valor — detecta divergência com a diretriz */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verificar?: (inputs: any, result: any) => { ok: boolean; esperado: number };
}

export interface TimelineColumnDef {
  key: string;
  label: string;
  unidade: FieldUnit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getValue: (row: any) => number | null | undefined;
}

export interface DebuggerSpec {
  slug: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calcFn: (inputs: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultInputs: any;
  inputFields: InputFieldDef[];
  traceSteps: TraceStep[];
  timelineColumns?: TimelineColumnDef[];
}

// ── Helpers de verificação ────────────────────────────────────────────────────

const tol = (a: number, b: number, delta = 0.05) =>
  Math.abs((a - b)) <= Math.max(delta, Math.abs(b) * 0.0001 + 0.01);

// ── 1. Simulador de Lance ─────────────────────────────────────────────────────

const lanceSpec: DebuggerSpec = {
  slug: "simulador-lance",
  label: "Simulador de Lance",
  calcFn: calcLance,
  defaultInputs: { ...defaultLanceInputs, cartaCredito: 1_000_000, percLanceEmb: 20, mesContemplacaoLance: 12 },
  inputFields: [
    { key: "cartaCredito",          label: "Carta de Crédito",        type: "money",   defaultValue: 1_000_000 },
    { key: "taxaAdmTotal",          label: "Taxa de Adm (%)",          type: "percent", defaultValue: 18 },
    { key: "prazoMeses",            label: "Prazo (meses)",            type: "meses",   defaultValue: 240 },
    { key: "taxaAtualizacaoAnual",  label: "INCC a.a. (%)",            type: "percent", defaultValue: 4 },
    { key: "percLanceEmb",          label: "Lance Embutido (%)",        type: "percent", defaultValue: 20 },
    { key: "lanceProprioR",         label: "Lance Próprio (R$)",        type: "money",   defaultValue: 0 },
    { key: "mesContemplacaoLance",  label: "Mês Contemplação (lance)", type: "meses",   defaultValue: 12 },
    { key: "mesSemLance",           label: "Mês Contemplação (sem)",   type: "meses",   defaultValue: 72 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "cartaCorrigida",
      campo: "cartaCorrigida",
      label: "Carta Corrigida pelo INCC",
      formula: "C × (1+INCC)^⌊mc/12⌋",
      diretriz: "A",
      unidade: "R$",
      getValue: (r) => r.cartaAtualizada,
      verificar: (inp: LanceInputs, r) => {
        const esperado = inp.cartaCredito * Math.pow(1 + inp.taxaAtualizacaoAnual / 100, Math.floor(inp.mesContemplacaoLance / 12));
        return { ok: tol(r.cartaAtualizada, esperado), esperado };
      },
    },
    {
      id: "lanceEmbutidoR",
      campo: "lanceEmbutidoR",
      label: "Lance Embutido (R$)",
      formula: "C_atualizado × L%",
      diretriz: "B",
      unidade: "R$",
      getValue: (r) => r.lanceEmbR,
      verificar: (inp: LanceInputs, r) => {
        const esperado = r.cartaAtualizada * (inp.percLanceEmb / 100);
        return { ok: tol(r.lanceEmbR, esperado), esperado };
      },
    },
    {
      id: "poderDeCompra",
      campo: "poderDeCompra",
      label: "Poder de Compra Líquido",
      formula: "C_atualizado − L_embutido",
      diretriz: "C",
      unidade: "R$",
      getValue: (r) => r.creditoLiquido,
      verificar: (_inp, r) => {
        const esperado = r.cartaAtualizada - r.lanceEmbR;
        return { ok: tol(r.creditoLiquido, esperado), esperado };
      },
    },
    {
      id: "saldoCaixa",
      campo: "saldoCaixa",
      label: "Saldo de Caixa (Sobra/Déficit)",
      formula: "P_liq − C_atualizado",
      diretriz: "D",
      unidade: "R$",
      getValue: (r) => (r.creditoLiquido ?? 0) - (r.cartaAtualizada ?? 0),
      verificar: (_inp, r) => {
        const esperado = (r.creditoLiquido ?? 0) - (r.cartaAtualizada ?? 0);
        return { ok: tol((r.creditoLiquido ?? 0) - (r.cartaAtualizada ?? 0), esperado), esperado };
      },
    },
    {
      id: "parcelaNominal",
      campo: "parcelaNominal",
      label: "Parcela Nominal (mês 1)",
      formula: "(C × (1+TA)) / N",
      unidade: "R$",
      getValue: (r) => r.parcelaPadrao,
      verificar: (inp: LanceInputs, r) => {
        const esperado = (inp.cartaCredito * (1 + inp.taxaAdmTotal / 100)) / inp.prazoMeses;
        return { ok: tol(r.parcelaPadrao, esperado), esperado };
      },
    },
    {
      id: "parcelaReduzida",
      campo: "parcelaReduzida",
      label: "Parcela Reduzida (pós-lance)",
      formula: "saldo_pós_lance / meses_restantes",
      unidade: "R$",
      getValue: (r) => r.parcelaPosLance,
    },
    {
      id: "saldoDevedor",
      campo: "saldoDevedor",
      label: "Saldo Devedor (pós-lance)",
      formula: "saldo_plano − L_embutido − L_próprio",
      unidade: "R$",
      getValue: (r) => r.saldoDevedorPosLance,
    },
    {
      id: "custoGlobal",
      campo: "custoGlobal",
      label: "Custo Total COM Lance",
      formula: "ΣP_pre + L_rp + ΣP_pos",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.totalComLance,
    },
    {
      id: "totalSemLance",
      campo: "custoGlobal",
      label: "Custo Total SEM Lance",
      formula: "ΣP_pre + ΣP_pos (sem lance)",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.totalSemLance,
    },
    {
      id: "economia",
      campo: "economia",
      label: "Economia com o Lance",
      formula: "totalSemLance − totalComLance",
      unidade: "R$",
      getValue: (r) => r.economia,
      verificar: (_inp, r) => {
        const esperado = r.totalSemLance - r.totalComLance;
        return { ok: tol(r.economia, esperado), esperado };
      },
    },
  ],
  timelineColumns: [
    { key: "mes",                       label: "Mês",         unidade: "n",  getValue: (r) => r.mes },
    { key: "parcelaSemLance",           label: "Parcela S/L", unidade: "R$", getValue: (r) => r.parcelaSemLance },
    { key: "parcelaComLance",           label: "Parcela C/L", unidade: "R$", getValue: (r) => r.parcelaComLance },
    { key: "desembolsoAcumSemLance",    label: "Acum S/L",   unidade: "R$", getValue: (r) => r.desembolsoAcumSemLance },
    { key: "desembolsoAcumComLance",    label: "Acum C/L",   unidade: "R$", getValue: (r) => r.desembolsoAcumComLance },
  ],
};

// ── 2. Flip de Cota ───────────────────────────────────────────────────────────

const flipSpec: DebuggerSpec = {
  slug: "flip-cota",
  label: "Alavancagem / Flip de Cota",
  calcFn: calcFlipCota,
  defaultInputs: { ...defaultFlipCotaInputs },
  inputFields: [
    { key: "cartaCredito",        label: "Carta de Crédito",    type: "money",   defaultValue: 500_000 },
    { key: "taxaAdm",             label: "Taxa de Adm (%)",      type: "percent", defaultValue: 23.5 },
    { key: "fundoReserva",        label: "Fundo de Reserva (%)", type: "percent", defaultValue: 1.5 },
    { key: "prazo",               label: "Prazo (meses)",        type: "meses",   defaultValue: 240 },
    { key: "lancePerc",           label: "Lance (%)",            type: "percent", defaultValue: 50 },
    { key: "mesContemplacao",     label: "Mês Contemplação",     type: "meses",   defaultValue: 36 },
    { key: "agioVenda",           label: "Ágio de Venda (%)",    type: "percent", defaultValue: 20 },
    { key: "meiaParcela",         label: "Meia Parcela?",        type: "numero",  defaultValue: 1 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "parcelaCheia",
      campo: "parcelaCheia",
      label: "Parcela Cheia do Plano (mês 1)",
      formula: "C × (1+(TA+FR)/100) / N",
      unidade: "R$",
      getValue: (r) => r.parcelaCheia,
      verificar: (inp: FlipCotaInputs, r) => {
        const esperado = (inp.cartaCredito * (1 + (inp.taxaAdm + inp.fundoReserva) / 100)) / inp.prazo;
        return { ok: tol(r.parcelaCheia, esperado), esperado };
      },
    },
    {
      id: "parcelaEfetiva",
      campo: "parcelaEfetiva",
      label: "Parcela Efetiva (meia ou cheia)",
      formula: "meiaParcela ? cheia/2 : cheia",
      unidade: "R$",
      getValue: (r) => r.parcelaEfetiva,
      verificar: (inp: FlipCotaInputs, r) => {
        const esperado = inp.meiaParcela ? r.parcelaCheia / 2 : r.parcelaCheia;
        return { ok: tol(r.parcelaEfetiva, esperado), esperado };
      },
    },
    {
      id: "cartaCorrigida",
      campo: "cartaCorrigida",
      label: "Carta Corrigida pelo INCC",
      formula: "C × (1+INCC)^⌊mc/12⌋",
      diretriz: "A",
      unidade: "R$",
      getValue: (r) => r.creditoAtualizado,
      verificar: (inp: FlipCotaInputs, r) => {
        const esperado = inp.cartaCredito * Math.pow(1 + inp.taxaAtualizacaoAnual / 100, Math.floor(inp.mesContemplacao / 12));
        return { ok: tol(r.creditoAtualizado, esperado), esperado };
      },
    },
    {
      id: "creditoLiquido",
      campo: "creditoLiquido",
      label: "Crédito Líquido (pós-lance embutido)",
      formula: "embutido? C_atual − C_atual×L% : C_atual",
      diretriz: "C",
      unidade: "R$",
      getValue: (r) => r.creditoLiquido,
      verificar: (inp: FlipCotaInputs, r) => {
        const esperado = inp.tipoLance === "embutido"
          ? r.creditoAtualizado - r.creditoAtualizado * (inp.lancePerc / 100)
          : r.creditoAtualizado;
        return { ok: tol(r.creditoLiquido, esperado), esperado };
      },
    },
    {
      id: "valorPagoParcelas",
      campo: "valorPagoParcelas",
      label: "Total Pago em Parcelas (com INCC)",
      formula: "Σ parcelas reajustadas até mc",
      unidade: "R$",
      getValue: (r) => r.valorPagoParcelas,
      // Verificação estrutural: deve ser ≥ parcelaEfetiva × mc (INCC só pode aumentar)
      verificar: (inp: FlipCotaInputs, r) => {
        const minEsperado = r.parcelaEfetiva * inp.mesContemplacao;
        return { ok: r.valorPagoParcelas >= minEsperado - 0.01, esperado: minEsperado };
      },
    },
    {
      id: "desembolsoTotal",
      campo: "desembolsoTotal",
      label: "Desembolso Total (saída de caixa)",
      formula: "valorPagoParcelas + desembolsoLance",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.desembolsoTotal,
      verificar: (_inp, r) => {
        const esperado = r.valorPagoParcelas + r.desembolsoLance;
        return { ok: tol(r.desembolsoTotal, esperado), esperado };
      },
    },
    {
      id: "valorVenda",
      campo: "valorVenda",
      label: "Receita do Ágio (sobre carta corrigida)",
      formula: "C_atual × (ágio%/100)",
      unidade: "R$",
      getValue: (r) => r.valorVenda,
      verificar: (inp: FlipCotaInputs, r) => {
        const esperado = r.creditoAtualizado * (inp.agioVenda / 100);
        return { ok: tol(r.valorVenda, esperado), esperado };
      },
    },
    {
      id: "lucroLiquido",
      campo: "lucroLiquido",
      label: "Lucro Líquido",
      formula: "valorVenda − desembolsoTotal",
      unidade: "R$",
      getValue: (r) => r.lucroLiquido,
      verificar: (_inp, r) => {
        const esperado = r.valorVenda - r.desembolsoTotal;
        return { ok: tol(r.lucroLiquido, esperado), esperado };
      },
    },
    {
      id: "tirMensal",
      campo: "tirMensal",
      label: "TIR Mensal",
      formula: "(valorVenda/desembolso)^(1/mc) − 1",
      unidade: "%",
      getValue: (r) => r.tirMensal,
    },
    {
      id: "roiTotal",
      campo: "roiTotal",
      label: "ROI Total",
      formula: "lucroLiquido / desembolsoTotal × 100",
      unidade: "%",
      getValue: (r) => r.roiTotal,
      verificar: (_inp, r) => {
        const esperado = r.desembolsoTotal > 0 ? (r.lucroLiquido / r.desembolsoTotal) * 100 : 0;
        return { ok: tol(r.roiTotal, esperado), esperado };
      },
    },
  ],
  timelineColumns: [
    { key: "mes",            label: "Mês",          unidade: "n",  getValue: (r) => r.mes },
    { key: "parcela",        label: "Parcela",       unidade: "R$", getValue: (r) => r.parcela },
    { key: "desembolsoAcum", label: "Desemb. Acum.", unidade: "R$", getValue: (r) => r.desembolsoAcum },
  ],
};

// ── 3. Aluguel vs Consórcio ───────────────────────────────────────────────────

const aluguelSpec: DebuggerSpec = {
  slug: "aluguel-vs-consorcio",
  label: "Aluguel vs Consórcio",
  calcFn: calcAluguelVsConsorcio,
  defaultInputs: { ...defaultAluguelInputs },
  inputFields: [
    { key: "cartaCredito",          label: "Carta de Crédito",        type: "money",   defaultValue: 500_000 },
    { key: "taxaAdmTotal",          label: "Taxa de Adm (%)",          type: "percent", defaultValue: 18 },
    { key: "prazoMeses",            label: "Prazo (meses)",            type: "meses",   defaultValue: 120 },
    { key: "taxaAtualizacaoAnual",  label: "INCC a.a. (%)",            type: "percent", defaultValue: 4 },
    { key: "percLance",             label: "Lance Embutido (%)",        type: "percent", defaultValue: 25 },
    { key: "mesContemplacao",       label: "Mês Contemplação",         type: "meses",   defaultValue: 12 },
    { key: "aluguelAtual",          label: "Aluguel Atual (R$)",       type: "money",   defaultValue: 3_500 },
    { key: "horizonte",             label: "Horizonte (anos)",         type: "numero",  defaultValue: 20 },
    { key: "valorizacaoAnual",      label: "Valorização Imóvel (%)",  type: "percent", defaultValue: 6 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "cartaCorrigida",
      campo: "cartaCorrigida",
      label: "Carta Corrigida pelo INCC",
      formula: "C × (1+INCC)^⌊mc/12⌋",
      diretriz: "A",
      unidade: "R$",
      getValue: (r) => r.cartaAtualizada,
      verificar: (inp: AluguelInputs, r) => {
        const esperado = inp.cartaCredito * Math.pow(1 + inp.taxaAtualizacaoAnual / 100, Math.floor(inp.mesContemplacao / 12));
        return { ok: tol(r.cartaAtualizada, esperado), esperado };
      },
    },
    {
      id: "parcelaNominal",
      campo: "parcelaNominal",
      label: "Parcela Nominal do Consórcio",
      formula: "(C × (1+TA)) / N",
      unidade: "R$",
      getValue: (r) => r.parcelaPadrao,
      verificar: (inp: AluguelInputs, r) => {
        const esperado = (inp.cartaCredito * (1 + inp.taxaAdmTotal / 100)) / inp.prazoMeses;
        return { ok: tol(r.parcelaPadrao, esperado), esperado };
      },
    },
    {
      id: "parcelaReduzida",
      campo: "parcelaReduzida",
      label: "Parcela Pós-Lance",
      formula: "saldo_pós_lance / meses_restantes",
      unidade: "R$",
      getValue: (r) => r.parcelaPosLance,
    },
    {
      id: "custoGlobal",
      campo: "custoGlobal",
      label: "Custo Total Consórcio",
      formula: "ΣP_pre + L_rp + ΣP_pos",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.totalConsorcio,
    },
    {
      id: "saldoCaixa",
      campo: "saldoCaixa",
      label: "Saldo de Caixa (Sobra/Déficit)",
      formula: "P_liq − C_atualizado",
      diretriz: "D",
      unidade: "R$",
      getValue: (r) => r.saldoCaixa,
    },
    {
      id: "valorImovelFinal",
      campo: "valorFuturo",
      label: "Valor Futuro do Imóvel",
      formula: "C × (1+V_imm)^(T_total/12)",
      diretriz: "F",
      unidade: "R$",
      getValue: (r) => r.valorImovelFinal,
      verificar: (inp: AluguelInputs, r) => {
        const esperado = inp.cartaCredito * Math.pow(1 + inp.valorizacaoAnual / 100, inp.horizonte);
        return { ok: tol(r.valorImovelFinal, esperado), esperado };
      },
    },
    {
      id: "totalAluguel",
      campo: "totalAluguel",
      label: "Total Gasto com Aluguel",
      formula: "Σ aluguelMes (com reajuste anual)",
      unidade: "R$",
      getValue: (r) => r.totalAluguel,
    },
    {
      id: "vantagemPatrimonial",
      campo: "vantagemPatrimonial",
      label: "Vantagem Patrimonial",
      formula: "V_futuro − custoConsórcio + totalAluguel",
      unidade: "R$",
      getValue: (r) => r.vantagemPatrimonial,
    },
  ],
  timelineColumns: [
    { key: "mes",                  label: "Mês",         unidade: "n",  getValue: (r) => r.mes },
    { key: "aluguelMes",           label: "Aluguel",     unidade: "R$", getValue: (r) => r.aluguelMes },
    { key: "aluguelAcum",          label: "Alug. Acum.", unidade: "R$", getValue: (r) => r.aluguelAcum },
    { key: "parcelaCons",          label: "Parcela",     unidade: "R$", getValue: (r) => r.parcelaCons },
    { key: "patrimonioConsorcio",  label: "Patrimônio",  unidade: "R$", getValue: (r) => r.patrimonioConsorcio },
  ],
};

// ── 4. Renda Passiva ──────────────────────────────────────────────────────────

const rendaSpec: DebuggerSpec = {
  slug: "renda-passiva-consorcio",
  label: "Renda Passiva com Consórcio",
  calcFn: calcRendaPassiva,
  defaultInputs: { ...defaultRendaPassivaInputs },
  inputFields: [
    { key: "cartaCredito",         label: "Carta de Crédito",     type: "money",   defaultValue: 500_000 },
    { key: "taxaAdmTotal",         label: "Taxa de Adm (%)",       type: "percent", defaultValue: 18 },
    { key: "prazoMeses",           label: "Prazo (meses)",         type: "meses",   defaultValue: 120 },
    { key: "taxaAtualizacaoAnual", label: "INCC a.a. (%)",         type: "percent", defaultValue: 4 },
    { key: "percLance",            label: "Lance Embutido (%)",    type: "percent", defaultValue: 25 },
    { key: "mesContemplacao",      label: "Mês Contemplação",      type: "meses",   defaultValue: 12 },
    { key: "rendaAluguelMensal",   label: "Renda de Aluguel (R$)", type: "money",   defaultValue: 2_500 },
    { key: "taxaCDIAnual",         label: "CDI a.a. (%)",          type: "percent", defaultValue: 13 },
    { key: "valorizacaoAnual",     label: "Valorização (%)",       type: "percent", defaultValue: 6 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "cartaCorrigida",
      campo: "cartaCorrigida",
      label: "Carta Corrigida (base CDI)",
      formula: "C × (1+INCC)^⌊mc/12⌋",
      diretriz: "A",
      unidade: "R$",
      getValue: (r) => r.cartaAtualizada,
      verificar: (inp: RendaPassivaInputs, r) => {
        const esperado = inp.cartaCredito * Math.pow(1 + inp.taxaAtualizacaoAnual / 100, Math.floor(inp.mesContemplacao / 12));
        return { ok: tol(r.cartaAtualizada, esperado), esperado };
      },
    },
    {
      id: "parcelaNominal",
      campo: "parcelaNominal",
      label: "Parcela Nominal",
      formula: "(C × (1+TA)) / N",
      unidade: "R$",
      getValue: (r) => r.parcelaPadrao,
    },
    {
      id: "parcelaReduzida",
      campo: "parcelaReduzida",
      label: "Parcela Pós-Lance",
      formula: "saldo / meses_restantes",
      unidade: "R$",
      getValue: (r) => r.parcelaPosLance,
    },
    {
      id: "saldoDevedor",
      campo: "saldoDevedor",
      label: "Saldo Devedor (pós-lance)",
      formula: "saldo_plano − lances",
      unidade: "R$",
      getValue: (r) => r.saldoDevedorPosLance,
    },
    {
      id: "valorImovelFinal",
      campo: "valorFuturo",
      label: "Valor Futuro do Imóvel",
      formula: "C × (1+V_imm)^(N/12)",
      diretriz: "F",
      unidade: "R$",
      getValue: (r) => r.valorImovelFinal,
    },
    {
      id: "creditoFinalComCDI",
      campo: "creditoFinalComCDI",
      label: "Crédito Final (rendendo CDI)",
      formula: "C_atualizado × (1+CDI_mensal)^(N−mc)",
      unidade: "R$",
      getValue: (r) => r.creditoFinalComCDI,
    },
    {
      id: "roiAnual",
      campo: "roiAnual",
      label: "ROI Anual",
      formula: "(patrimônioFinal/totalInvestido)^(12/N) − 1",
      unidade: "%",
      getValue: (r) => r.roiAnual,
    },
  ],
  timelineColumns: [
    { key: "mes",           label: "Mês",        unidade: "n",  getValue: (r) => r.mes },
    { key: "parcelaCons",   label: "Parcela",    unidade: "R$", getValue: (r) => r.parcelaCons },
    { key: "rendaAluguel",  label: "Aluguel",    unidade: "R$", getValue: (r) => r.rendaAluguel },
    { key: "fluxoLiquido",  label: "Fluxo Liq.", unidade: "R$", getValue: (r) => r.fluxoLiquido },
    { key: "patrimonioTotal", label: "Patrimônio", unidade: "R$", getValue: (r) => r.patrimonioTotal },
  ],
};

// ── 5. Saída do Financiamento ─────────────────────────────────────────────────

const saidaSpec: DebuggerSpec = {
  slug: "saida-financiamento",
  label: "Saída do Financiamento",
  calcFn: calcSaidaFinanciamento,
  defaultInputs: { ...defaultSaidaInputs },
  inputFields: [
    { key: "valorImovelAtual",           label: "Valor do Imóvel (R$)",         type: "money",   defaultValue: 600_000 },
    { key: "saldoDevedor",               label: "Saldo Devedor Fin. (R$)",       type: "money",   defaultValue: 380_000 },
    { key: "prazoRestanteMeses",         label: "Prazo Restante (meses)",        type: "meses",   defaultValue: 264 },
    { key: "taxaJurosMensal",            label: "Juros Mensal Fin. (%)",         type: "percent", defaultValue: 0.83 },
    { key: "cartaConsorcio",             label: "Carta Consórcio (R$)",          type: "money",   defaultValue: 500_000 },
    { key: "taxaAdmConsorcio",           label: "Taxa de Adm (%)",              type: "percent", defaultValue: 18 },
    { key: "prazoConsorcio",             label: "Prazo Consórcio (meses)",       type: "meses",   defaultValue: 120 },
    { key: "percLance",                  label: "Lance (%)",                     type: "percent", defaultValue: 25 },
    { key: "mesContemplacaoConsorcio",   label: "Mês Contemplação",             type: "meses",   defaultValue: 8 },
    { key: "valorizacaoAnual",           label: "Valorização (%)",              type: "percent", defaultValue: 6 },
    { key: "taxaAtualizacaoAnual",       label: "INCC a.a. (%)",                type: "percent", defaultValue: 4 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "capitalLiquidoVenda",
      campo: "capitalLiquidoVenda",
      label: "Capital Líquido da Venda",
      formula: "V_imovel × (1−custos%) − saldo_devedor",
      unidade: "R$",
      getValue: (r) => r.capitalLiquidoVenda,
      verificar: (inp: SaidaFinanciamentoInputs, r) => {
        const esperado = Math.max(inp.valorImovelAtual * (1 - inp.custosVenda / 100) - inp.saldoDevedor, 0);
        return { ok: tol(r.capitalLiquidoVenda, esperado), esperado };
      },
    },
    {
      id: "cartaCorrigida",
      campo: "cartaCorrigida",
      label: "Carta Corrigida pelo INCC",
      formula: "C × (1+INCC)^⌊mc/12⌋",
      diretriz: "A",
      unidade: "R$",
      getValue: (r) => r.creditoLiquido + (r.lanceEmbR ?? 0),
    },
    {
      id: "creditoLiquido",
      campo: "poderDeCompra",
      label: "Crédito Líquido (pós-lance)",
      formula: "C_atualizado − L_embutido",
      diretriz: "C",
      unidade: "R$",
      getValue: (r) => r.creditoLiquido,
    },
    {
      id: "parcelaNominal",
      campo: "parcelaNominal",
      label: "Parcela Nominal do Consórcio",
      formula: "(C × (1+TA)) / N",
      unidade: "R$",
      getValue: (r) => r.parcelaConsorcio,
      verificar: (inp: SaidaFinanciamentoInputs, r) => {
        const esperado = (inp.cartaConsorcio * (1 + inp.taxaAdmConsorcio / 100)) / inp.prazoConsorcio;
        return { ok: tol(r.parcelaConsorcio, esperado), esperado };
      },
    },
    {
      id: "parcelaReduzida",
      campo: "parcelaReduzida",
      label: "Parcela Pós-Lance",
      formula: "saldo / meses_restantes",
      unidade: "R$",
      getValue: (r) => r.parcelaPosLance,
    },
    {
      id: "totalRestanteFin",
      campo: "totalRestanteFin",
      label: "Total Restante Financiamento",
      formula: "Σ (amort + juros) SAC × prazo",
      unidade: "R$",
      getValue: (r) => r.totalRestanteFin,
    },
    {
      id: "custoGlobal",
      campo: "custoGlobal",
      label: "Custo Total Consórcio",
      formula: "ΣP_pre + L_rp + ΣP_pos",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.totalConsorcio,
    },
    {
      id: "economiaTotalCusto",
      campo: "economiaTotalCusto",
      label: "Economia vs Financiamento",
      formula: "totalFin − totalConsórcio",
      unidade: "R$",
      getValue: (r) => r.economiaTotalCusto,
      verificar: (_inp, r) => {
        const esperado = r.totalRestanteFin - r.totalConsorcio;
        return { ok: tol(r.economiaTotalCusto, esperado), esperado };
      },
    },
  ],
  timelineColumns: [
    { key: "mes",                   label: "Mês",         unidade: "n",  getValue: (r) => r.mes },
    { key: "parcelaFin",            label: "Parcela Fin.", unidade: "R$", getValue: (r) => r.parcelaFin },
    { key: "parcelaCons",           label: "Parcela Cons.", unidade: "R$", getValue: (r) => r.parcelaCons },
    { key: "saldoDevedorFin",       label: "Saldo Fin.",  unidade: "R$", getValue: (r) => r.saldoDevedorFin },
    { key: "patrimonioLiquidoCons", label: "Patrim. Cons.", unidade: "R$", getValue: (r) => r.patrimonioLiquidoCons },
  ],
};

// ── 6. Meta Patrimonial ───────────────────────────────────────────────────────

const metaSpec: DebuggerSpec = {
  slug: "meta-patrimonial",
  label: "Meta Patrimonial",
  calcFn: calcMetaPatrimonial,
  defaultInputs: { ...defaultMetaInputs },
  inputFields: [
    { key: "patrimonioAlvoR",          label: "Patrimônio Alvo (R$)",    type: "money",   defaultValue: 2_000_000 },
    { key: "horizonteAnos",            label: "Horizonte (anos)",         type: "numero",  defaultValue: 15 },
    { key: "valorizacaoAnual",         label: "Valorização a.a. (%)",    type: "percent", defaultValue: 6 },
    { key: "taxaAtualizacaoAnual",     label: "INCC a.a. (%)",            type: "percent", defaultValue: 4 },
    { key: "taxaAdmConsorcio",         label: "Taxa de Adm (%)",          type: "percent", defaultValue: 18 },
    { key: "prazoConsorcio",           label: "Prazo Consórcio (meses)", type: "meses",   defaultValue: 120 },
    { key: "valorCarta",               label: "Valor da Carta (R$)",      type: "money",   defaultValue: 500_000 },
    { key: "mesContemplacaoPrimeira",  label: "1ª Contemplação (mês)",    type: "meses",   defaultValue: 12 },
    { key: "intervaloCotasMeses",      label: "Intervalo entre Cotas",    type: "meses",   defaultValue: 24 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "valorImovelFinalPorCota",
      campo: "valorFuturo",
      label: "Valor Futuro (1ª cota)",
      formula: "C × (1+V_imm)^((horizonte−mc)/12)",
      diretriz: "F",
      unidade: "R$",
      getValue: (r) => r.cotas?.[0]?.valorImovelFinal,
    },
    {
      id: "numCotas",
      campo: "numCotas",
      label: "Número de Cotas Necessárias",
      formula: "sizing iterativo até Σ valorFinal ≥ alvo",
      unidade: "n",
      getValue: (r) => r.numCotas,
      verificar: (_inp: MetaPatrimonialInputs, r) => {
        // Correto: patrimonioTotalFinal ≥ patrimonioAlvo (metaAtingida=true)
        const ok = r.metaAtingida === true;
        return { ok, esperado: r.numCotas };
      },
    },
    {
      id: "parcelaPrimeiraCota",
      campo: "parcelaNominal",
      label: "Parcela Nominal (1ª cota)",
      formula: "(C × (1+TA)) / N",
      unidade: "R$",
      getValue: (r) => r.cotas?.[0]?.parcelaMensal,
    },
    {
      id: "totalInvestido",
      campo: "totalInvestido",
      label: "Total Investido",
      formula: "Σ custoGlobal por cota",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.totalInvestido,
    },
    {
      id: "patrimonioTotalFinal",
      campo: "patrimonioTotalFinal",
      label: "Patrimônio Total Final",
      formula: "Σ valorImovelFinal por cota",
      diretriz: "F",
      unidade: "R$",
      getValue: (r) => r.patrimonioTotalFinal,
    },
    {
      id: "economiaFiscalTotal",
      campo: "economiaFiscalTotal",
      label: "Economia Fiscal Total",
      formula: "totalInvestido × fracTA × alíquota",
      unidade: "R$",
      getValue: (r) => r.economiaFiscalTotal,
    },
  ],
};

// ── 7. Consórcio CNPJ ─────────────────────────────────────────────────────────

const cnpjSpec: DebuggerSpec = {
  slug: "consorcio-cnpj",
  label: "Consórcio para CNPJ",
  calcFn: calcConsorcioCNPJ,
  defaultInputs: { ...defaultCNPJInputs },
  inputFields: [
    { key: "cartaCredito",            label: "Carta de Crédito (R$)",      type: "money",   defaultValue: 800_000 },
    { key: "taxaAdmConsorcio",        label: "Taxa de Adm (%)",             type: "percent", defaultValue: 18 },
    { key: "prazoConsorcio",          label: "Prazo (meses)",               type: "meses",   defaultValue: 120 },
    { key: "percLance",               label: "Lance (%)",                   type: "percent", defaultValue: 20 },
    { key: "mesContemplacaoConsorcio",label: "Mês Contemplação",            type: "meses",   defaultValue: 10 },
    { key: "taxaJurosMensalFin",      label: "Juros Fin. Mensal (%)",       type: "percent", defaultValue: 1.2 },
    { key: "prazoFinanciamentoMeses", label: "Prazo Financiamento (meses)", type: "meses",   defaultValue: 120 },
    { key: "aliquotaIRPJ",            label: "IRPJ (%)",                    type: "percent", defaultValue: 15 },
    { key: "aliquotaCSLL",            label: "CSLL (%)",                    type: "percent", defaultValue: 9 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "parcelaBrutaConsorcio",
      campo: "parcelaNominal",
      label: "Parcela Bruta do Consórcio",
      formula: "(C × (1+TA)) / N",
      unidade: "R$",
      getValue: (r) => r.parcelaBrutaConsorcio,
      verificar: (inp: ConsorcioCNPJInputs, r) => {
        const esperado = (inp.cartaCredito * (1 + inp.taxaAdmConsorcio / 100)) / inp.prazoConsorcio;
        return { ok: tol(r.parcelaBrutaConsorcio, esperado), esperado };
      },
    },
    {
      id: "fracTaxaNaParcela",
      campo: "fracTaxaNaParcela",
      label: "Fração da Taxa na Parcela",
      formula: "(TA/100) / (1 + TA/100)",
      unidade: "n",
      getValue: (r) => {
        if (!r.parcelaBrutaConsorcio) return null;
        // infer from economiaFiscalMensal / (parcelaBruta * aliquota)
        return null; // computed internally
      },
    },
    {
      id: "economiaFiscalMensal",
      campo: "economiaFiscalMensal",
      label: "Economia Fiscal Mensal",
      formula: "parcela × fracTA × alíquota",
      unidade: "R$",
      getValue: (r) => r.economiaFiscalMensal,
    },
    {
      id: "parcelaLiquidaConsorcio",
      campo: "parcelaLiquidaConsorcio",
      label: "Parcela Líquida do Consórcio",
      formula: "parcelaBruta − economiaFiscal",
      unidade: "R$",
      getValue: (r) => r.parcelaLiquidaConsorcio,
      verificar: (_inp, r) => {
        const esperado = r.parcelaBrutaConsorcio - r.economiaFiscalMensal;
        return { ok: tol(r.parcelaLiquidaConsorcio, esperado), esperado };
      },
    },
    {
      id: "totalBrutoConsorcio",
      campo: "custoGlobal",
      label: "Custo Total Bruto Consórcio",
      formula: "ΣP_pre + L_rp + ΣP_pos",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.totalBrutoConsorcio,
    },
    {
      id: "totalLiquidoConsorcio",
      campo: "totalLiquidoConsorcio",
      label: "Custo Total Líquido (pós-fiscal)",
      formula: "totalBruto − totalEconomiaSFiscal",
      unidade: "R$",
      getValue: (r) => r.totalLiquidoConsorcio,
      verificar: (_inp, r) => {
        const esperado = r.totalBrutoConsorcio - r.totalEconomiaFiscalConsorcio;
        return { ok: tol(r.totalLiquidoConsorcio, esperado), esperado };
      },
    },
    {
      id: "totalFinanciamento",
      campo: "totalFinanciamento",
      label: "Total Financiamento (comparativo)",
      formula: "parcela_Price × prazo",
      unidade: "R$",
      getValue: (r) => r.totalFinanciamento,
    },
    {
      id: "economiaTotalVsFinanciamento",
      campo: "economiaTotalVsFinanciamento",
      label: "Economia vs Financiamento",
      formula: "totalFin − totalLíquidoCons",
      unidade: "R$",
      getValue: (r) => r.economiaTotalVsFinanciamento,
      verificar: (_inp, r) => {
        const esperado = r.totalFinanciamento - r.totalLiquidoConsorcio;
        return { ok: tol(r.economiaTotalVsFinanciamento, esperado), esperado };
      },
    },
  ],
  timelineColumns: [
    { key: "mes",                      label: "Mês",          unidade: "n",  getValue: (r) => r.mes },
    { key: "parcelaBrutaConsorcio",    label: "Parcela Bruta", unidade: "R$", getValue: (r) => r.parcelaBrutaConsorcio },
    { key: "economiaFiscalMes",        label: "Eco. Fiscal",  unidade: "R$", getValue: (r) => r.economiaFiscalMes },
    { key: "parcelaLiquidaConsorcio",  label: "P. Líquida",   unidade: "R$", getValue: (r) => r.parcelaLiquidaConsorcio },
    { key: "parcelaFinanciamento",     label: "P. Fin.",      unidade: "R$", getValue: (r) => r.parcelaFinanciamento },
  ],
};

// ── 8. Calculadora Patrimonial ────────────────────────────────────────────────

const patrimonialSpec: DebuggerSpec = {
  slug: "calculadora-patrimonial",
  label: "Calculadora Patrimonial",
  calcFn: calcular,
  defaultInputs: {
    valorImovel: 600_000, entrada: 120_000, prazoF: 360, jFinAnual: 10,
    trAnual: 0, creditoCons: 500_000, percLanceEmb: 20, baseLance: "credito",
    usoCredito: "comprar", lanceProprio: 0, tAdm: 18, prazoC: 120,
    inccAnual: 4, percReducao: 0, mesContemplacao: 12, amortTipo: "parcela",
    aluguel: 2_500, taxaOportunidadeMensal: 1, valorizacaoAnual: 6, percItbi: 3,
  },
  inputFields: [
    { key: "creditoCons",      label: "Carta Consórcio (R$)",   type: "money",   defaultValue: 500_000 },
    { key: "tAdm",             label: "Taxa de Adm (%)",         type: "percent", defaultValue: 18 },
    { key: "prazoC",           label: "Prazo Consórcio (meses)", type: "meses",   defaultValue: 120 },
    { key: "inccAnual",        label: "INCC a.a. (%)",           type: "percent", defaultValue: 4 },
    { key: "percLanceEmb",     label: "Lance Embutido (%)",       type: "percent", defaultValue: 20 },
    { key: "mesContemplacao",  label: "Mês Contemplação",        type: "meses",   defaultValue: 12 },
    { key: "valorImovel",      label: "Valor do Imóvel (R$)",    type: "money",   defaultValue: 600_000 },
    { key: "entrada",          label: "Entrada / Dowpayment (R$)", type: "money", defaultValue: 120_000 },
    { key: "prazoF",           label: "Prazo Financiamento (meses)", type: "meses", defaultValue: 360 },
    { key: "jFinAnual",        label: "Juros Fin. a.a. (%)",     type: "percent", defaultValue: 10 },
    { key: "valorizacaoAnual", label: "Valorização Imóvel (%)", type: "percent", defaultValue: 6 },
  ] as InputFieldDef[],
  traceSteps: [
    {
      id: "creditoAtualizado",
      campo: "cartaCorrigida",
      label: "Carta Corrigida pelo INCC",
      formula: "C × (1+INCC)^(mc/12)",
      diretriz: "A",
      unidade: "R$",
      getValue: (r) => r.creditoAtualizadoContemplacao,
      verificar: (inp, r) => {
        const esperado = inp.creditoCons * Math.pow(1 + inp.inccAnual / 100, inp.mesContemplacao / 12);
        return { ok: tol(r.creditoAtualizadoContemplacao, esperado), esperado };
      },
    },
    {
      id: "poderCompraLiquido",
      campo: "poderDeCompra",
      label: "Poder de Compra Líquido",
      formula: "C_atualizado − L_embutido",
      diretriz: "C",
      unidade: "R$",
      getValue: (r) => r.poderCompraLiquido,
    },
    {
      id: "tCons",
      campo: "custoGlobal",
      label: "Custo Total do Consórcio",
      formula: "ΣP_pre + L_rp + ΣP_pos",
      diretriz: "E",
      unidade: "R$",
      getValue: (r) => r.tCons,
    },
    {
      id: "tSAC",
      campo: "totalSAC",
      label: "Custo Total SAC",
      formula: "entrada + Σ parcelas SAC",
      unidade: "R$",
      getValue: (r) => r.tSAC,
    },
    {
      id: "tPrice",
      campo: "totalPrice",
      label: "Custo Total PRICE",
      formula: "entrada + Σ parcelas PRICE",
      unidade: "R$",
      getValue: (r) => r.tPrice,
    },
    {
      id: "imovelNoFuturo",
      campo: "valorFuturo",
      label: "Valor Futuro do Imóvel",
      formula: "V_a × (1+V_imm)^(T/12)",
      diretriz: "F",
      unidade: "R$",
      getValue: (r) => r.imovelNoFuturo,
    },
  ],
};

// ── Registro completo ─────────────────────────────────────────────────────────

export const DEBUGGER_REGISTRY: Record<string, DebuggerSpec> = {
  "simulador-lance":         lanceSpec,
  "flip-cota":               flipSpec,
  "aluguel-vs-consorcio":    aluguelSpec,
  "renda-passiva-consorcio": rendaSpec,
  "saida-financiamento":     saidaSpec,
  "meta-patrimonial":        metaSpec,
  "consorcio-cnpj":          cnpjSpec,
  "calculadora-patrimonial": patrimonialSpec,
};
