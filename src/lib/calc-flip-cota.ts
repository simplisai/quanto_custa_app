// ─── Simulador de Alavancagem / Flip de Cota ─────────────────────────────────
// Lógica: operador compra cota → paga parcelas (com ou sem meia parcela)
// → oferta lance → é contemplado → vende a cota com ágio → lucra.
//
// valorVenda = crédito_líquido × (ágio %)   ← o prêmio recebido do comprador
// lucro      = valorVenda - desembolsoTotal
// TIR mensal = (valorVenda / desembolsoTotal)^(1/mesContemplacao) - 1

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
}

export interface FlipCotaResults {
  parcelaCheia: number;         // Parcela 100%
  parcelaEfetiva: number;       // Parcela paga (100% ou 50%)
  creditoLiquido: number;       // Crédito após desconto do lance embutido
  desembolsoLance: number;      // Lance em recursos próprios desembolsado
  valorPagoParcelas: number;    // Total pago em parcelas
  desembolsoTotal: number;      // Total investido (parcelas + lance próprio)
  valorVenda: number;           // Ágio recebido na venda (R$)
  precoVendaTotal: number;      // Preço total que o comprador paga (crédito líquido + ágio)
  lucroLiquido: number;         // Lucro líquido da operação
  tirMensal: number;            // TIR mensal (%)
  tirAnual: number;             // TIR anual (%)
  roiTotal: number;             // ROI total (%)
  paybackMes: number;           // Mês estimado de payback (= mesContemplacao, pois recebe tudo na venda)
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
  } = i;

  const prazoSafe = Math.max(prazo, 1);
  const mesContemp = Math.min(Math.max(mesContemplacao, 1), prazoSafe);

  // ── Parcelas ─────────────────────────────────────────────────────────────
  const taxaTotal = taxaAdm + fundoReserva;
  const custoTotalPlano = cartaCredito * (1 + taxaTotal / 100);
  const parcelaCheia = custoTotalPlano / prazoSafe;
  const parcelaEfetiva = meiaParcela ? parcelaCheia / 2 : parcelaCheia;
  const valorPagoParcelas = parcelaEfetiva * mesContemp;

  // ── Lance ─────────────────────────────────────────────────────────────────
  let creditoLiquido = cartaCredito;
  let desembolsoLance = 0;

  if (lancePerc > 0) {
    if (tipoLance === "embutido") {
      // Lance embutido: abate do crédito líquido (não é desembolso extra)
      creditoLiquido = cartaCredito - cartaCredito * (lancePerc / 100);
    } else {
      // Lance próprio: desembolso real do operador
      desembolsoLance = cartaCredito * (lancePerc / 100);
    }
  }

  // ── Desembolso total ─────────────────────────────────────────────────────
  const desembolsoTotal = valorPagoParcelas + desembolsoLance;

  // ── Venda com ágio ───────────────────────────────────────────────────────
  // O ágio é a % sobre o crédito LÍQUIDO que o comprador paga como prêmio
  const valorVenda = creditoLiquido * (agioVenda / 100);
  const precoVendaTotal = creditoLiquido + valorVenda; // total que o comprador paga
  const lucroLiquido = valorVenda - desembolsoTotal;

  // ── TIR mensal ───────────────────────────────────────────────────────────
  // TIR = (valorVenda / desembolsoTotal)^(1/mesContemplacao) - 1
  let tirMensal = 0;
  if (desembolsoTotal > 0 && valorVenda > 0 && mesContemp > 0) {
    tirMensal = (Math.pow(valorVenda / desembolsoTotal, 1 / mesContemp) - 1) * 100;
  }
  const tirAnual = (Math.pow(1 + tirMensal / 100, 12) - 1) * 100;
  const roiTotal = desembolsoTotal > 0 ? (lucroLiquido / desembolsoTotal) * 100 : 0;

  return {
    parcelaCheia,
    parcelaEfetiva,
    creditoLiquido,
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
  };
}
