// ─── Simulador de Renda Passiva com Consórcio ────────────────────────────────
// Responde: "O consórcio pode se pagar sozinho com a renda do aluguel?"
// Foco: rendimento do aluguel + valor patrimonial; e crédito rendendo CDI vs
// parcela rendendo INCC. (Não comparar as parcelas aplicadas em CDB.)

import { simularConsorcio } from "./consorcio-core";

export type UsoCreditoContemplado = "compra_imovel" | "credito_rende_cdi";

export interface RendaPassivaInputs {
  cartaCredito: number;          // Valor da carta de crédito (R$)
  taxaAdmTotal: number;          // Taxa de administração total (%)
  prazoMeses: number;            // Prazo do grupo (meses)
  percLance: number;             // Lance ofertado (% da carta)
  lanceProprioR: number;         // Lance em recursos próprios (R$)
  mesContemplacao: number;       // Mês estimado de contemplação
  rendaAluguelMensal: number;    // Renda de aluguel mensal esperada (R$)
  reajusteAluguelAnual: number;  // Reajuste anual do aluguel (% — ex: 5)
  valorizacaoAnual: number;      // Valorização anual do imóvel (% — ex: 6)
  taxaCDIAnual: number;          // Taxa CDI anual comparativa (% — ex: 13)
  taxaAtualizacaoAnual: number;  // Taxa de atualização anual da carta (INCC, % a.a.)
  usoCreditoContemplado: UsoCreditoContemplado; // "compra_imovel" | "credito_rende_cdi"
}

export interface MesRenda {
  mes: number;
  parcelaCons: number;           // Saída: parcela do consórcio (corrigida pelo INCC anualmente)
  rendaAluguel: number;          // Entrada: aluguel recebido (0 antes da contemplação)
  fluxoLiquido: number;          // rendaAluguel - parcelaCons
  fluxoAcum: number;             // Fluxo líquido acumulado
  totalInvestido: number;        // Desembolso acumulado (parcelas + lance)
  patrimonioImóvel: number;      // Valor do imóvel valorizado (0 antes da contemplação)
  patrimonioTotal: number;       // imóvel + fluxo positivo acumulado
  creditoCDI: number;            // Crédito rendendo CDI (cenário credito_rende_cdi, 0 caso contrário)
}

export interface RendaPassivaResults {
  // ── Inputs calculados ────────────────────────────────────────────────────
  parcelaPadrao: number;
  parcelaPosLance: number;
  lanceEmbR: number;
  lanceProprio: number;
  saldoDevedorPosLance: number;

  // ── Totais ───────────────────────────────────────────────────────────────
  totalInvestido: number;        // Parcelas + lance próprio
  totalRendaGerada: number;      // Soma de todos os aluguéis recebidos
  valorImovelFinal: number;      // Imóvel corrigido pela valorização
  patrimonioFinal: number;       // Imóvel + saldo positivo do fluxo

  // ── ROI ──────────────────────────────────────────────────────────────────
  retornoTotalR: number;         // patrimonioFinal - totalInvestido
  roiPercentual: number;         // (retornoTotalR / totalInvestido) × 100
  roiAnual: number;              // Taxa equivalente anual

  // ── Comparativo CDB ──────────────────────────────────────────────────────
  cdbFuturo: number;             // Se tivesse investido o mesmo em CDB
  vantagemVsCDB: number;

  // ── Taxa de atualização ──────────────────────────────────────────────────
  cartaAtualizada: number;       // Carta corrigida pelo INCC na contemplação

  // ── Ponto de equilíbrio de fluxo ─────────────────────────────────────────
  mesFluxoNeutro: number | null; // Primeiro mês em que aluguel ≥ parcela

  // ── Cenário CDI (crédito rende CDI, parcela sobe com INCC) ───────────────
  creditoFinalComCDI: number;    // Crédito acumulado com CDI ao final
  totalParcelasComINCC: number;  // Total de parcelas pagas corrigidas pelo INCC
  spreadCDIvsINCC: number;       // creditoFinalComCDI - totalParcelasComINCC - lanceProprio
  lucroEstrategiaCDI: number;    // Lucro líquido do esquema CDI vs INCC

  // ── Timeline ────────────────────────────────────────────────────────────
  timeline: MesRenda[];
  prazoMeses: number;
}

export const defaultRendaPassivaInputs: RendaPassivaInputs = {
  cartaCredito: 500_000,
  taxaAdmTotal: 18,
  prazoMeses: 120,
  percLance: 25,
  lanceProprioR: 0,
  mesContemplacao: 12,
  rendaAluguelMensal: 2_500,
  reajusteAluguelAnual: 5,
  valorizacaoAnual: 6,
  taxaCDIAnual: 13,
  taxaAtualizacaoAnual: 4,
  usoCreditoContemplado: "compra_imovel",
};

export function calcRendaPassiva(i: RendaPassivaInputs): RendaPassivaResults {
  const {
    cartaCredito,
    taxaAdmTotal,
    prazoMeses,
    percLance,
    lanceProprioR,
    mesContemplacao,
    rendaAluguelMensal,
    reajusteAluguelAnual,
    valorizacaoAnual,
    taxaCDIAnual,
    taxaAtualizacaoAnual,
    usoCreditoContemplado,
  } = i;

  const prazo = Math.max(prazoMeses, 1);
  const mesContemp = Math.min(Math.max(mesContemplacao, 1), prazo);

  // ── Núcleo: consórcio com parcela e saldo derivados do crédito atualizado ──
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
  });

  const cartaAtualizada = sim.creditoAtualizadoContemplacao;
  const lanceEmbR = sim.lanceEmbutidoR;
  const lanceProprio = sim.lanceProprioR;
  const parcelaPadrao = sim.parcelaInicial;
  const parcelaPosLance = sim.parcelaPosLance;
  const saldoDevedorPosLance = sim.saldoDevedorPosLance;

  // ── Taxas mensais ────────────────────────────────────────────────────────
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;
  const cdiMensal = Math.pow(1 + taxaCDIAnual / 100, 1 / 12) - 1;

  // ── Simulação mês a mês ──────────────────────────────────────────────────
  const timeline: MesRenda[] = [];
  let totalInvestido = 0;
  let totalRendaGerada = 0;
  let fluxoAcum = 0;
  let mesFluxoNeutro: number | null = null;

  // Crédito aplicado no CDI (só para cenário credito_rende_cdi, após contemplação)
  let creditoCDIAcum = 0;
  const isCDI = usoCreditoContemplado === "credito_rende_cdi";

  for (let m = 1; m <= prazo; m++) {
    // Parcela do consórcio do núcleo (já reajustada pelo INCC)
    const parcelaCons = sim.timeline[m - 1]?.parcela ?? 0;

    // Lance próprio no mês da contemplação; crédito começa a render CDI
    if (m === mesContemp) {
      totalInvestido += lanceProprio;
      if (isCDI) creditoCDIAcum = cartaCredito; // crédito inicial ao CDI
    }

    // CDI: crédito cresce mensalmente (só após contemplação, cenário CDI)
    if (isCDI && m > mesContemp) {
      creditoCDIAcum *= (1 + cdiMensal);
    }

    // Renda de aluguel (só após contemplação, apenas no cenário compra_imovel)
    let renda = 0;
    if (!isCDI && m > mesContemp) {
      const anosPosCont = Math.floor((m - mesContemp - 1) / 12);
      renda = rendaAluguelMensal * Math.pow(1 + reajusteAluguelAnual / 100, anosPosCont);
      totalRendaGerada += renda;
    }

    // Fluxo líquido (entrada - saída)
    const fluxoLiquido = renda - parcelaCons;
    fluxoAcum += fluxoLiquido;
    totalInvestido += parcelaCons;

    // Patrimônio do imóvel (após contemplação, valorização mensal)
    let patrimonioImovel = 0;
    if (!isCDI && m >= mesContemp) {
      const mesesPosContemp = m - mesContemp;
      patrimonioImovel = cartaCredito * Math.pow(1 + valorizMensal, mesesPosContemp);
    }

    // Patrimônio total
    const caixaExtra = Math.max(fluxoAcum, 0);
    const patrimonioTotal = isCDI ? creditoCDIAcum : patrimonioImovel + caixaExtra;

    // Ponto de equilíbrio de fluxo (compra_imovel)
    if (!isCDI && mesFluxoNeutro === null && m > mesContemp && renda >= parcelaCons) {
      mesFluxoNeutro = m;
    }

    timeline.push({
      mes: m,
      parcelaCons,
      rendaAluguel: renda,
      fluxoLiquido,
      fluxoAcum,
      totalInvestido,
      patrimonioImóvel: patrimonioImovel,
      patrimonioTotal,
      creditoCDI: creditoCDIAcum,
    });
  }

  // ── Resultados finais ────────────────────────────────────────────────────
  const valorImovelFinal = cartaCredito * Math.pow(1 + valorizacaoAnual / 100, prazo / 12);
  const caixaFinal = Math.max(fluxoAcum, 0);
  const patrimonioFinal = valorImovelFinal + caixaFinal;

  const retornoTotalR = patrimonioFinal - totalInvestido;
  const roiPercentual = totalInvestido > 0 ? (retornoTotalR / totalInvestido) * 100 : 0;
  const anos = prazo / 12;
  const roiAnual =
    totalInvestido > 0 && patrimonioFinal > 0
      ? (Math.pow(patrimonioFinal / totalInvestido, 1 / anos) - 1) * 100
      : 0;

  // CDB comparativo: como se o investidor aplicasse todo o totalInvestido de uma vez
  // (aproximação: aplicar o valor total ao CDI pelo prazo)
  const cdbFuturo = totalInvestido * Math.pow(1 + cdiMensal, prazo);
  const vantagemVsCDB = patrimonioFinal - cdbFuturo;

  // ── Cenário CDI: resultado final a partir da timeline já calculada ──────────
  const creditoFinalComCDI = isCDI
    ? (timeline[timeline.length - 1]?.creditoCDI ?? 0)
    : 0;
  const totalParcelasComINCC = isCDI ? totalInvestido : 0;

  const lucroEstrategiaCDI = creditoFinalComCDI - totalParcelasComINCC - lanceProprio;
  const spreadCDIvsINCC = creditoFinalComCDI - totalParcelasComINCC;

  return {
    parcelaPadrao,
    parcelaPosLance,
    lanceEmbR,
    lanceProprio,
    saldoDevedorPosLance,
    totalInvestido,
    totalRendaGerada,
    valorImovelFinal,
    patrimonioFinal,
    retornoTotalR,
    roiPercentual,
    roiAnual,
    cdbFuturo,
    vantagemVsCDB,
    cartaAtualizada,
    mesFluxoNeutro,
    creditoFinalComCDI,
    totalParcelasComINCC,
    spreadCDIvsINCC,
    lucroEstrategiaCDI,
    timeline,
    prazoMeses: prazo,
  };
}
