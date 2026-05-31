// ─── Simulador de Renda Passiva com Consórcio ────────────────────────────────
// Foco: rendimento com aluguel + valor patrimonial do imóvel;
//       e crédito rendendo CDI vs parcela corrigida pelo INCC.
//
// CORREÇÃO CDI: a capitalização do crédito no CDI inicia a partir do valor da
// carta JÁ CORRIGIDO PELO INCC na data da contemplação (cartaAtualizada),
// nunca pelo valor nominal retroativo de início do contrato.
//
// Fonte única de verdade: simularConsorcio() mensal → KPI cards == gráficos.

import {
  simularConsorcio,
  valorFuturo,
} from "./consorcio-core";

export type UsoCreditoContemplado = "compra_imovel" | "credito_rende_cdi";

export interface RendaPassivaInputs {
  cartaCredito: number;
  taxaAdmTotal: number;
  prazoMeses: number;
  percLance: number;
  lanceProprioR: number;
  mesContemplacao: number;
  rendaAluguelMensal: number;
  reajusteAluguelAnual: number;
  valorizacaoAnual: number;
  taxaCDIAnual: number;
  taxaAtualizacaoAnual: number;
  usoCreditoContemplado: UsoCreditoContemplado;
}

export interface MesRenda {
  mes: number;
  parcelaCons: number;
  rendaAluguel: number;
  fluxoLiquido: number;
  fluxoAcum: number;
  totalInvestido: number;
  patrimonioImóvel: number;
  patrimonioTotal: number;
  creditoCDI: number;
}

export interface RendaPassivaResults {
  parcelaPadrao: number;
  parcelaPosLance: number;
  lanceEmbR: number;
  lanceProprio: number;
  saldoDevedorPosLance: number;
  totalInvestido: number;
  totalRendaGerada: number;
  valorImovelFinal: number;
  patrimonioFinal: number;
  retornoTotalR: number;
  roiPercentual: number;
  roiAnual: number;
  cartaAtualizada: number;
  mesFluxoNeutro: number | null;
  creditoFinalComCDI: number;
  totalParcelasComINCC: number;
  spreadCDIvsINCC: number;
  lucroEstrategiaCDI: number;
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
  const N = Math.max(i.prazoMeses, 1);
  const mc = Math.min(Math.max(i.mesContemplacao, 1), N);
  const vMensal  = Math.pow(1 + i.valorizacaoAnual / 100, 1 / 12) - 1;
  const cdiMensal = Math.pow(1 + i.taxaCDIAnual / 100, 1 / 12) - 1;
  const iAlug    = i.reajusteAluguelAnual / 100;
  const isCDI    = i.usoCreditoContemplado === "credito_rende_cdi";

  // ── Simulação mensal do consórcio ────────────────────────────────────────
  const sim = simularConsorcio({
    credito:           i.cartaCredito,
    taxaAdm:           i.taxaAdmTotal,
    prazo:             N,
    inccAnual:         i.taxaAtualizacaoAnual,
    mesContemplacao:   mc,
    lanceEmbutidoPerc: i.percLance,
    lanceProprioR:     i.lanceProprioR,
    amortizacao:       "parcela",
  });

  // KPIs derivados da timeline
  const parcelaPadrao       = sim.parcelaNominal;
  const parcelaPosLance     = sim.parcelaReduzida;
  const lanceEmbR           = sim.lanceEmbutidoR;
  const lanceProprio        = sim.lanceProprioR;
  const saldoDevedorPosLance = sim.saldoDevedor;

  // Crédito corrigido pelo INCC na data da contemplação (base do CDI)
  // CORREÇÃO: usa o valor da carta atualizada pelos reajustes anuais até mc,
  // não o valor nominal de início do contrato.
  const cartaAtualizada = sim.cartaCorrigida;

  // ── Simulação mês a mês ─────────────────────────────────────────────────
  const timeline: MesRenda[] = [];
  let totalInvestido   = 0;
  let totalRendaGerada = 0;
  let fluxoAcum        = 0;
  let rendaAcum        = 0; // aluguel BRUTO acumulado (Diretriz 5: Caixa_Aluguel)
  let mesFluxoNeutro: number | null = null;
  // CDI: inicia com o crédito JÁ corrigido pelo INCC na contemplação
  let creditoCDIAcum   = 0;

  for (let m = 1; m <= N; m++) {
    const simMes = sim.timeline[m - 1];
    const parcelaCons = simMes?.parcela ?? 0;

    // Lance próprio no mês da contemplação; crédito começa a render CDI
    if (m === mc) {
      totalInvestido += lanceProprio;
      if (isCDI) {
        // Base do CDI = carta corrigida pelo INCC acumulado até a contemplação
        creditoCDIAcum = cartaAtualizada;
      }
    }

    // CDI: cresce mensalmente após contemplação
    if (isCDI && m > mc) {
      creditoCDIAcum *= (1 + cdiMensal);
    }

    // Renda de aluguel (só no cenário compra_imovel, após contemplação)
    let renda = 0;
    if (!isCDI && m > mc) {
      const anosPosCont = Math.floor((m - mc - 1) / 12);
      renda = i.rendaAluguelMensal * Math.pow(1 + iAlug, anosPosCont);
      totalRendaGerada += renda;
      rendaAcum += renda;
    }

    const fluxoLiquido = renda - parcelaCons;
    fluxoAcum += fluxoLiquido;
    totalInvestido += parcelaCons;

    // Patrimônio do imóvel após contemplação
    let patrimonioImovel = 0;
    if (!isCDI && m >= mc) {
      patrimonioImovel = i.cartaCredito * Math.pow(1 + vMensal, m - mc);
    }

    // Diretriz 5: Pat = V_futuro(imóvel) + Caixa_Aluguel (aluguel BRUTO acumulado)
    const patrimonioTotal = isCDI ? creditoCDIAcum : patrimonioImovel + rendaAcum;

    if (!isCDI && mesFluxoNeutro === null && m > mc && renda >= parcelaCons) {
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

  // ── Resultados finais derivados da timeline ───────────────────────────────
  const ultimoMes = timeline[timeline.length - 1];
  // Diretriz 5: valorização incide só sobre os meses pós-contemplação (T_pos = N − mc),
  // eliminando a "rentabilidade fantasma" dos meses de espera.
  const valorImovelFinal = valorFuturo(i.cartaCredito, i.valorizacaoAnual / 100, (N - mc) / 12);
  const creditoFinalComCDI = isCDI ? (ultimoMes?.creditoCDI ?? 0) : 0;
  // Diretriz 5: Pat_final = V_futuro + Caixa_Aluguel (aluguel bruto acumulado)
  const patrimonioFinal = isCDI ? creditoFinalComCDI : valorImovelFinal + totalRendaGerada;

  const retornoTotalR = patrimonioFinal - totalInvestido;
  const roiPercentual = totalInvestido > 0 ? (retornoTotalR / totalInvestido) * 100 : 0;
  const anos = N / 12;
  const roiAnual =
    totalInvestido > 0 && patrimonioFinal > 0
      ? (Math.pow(patrimonioFinal / totalInvestido, 1 / anos) - 1) * 100 : 0;

  // Σ parcelas pagas (sem o lance próprio, que já está em totalInvestido)
  const totalParcelasComINCC = isCDI ? Math.max(totalInvestido - lanceProprio, 0) : 0;
  // Lucro real da estratégia CDI = patrimônio final − tudo que foi investido (parcelas + lance)
  const lucroEstrategiaCDI   = creditoFinalComCDI - totalInvestido;
  const spreadCDIvsINCC      = creditoFinalComCDI - totalParcelasComINCC;

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
    cartaAtualizada,
    mesFluxoNeutro,
    creditoFinalComCDI,
    totalParcelasComINCC,
    spreadCDIvsINCC,
    lucroEstrategiaCDI,
    timeline,
    prazoMeses: N,
  };
}
