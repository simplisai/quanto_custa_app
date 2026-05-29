// ─── Simulador: Consórcio para CNPJ ──────────────────────────────────────────
// Mostra o benefício fiscal da PJ: parcelas dedutíveis como despesa operacional,
// reduzindo IRPJ/CSLL e o custo real da operação.
// Compara consórcio PJ vs. financiamento PJ (com juros + IOF).

import { simularConsorcio } from "./consorcio-core";

export type RegimeTributario = "presumido" | "real";

export interface ConsorcioCNPJInputs {
  // Consórcio
  cartaCredito: number;          // Valor da carta de crédito (R$)
  taxaAdmConsorcio: number;      // Taxa de administração total (%)
  prazoConsorcio: number;        // Prazo do grupo (meses)
  percLance: number;             // Lance ofertado (% da carta)
  mesContemplacaoConsorcio: number;

  // Financiamento PJ (comparativo)
  taxaJurosMensalFin: number;    // Taxa de juros mensal do financiamento PJ (% a.m.)
  prazoFinanciamentoMeses: number;

  // Fiscal PJ
  regimeTributario: RegimeTributario;
  aliquotaIRPJ: number;          // Alíquota IRPJ (% — ex: 15 + 10 adicional = 25%)
  aliquotaCSLL: number;          // Alíquota CSLL (% — ex: 9%)
  lucroMensalEmpresa: number;    // Lucro mensal da empresa (R$) para simular base tributável

  // Premissas
  valorizacaoAnual: number;      // Valorização anual do bem (%)
  taxaAtualizacaoAnual?: number; // Atualização anual da carta pelo INCC (% a.a.) — default 4
}

export interface CNPJMesData {
  mes: number;
  parcelaBrutaConsorcio: number;
  economiaFiscalMes: number;
  parcelaLiquidaConsorcio: number;
  parcelaFinanciamento: number;
  saldoDevedorFin: number;
}

export interface ConsorcioCNPJResults {
  // Consórcio PJ
  parcelaBrutaConsorcio: number;
  parcelaBrutaPosLance: number;
  economiaFiscalMensal: number;   // Dedução × alíquota efetiva
  parcelaLiquidaConsorcio: number; // Pós dedução fiscal
  parcelaLiquidaPosLance: number;
  totalBrutoConsorcio: number;
  totalEconomiaFiscalConsorcio: number;
  totalLiquidoConsorcio: number;

  // Financiamento PJ
  parcelaFinanciamento: number;
  totalFinanciamento: number;
  totalJurosFinanciamento: number;

  // Comparativos
  economiaTotalVsFinanciamento: number;
  percentualEconomia: number;
  aliquotaEfetivaTotal: number;   // IRPJ + CSLL (alíquota de dedução; 0 no presumido)

  // Regime fiscal
  regimeTributario: RegimeTributario;
  beneficioFiscalAtivo: boolean;  // true só no Lucro Real (há abatimento de imposto)
  percentualPatrocinadoEstado: number; // % do custo da taxa que o Estado "paga" (Lucro Real)

  // Patrimônio
  valorBemFinalConsorcio: number;
  valorBemFinalFinanciamento: number;

  // Timeline
  timeline: CNPJMesData[];
}

export const defaultCNPJInputs: ConsorcioCNPJInputs = {
  cartaCredito: 800_000,
  taxaAdmConsorcio: 18,
  prazoConsorcio: 120,
  percLance: 20,
  mesContemplacaoConsorcio: 10,
  taxaJurosMensalFin: 1.2,        // ~15% a.a. (crédito imobiliário PJ)
  prazoFinanciamentoMeses: 120,
  regimeTributario: "presumido",
  aliquotaIRPJ: 15,
  aliquotaCSLL: 9,
  lucroMensalEmpresa: 50_000,
  valorizacaoAnual: 6,
  taxaAtualizacaoAnual: 4,
};

export function calcConsorcioCNPJ(i: ConsorcioCNPJInputs): ConsorcioCNPJResults {
  const {
    cartaCredito, taxaAdmConsorcio, prazoConsorcio,
    percLance, mesContemplacaoConsorcio,
    taxaJurosMensalFin, prazoFinanciamentoMeses,
    regimeTributario,
    aliquotaIRPJ, aliquotaCSLL,
    valorizacaoAnual,
  } = i;

  const taxaJurosFrac = taxaJurosMensalFin / 100;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;
  const inccAnual = i.taxaAtualizacaoAnual ?? 4;

  // ── Regime fiscal ────────────────────────────────────────────────────────
  // Lucro Real: taxa adm + seguros são despesa operacional dedutível → abate
  //   IRPJ + CSLL (Estado "patrocina" até ~34% do custo da taxa).
  // Lucro Presumido: imposto incide sobre faturamento → NÃO há dedução direta.
  //   O benefício é de caixa/balanço (SCR intocado), economia fiscal = 0.
  const beneficioFiscalAtivo = regimeTributario === "real";
  const aliquotaEfetivaTotal = beneficioFiscalAtivo ? aliquotaIRPJ + aliquotaCSLL : 0; // %
  const aliquotaFrac = aliquotaEfetivaTotal / 100;

  // ── Consórcio PJ (núcleo: parcela derivada do crédito atualizado pelo INCC) ──
  const sim = simularConsorcio({
    credito: cartaCredito,
    taxaAdm: taxaAdmConsorcio,
    prazo: prazoConsorcio,
    inccAnual,
    mesContemplacao: mesContemplacaoConsorcio,
    lanceEmbutidoPerc: percLance,
    abatimentoEmbutido: "saldoDevedor",
    amortizacao: "parcela",
  });

  const parcelaBrutaConsorcio = sim.parcelaInicial;
  const parcelaBrutaPosLance = sim.parcelaPosLance;
  const lanceR = cartaCredito * (percLance / 100);
  const prazoPos = Math.max(prazoConsorcio - mesContemplacaoConsorcio, 0);

  // A dedução fiscal incide apenas sobre a TAXA DE ADMINISTRAÇÃO embutida na
  // parcela (parte que é despesa operacional), não sobre a amortização do bem.
  const fracTaxaNaParcela = taxaAdmConsorcio / (100 + taxaAdmConsorcio);
  const economiaFiscalMensal = parcelaBrutaConsorcio * fracTaxaNaParcela * aliquotaFrac;
  const economiaFiscalPosLance = parcelaBrutaPosLance * fracTaxaNaParcela * aliquotaFrac;
  const parcelaLiquidaConsorcio = parcelaBrutaConsorcio - economiaFiscalMensal;
  const parcelaLiquidaPosLance = parcelaBrutaPosLance - economiaFiscalPosLance;

  // Totais reais a partir da timeline reajustada
  const totalBrutoConsorcio = sim.desembolsoTotal;

  // Economia fiscal total = soma da economia mês a mês (parte taxa adm × alíquota)
  const totalEconomiaFiscalConsorcio = beneficioFiscalAtivo
    ? sim.timeline.reduce((acc, t) => acc + t.parcela * fracTaxaNaParcela * aliquotaFrac, 0)
    : 0;

  const totalLiquidoConsorcio = totalBrutoConsorcio - totalEconomiaFiscalConsorcio;

  // % do custo da taxa de administração que o Estado "patrocina" via dedução
  const percentualPatrocinadoEstado = beneficioFiscalAtivo ? aliquotaEfetivaTotal : 0;

  // ── Financiamento PJ ───────────────────────────────────────────────────────
  // Price simplificado
  const prazoFin = Math.max(prazoFinanciamentoMeses, 1);
  const coefPrice =
    taxaJurosFrac > 0
      ? (taxaJurosFrac * Math.pow(1 + taxaJurosFrac, prazoFin)) /
        (Math.pow(1 + taxaJurosFrac, prazoFin) - 1)
      : 1 / prazoFin;
  const parcelaFinanciamento = cartaCredito * coefPrice;
  const totalFinanciamento = parcelaFinanciamento * prazoFin;
  const totalJurosFinanciamento = totalFinanciamento - cartaCredito;

  // ── Comparativos ───────────────────────────────────────────────────────────
  const prazoAnalise = Math.max(prazoConsorcio, prazoFin);
  const economiaTotalVsFinanciamento = totalFinanciamento - totalLiquidoConsorcio;
  const percentualEconomia =
    totalFinanciamento > 0 ? (economiaTotalVsFinanciamento / totalFinanciamento) * 100 : 0;

  // Patrimônio final
  const valorBemFinalConsorcio =
    cartaCredito * Math.pow(1 + valorizMensal, prazoAnalise - mesContemplacaoConsorcio);
  const valorBemFinalFinanciamento =
    cartaCredito * Math.pow(1 + valorizMensal, prazoAnalise);

  // ── Timeline ───────────────────────────────────────────────────────────────
  const timeline: CNPJMesData[] = [];
  let saldoDevedorFin = cartaCredito;
  const amortizacaoFin = cartaCredito / prazoFin;

  const prazoTL = Math.min(prazoAnalise, 240);
  for (let m = 1; m <= prazoTL; m++) {
    // Parcela do consórcio do núcleo (reajustada pelo INCC)
    const parcelaMesCons = sim.timeline[m - 1]?.parcela ?? 0;
    const economiaFiscalMes = parcelaMesCons * fracTaxaNaParcela * aliquotaFrac;
    const parcelaLiquidaMes = parcelaMesCons - economiaFiscalMes;

    // Financiamento: juros sobre saldo + amortização
    const jurosMes = saldoDevedorFin * taxaJurosFrac;
    const parcelaFinMes = m <= prazoFin ? amortizacaoFin + jurosMes : 0;
    saldoDevedorFin = Math.max(saldoDevedorFin - amortizacaoFin, 0);

    timeline.push({
      mes: m,
      parcelaBrutaConsorcio: parcelaMesCons,
      economiaFiscalMes,
      parcelaLiquidaConsorcio: parcelaLiquidaMes,
      parcelaFinanciamento: parcelaFinMes,
      saldoDevedorFin,
    });
  }

  return {
    parcelaBrutaConsorcio,
    parcelaBrutaPosLance,
    economiaFiscalMensal,
    parcelaLiquidaConsorcio,
    parcelaLiquidaPosLance,
    totalBrutoConsorcio,
    totalEconomiaFiscalConsorcio,
    totalLiquidoConsorcio,
    parcelaFinanciamento,
    totalFinanciamento,
    totalJurosFinanciamento,
    economiaTotalVsFinanciamento,
    percentualEconomia,
    aliquotaEfetivaTotal,
    regimeTributario,
    beneficioFiscalAtivo,
    percentualPatrocinadoEstado,
    valorBemFinalConsorcio,
    valorBemFinalFinanciamento,
    timeline,
  };
}
