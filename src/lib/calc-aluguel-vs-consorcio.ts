// ─── Simulador Aluguel vs Consórcio ──────────────────────────────────────────
// Responde: "Você está jogando dinheiro fora pagando aluguel?"
// Mostra o custo total do aluguel vs. o patrimônio gerado pelo consórcio.

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
  } = i;

  const horizonteMeses = Math.max(horizonte, 1) * 12;
  const prazo = Math.max(prazoMeses, 1);
  const mesContemp = Math.min(Math.max(mesContemplacao, 1), prazo);
  const reajusteMensal = Math.pow(1 + reajusteAluguelAnual / 100, 1 / 12) - 1;

  // ── Lance ────────────────────────────────────────────────────────────────
  const lanceEmbR = cartaCredito * (percLance / 100);
  const lanceProprio = lanceProprioR;
  const saldoDevedorPosLance = Math.max(cartaCredito - lanceEmbR - lanceProprio, 0);

  // ── Parcelas do consórcio ────────────────────────────────────────────────
  const taxaAdmFrac = taxaAdmTotal / 100;
  const valorPlano = cartaCredito * (1 + taxaAdmFrac);
  const parcelaPadrao = valorPlano / prazo;
  const parcelaPosLance = prazo > mesContemp
    ? (saldoDevedorPosLance * (1 + taxaAdmFrac)) / prazo
    : 0;

  // ── Totais ───────────────────────────────────────────────────────────────
  // Aluguel: soma acumulada com reajuste anual ao longo do horizonte
  let totalAluguel = 0;
  let aluguelMesAtual = aluguelAtual;

  // Consórcio: parcelas (limitadas ao prazo, depois para)
  let totalConsorcio = 0;

  const timeline: MesAluguel[] = [];
  let aluguelAcum = 0;
  let consAcum = 0;
  let breakEvenMes: number | null = null;

  // Valorização mensal do imóvel
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;

  for (let m = 1; m <= horizonteMeses; m++) {
    // Reajuste anual do aluguel (nos meses múltiplos de 12, exceto no 1º)
    if (m > 1 && (m - 1) % 12 === 0) {
      aluguelMesAtual = aluguelMesAtual * (1 + reajusteAluguelAnual / 100);
    }

    // Parcela do consórcio neste mês
    let parcelaCons = 0;
    if (m <= mesContemp && m <= prazo) {
      parcelaCons = parcelaPadrao;
    } else if (m > mesContemp && m <= prazo) {
      parcelaCons = parcelaPosLance;
    }
    // Após o prazo: parcela = 0 (consórcio encerrado)

    // Lance próprio no mês da contemplação
    if (m === mesContemp) {
      consAcum += lanceProprio;
      totalConsorcio += lanceProprio;
    }

    aluguelAcum += aluguelMesAtual;
    totalAluguel += aluguelMesAtual;
    consAcum += parcelaCons;
    totalConsorcio += parcelaCons;

    // Patrimônio do consórcio: 0 antes da contemplação; imóvel (valorizado) após
    let patrimonioConsMes = 0;
    if (m >= mesContemp) {
      const mesesPosContemp = m - mesContemp;
      patrimonioConsMes = cartaCredito * Math.pow(1 + valorizMensal, mesesPosContemp);
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
      saldoDevedorCons: m < mesContemp ? cartaCredito : saldoDevedorPosLance,
    });
  }

  // Valor do imóvel no futuro (ao final do horizonte)
  const valorImovelFinal = cartaCredito * Math.pow(1 + valorizacaoAnual / 100, horizonte);
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
    breakEvenMes,
    timeline,
    horizonteMeses,
  };
}
