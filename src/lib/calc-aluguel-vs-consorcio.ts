// ─── Simulador Aluguel vs Consórcio ──────────────────────────────────────────
// Responde: "Você está jogando dinheiro fora pagando aluguel?"
// Mostra o custo total do aluguel vs. o patrimônio gerado pelo consórcio.

import { simularConsorcio } from "./consorcio-core";

export interface AluguelInputs {
  aluguelAtual: number;          // Aluguel atual (R$/mês)
  reajusteAluguelAnual: number;  // Reajuste anual do aluguel (% — ex: 5)
  horizonte: number;             // Horizonte de análise (anos — ex: 20)
  cartaCredito: number;          // Valor da carta de crédito / imóvel desejado (R$)
  taxaAdmTotal: number;          // Taxa de administração total (%)
  prazoMeses: number;            // Prazo do grupo (meses)
  percLance: number;             // Lance ofertado (% da carta)
  lanceProprioR: number;         // Lance em recursos próprios (R$)
  mesContemplacao: number;       // Mês de contemplação estimado
  valorizacaoAnual: number;      // Valorização anual esperada do imóvel (% — ex: 6)
  taxaAtualizacaoAnual: number;  // Atualização anual da carta pelo INCC (% a.a. — ex: 4)
}

export interface MesAluguel {
  mes: number;
  aluguelMes: number;
  aluguelAcum: number;
  parcelaCons: number;
  patrimonioConsorcio: number;  // 0 antes da contemplação; cresce após
  saldoDevedorCons: number;
}

export interface AluguelResults {
  // ── Aluguel ─────────────────────────────────────────────────────────────
  totalAluguel: number;
  patrimônioAluguel: number;  // Sempre 0

  // ── Consórcio ────────────────────────────────────────────────────────────
  parcelaPadrao: number;
  parcelaPosLance: number;
  totalConsorcio: number;        // Parcelas + lance próprio
  lanceEmbR: number;
  lanceProprio: number;
  saldoDevedorPosLance: number;

  // ── Imóvel ──────────────────────────────────────────────────────────────
  valorImovelFinal: number;      // Carta corrigida pela valorização
  patrimonioConsorcio: number;   // = valorImovelFinal

  // ── Comparativo ─────────────────────────────────────────────────────────
  vantagemPatrimonial: number;   // patrimonioConsorcio - 0
  custoCons: number;             // totalConsorcio (custo líquido do consórcio)
  diferencaCusto: number;        // totalAluguel - totalConsorcio
  cartaAtualizada: number;       // Carta corrigida pelo INCC na contemplação

  // ── Break-even ──────────────────────────────────────────────────────────
  breakEvenMes: number | null;   // Mês em que patrimônio consórcio > acumulado aluguel

  // ── Timeline ────────────────────────────────────────────────────────────
  timeline: MesAluguel[];

  // Configurações usadas
  horizonteMeses: number;
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
  const {
    aluguelAtual,
    reajusteAluguelAnual,
    horizonte,
    cartaCredito,
    taxaAdmTotal,
    prazoMeses,
    percLance,
    lanceProprioR,
    mesContemplacao,
    valorizacaoAnual,
    taxaAtualizacaoAnual,
  } = i;

  const horizonteMeses = Math.max(horizonte, 1) * 12;
  const prazo = Math.max(prazoMeses, 1);
  const mesContemp = Math.min(Math.max(mesContemplacao, 1), prazo);

  // ── Núcleo: consórcio com parcela e saldo derivados do crédito atualizado ──
  // O lance (percLance) abate o saldo devedor; lance próprio é desembolso real.
  const sim = simularConsorcio({
    credito: cartaCredito,
    taxaAdm: taxaAdmTotal,
    prazo,
    inccAnual: taxaAtualizacaoAnual,
    mesContemplacao: mesContemp,
    lanceEmbutidoPerc: percLance,
    lanceProprioR,
    abatimentoEmbutido: "saldoDevedor",
    amortizacao: "parcela",
    horizonteMeses,
  });

  const cartaAtualizada = sim.creditoAtualizadoContemplacao;
  const lanceEmbR = sim.lanceEmbutidoR;
  const lanceProprio = sim.lanceProprioR;
  const parcelaPadrao = sim.parcelaInicial;
  const parcelaPosLance = sim.parcelaPosLance;
  const saldoDevedorPosLance = sim.saldoDevedorPosLance;
  const totalConsorcio = sim.desembolsoTotal;

  // ── Totais ───────────────────────────────────────────────────────────────
  let totalAluguel = 0;
  let aluguelMesAtual = aluguelAtual;

  const timeline: MesAluguel[] = [];
  let aluguelAcum = 0;
  let breakEvenMes: number | null = null;

  // Valorização mensal do imóvel
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;

  for (let m = 1; m <= horizonteMeses; m++) {
    // Reajuste anual do aluguel pelo INCC/índice de reajuste
    if (m > 1 && (m - 1) % 12 === 0) {
      aluguelMesAtual = aluguelMesAtual * (1 + reajusteAluguelAnual / 100);
    }

    // Parcela do consórcio neste mês (do núcleo — já reajustada pelo INCC)
    const parcelaCons = sim.timeline[m - 1]?.parcela ?? 0;
    const saldoDevedorMes = sim.timeline[m - 1]?.saldoDevedor ?? 0;

    aluguelAcum += aluguelMesAtual;
    totalAluguel += aluguelMesAtual;

    // Patrimônio do consórcio: 0 antes da contemplação; imóvel (valorizado) após
    let patrimonioConsMes = 0;
    if (m >= mesContemp) {
      const mesesPosContemp = m - mesContemp;
      patrimonioConsMes = sim.creditoAtualizadoContemplacao * Math.pow(1 + valorizMensal, mesesPosContemp);
    }

    // Break-even: primeiro mês em que patrimônio consórcio >= custo aluguel acumulado
    if (breakEvenMes === null && patrimonioConsMes > 0 && patrimonioConsMes >= aluguelAcum) {
      breakEvenMes = m;
    }

    timeline.push({
      mes: m,
      aluguelMes: aluguelMesAtual,
      aluguelAcum,
      parcelaCons,
      patrimonioConsorcio: patrimonioConsMes,
      saldoDevedorCons: m < mesContemp ? cartaCredito : saldoDevedorMes,
    });
  }

  // Valor do imóvel no futuro (ao final do horizonte)
  const valorImovelFinal = timeline[timeline.length - 1].patrimonioConsorcio;
  const patrimonioConsorcio = valorImovelFinal;

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
    patrimonioConsorcio,
    vantagemPatrimonial: patrimonioConsorcio,
    custoCons: totalConsorcio,
    diferencaCusto: totalAluguel - totalConsorcio,
    cartaAtualizada,
    breakEvenMes,
    timeline,
    horizonteMeses,
  };
}
