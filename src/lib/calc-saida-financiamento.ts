// ─── Simulador: Saída do Financiamento ───────────────────────────────────────
// Responde: "Vale a pena eu vender meu imóvel financiado e migrar para consórcio?"
// O cliente compara patrimônio líquido, parcela mensal e custo total em ambos os cenários.

export interface SaidaFinanciamentoInputs {
  // Imóvel financiado
  valorImovelAtual: number;      // Valor atual de mercado do imóvel (R$)
  saldoDevedor: number;          // Saldo devedor restante no banco (R$)
  parcelaAtual: number;          // Parcela atual do financiamento (R$)
  prazoRestanteMeses: number;    // Meses restantes de financiamento
  taxaJurosMensal: number;       // Taxa de juros mensal do financiamento (% a.m.)

  // Consórcio destino
  cartaConsorcio: number;        // Valor da carta do consórcio (R$)
  taxaAdmConsorcio: number;      // Taxa de administração total do consórcio (%)
  prazoConsorcio: number;        // Prazo do grupo consórcio (meses)
  percLance: number;             // Lance ofertado (% da carta)
  mesContemplacaoConsorcio: number; // Mês estimado de contemplação com lance

  // Premissas de mercado
  valorizacaoAnual: number;      // Valorização anual do imóvel (%)
  custosVenda: number;           // Custos de venda do imóvel (% do valor — corretagem, ITBI etc.)
}

export interface SaidaMesData {
  mes: number;
  // Cenário financiamento
  saldoDevedorFin: number;
  parcelaFin: number;
  patrimonioLiquidoFin: number;  // valor imóvel - saldo devedor
  // Cenário consórcio
  desembolsoAcumCons: number;
  parcelaCons: number;
  patrimonioLiquidoCons: number;
}

export interface SaidaFinanciamentoResults {
  // Venda do imóvel
  capitalLiquidoVenda: number;   // Valor de venda - saldo devedor - custos
  lanceEmReaisConsorcio: number; // Quanto do capital vai para lance
  sobra: number;                 // Capital que sobra após lance

  // Financiamento (manter como está)
  totalRestanteFin: number;      // Total a pagar no financiamento (soma parcelas restantes)
  patrimonioFinalFin: number;    // Valor imóvel corrigido - 0 (quitado)

  // Consórcio (migrar)
  parcelaConsorcio: number;      // Parcela mensal do consórcio
  parcelaPosLance: number;       // Parcela após contemplação (saldo reduzido)
  totalConsorcio: number;        // Total desembolsado no consórcio
  patrimonioFinalCons: number;   // Valor carta × valorização

  // Comparativos
  economiaParcelaMensal: number; // Diferença de parcela mês a mês
  economiaTotalCusto: number;    // Diferença total de custo
  diferencaPatrimonial: number;  // Patrimônio final consórcio - financiamento
  prazoParaImovelCons: number;   // Mês em que o imóvel é adquirido (contemplação)

  // Timeline
  timeline: SaidaMesData[];
}

export const defaultSaidaInputs: SaidaFinanciamentoInputs = {
  valorImovelAtual: 600_000,
  saldoDevedor: 380_000,
  parcelaAtual: 4_200,
  prazoRestanteMeses: 264,       // 22 anos
  taxaJurosMensal: 0.83,         // ~10% a.a.
  cartaConsorcio: 500_000,
  taxaAdmConsorcio: 18,
  prazoConsorcio: 120,
  percLance: 25,
  mesContemplacaoConsorcio: 8,
  valorizacaoAnual: 6,
  custosVenda: 6,                // 6% do valor (corretagem 5% + despesas)
};

export function calcSaidaFinanciamento(i: SaidaFinanciamentoInputs): SaidaFinanciamentoResults {
  const {
    valorImovelAtual, saldoDevedor, parcelaAtual, prazoRestanteMeses,
    taxaJurosMensal, cartaConsorcio, taxaAdmConsorcio, prazoConsorcio,
    percLance, mesContemplacaoConsorcio, valorizacaoAnual, custosVenda,
  } = i;

  const taxaJurosFrac = taxaJurosMensal / 100;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;
  const taxaAdmFrac = taxaAdmConsorcio / 100;

  // ── Venda do imóvel financiado ──────────────────────────────────────────────
  const custosVendaR = valorImovelAtual * (custosVenda / 100);
  const capitalLiquidoVenda = Math.max(valorImovelAtual - saldoDevedor - custosVendaR, 0);

  // Lance no consórcio com capital da venda
  const lanceMaxConsorcio = cartaConsorcio * (percLance / 100);
  const lanceEmReaisConsorcio = Math.min(capitalLiquidoVenda, lanceMaxConsorcio);
  const sobra = capitalLiquidoVenda - lanceEmReaisConsorcio;

  // ── Consórcio ───────────────────────────────────────────────────────────────
  const valorPlanoConsorcio = cartaConsorcio * (1 + taxaAdmFrac);
  const parcelaConsorcio = valorPlanoConsorcio / prazoConsorcio;

  const saldoDevedorPosLance = Math.max(cartaConsorcio - lanceEmReaisConsorcio, 0);
  const prazoPos = prazoConsorcio - mesContemplacaoConsorcio;
  const parcelaPosLance =
    prazoPos > 0
      ? (saldoDevedorPosLance * (1 + taxaAdmFrac)) / prazoConsorcio
      : 0;

  const totalConsorcio =
    parcelaConsorcio * mesContemplacaoConsorcio +
    lanceEmReaisConsorcio +
    parcelaPosLance * prazoPos;

  // ── Financiamento — total restante (SAC simplificado) ──────────────────────
  // Para simplicidade: amortização constante sobre saldo atual
  const amortizacaoMensal = saldoDevedor / prazoRestanteMeses;
  let saldoFin = saldoDevedor;
  let totalRestanteFin = 0;
  for (let m = 0; m < prazoRestanteMeses; m++) {
    const jurosMes = saldoFin * taxaJurosFrac;
    totalRestanteFin += amortizacaoMensal + jurosMes;
    saldoFin -= amortizacaoMensal;
  }

  // Patrimônio final — financiamento: imóvel atual valorizado (mesmo prazo)
  const prazoAnalise = Math.max(prazoRestanteMeses, prazoConsorcio);
  const patrimonioFinalFin = valorImovelAtual * Math.pow(1 + valorizMensal, prazoAnalise);

  // Patrimônio final — consórcio: carta valorizada
  const patrimonioFinalCons =
    cartaConsorcio * Math.pow(1 + valorizMensal, prazoAnalise - mesContemplacaoConsorcio) + sobra;

  // ── Comparativos ────────────────────────────────────────────────────────────
  const economiaParcelaMensal = parcelaAtual - parcelaPosLance;
  const economiaTotalCusto = totalRestanteFin - totalConsorcio;
  const diferencaPatrimonial = patrimonioFinalCons - patrimonioFinalFin;

  // ── Timeline ────────────────────────────────────────────────────────────────
  const timeline: SaidaMesData[] = [];
  let saldoFinTimeline = saldoDevedor;
  let desembolsoAcumCons = 0;
  const prazoTL = Math.min(prazoAnalise, 360);

  for (let m = 1; m <= prazoTL; m++) {
    // Financiamento
    const jurosMes = saldoFinTimeline * taxaJurosFrac;
    const amort = saldoFinTimeline > 0 ? Math.min(amortizacaoMensal, saldoFinTimeline) : 0;
    const parcelaMesFin = amort + jurosMes;
    saldoFinTimeline = Math.max(saldoFinTimeline - amort, 0);
    const valorImovelMes = valorImovelAtual * Math.pow(1 + valorizMensal, m);
    const patrimonioLiquidoFin = valorImovelMes - saldoFinTimeline;

    // Consórcio
    const parcelaMesCons = m <= mesContemplacaoConsorcio ? parcelaConsorcio : parcelaPosLance;
    if (m === mesContemplacaoConsorcio + 1) {
      desembolsoAcumCons += lanceEmReaisConsorcio;
    }
    desembolsoAcumCons += parcelaMesCons;

    const patrimonioLiquidoCons =
      m <= mesContemplacaoConsorcio
        ? 0
        : cartaConsorcio * Math.pow(1 + valorizMensal, m - mesContemplacaoConsorcio) + sobra;

    timeline.push({
      mes: m,
      saldoDevedorFin: saldoFinTimeline,
      parcelaFin: parcelaMesFin,
      patrimonioLiquidoFin,
      desembolsoAcumCons,
      parcelaCons: parcelaMesCons,
      patrimonioLiquidoCons,
    });
  }

  return {
    capitalLiquidoVenda,
    lanceEmReaisConsorcio,
    sobra,
    totalRestanteFin,
    patrimonioFinalFin,
    parcelaConsorcio,
    parcelaPosLance,
    totalConsorcio,
    patrimonioFinalCons,
    economiaParcelaMensal,
    economiaTotalCusto,
    diferencaPatrimonial,
    prazoParaImovelCons: mesContemplacaoConsorcio,
    timeline,
  };
}
