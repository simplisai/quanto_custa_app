// ─── Simulador de Renda Passiva com Consórcio ────────────────────────────────
// Responde: "O consórcio pode se pagar sozinho com a renda do aluguel?"
// Calcula fluxo de caixa mês a mês, ROI e compara com CDB/Selic.

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
}

export interface MesRenda {
  mes: number;
  parcelaCons: number;           // Saída: parcela do consórcio
  rendaAluguel: number;          // Entrada: aluguel recebido (0 antes da contemplação)
  fluxoLiquido: number;          // rendaAluguel - parcelaCons
  fluxoAcum: number;             // Fluxo líquido acumulado
  totalInvestido: number;        // Desembolso acumulado (parcelas + lance)
  patrimonioImóvel: number;      // Valor do imóvel valorizado (0 antes da contemplação)
  patrimonioTotal: number;       // imóvel + fluxo positivo acumulado
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

  // ── Ponto de equilíbrio de fluxo ─────────────────────────────────────────
  mesFluxoNeutro: number | null; // Primeiro mês em que aluguel ≥ parcela

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
  } = i;

  const prazo = Math.max(prazoMeses, 1);
  const mesContemp = Math.min(Math.max(mesContemplacao, 1), prazo);

  // ── Lance ────────────────────────────────────────────────────────────────
  const lanceEmbR = cartaCredito * (percLance / 100);
  const lanceProprio = lanceProprioR;
  const saldoDevedorPosLance = Math.max(cartaCredito - lanceEmbR - lanceProprio, 0);

  // ── Parcelas ────────────────────────────────────────────────────────────
  const taxaAdmFrac = taxaAdmTotal / 100;
  const valorPlano = cartaCredito * (1 + taxaAdmFrac);
  const parcelaPadrao = valorPlano / prazo;
  const parcelaPosLance = prazo > mesContemp
    ? (saldoDevedorPosLance * (1 + taxaAdmFrac)) / prazo
    : 0;

  // ── Taxas mensais ────────────────────────────────────────────────────────
  const reajusteMensal = Math.pow(1 + reajusteAluguelAnual / 100, 1 / 12) - 1;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;
  const cdiMensal = Math.pow(1 + taxaCDIAnual / 100, 1 / 12) - 1;

  // ── Simulação mês a mês ──────────────────────────────────────────────────
  const timeline: MesRenda[] = [];
  let totalInvestido = 0;
  let totalRendaGerada = 0;
  let fluxoAcum = 0;
  let mesFluxoNeutro: number | null = null;
  let rendaAtual = rendaAluguelMensal;

  for (let m = 1; m <= prazo; m++) {
    // Parcela do consórcio
    let parcelaCons = 0;
    if (m <= mesContemp) {
      parcelaCons = parcelaPadrao;
    } else {
      parcelaCons = parcelaPosLance;
    }

    // Lance próprio no mês da contemplação
    if (m === mesContemp) {
      totalInvestido += lanceProprio;
    }

    // Renda de aluguel (só após contemplação)
    let renda = 0;
    if (m > mesContemp) {
      // Reajuste anual do aluguel
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
    if (m >= mesContemp) {
      const mesesPosContemp = m - mesContemp;
      patrimonioImovel = cartaCredito * Math.pow(1 + valorizMensal, mesesPosContemp);
    }

    // Patrimônio total = imóvel + saldo de caixa positivo acumulado
    const caixaExtra = Math.max(fluxoAcum, 0);
    const patrimonioTotal = patrimonioImovel + caixaExtra;

    // Ponto de equilíbrio: primeiro mês em que renda ≥ parcela
    if (mesFluxoNeutro === null && m > mesContemp && renda >= parcelaCons) {
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
    mesFluxoNeutro,
    timeline,
    prazoMeses: prazo,
  };
}
