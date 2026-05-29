// ─── Simulador de Alavancagem / Flip de Cota ─────────────────────────────────
// Lógica: operador compra cota → paga parcelas (com ou sem meia parcela)
// → oferta lance → é contemplado → vende a cota com ágio → lucra.
//
// valorVenda = crédito_líquido × (ágio %)   ← o prêmio recebido do comprador
// lucro      = valorVenda - desembolsoTotal
// TIR mensal = (valorVenda / desembolsoTotal)^(1/mesContemplacao) - 1

import {
  simularConsorcio,
  tirMensalSimples,
  anualFromMensal,
  type ConsorcioMes,
} from "./consorcio-core";

export interface FlipCotaInputs {
  cartaCredito: number;         // Valor do crédito original (R$)
  prazo: number;                // Prazo do plano (meses)
  meiaParcela: boolean;         // Paga 50% da parcela até contemplar?
  taxaAdm: number;              // Taxa de administração total (%)
  fundoReserva: number;         // Fundo de reserva (%)
  lancePerc: number;            // Lance (% do crédito)
  tipoLance: "embutido" | "proprio";
  mesContemplacao: number;      // Mês estimado de contemplação
  agioVenda: number;            // Ágio cobrado na venda (% do crédito líquido)
  taxaAtualizacaoAnual: number; // Taxa de atualização anual da carta (INCC, % a.a.)
}

export interface FlipCotaResults {
  parcelaCheia: number;         // Parcela 100%
  parcelaEfetiva: number;       // Parcela paga (100% ou 50%)
  creditoLiquido: number;       // Crédito após desconto do lance embutido (nominal)
  creditoAtualizado: number;    // Crédito líquido corrigido pelo INCC na contemplação
  desembolsoLance: number;      // Lance em recursos próprios desembolsado
  valorPagoParcelas: number;    // Total pago em parcelas
  desembolsoTotal: number;      // Total investido (parcelas + lance próprio)
  valorVenda: number;           // Ágio recebido na venda (R$) sobre crédito atualizado
  precoVendaTotal: number;      // Preço total que o comprador paga (crédito atualizado + ágio)
  lucroLiquido: number;         // Lucro líquido da operação
  tirMensal: number;            // TIR mensal (%)
  tirAnual: number;             // TIR anual (%)
  roiTotal: number;             // ROI total (%)
  paybackMes: number;           // Mês estimado de payback (= mesContemplacao, pois recebe tudo na venda)
  multAtualizacao: number;      // Multiplicador INCC aplicado
  timeline: ConsorcioMes[];     // Evolução mês a mês (parcela reajustada, crédito corrigido)
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
  const {
    cartaCredito,
    prazo,
    meiaParcela,
    taxaAdm,
    fundoReserva,
    lancePerc,
    tipoLance,
    mesContemplacao,
    agioVenda,
    taxaAtualizacaoAnual,
  } = i;

  const prazoSafe = Math.max(prazo, 1);
  const mesContemp = Math.min(Math.max(mesContemplacao, 1), prazoSafe);
  const multAtualizacao = Math.pow(1 + (taxaAtualizacaoAnual || 0) / 100, mesContemp / 12);

  // ── Núcleo: simula a cota com parcela e crédito atualizados pelo INCC ──────
  // O lance embutido reduz o crédito líquido; o lance próprio é desembolso real.
  const sim = simularConsorcio({
    credito: cartaCredito,
    taxaAdm,
    fundoReserva,
    prazo: prazoSafe,
    inccAnual: taxaAtualizacaoAnual,
    mesContemplacao: mesContemp,
    lanceEmbutidoPerc: tipoLance === "embutido" ? lancePerc : 0,
    lanceProprioR: tipoLance === "proprio" ? cartaCredito * (lancePerc / 100) : 0,
    meiaParcela,
    horizonteMeses: mesContemp, // o operador paga só até contemplar e vende
  });

  const parcelaCheia = sim.timeline[mesContemp - 1]?.parcelaCheia ?? 0;
  const parcelaEfetiva = sim.timeline[mesContemp - 1]?.parcela ?? 0;

  // Parcelas EFETIVAMENTE pagas até a contemplação (já reajustadas pelo INCC) —
  // corrige o bug de desembolso subestimado.
  const valorPagoParcelas = sim.timeline
    .filter((t) => t.mes <= mesContemp)
    .reduce((acc, t) => acc + t.parcela, 0);

  const desembolsoLance = tipoLance === "proprio" ? cartaCredito * (lancePerc / 100) : 0;

  // ── Crédito atualizado e crédito líquido (após lance embutido) ────────────
  const creditoLiquido = sim.creditoLiquido / multAtualizacao; // valor nominal líquido (sem INCC)
  const creditoAtualizado = sim.creditoLiquido; // já corrigido pelo INCC na contemplação

  // ── Desembolso total real ──────────────────────────────────────────────────
  const desembolsoTotal = valorPagoParcelas + desembolsoLance;

  // ── Venda com ágio ───────────────────────────────────────────────────────
  const valorVenda = creditoAtualizado * (agioVenda / 100);
  const precoVendaTotal = creditoAtualizado + valorVenda;
  const lucroLiquido = valorVenda - desembolsoTotal;

  // ── TIR mensal ───────────────────────────────────────────────────────────
  const tirMensal = tirMensalSimples(desembolsoTotal, valorVenda, mesContemp);
  const tirAnual = anualFromMensal(tirMensal);
  const roiTotal = desembolsoTotal > 0 ? (lucroLiquido / desembolsoTotal) * 100 : 0;

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
    paybackMes: mesContemp,
    multAtualizacao,
    timeline: sim.timeline,
  };
}
