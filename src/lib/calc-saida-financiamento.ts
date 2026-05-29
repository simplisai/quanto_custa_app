// ─── Simulador: Saída do Financiamento ───────────────────────────────────────
// Responde: "Vale a pena eu vender meu imóvel financiado e migrar para consórcio?"
// O cliente compara patrimônio líquido, parcela mensal e custo total em ambos os cenários.

import { simularConsorcio } from "./consorcio-core";

export type TipoAbatimento = "prazo" | "parcela";

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
  percLance: number;             // Lance em recursos próprios (% da carta) — vem do capital da venda
  percLanceEmb: number;          // Lance embutido (% da carta) — sai do crédito recebido
  mesContemplacaoConsorcio: number; // Mês estimado de contemplação com lance
  tipoAbatimento: TipoAbatimento;  // Como o lance abate: reduz prazo ou parcela

  // Premissas de mercado
  valorizacaoAnual: number;      // Valorização anual do imóvel (%)
  custosVenda: number;           // Custos de venda do imóvel (% do valor — corretagem, ITBI etc.)
  taxaAtualizacaoAnual: number;  // Taxa de atualização anual da carta (INCC, % a.a. — ex: 4)
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
  lanceEmReaisConsorcio: number; // Lance total (próprio + embutido) em R$
  lanceProprioR: number;         // Lance com recursos da venda (R$)
  lanceEmbR: number;             // Lance embutido (R$) — sai do crédito
  creditoLiquido: number;        // Crédito disponível após lance embutido
  sobra: number;                 // Capital que sobra da venda após lance próprio

  // Financiamento (manter como está)
  totalRestanteFin: number;      // Total a pagar no financiamento (soma parcelas restantes)
  patrimonioFinalFin: number;    // Valor imóvel corrigido - 0 (quitado)

  // Consórcio (migrar)
  parcelaConsorcio: number;      // Parcela mensal do consórcio
  parcelaPosLance: number;       // Parcela após contemplação (saldo reduzido)
  prazoPosFinal: number;         // Prazo restante após contemplação
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
  percLanceEmb: 0,
  mesContemplacaoConsorcio: 8,
  tipoAbatimento: "parcela",
  valorizacaoAnual: 6,
  custosVenda: 6,                // 6% do valor (corretagem 5% + despesas)
  taxaAtualizacaoAnual: 4,
};

export function calcSaidaFinanciamento(i: SaidaFinanciamentoInputs): SaidaFinanciamentoResults {
  const {
    valorImovelAtual, saldoDevedor, parcelaAtual, prazoRestanteMeses,
    taxaJurosMensal, cartaConsorcio, taxaAdmConsorcio, prazoConsorcio,
    percLance, percLanceEmb, mesContemplacaoConsorcio, tipoAbatimento,
    valorizacaoAnual, custosVenda, taxaAtualizacaoAnual,
  } = i;

  const taxaJurosFrac = taxaJurosMensal / 100;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;

  // ── Venda do imóvel financiado ──────────────────────────────────────────────
  const custosVendaR = valorImovelAtual * (custosVenda / 100);
  const capitalLiquidoVenda = Math.max(valorImovelAtual - saldoDevedor - custosVendaR, 0);

  // Lance no consórcio com capital da venda
  const lanceMaxConsorcio = cartaConsorcio * (percLance / 100);
  const lanceEmReaisConsorcio = Math.min(capitalLiquidoVenda, lanceMaxConsorcio);
  const sobra = capitalLiquidoVenda - lanceEmReaisConsorcio;

  // ── Consórcio (núcleo) ───────────────────────────────────────────────────────
  // Lance embutido sai do crédito recebido (reduz poder de compra); lance próprio
  // (capital da venda) amortiza o saldo devedor conforme o tipo de abatimento.
  const prazoAnaliseSim = Math.max(prazoRestanteMeses, prazoConsorcio);
  const sim = simularConsorcio({
    credito: cartaConsorcio,
    taxaAdm: taxaAdmConsorcio,
    prazo: prazoConsorcio,
    inccAnual: taxaAtualizacaoAnual,
    mesContemplacao: mesContemplacaoConsorcio,
    lanceEmbutidoPerc: percLanceEmb || 0,
    lanceProprioR: lanceEmReaisConsorcio,
    abatimentoEmbutido: "credito",
    amortizacao: tipoAbatimento,
    horizonteMeses: prazoAnaliseSim,
  });

  const parcelaConsorcio = sim.parcelaInicial;
  const lanceEmbR = sim.lanceEmbutidoR;
  const creditoLiquido = sim.creditoLiquido;
  const lanceProprioR = lanceEmReaisConsorcio; // alias for clarity
  const saldoDevedorPosLance = sim.saldoDevedorPosLance;
  const parcelaPosLance = sim.parcelaPosLance;
  const prazoPosFinal = sim.prazoPosLance;
  const totalConsorcio = sim.desembolsoTotal;

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

    // Consórcio: parcela do núcleo (já reajustada pelo INCC). O lance próprio
    // (capital da venda) entra como desembolso no mês da contemplação.
    const parcelaMesCons = sim.timeline[m - 1]?.parcela ?? 0;
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
    prazoParaImovelCons: mesContemplacaoConsorcio,
    timeline,
  };
}
