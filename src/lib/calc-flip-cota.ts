// ─── Simulador de Alavancagem / Flip de Cota ─────────────────────────────────
//
// MODELO CANÔNICO = documento "Correções para aplicar na Calculadora" (item 7).
// Diferente do HTML nominal: aqui o INCC É aplicado (convenção discreta, igual ao
// Simulador de Lance), tanto no desembolso (parcelas reajustadas mês a mês) quanto
// na base do ágio (sobre a CARTA CHEIA corrigida pelo INCC).
//
// Fonte única de verdade: simularConsorcio() — INCC discreto, meia parcela e lance.
//
// Fórmulas (item 7 do documento):
//   C_atual          = carta corrigida pelo INCC no mês da contemplação
//   Desembolso_Total = Σ parcelas (com INCC) até a contemplação + lance próprio
//   V_agio           = C_atual × ágio%        (ágio sobre a carta cheia corrigida)
//   Valor_Recebido   = V_agio
//   Lucro_Liq        = V_agio − Desembolso_Total
//   ROI              = Lucro_Liq / Desembolso_Total
//   TIR mensal       = (V_agio/Desembolso_Total)^(1/mesContemplacao) − 1

import { simularConsorcio, tirMensalSimples, anualFromMensalPerc } from "./consorcio-core";

export interface FlipMes {
  mes: number;
  parcela: number;
  desembolsoAcum: number;
}

export interface FlipCotaInputs {
  cartaCredito: number;
  prazo: number;
  meiaParcela: boolean;
  taxaAdm: number;
  fundoReserva: number;
  lancePerc: number;
  tipoLance: "embutido" | "proprio";
  mesContemplacao: number;
  agioVenda: number;
  taxaAtualizacaoAnual: number;
}

export interface FlipCotaResults {
  parcelaCheia: number;
  parcelaEfetiva: number;
  creditoLiquido: number;
  creditoAtualizado: number;  // carta cheia corrigida pelo INCC no mês da contemplação
  desembolsoLance: number;
  valorPagoParcelas: number;
  desembolsoTotal: number;
  valorVenda: number;
  precoVendaTotal: number;
  lucroLiquido: number;
  tirMensal: number;
  tirAnual: number;
  roiTotal: number;
  paybackMes: number;
  multAtualizacao: number;    // = 1 (flip não aplica INCC)
  timeline: FlipMes[];
}

export const defaultFlipCotaInputs: FlipCotaInputs = {
  cartaCredito: 500_000,
  prazo: 240,
  meiaParcela: true,
  taxaAdm: 23.5,
  fundoReserva: 1.5,
  lancePerc: 50,
  tipoLance: "embutido",
  mesContemplacao: 36,
  agioVenda: 20,
  taxaAtualizacaoAnual: 4,
};

export function calcFlipCota(i: FlipCotaInputs): FlipCotaResults {
  const N = Math.max(i.prazo, 1);
  const mc = Math.min(Math.max(i.mesContemplacao, 1), N);

  // Lance próprio (R$) sai do bolso; lance embutido vem da própria carta.
  const desembolsoLance = i.tipoLance === "proprio"
    ? i.cartaCredito * (i.lancePerc / 100) : 0;
  const percEmbutido = i.tipoLance === "embutido" ? i.lancePerc : 0;

  // ── Motor único: INCC discreto, meia parcela e lance até a contemplação ───
  const sim = simularConsorcio({
    carta:             i.cartaCredito,
    taxaAdm:           i.taxaAdm,
    fundoReserva:      i.fundoReserva,
    prazo:             N,
    inccAnual:         i.taxaAtualizacaoAnual,
    mesContemplacao:   mc,
    lanceEmbutidoPerc: percEmbutido,
    lanceProprioR:     desembolsoLance,
    meiaParcela:       i.meiaParcela,
    amortizacao:       "parcela",
    horizonteMeses:    mc,
  });

  // ── Parcelas (com INCC) ───────────────────────────────────────────────────
  const parcelaCheia = sim.parcelaNominal;                 // parcela cheia mês 1
  const parcelaEfetiva = sim.timeline[0]?.parcela ?? parcelaCheia; // meia, se aplicável
  const valorPagoParcelas = sim.parcelasAteContemplacao;   // Σ parcelas com INCC até mc

  // ── Carta corrigida e crédito líquido ─────────────────────────────────────
  const creditoAtualizado = sim.cartaCorrigida;            // C_atual = carta × (1+INCC)^⌊mc/12⌋
  const creditoLiquido = sim.poderDeCompra;                // carta corrigida − embutido
  const multAtualizacao = i.cartaCredito > 0 ? creditoAtualizado / i.cartaCredito : 1;

  // ── Desembolso total (só o que sai do bolso) ──────────────────────────────
  const desembolsoTotal = valorPagoParcelas + desembolsoLance;

  // ── Venda com ágio (sobre a carta cheia corrigida) e lucro ────────────────
  const valorVenda = creditoAtualizado * (i.agioVenda / 100); // V_agio = C_atual × ágio%
  const precoVendaTotal = creditoAtualizado + valorVenda;
  const lucroLiquido = valorVenda - desembolsoTotal;

  // ── TIR / ROI ─────────────────────────────────────────────────────────────
  const tirMensal = tirMensalSimples(desembolsoTotal, valorVenda, mc);
  const tirAnual = anualFromMensalPerc(tirMensal);
  const roiTotal = desembolsoTotal > 0 ? (lucroLiquido / desembolsoTotal) * 100 : 0;

  // ── Timeline (parcelas reais com INCC) para o gráfico ─────────────────────
  const timeline: FlipMes[] = [];
  let acum = 0;
  for (let m = 1; m <= mc; m++) {
    const parcelaMes = sim.timeline[m - 1]?.parcela ?? parcelaEfetiva;
    acum += parcelaMes + (m === mc ? desembolsoLance : 0);
    timeline.push({ mes: m, parcela: parcelaMes, desembolsoAcum: acum });
  }

  return {
    parcelaCheia,
    parcelaEfetiva,
    creditoLiquido,
    creditoAtualizado,
    desembolsoLance,
    valorPagoParcelas,
    desembolsoTotal,
    valorVenda,
    precoVendaTotal,
    lucroLiquido,
    tirMensal,
    tirAnual,
    roiTotal,
    paybackMes: mc,
    multAtualizacao,
    timeline,
  };
}
