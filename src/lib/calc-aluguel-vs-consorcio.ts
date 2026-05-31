// ─── Simulador Aluguel vs Consórcio ──────────────────────────────────────────
// Responde: "Você está jogando dinheiro fora pagando aluguel?"
// Mostra o custo total do aluguel vs. o patrimônio gerado pelo consórcio.
//
// Fonte única de verdade: simularConsorcio() gera a timeline completa mensal.
// Os KPI cards e o gráfico leem exatamente os mesmos dados.

import {
  simularConsorcio,
  valorFuturo,
} from "./consorcio-core";

export interface AluguelInputs {
  aluguelAtual: number;
  reajusteAluguelAnual: number;
  horizonte: number;
  cartaCredito: number;
  taxaAdmTotal: number;
  prazoMeses: number;
  percLance: number;
  lanceProprioR: number;
  mesContemplacao: number;
  valorizacaoAnual: number;
  taxaAtualizacaoAnual: number;
}

export interface MesAluguel {
  mes: number;
  aluguelMes: number;
  aluguelAcum: number;
  parcelaCons: number;
  patrimonioConsorcio: number;
  saldoDevedorCons: number;
}

export interface AluguelResults {
  totalAluguel: number;
  patrimônioAluguel: number;
  parcelaPadrao: number;
  parcelaPosLance: number;
  totalConsorcio: number;
  lanceEmbR: number;
  lanceProprio: number;
  saldoDevedorPosLance: number;
  valorImovelFinal: number;
  patrimonioConsorcio: number;
  vantagemPatrimonial: number;
  custoCons: number;
  diferencaCusto: number;
  cartaAtualizada: number;
  breakEvenMes: number | null;
  timeline: MesAluguel[];
  horizonteMeses: number;
  /** Diretriz D: P_liq − C_atualizado (sobra/déficit de crédito na contemplação) */
  saldoCaixa: number;
}

export const defaultAluguelInputs: AluguelInputs = {
  aluguelAtual: 3_500,
  reajusteAluguelAnual: 5,
  horizonte: 20,
  cartaCredito: 500_000,
  taxaAdmTotal: 18,
  prazoMeses: 120,
  percLance: 25,
  lanceProprioR: 0,
  mesContemplacao: 12,
  valorizacaoAnual: 6,
  taxaAtualizacaoAnual: 4,
};

export function calcAluguelVsConsorcio(i: AluguelInputs): AluguelResults {
  const T = Math.max(i.horizonte, 1);
  const horizonteMeses = T * 12;
  const prazo = Math.max(i.prazoMeses, 1);
  const mc = Math.min(Math.max(i.mesContemplacao, 1), prazo);
  const iAlug = i.reajusteAluguelAnual / 100;
  const vAnual = i.valorizacaoAnual / 100;
  const vMensal = Math.pow(1 + vAnual, 1 / 12) - 1;

  // ── Simulação mensal do consórcio (fonte única) ───────────────────────────
  const sim = simularConsorcio({
    credito: i.cartaCredito,
    taxaAdm: i.taxaAdmTotal,
    prazo,
    inccAnual: i.taxaAtualizacaoAnual,
    mesContemplacao: mc,
    lanceEmbutidoPerc: i.percLance,
    lanceProprioR: i.lanceProprioR,
    amortizacao: "parcela",
    horizonteMeses,
  });

  // KPIs derivados da timeline (cards == gráfico garantido)
  const parcelaPadrao = sim.parcelaNominal;
  const parcelaPosLance = sim.parcelaReduzida;
  const lanceEmbR = sim.lanceEmbutidoR;
  const lanceProprio = sim.lanceProprioR;
  const saldoDevedorPosLance = sim.saldoDevedor;
  // Total_Cons (Diretriz 4) = soma de TODOS os custos do consórcio ao longo do
  // plano (parcelas indexadas ao INCC + lances) → totalPagamentos.
  const totalConsorcio = sim.totalPagamentos;
  const cartaAtualizada = sim.cartaCorrigida;

  // ── Timeline mensal: aluguel + patrimônio consórcio ───────────────────────
  const timeline: MesAluguel[] = [];
  let aluguelMesAtual = i.aluguelAtual;
  let aluguelAcum = 0;
  let totalAluguel = 0;
  let breakEvenMes: number | null = null;

  for (let m = 1; m <= horizonteMeses; m++) {
    // Reajuste anual do aluguel
    if (m > 1 && (m - 1) % 12 === 0) {
      aluguelMesAtual *= (1 + iAlug);
    }

    aluguelAcum += aluguelMesAtual;
    totalAluguel += aluguelMesAtual;

    // Parcela do consórcio (da timeline do simulador — fonte única)
    const simMes = sim.timeline[m - 1];
    const parcelaCons = simMes?.parcela ?? 0;
    const saldoDevedorMes = simMes?.saldoPlano ?? 0;

    // Patrimônio imobiliário: 0 antes da contemplação; carta valorizada após
    let patrimonioConsorcioMes = 0;
    if (m >= mc) {
      patrimonioConsorcioMes = i.cartaCredito * Math.pow(1 + vMensal, m - mc);
    }

    if (breakEvenMes === null && patrimonioConsorcioMes > 0 && patrimonioConsorcioMes >= aluguelAcum) {
      breakEvenMes = m;
    }

    timeline.push({
      mes: m,
      aluguelMes: aluguelMesAtual,
      aluguelAcum,
      parcelaCons,
      patrimonioConsorcio: patrimonioConsorcioMes,
      saldoDevedorCons: m < mc ? i.cartaCredito : saldoDevedorMes,
    });
  }

  const valorImovelFinal = valorFuturo(i.cartaCredito, vAnual, T);
  const vantagemPatrimonial = valorImovelFinal - totalConsorcio + totalAluguel;

  return {
    totalAluguel,
    patrimônioAluguel: 0,
    parcelaPadrao,
    parcelaPosLance,
    totalConsorcio,
    lanceEmbR,
    lanceProprio,
    saldoDevedorPosLance,
    valorImovelFinal,
    patrimonioConsorcio: valorImovelFinal,
    vantagemPatrimonial,
    custoCons: totalConsorcio,
    diferencaCusto: totalAluguel - totalConsorcio,
    cartaAtualizada,
    breakEvenMes,
    timeline,
    horizonteMeses,
    saldoCaixa: sim.saldoCaixa,
  };
}
