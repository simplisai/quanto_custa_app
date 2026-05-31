// ─── Simulador de Lance ──────────────────────────────────────────────────────
// Fonte única de verdade: simularConsorcio() mensal para ambos os cenários.
// KPI cards derivam 100% da timeline.

import { simularConsorcio } from "./consorcio-core";

export interface LanceInputs {
  cartaCredito: number;
  taxaAdmTotal: number;
  prazoMeses: number;
  percLanceEmb: number;
  lanceProprioR: number;
  tipoLance: "embutido" | "proprio" | "combinado";
  mesContemplacaoLance: number;
  mesSemLance: number;
  tipoAbatimentoLance: "credito" | "saldoDevedor";
  taxaAtualizacaoAnual: number;
}

export interface MesData {
  mes: number;
  parcelaSemLance: number;
  parcelaComLance: number;
  desembolsoAcumSemLance: number;
  desembolsoAcumComLance: number;
}

export interface LanceResults {
  parcelaPadrao: number;
  parcelaPosLance: number;
  lanceEmbR: number;
  lanceTotalR: number;
  percLanceTotalSobreCarta: number;
  creditoLiquido: number;
  cartaAtualizada: number;
  totalSemLance: number;
  totalComLance: number;
  economia: number;
  timeline: MesData[];
  breakEvenMes: number | null;
  saldoDevedorPosLance: number;
  parcelesPre: number;
  parcelesPos: number;
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
  const N = Math.max(i.prazoMeses, 1);
  const mLance = Math.min(Math.max(i.mesContemplacaoLance, 1), N);
  const mSem = Math.min(Math.max(i.mesSemLance, 1), N);

  const usaEmbutido = i.tipoLance === "embutido" || i.tipoLance === "combinado";
  const usaProprio  = i.tipoLance === "proprio"  || i.tipoLance === "combinado";
  const percEmb     = usaEmbutido ? i.percLanceEmb : 0;
  const lanceProprio = usaProprio ? i.lanceProprioR : 0;

  // ── Cenário COM lance (timeline completa) ────────────────────────────────
  const comLance = simularConsorcio({
    credito:           i.cartaCredito,
    taxaAdm:           i.taxaAdmTotal,
    prazo:             N,
    inccAnual:         i.taxaAtualizacaoAnual,
    mesContemplacao:   mLance,
    lanceEmbutidoPerc: percEmb,
    lanceProprioR:     lanceProprio,
    amortizacao:       "parcela",
  });

  // ── Cenário SEM lance: contemplado no mês de referência (mesSemLance) ─────
  const semLance = simularConsorcio({
    credito:         i.cartaCredito,
    taxaAdm:         i.taxaAdmTotal,
    prazo:           N,
    inccAnual:       i.taxaAtualizacaoAnual,
    mesContemplacao: mSem, // contemplação tardia sem lance
  });

  // KPIs derivados da timeline (fonte única)
  const parcelaPadrao       = comLance.parcelaNominal;
  const parcelaPosLance     = comLance.parcelaReduzida;
  const lanceEmbR           = comLance.lanceEmbutidoR;
  const lanceTotalR         = lanceEmbR + lanceProprio;
  const saldoDevedorPosLance = comLance.saldoDevedor;
  const creditoLiquido      = comLance.poderDeCompra;
  const cartaAtualizada     = comLance.cartaCorrigida;

  const percLanceTotalSobreCarta = cartaAtualizada > 0
    ? (lanceTotalR / cartaAtualizada) * 100 : 0;

  // Totais: CUSTO GLOBAL (snapshot na contemplação) — gabarito do Validador.
  // Sem lance: snapshot no mês de referência (mesContemplacao = N → saldo zera);
  // por isso usamos custoGlobal de ambos os cenários (parcelas + lance + saldo).
  const totalSemLance = semLance.custoGlobal;
  const totalComLance = comLance.custoGlobal;
  const economia = totalSemLance - totalComLance;

  // ── Timeline mês a mês ─────────────────────────────────────────────────
  const maxM = Math.max(semLance.timeline.length, comLance.timeline.length);
  const timeline: MesData[] = [];
  let acumSemLance = 0;
  let acumComLance = 0;

  for (let idx = 0; idx < maxM; idx++) {
    const semM = semLance.timeline[idx];
    const comM = comLance.timeline[idx];
    acumSemLance += semM?.parcela ?? 0;
    acumComLance += comM?.desembolsoMes ?? 0;

    timeline.push({
      mes: (semM ?? comM)!.mes,
      parcelaSemLance: semM?.parcela ?? 0,
      parcelaComLance: comM?.parcela ?? 0,
      desembolsoAcumSemLance: acumSemLance,
      desembolsoAcumComLance: acumComLance,
    });
  }

  // Break-even: mês em que o acumulado COM lance ≤ acumulado SEM lance
  let breakEvenMes: number | null = null;
  if (lanceProprio > 0) {
    const cruzamento = timeline.find(
      t => t.mes > mLance && t.desembolsoAcumComLance <= t.desembolsoAcumSemLance,
    );
    breakEvenMes = cruzamento?.mes ?? null;
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
    parcelesPre: mLance,
    parcelesPos: N - mLance,
  };
}
