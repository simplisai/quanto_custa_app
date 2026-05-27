// ─── Simulador de Lance ──────────────────────────────────────────────────────
// Responde: "O que preciso dar de lance para ser contemplado no mês X?"
// e mostra a economia real vs. esperar contemplação aleatória.

export interface LanceInputs {
  cartaCredito: number;        // Valor da carta de crédito (R$)
  taxaAdmTotal: number;        // Taxa de administração total (% — ex: 18%)
  prazoMeses: number;          // Prazo do grupo (meses)
  percLanceEmb: number;        // Lance embutido (% da carta) — ex: 20
  lanceProprioR: number;       // Lance próprio em R$
  tipoLance: "embutido" | "proprio" | "combinado";
  mesContemplacaoLance: number; // Mês-alvo de contemplação com lance
  mesSemLance: number;         // Mês médio de contemplação sem lance (ex: prazo * 0.6)
  tipoAbatimentoLance: "credito" | "saldoDevedor"; // Lance abate crédito recebido ou saldo devedor
  taxaAtualizacaoAnual: number; // Taxa de atualização anual da carta (INCC, % a.a.)
}

export interface MesData {
  mes: number;
  parcelaSemLance: number;
  parcelaComLance: number;     // pré-contemplação = mesma; pós = menor
  desembolsoAcumSemLance: number;
  desembolsoAcumComLance: number;
}

export interface LanceResults {
  // Parcelas
  parcelaPadrao: number;       // Parcela sem lance (pré e pós, igual)
  parcelaPosLance: number;     // Parcela após contemplação com lance

  // Lance
  lanceEmbR: number;           // Lance embutido em R$
  lanceTotalR: number;         // Lance total = emb + próprio
  percLanceTotalSobreCarta: number; // % total sobre a carta

  // Crédito
  creditoLiquido: number;      // Crédito disponível após lance (depende do tipoAbatimento)
  cartaAtualizada: number;     // Carta de crédito corrigida pelo INCC na contemplação

  // Totais
  totalSemLance: number;
  totalComLance: number;
  economia: number;

  // Mês-a-mês
  timeline: MesData[];

  // Break-even: mês em que a economia de parcelas cobre o lance próprio
  breakEvenMes: number | null;

  // Detalhes
  saldoDevedorPosLance: number;
  parcelesPre: number;         // Qtde de parcelas antes da contemplação com lance
  parcelesPos: number;         // Qtde de parcelas após
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
  const {
    cartaCredito,
    taxaAdmTotal,
    prazoMeses,
    percLanceEmb,
    lanceProprioR,
    tipoLance,
    mesContemplacaoLance,
    mesSemLance,
    tipoAbatimentoLance,
    taxaAtualizacaoAnual,
  } = i;

  // Carta corrigida pelo INCC no mês da contemplação
  const cartaAtualizada = cartaCredito * Math.pow(1 + (taxaAtualizacaoAnual || 0) / 100, mesContemplacaoLance / 12);

  const prazo = Math.max(prazoMeses, 1);
  const mesLance = Math.min(Math.max(mesContemplacaoLance, 1), prazo);
  const mesSL = Math.min(Math.max(mesSemLance, 1), prazo);

  // ── Parcela padrão ──────────────────────────────────────────────────────
  // Valor do plano = carta × (1 + taxa_adm %)
  // Parcela mensal = valor_plano / prazo
  const taxaAdmFrac = taxaAdmTotal / 100;
  const valorPlano = cartaCredito * (1 + taxaAdmFrac);
  const parcelaPadrao = valorPlano / prazo;

  // ── Lance ────────────────────────────────────────────────────────────────
  let lanceEmbR = 0;
  let lanceProprio = 0;

  if (tipoLance === "embutido" || tipoLance === "combinado") {
    lanceEmbR = cartaCredito * (percLanceEmb / 100);
  }
  if (tipoLance === "proprio" || tipoLance === "combinado") {
    lanceProprio = lanceProprioR;
  }
  if (tipoLance === "proprio") {
    // only próprio, no embutido
    lanceEmbR = 0;
    lanceProprio = lanceProprioR;
  }

  const lanceTotalR = lanceEmbR + lanceProprio;
  const percLanceTotalSobreCarta = cartaCredito > 0 ? (lanceTotalR / cartaCredito) * 100 : 0;

  // Crédito líquido e saldo devedor dependem do tipo de abatimento:
  //   "credito"       → lance embutido reduz o crédito recebido (o cliente recebe menos)
  //   "saldoDevedor"  → o cliente recebe a carta cheia, mas o saldo devedor é menor
  let creditoLiquido: number;
  let saldoDevedorPosLance: number;

  if (tipoAbatimentoLance === "credito") {
    creditoLiquido = Math.max(cartaCredito - lanceEmbR, 0);
    saldoDevedorPosLance = Math.max(creditoLiquido - lanceProprio, 0);
  } else {
    // saldoDevedor (padrão)
    creditoLiquido = cartaCredito; // recebe a carta cheia
    saldoDevedorPosLance = Math.max(cartaCredito - lanceTotalR, 0);
  }

  // Parcela pós-contemplação (recalculada sobre saldo menor, dividida pelo prazo restante)
  const parcelasRestantes = prazo - mesLance;
  const parcelaPosLance =
    parcelasRestantes > 0
      ? (saldoDevedorPosLance * (1 + taxaAdmFrac)) / parcelasRestantes
      : 0;

  // ── Totais ───────────────────────────────────────────────────────────────
  // Sem lance: paga parcela padrão por todo o prazo
  const totalSemLance = parcelaPadrao * prazo;

  // Com lance:
  //   - Parcelas pré-contemplação (meses 1 → mesLance): parcela padrão
  //   - Desembolso do lance próprio no mês da contemplação
  //   - Parcelas pós-contemplação: parcela reduzida × parcelasRestantes
  //   (lance embutido não é desembolso adicional — vem da própria carta)
  const parcelasPre = parcelaPadrao * mesLance;
  const parcelasPos = parcelaPosLance * parcelasRestantes;
  const totalComLance = parcelasPre + lanceProprio + parcelasPos;

  const economia = totalSemLance - totalComLance;

  // ── Break-even ───────────────────────────────────────────────────────────
  // Mês a partir da contemplação em que a economia acumulada de parcelas
  // supera o desembolso do lance próprio.
  let breakEvenMes: number | null = null;
  if (lanceProprio > 0) {
    const economiaParcelaMes = parcelaPadrao - parcelaPosLance;
    if (economiaParcelaMes > 0) {
      const mesesParaRecuperar = Math.ceil(lanceProprio / economiaParcelaMes);
      const breakEvenAbsoluto = mesLance + mesesParaRecuperar;
      breakEvenMes = breakEvenAbsoluto <= prazo ? breakEvenAbsoluto : null;
    }
  }

  // ── Timeline mês a mês ───────────────────────────────────────────────────
  const timeline: MesData[] = [];
  let acumSemLance = 0;
  let acumComLance = 0;

  for (let m = 1; m <= prazo; m++) {
    // Sem lance: parcela padrão sempre
    acumSemLance += parcelaPadrao;

    // Com lance:
    if (m <= mesLance) {
      // Pré-contemplação: parcela padrão
      acumComLance += parcelaPadrao;
    } else if (m === mesLance + 1) {
      // Contemplação: adiciona lance próprio e a primeira parcela pós
      acumComLance += lanceProprio + parcelaPosLance;
    } else {
      acumComLance += parcelaPosLance;
    }

    // A parcela exibida no mês
    const parcelaComLanceMes = m <= mesLance ? parcelaPadrao : parcelaPosLance;

    timeline.push({
      mes: m,
      parcelaSemLance: parcelaPadrao,
      parcelaComLance: parcelaComLanceMes,
      desembolsoAcumSemLance: acumSemLance,
      desembolsoAcumComLance: acumComLance,
    });
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
    parcelesPre: mesLance,
    parcelesPos: parcelasRestantes,
  };
}
