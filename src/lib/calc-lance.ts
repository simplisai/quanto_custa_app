// ─── Simulador de Lance ──────────────────────────────────────────────────────
// Responde: "O que preciso dar de lance para ser contemplado no mês X?"
// e mostra a economia real vs. esperar contemplação aleatória.

import { simularConsorcio } from "./consorcio-core";

export interface LanceInputs {
  cartaCredito: number;        // Valor da carta de crédito (R$)
  taxaAdmTotal: number;        // Taxa de administração total (% — ex: 18%)
  prazoMeses: number;          // Prazo do grupo (meses)
  percLanceEmb: number;        // Lance embutido (% da carta) — ex: 20
  lanceProprioR: number;       // Lance próprio em R$
  tipoLance: "embutido" | "proprio" | "combinado";
  mesContemplacaoLance: number; // Mês-alvo de contemplação com lance
  mesSemLance: number;         // Mês médio de contemplação sem lance (ex: prazo * 0.6)
  tipoAbatimentoLance: "credito" | "saldoDevedor"; // Lance abate crédito recebido ou saldo devedor
  taxaAtualizacaoAnual: number; // Taxa de atualização anual da carta (INCC, % a.a.)
}

export interface MesData {
  mes: number;
  parcelaSemLance: number;
  parcelaComLance: number;     // pré-contemplação = mesma; pós = menor
  desembolsoAcumSemLance: number;
  desembolsoAcumComLance: number;
}

export interface LanceResults {
  // Parcelas
  parcelaPadrao: number;       // Parcela sem lance (pré e pós, igual)
  parcelaPosLance: number;     // Parcela após contemplação com lance

  // Lance
  lanceEmbR: number;           // Lance embutido em R$
  lanceTotalR: number;         // Lance total = emb + próprio
  percLanceTotalSobreCarta: number; // % total sobre a carta

  // Crédito
  creditoLiquido: number;      // Crédito disponível após lance (depende do tipoAbatimento)
  cartaAtualizada: number;     // Carta de crédito corrigida pelo INCC na contemplação

  // Totais
  totalSemLance: number;
  totalComLance: number;
  economia: number;

  // Mês-a-mês
  timeline: MesData[];

  // Break-even: mês em que a economia de parcelas cobre o lance próprio
  breakEvenMes: number | null;

  // Detalhes
  saldoDevedorPosLance: number;
  parcelesPre: number;         // Qtde de parcelas antes da contemplação com lance
  parcelesPos: number;         // Qtde de parcelas após
}

export const defaultLanceInputs: LanceInputs = {
  cartaCredito: 500_000,
  taxaAdmTotal: 18,
  prazoMeses: 120,
  percLanceEmb: 20,
  lanceProprioR: 0,
  tipoLance: "embutido",
  mesContemplacaoLance: 12,
  mesSemLance: 72,
  tipoAbatimentoLance: "saldoDevedor",
  taxaAtualizacaoAnual: 4,
};

export function calcLance(i: LanceInputs): LanceResults {
  const {
    cartaCredito,
    taxaAdmTotal,
    prazoMeses,
    percLanceEmb,
    lanceProprioR,
    tipoLance,
    mesContemplacaoLance,
    tipoAbatimentoLance,
    taxaAtualizacaoAnual,
  } = i;

  const prazo = Math.max(prazoMeses, 1);
  const mesLance = Math.min(Math.max(mesContemplacaoLance, 1), prazo);

  // Lance embutido / próprio conforme o tipo selecionado
  const usaEmbutido = tipoLance === "embutido" || tipoLance === "combinado";
  const usaProprio = tipoLance === "proprio" || tipoLance === "combinado";
  const percEmb = usaEmbutido ? percLanceEmb : 0;
  const lanceProprio = usaProprio ? lanceProprioR : 0;

  // ── Cenário COM LANCE ──────────────────────────────────────────────────────
  // A parcela é derivada do crédito ATUALIZADO pelo INCC (núcleo); o lance
  // amortiza o saldo devedor e (no modo "credito") reduz o crédito líquido.
  const comLance = simularConsorcio({
    credito: cartaCredito,
    taxaAdm: taxaAdmTotal,
    prazo,
    inccAnual: taxaAtualizacaoAnual,
    mesContemplacao: mesLance,
    lanceEmbutidoPerc: percEmb,
    lanceProprioR: lanceProprio,
    abatimentoEmbutido: tipoAbatimentoLance,
    amortizacao: "parcela",
  });

  // ── Cenário SEM LANCE ──────────────────────────────────────────────────────
  // Paga a parcela padrão (reajustada pelo INCC) por todo o prazo.
  const semLance = simularConsorcio({
    credito: cartaCredito,
    taxaAdm: taxaAdmTotal,
    prazo,
    inccAnual: taxaAtualizacaoAnual,
    mesContemplacao: prazo, // sem lance: contemplação não antecipa nada
  });

  const cartaAtualizada = comLance.creditoAtualizadoContemplacao;
  const parcelaPadrao = comLance.parcelaInicial;
  const parcelaPosLance = comLance.parcelaPosLance;
  const saldoDevedorPosLance = comLance.saldoDevedorPosLance;

  const lanceEmbR = comLance.lanceEmbutidoR;
  const lanceTotalR = lanceEmbR + lanceProprio;
  const percLanceTotalSobreCarta = cartaAtualizada > 0 ? (lanceTotalR / cartaAtualizada) * 100 : 0;
  const creditoLiquido = comLance.creditoLiquido;

  const parcelasRestantes = prazo - mesLance;

  // ── Totais (a partir das timelines reajustadas — fonte única) ──────────────
  const totalSemLance = semLance.totalParcelas;
  const totalComLance = comLance.desembolsoTotal;
  const economia = totalSemLance - totalComLance;

  // ── Timeline mês a mês ───────────────────────────────────────────────────
  const timeline: MesData[] = [];
  let acumSemLance = 0;
  let acumComLance = 0;

  for (let m = 1; m <= prazo; m++) {
    const semM = semLance.timeline[m - 1];
    const comM = comLance.timeline[m - 1];
    acumSemLance += semM?.parcela ?? 0;
    acumComLance += comM?.desembolsoMes ?? 0;

    timeline.push({
      mes: m,
      parcelaSemLance: semM?.parcela ?? 0,
      parcelaComLance: comM?.parcela ?? 0,
      desembolsoAcumSemLance: acumSemLance,
      desembolsoAcumComLance: acumComLance,
    });
  }

  // ── Break-even ───────────────────────────────────────────────────────────
  // Primeiro mês em que o desembolso acumulado COM lance ≤ SEM lance.
  let breakEvenMes: number | null = null;
  if (lanceProprio > 0) {
    const cruzamento = timeline.find(
      (t) => t.mes > mesLance && t.desembolsoAcumComLance <= t.desembolsoAcumSemLance,
    );
    breakEvenMes = cruzamento ? cruzamento.mes : null;
  }

  return {
    parcelaPadrao,
    parcelaPosLance,
    lanceEmbR,
    lanceTotalR,
    percLanceTotalSobreCarta,
    creditoLiquido,
    cartaAtualizada,
    totalSemLance,
    totalComLance,
    economia,
    timeline,
    breakEvenMes,
    saldoDevedorPosLance,
    parcelesPre: mesLance,
    parcelesPos: parcelasRestantes,
  };
}
