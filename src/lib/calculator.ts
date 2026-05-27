// Cálculo preserva a lógica original do "Quanto custa? Imobiliário v7.4"

export type AmortTipo = "prazo" | "parcela";
export type BaseLance = "credito" | "plano";
export type UsoCredito = "comprar" | "patrimonio";

export interface CalcInputs {
  valorImovel: number;
  entrada: number;
  prazoF: number;
  jFinAnual: number; // %
  trAnual: number; // %
  creditoCons: number;
  percLanceEmb: number; // %
  baseLance: BaseLance;
  usoCredito: UsoCredito;
  lanceProprio: number;
  tAdm: number; // %
  prazoC: number;
  inccAnual: number; // %
  percReducao: number; // %
  mesContemplacao: number;
  amortTipo: AmortTipo;
  aluguel: number;
  taxaOportunidadeMensal: number; // %
  valorizacaoAnual: number; // %
  percItbi: number; // %
}

export interface CalcResults {
  tSAC: number;
  tPrice: number;
  tCons: number;
  imovelNoFuturo: number;
  custoItbiFinanciamento: number;
  custoItbiConsorcio: number;
  custoAluguelTotal: number;
  cdiFin: number;
  cdiCons: number;
  valorCreditoRentabilizado: number;
  patrimonioConsTotal: number;
  saldoDevedorNaContemplacao: number;
  valorEmbVisual: number;
  parcelasSAC: number[];
  parcelasPrice: number[];
  parcelasCons: number[];
  saldoConsMes: number[];   // Saldo devedor do consórcio mês a mês (para curva de dívida)
  desembolsoCons: number[];
  patrimonioCons: number[];
}

export function calcular(i: CalcInputs): CalcResults {
  const valor = i.valorImovel;
  const entradaDisponivel = i.entrada;
  const credito = i.creditoCons;
  const pF = i.prazoF;
  const pC = i.prazoC;
  const jF = i.jFinAnual / 100;
  const cF = i.trAnual / 100;
  const tA = i.tAdm / 100;
  const cC = i.inccAnual / 100;
  const lanceP = i.lanceProprio;
  const pEmb = i.percLanceEmb / 100;
  const usoCredito = i.usoCredito;
  const rOportunidade = i.taxaOportunidadeMensal / 100;
  const aluguel = i.aluguel;
  const valAnualImovel = i.valorizacaoAnual / 100;
  const pItbi = i.percItbi / 100;
  const custoItbiConsorcio = usoCredito === "patrimonio" ? 0 : valor * pItbi;
  const custoItbiFinanciamento = valor * pItbi;
  let mContemplacao = i.mesContemplacao || 1;
  const pReducao = i.percReducao / 100;
  if (mContemplacao > pC && pC > 0) mContemplacao = pC;
  const montanteComTaxa = credito * (1 + tA);
  let maxMeses = Math.max(pF, pC);
  if (maxMeses === 0) maxMeses = 1;
  const custoAluguelTotal = aluguel * mContemplacao;

  const pSAC: number[] = [],
    pPrice: number[] = [],
    pCons: number[] = [];
  const arrDesembolsoCons: number[] = [],
    arrPatrimonioCons: number[] = [],
    arrSaldoCons: number[] = [];

  let tSAC = entradaDisponivel + custoItbiFinanciamento;
  let tPrice = entradaDisponivel + custoItbiFinanciamento;
  let tCons = lanceP + custoItbiConsorcio + custoAluguelTotal;
  let acumuladorDesembolso = 0;
  const jM_F = jF / 12;
  const trM = cF / 12;
  let cdiFin = 0;
  let cdiCons = entradaDisponivel;
  let valorCreditoRentabilizado = 0;
  let saldoSAC = valor - entradaDisponivel;
  let saldoPrice = valor - entradaDisponivel;
  let saldoCons = montanteComTaxa;
  let baseParcelC_integral = pC > 0 ? saldoCons / pC : 0;
  let parcelaConsAtual = baseParcelC_integral;
  let saldoDevedorNaContemplacao = 0;

  for (let m = 1; m <= maxMeses; m++) {
    cdiFin *= 1 + rOportunidade;
    cdiCons *= 1 + rOportunidade;
    const isCorrectionMensal = m > 1;

    if (m <= pF && saldoSAC > 0.01) {
      if (isCorrectionMensal) saldoSAC *= 1 + trM;
      const mesesRestantes = pF - m + 1;
      const amort = saldoSAC / mesesRestantes;
      const juros = saldoSAC * jM_F;
      let parcela = amort + juros;
      if (parcela > saldoSAC + juros) parcela = saldoSAC + juros;
      saldoSAC -= amort;
      if (saldoSAC < 0) saldoSAC = 0;
      pSAC.push(parcela);
      tSAC += parcela;
    } else pSAC.push(0);

    if (m <= pF && saldoPrice > 0.01) {
      if (isCorrectionMensal) saldoPrice *= 1 + trM;
      const mesesRestantes = pF - m + 1;
      const divisor = Math.pow(1 + jM_F, mesesRestantes) - 1;
      let pmt =
        divisor > 0
          ? (saldoPrice * (jM_F * Math.pow(1 + jM_F, mesesRestantes))) / divisor
          : saldoPrice;
      const juros = saldoPrice * jM_F;
      let amort = pmt - juros;
      if (pmt > saldoPrice + juros) {
        pmt = saldoPrice + juros;
        amort = saldoPrice;
      }
      saldoPrice -= amort;
      if (saldoPrice < 0) saldoPrice = 0;
      pPrice.push(pmt);
      tPrice += pmt;
    } else pPrice.push(0);

    let parcelaConsDoMes = 0;
    if (m <= pC && saldoCons > 0.01) {
      if (m > 1 && (m - 1) % 12 === 0) {
        saldoCons *= 1 + cC;
        baseParcelC_integral *= 1 + cC;
        parcelaConsAtual *= 1 + cC;
      }
      if (m <= mContemplacao) parcelaConsDoMes = baseParcelC_integral * (1 - pReducao);
      else parcelaConsDoMes = parcelaConsAtual;
      if (parcelaConsDoMes > saldoCons) parcelaConsDoMes = saldoCons;
      saldoCons -= parcelaConsDoMes;
      if (saldoCons < 0) saldoCons = 0;

      if (m === mContemplacao) {
        const anosPassados = Math.floor((m - 1) / 12);
        const multINCC = Math.pow(1 + cC, anosPassados);
        const creditoReajustado = credito * multINCC;
        const montanteComTaxaReajustado = montanteComTaxa * multINCC;
        const valorEmbReajustado =
          i.baseLance === "plano" ? montanteComTaxaReajustado * pEmb : creditoReajustado * pEmb;
        saldoCons -= lanceP + valorEmbReajustado;
        if (saldoCons < 0) saldoCons = 0;
        saldoDevedorNaContemplacao = saldoCons;
        cdiCons -= lanceP;
        if (cdiCons < 0) cdiCons = 0;
        if (usoCredito === "patrimonio")
          valorCreditoRentabilizado = creditoReajustado - valorEmbReajustado;
        if (i.amortTipo === "parcela") {
          const mesesRestantes = pC - m;
          parcelaConsAtual = mesesRestantes > 0 ? saldoCons / mesesRestantes : saldoCons;
        } else parcelaConsAtual = baseParcelC_integral;
      }
      if (usoCredito === "patrimonio" && m > mContemplacao)
        valorCreditoRentabilizado *= 1 + rOportunidade;
      pCons.push(parcelaConsDoMes);
      arrSaldoCons.push(Math.max(saldoCons, 0));
      tCons += parcelaConsDoMes;
    } else {
      pCons.push(0);
      arrSaldoCons.push(0);
      if (usoCredito === "patrimonio" && m > mContemplacao)
        valorCreditoRentabilizado *= 1 + rOportunidade;
    }

    if (m === 1) acumuladorDesembolso += custoItbiConsorcio;
    if (m <= mContemplacao) acumuladorDesembolso += aluguel;
    if (m === mContemplacao) acumuladorDesembolso += lanceP;
    acumuladorDesembolso += parcelaConsDoMes;
    arrDesembolsoCons.push(acumuladorDesembolso);

    let patMes = cdiCons;
    if (m >= mContemplacao) {
      if (usoCredito === "patrimonio") patMes += valorCreditoRentabilizado;
      else patMes += valor * Math.pow(1 + valAnualImovel / 12, m);
    }
    arrPatrimonioCons.push(patMes);
  }

  const imovelNoFuturo = valor * Math.pow(1 + valAnualImovel / 12, maxMeses);
  let patrimonioConsTotal = cdiCons;
  if (usoCredito === "patrimonio") patrimonioConsTotal += valorCreditoRentabilizado;
  const valorEmbVisual = i.baseLance === "plano" ? credito * (1 + tA) * pEmb : credito * pEmb;

  return {
    tSAC,
    tPrice,
    tCons,
    imovelNoFuturo,
    custoItbiFinanciamento,
    custoItbiConsorcio,
    custoAluguelTotal,
    cdiFin,
    cdiCons,
    valorCreditoRentabilizado,
    patrimonioConsTotal,
    saldoDevedorNaContemplacao,
    valorEmbVisual,
    parcelasSAC: pSAC,
    parcelasPrice: pPrice,
    parcelasCons: pCons,
    saldoConsMes: arrSaldoCons,
    desembolsoCons: arrDesembolsoCons,
    patrimonioCons: arrPatrimonioCons,
  };
}

export const defaultInputs: CalcInputs = {
  valorImovel: 0,
  entrada: 0,
  prazoF: 0,
  jFinAnual: 0,
  trAnual: 0,
  creditoCons: 0,
  percLanceEmb: 0,
  baseLance: "credito",
  usoCredito: "comprar",
  lanceProprio: 0,
  tAdm: 0,
  prazoC: 0,
  inccAnual: 0,
  percReducao: 0,
  mesContemplacao: 1,
  amortTipo: "prazo",
  aluguel: 0,
  taxaOportunidadeMensal: 0,
  valorizacaoAnual: 0,
  percItbi: 0,
};
