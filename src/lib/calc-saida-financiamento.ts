// ─── Simulador: Saída do Financiamento ───────────────────────────────────────
// Fonte única de verdade: simularConsorcio() mensal para o consórcio destino.
// Financiamento: amortização SAC linear (saldo atual ÷ prazo restante).

import {
  simularConsorcio,
  valorFuturo,
} from "./consorcio-core";

export type TipoAbatimento = "prazo" | "parcela";

export interface SaidaFinanciamentoInputs {
  valorImovelAtual: number;
  saldoDevedor: number;
  parcelaAtual: number;
  prazoRestanteMeses: number;
  taxaJurosMensal: number;
  cartaConsorcio: number;
  taxaAdmConsorcio: number;
  prazoConsorcio: number;
  percLance: number;
  percLanceEmb: number;
  mesContemplacaoConsorcio: number;
  tipoAbatimento: TipoAbatimento;
  valorizacaoAnual: number;
  custosVenda: number;
  taxaAtualizacaoAnual: number;
}

export interface SaidaMesData {
  mes: number;
  saldoDevedorFin: number;
  parcelaFin: number;
  patrimonioLiquidoFin: number;
  desembolsoAcumCons: number;
  parcelaCons: number;
  patrimonioLiquidoCons: number;
}

export interface SaidaFinanciamentoResults {
  capitalLiquidoVenda: number;
  lanceEmReaisConsorcio: number;
  lanceProprioR: number;
  lanceEmbR: number;
  creditoLiquido: number;
  sobra: number;
  totalRestanteFin: number;
  patrimonioFinalFin: number;
  parcelaConsorcio: number;
  parcelaPosLance: number;
  prazoPosFinal: number;
  totalConsorcio: number;
  patrimonioFinalCons: number;
  economiaParcelaMensal: number;
  economiaTotalCusto: number;
  diferencaPatrimonial: number;
  prazoParaImovelCons: number;
  saldoDevedorPosLance: number;
  timeline: SaidaMesData[];
}

export const defaultSaidaInputs: SaidaFinanciamentoInputs = {
  valorImovelAtual: 600_000,
  saldoDevedor: 380_000,
  parcelaAtual: 4_200,
  prazoRestanteMeses: 264,
  taxaJurosMensal: 0.83,
  cartaConsorcio: 500_000,
  taxaAdmConsorcio: 18,
  prazoConsorcio: 120,
  percLance: 25,
  percLanceEmb: 0,
  mesContemplacaoConsorcio: 8,
  tipoAbatimento: "parcela",
  valorizacaoAnual: 6,
  custosVenda: 6,
  taxaAtualizacaoAnual: 4,
};

export function calcSaidaFinanciamento(i: SaidaFinanciamentoInputs): SaidaFinanciamentoResults {
  const jFrac = i.taxaJurosMensal / 100;
  const vMensal = Math.pow(1 + i.valorizacaoAnual / 100, 1 / 12) - 1;
  const Nfin = Math.max(i.prazoRestanteMeses, 1);

  // Cap_liq = [V_merc*(1-custos)] - SD
  const capitalLiquidoVenda = Math.max(
    i.valorImovelAtual * (1 - i.custosVenda / 100) - i.saldoDevedor, 0
  );
  const lanceMaxConsorcio    = i.cartaConsorcio * (i.percLance / 100);
  const lanceEmReaisConsorcio = Math.min(capitalLiquidoVenda, lanceMaxConsorcio);
  const sobra = capitalLiquidoVenda - lanceEmReaisConsorcio;
  const lanceEmbR = i.cartaConsorcio * ((i.percLanceEmb || 0) / 100);
  const lanceProprioR = lanceEmReaisConsorcio;
  const lanceTotal = lanceEmbR + lanceProprioR;

  const prazoAnalise = Math.max(Nfin, i.prazoConsorcio);

  // ── Simulação mensal do consórcio ────────────────────────────────────────
  const mc = Math.min(Math.max(i.mesContemplacaoConsorcio, 1), i.prazoConsorcio);
  const sim = simularConsorcio({
    credito:           i.cartaConsorcio,
    taxaAdm:           i.taxaAdmConsorcio,
    prazo:             i.prazoConsorcio,
    inccAnual:         i.taxaAtualizacaoAnual,
    mesContemplacao:   mc,
    lanceEmbutidoPerc: i.percLanceEmb || 0,
    lanceProprioR:     lanceProprioR,
    amortizacao:       i.tipoAbatimento,
    horizonteMeses:    prazoAnalise,
  });

  // KPIs derivados da timeline
  const parcelaConsorcio    = sim.parcelaNominal;
  const parcelaPosLance     = sim.parcelaReduzida;
  const creditoLiquido      = sim.poderDeCompra;
  const saldoDevedorPosLance = sim.saldoDevedor;
  const prazoPosFinal       = sim.prazoPosLance;
  const totalConsorcio      = sim.totalPagamentos; // custo total ao longo do plano

  // ── Financiamento — SAC ───────────────────────────────────────────────────
  const amortizacaoMensal = i.saldoDevedor / Nfin;
  let saldoFin = i.saldoDevedor;
  let totalRestanteFin = 0;
  for (let m = 0; m < Nfin; m++) {
    const jurosMes = saldoFin * jFrac;
    totalRestanteFin += amortizacaoMensal + jurosMes;
    saldoFin -= amortizacaoMensal;
  }

  const patrimonioFinalFin  = valorFuturo(i.valorImovelAtual, i.valorizacaoAnual / 100, prazoAnalise / 12);
  const patrimonioFinalCons = valorFuturo(i.cartaConsorcio, i.valorizacaoAnual / 100, (prazoAnalise - mc) / 12) + sobra;

  const economiaParcelaMensal = i.parcelaAtual - parcelaPosLance;
  const economiaTotalCusto    = totalRestanteFin - totalConsorcio;
  const diferencaPatrimonial  = patrimonioFinalCons - patrimonioFinalFin;

  // ── Timeline mês a mês ─────────────────────────────────────────────────
  const timeline: SaidaMesData[] = [];
  let saldoFinTimeline = i.saldoDevedor;
  let desembolsoAcumCons = 0;
  const prazoTL = Math.min(prazoAnalise, 360);

  for (let m = 1; m <= prazoTL; m++) {
    // Financiamento SAC
    const jurosMes  = saldoFinTimeline * jFrac;
    const amort     = saldoFinTimeline > 0 ? Math.min(amortizacaoMensal, saldoFinTimeline) : 0;
    const parcelaFin = m <= Nfin ? amort + jurosMes : 0;
    saldoFinTimeline = Math.max(saldoFinTimeline - amort, 0);
    const valorImovelMes = i.valorImovelAtual * Math.pow(1 + vMensal, m);
    const patrimonioLiquidoFin = valorImovelMes - saldoFinTimeline;

    // Consórcio (da timeline do simulador — fonte única)
    const parcelaMesCons = sim.timeline[m - 1]?.parcela ?? 0;
    if (m === mc + 1) desembolsoAcumCons += lanceProprioR;
    desembolsoAcumCons += parcelaMesCons;

    const patrimonioLiquidoCons = m <= mc
      ? 0
      : i.cartaConsorcio * Math.pow(1 + vMensal, m - mc) + sobra;

    timeline.push({
      mes: m,
      saldoDevedorFin: saldoFinTimeline,
      parcelaFin,
      patrimonioLiquidoFin,
      desembolsoAcumCons,
      parcelaCons: parcelaMesCons,
      patrimonioLiquidoCons,
    });
  }

  return {
    capitalLiquidoVenda,
    lanceEmReaisConsorcio,
    lanceProprioR,
    lanceEmbR,
    creditoLiquido,
    sobra,
    totalRestanteFin,
    patrimonioFinalFin,
    parcelaConsorcio,
    parcelaPosLance,
    prazoPosFinal,
    totalConsorcio,
    patrimonioFinalCons,
    economiaParcelaMensal,
    economiaTotalCusto,
    diferencaPatrimonial,
    prazoParaImovelCons: mc,
    saldoDevedorPosLance,
    timeline,
  };
}
