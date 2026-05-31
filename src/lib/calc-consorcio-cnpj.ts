// ─── Simulador: Consórcio para CNPJ ──────────────────────────────────────────
// Fonte única de verdade: simularConsorcio() mensal.
// Regime Tributário:
//   Lucro Real    → taxa adm é despesa operacional dedutível (abate IRPJ+CSLL).
//   Lucro Presumido → imposto sobre faturamento; sem dedução direta.

import {
  simularConsorcio,
  parcelaPrice,
  valorFuturo,
} from "./consorcio-core";

export type RegimeTributario = "presumido" | "real";

export interface ConsorcioCNPJInputs {
  cartaCredito: number;
  taxaAdmConsorcio: number;
  prazoConsorcio: number;
  percLance: number;
  mesContemplacaoConsorcio: number;
  taxaJurosMensalFin: number;
  prazoFinanciamentoMeses: number;
  regimeTributario: RegimeTributario;
  aliquotaIRPJ: number;
  aliquotaCSLL: number;
  lucroMensalEmpresa: number;
  valorizacaoAnual: number;
  taxaAtualizacaoAnual?: number;
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
  parcelaBrutaConsorcio: number;
  parcelaBrutaPosLance: number;
  economiaFiscalMensal: number;
  parcelaLiquidaConsorcio: number;
  parcelaLiquidaPosLance: number;
  totalBrutoConsorcio: number;
  totalEconomiaFiscalConsorcio: number;
  totalLiquidoConsorcio: number;
  parcelaFinanciamento: number;
  totalFinanciamento: number;
  totalJurosFinanciamento: number;
  economiaTotalVsFinanciamento: number;
  percentualEconomia: number;
  aliquotaEfetivaTotal: number;
  regimeTributario: RegimeTributario;
  beneficioFiscalAtivo: boolean;
  percentualPatrocinadoEstado: number;
  valorBemFinalConsorcio: number;
  valorBemFinalFinanciamento: number;
  timeline: CNPJMesData[];
}

export const defaultCNPJInputs: ConsorcioCNPJInputs = {
  cartaCredito: 800_000,
  taxaAdmConsorcio: 18,
  prazoConsorcio: 120,
  percLance: 20,
  mesContemplacaoConsorcio: 10,
  taxaJurosMensalFin: 1.2,
  prazoFinanciamentoMeses: 120,
  regimeTributario: "presumido",
  aliquotaIRPJ: 15,
  aliquotaCSLL: 9,
  lucroMensalEmpresa: 50_000,
  valorizacaoAnual: 6,
  taxaAtualizacaoAnual: 4,
};

export function calcConsorcioCNPJ(i: ConsorcioCNPJInputs): ConsorcioCNPJResults {
  const jFrac = i.taxaJurosMensalFin / 100;
  const vAnual = i.valorizacaoAnual / 100;
  const N = Math.max(i.prazoConsorcio, 1);
  const mc = Math.min(Math.max(i.mesContemplacaoConsorcio, 1), N);
  const inccAnual = i.taxaAtualizacaoAnual ?? 4;

  // Regime fiscal
  const beneficioFiscalAtivo = i.regimeTributario === "real";
  const aliquotaEfetivaTotal = beneficioFiscalAtivo ? i.aliquotaIRPJ + i.aliquotaCSLL : 0;
  const alphaFrac = aliquotaEfetivaTotal / 100;
  const percentualPatrocinadoEstado = aliquotaEfetivaTotal;

  // ── Simulação mensal do consórcio ────────────────────────────────────────
  const sim = simularConsorcio({
    credito:           i.cartaCredito,
    taxaAdm:           i.taxaAdmConsorcio,
    prazo:             N,
    inccAnual,
    mesContemplacao:   mc,
    lanceEmbutidoPerc: i.percLance,
    amortizacao:       "parcela",
  });

  const parcelaBrutaConsorcio = sim.parcelaNominal;
  const parcelaBrutaPosLance  = sim.parcelaReduzida;
  const fracTaxaNaParcela = (i.taxaAdmConsorcio / 100) / (1 + i.taxaAdmConsorcio / 100);

  // Economia fiscal: dedução sobre a parte de taxa de adm embutida na parcela
  const economiaFiscalMensal   = parcelaBrutaConsorcio * fracTaxaNaParcela * alphaFrac;
  const economiaFiscalPosLance = parcelaBrutaPosLance  * fracTaxaNaParcela * alphaFrac;
  const parcelaLiquidaConsorcio = parcelaBrutaConsorcio - economiaFiscalMensal;
  const parcelaLiquidaPosLance  = parcelaBrutaPosLance  - economiaFiscalPosLance;

  // Totais da timeline (fonte única)
  const totalBrutoConsorcio = sim.totalPagamentos; // custo total ao longo do plano
  const totalEconomiaFiscalConsorcio = beneficioFiscalAtivo
    ? sim.timeline.reduce((acc, t) => acc + t.parcela * fracTaxaNaParcela * alphaFrac, 0)
    : 0;
  const totalLiquidoConsorcio = totalBrutoConsorcio - totalEconomiaFiscalConsorcio;

  // ── Financiamento PJ (Price) ─────────────────────────────────────────────
  const prazoFin = Math.max(i.prazoFinanciamentoMeses, 1);
  const pFin = parcelaPrice(i.cartaCredito, jFrac, prazoFin);
  const totalFinanciamento = pFin * prazoFin;
  const totalJurosFinanciamento = totalFinanciamento - i.cartaCredito;

  const prazoAnalise = Math.max(N, prazoFin);
  const economiaTotalVsFinanciamento = totalFinanciamento - totalLiquidoConsorcio;
  const percentualEconomia = totalFinanciamento > 0
    ? (economiaTotalVsFinanciamento / totalFinanciamento) * 100 : 0;

  const valorBemFinalConsorcio    = valorFuturo(i.cartaCredito, vAnual, (prazoAnalise - mc) / 12);
  const valorBemFinalFinanciamento = valorFuturo(i.cartaCredito, vAnual, prazoAnalise / 12);

  // ── Timeline mês a mês ─────────────────────────────────────────────────
  const timeline: CNPJMesData[] = [];
  let saldoDevedorFin = i.cartaCredito;
  const amortizacaoFin = i.cartaCredito / prazoFin;
  const prazoTL = Math.min(prazoAnalise, 240);

  for (let m = 1; m <= prazoTL; m++) {
    const parcelaMesCons = sim.timeline[m - 1]?.parcela ?? 0;
    const economiaFiscalMes = beneficioFiscalAtivo
      ? parcelaMesCons * fracTaxaNaParcela * alphaFrac : 0;
    const parcelaLiquidaMes = parcelaMesCons - economiaFiscalMes;

    const jurosMes    = saldoDevedorFin * jFrac;
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
    parcelaFinanciamento: pFin,
    totalFinanciamento,
    totalJurosFinanciamento,
    economiaTotalVsFinanciamento,
    percentualEconomia,
    aliquotaEfetivaTotal,
    regimeTributario: i.regimeTributario,
    beneficioFiscalAtivo,
    percentualPatrocinadoEstado,
    valorBemFinalConsorcio,
    valorBemFinalFinanciamento,
    timeline,
  };
}
