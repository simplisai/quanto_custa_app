// ─── Simulador: Consórcio para CNPJ ──────────────────────────────────────────
// Mostra o benefício fiscal da PJ: parcelas dedutíveis como despesa operacional,
// reduzindo IRPJ/CSLL e o custo real da operação.
// Compara consórcio PJ vs. financiamento PJ (com juros + IOF).

export type RegimeTributario = "presumido" | "real";

export interface ConsorcioCNPJInputs {
  // Consórcio
  cartaCredito: number;          // Valor da carta de crédito (R$)
  taxaAdmConsorcio: number;      // Taxa de administração total (%)
  prazoConsorcio: number;        // Prazo do grupo (meses)
  percLance: number;             // Lance ofertado (% da carta)
  mesContemplacaoConsorcio: number;

  // Financiamento PJ (comparativo)
  taxaJurosMensalFin: number;    // Taxa de juros mensal do financiamento PJ (% a.m.)
  prazoFinanciamentoMeses: number;

  // Fiscal PJ
  regimeTributario: RegimeTributario;
  aliquotaIRPJ: number;          // Alíquota IRPJ (% — ex: 15 + 10 adicional = 25%)
  aliquotaCSLL: number;          // Alíquota CSLL (% — ex: 9%)
  lucroMensalEmpresa: number;    // Lucro mensal da empresa (R$) para simular base tributável

  // Premissas
  valorizacaoAnual: number;      // Valorização anual do bem (%)
}

export interface CNPJMesData {
  mes: number;
  parcelaBrutaConsorcio: number;
  economiaFiscalMes: number;
  parcelaLiquidaConsorcio: number;
  parcelaFinanciamento: number;
  saldoDevedorFin: number;
}

export interface ConsorcioCNPJResults {
  // Consórcio PJ
  parcelaBrutaConsorcio: number;
  parcelaBrutaPosLance: number;
  economiaFiscalMensal: number;   // Dedução × alíquota efetiva
  parcelaLiquidaConsorcio: number; // Pós dedução fiscal
  parcelaLiquidaPosLance: number;
  totalBrutoConsorcio: number;
  totalEconomiaFiscalConsorcio: number;
  totalLiquidoConsorcio: number;

  // Financiamento PJ
  parcelaFinanciamento: number;
  totalFinanciamento: number;
  totalJurosFinanciamento: number;

  // Comparativos
  economiaTotalVsFinanciamento: number;
  percentualEconomia: number;
  aliquotaEfetivaTotal: number;   // IRPJ + CSLL

  // Patrimônio
  valorBemFinalConsorcio: number;
  valorBemFinalFinanciamento: number;

  // Timeline
  timeline: CNPJMesData[];
}

export const defaultCNPJInputs: ConsorcioCNPJInputs = {
  cartaCredito: 800_000,
  taxaAdmConsorcio: 18,
  prazoConsorcio: 120,
  percLance: 20,
  mesContemplacaoConsorcio: 10,
  taxaJurosMensalFin: 1.2,        // ~15% a.a. (crédito imobiliário PJ)
  prazoFinanciamentoMeses: 120,
  regimeTributario: "presumido",
  aliquotaIRPJ: 15,
  aliquotaCSLL: 9,
  lucroMensalEmpresa: 50_000,
  valorizacaoAnual: 6,
};

export function calcConsorcioCNPJ(i: ConsorcioCNPJInputs): ConsorcioCNPJResults {
  const {
    cartaCredito, taxaAdmConsorcio, prazoConsorcio,
    percLance, mesContemplacaoConsorcio,
    taxaJurosMensalFin, prazoFinanciamentoMeses,
    aliquotaIRPJ, aliquotaCSLL,
    valorizacaoAnual,
  } = i;

  const taxaAdmFrac = taxaAdmConsorcio / 100;
  const aliquotaEfetivaTotal = aliquotaIRPJ + aliquotaCSLL; // %
  const aliquotaFrac = aliquotaEfetivaTotal / 100;
  const taxaJurosFrac = taxaJurosMensalFin / 100;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;

  // ── Consórcio PJ ───────────────────────────────────────────────────────────
  const valorPlano = cartaCredito * (1 + taxaAdmFrac);
  const parcelaBrutaConsorcio = valorPlano / prazoConsorcio;

  const lanceR = cartaCredito * (percLance / 100);
  const saldoPosLance = Math.max(cartaCredito - lanceR, 0);
  const prazoPos = prazoConsorcio - mesContemplacaoConsorcio;
  const parcelaBrutaPosLance =
    prazoPos > 0
      ? (saldoPosLance * (1 + taxaAdmFrac)) / prazoConsorcio
      : 0;

  // Economia fiscal: a parcela do consórcio é dedutível → reduz base de IRPJ+CSLL
  const economiaFiscalMensal = parcelaBrutaConsorcio * aliquotaFrac;
  const economiaFiscalPosLance = parcelaBrutaPosLance * aliquotaFrac;
  const parcelaLiquidaConsorcio = parcelaBrutaConsorcio - economiaFiscalMensal;
  const parcelaLiquidaPosLance = parcelaBrutaPosLance - economiaFiscalPosLance;

  const totalBrutoConsorcio =
    parcelaBrutaConsorcio * mesContemplacaoConsorcio +
    lanceR +
    parcelaBrutaPosLance * prazoPos;

  const totalEconomiaFiscalConsorcio =
    economiaFiscalMensal * mesContemplacaoConsorcio +
    economiaFiscalPosLance * prazoPos;

  const totalLiquidoConsorcio = totalBrutoConsorcio - totalEconomiaFiscalConsorcio;

  // ── Financiamento PJ ───────────────────────────────────────────────────────
  // Price simplificado
  const prazoFin = Math.max(prazoFinanciamentoMeses, 1);
  const coefPrice =
    taxaJurosFrac > 0
      ? (taxaJurosFrac * Math.pow(1 + taxaJurosFrac, prazoFin)) /
        (Math.pow(1 + taxaJurosFrac, prazoFin) - 1)
      : 1 / prazoFin;
  const parcelaFinanciamento = cartaCredito * coefPrice;
  const totalFinanciamento = parcelaFinanciamento * prazoFin;
  const totalJurosFinanciamento = totalFinanciamento - cartaCredito;

  // ── Comparativos ───────────────────────────────────────────────────────────
  const prazoAnalise = Math.max(prazoConsorcio, prazoFin);
  const economiaTotalVsFinanciamento = totalFinanciamento - totalLiquidoConsorcio;
  const percentualEconomia =
    totalFinanciamento > 0 ? (economiaTotalVsFinanciamento / totalFinanciamento) * 100 : 0;

  // Patrimônio final
  const valorBemFinalConsorcio =
    cartaCredito * Math.pow(1 + valorizMensal, prazoAnalise - mesContemplacaoConsorcio);
  const valorBemFinalFinanciamento =
    cartaCredito * Math.pow(1 + valorizMensal, prazoAnalise);

  // ── Timeline ───────────────────────────────────────────────────────────────
  const timeline: CNPJMesData[] = [];
  let saldoDevedorFin = cartaCredito;
  const amortizacaoFin = cartaCredito / prazoFin;

  const prazoTL = Math.min(prazoAnalise, 240);
  for (let m = 1; m <= prazoTL; m++) {
    const parcelaMesCons = m <= mesContemplacaoConsorcio ? parcelaBrutaConsorcio : parcelaBrutaPosLance;
    const economiaFiscalMes = parcelaMesCons * aliquotaFrac;
    const parcelaLiquidaMes = parcelaMesCons - economiaFiscalMes;

    // Financiamento: juros sobre saldo + amortização
    const jurosMes = saldoDevedorFin * taxaJurosFrac;
    const parcelaFinMes = m <= prazoFin ? amortizacaoFin + jurosMes : 0;
    saldoDevedorFin = Math.max(saldoDevedorFin - amortizacaoFin, 0);

    timeline.push({
      mes: m,
      parcelaBrutaConsorcio: parcelaMesCons,
      economiaFiscalMes,
      parcelaLiquidaConsorcio: parcelaLiquidaMes,
      parcelaFinanciamento: parcelaFinMes,
      saldoDevedorFin,
    });
  }

  return {
    parcelaBrutaConsorcio,
    parcelaBrutaPosLance,
    economiaFiscalMensal,
    parcelaLiquidaConsorcio,
    parcelaLiquidaPosLance,
    totalBrutoConsorcio,
    totalEconomiaFiscalConsorcio,
    totalLiquidoConsorcio,
    parcelaFinanciamento,
    totalFinanciamento,
    totalJurosFinanciamento,
    economiaTotalVsFinanciamento,
    percentualEconomia,
    aliquotaEfetivaTotal,
    valorBemFinalConsorcio,
    valorBemFinalFinanciamento,
    timeline,
  };
}
