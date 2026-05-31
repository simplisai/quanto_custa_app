// ─── Simulador: Meta Patrimonial ─────────────────────────────────────────────
// Cálculo reverso: dado patrimônio-alvo ou renda passiva-alvo,
// mostra quantas cotas, de qual valor e prazo o cliente precisa contratar.
// Fonte: simularConsorcio() mensal por cota → KPI cards derivados da timeline.

import {
  simularConsorcio,
  valorFuturo,
} from "./consorcio-core";

export type ModoMeta = "patrimonio" | "renda";
export type RegimeTributario = "nenhum" | "simples" | "presumido" | "real";

export interface MetaPatrimonialInputs {
  modo: ModoMeta;
  patrimonioAlvoR: number;
  rendaMensalAlvoR: number;
  yeildAluguelPerc: number;
  horizonteAnos: number;
  valorizacaoAnual: number;
  taxaAtualizacaoAnual: number;
  taxaAdmConsorcio: number;
  prazoConsorcio: number;
  percLance: number;
  percLanceEmb: number;
  mesContemplacaoPrimeira: number;
  intervaloCotasMeses: number;
  valorCarta?: number;
  regimeTributario: RegimeTributario;
  aliquotaEfetiva: number;
}

export interface CotaPlano {
  numero: number;
  valorCarta: number;
  mesContemplacaoAbsoluto: number;
  parcelaMensal: number;
  parcelaPosLance: number;
  lanceR: number;
  totalPagoNaCota: number;
  valorImovelFinal: number;
}

export interface MetaPatrimonialResults {
  numCotas: number;
  valorCadaCarta: number;
  patrimonioTotalFinal: number;
  rendaMensalFinalR: number;
  investimentoMensalTotal: number;
  totalInvestido: number;
  cotas: CotaPlano[];
  economiaFiscalTotal: number;
  custoRealTotal: number;
  metaAtingida: boolean;
  deficitR: number;
}

export const defaultMetaInputs: MetaPatrimonialInputs = {
  modo: "patrimonio",
  patrimonioAlvoR: 2_000_000,
  rendaMensalAlvoR: 10_000,
  yeildAluguelPerc: 0.5,
  horizonteAnos: 15,
  valorizacaoAnual: 6,
  taxaAtualizacaoAnual: 4,
  taxaAdmConsorcio: 18,
  prazoConsorcio: 120,
  percLance: 20,
  percLanceEmb: 0,
  mesContemplacaoPrimeira: 12,
  intervaloCotasMeses: 24,
  valorCarta: 500_000,
  regimeTributario: "nenhum",
  aliquotaEfetiva: 0,
};

export function calcMetaPatrimonial(i: MetaPatrimonialInputs): MetaPatrimonialResults {
  const T = Math.max(i.horizonteAnos, 1);
  const horizonteMeses = T * 12;
  const C = i.valorCarta && i.valorCarta > 0 ? i.valorCarta : 500_000;
  const vAnual = i.valorizacaoAnual / 100;

  // Obj_Patr: renda → perpetuidade; patrimônio → input direto
  const patrimonioAlvo = i.modo === "renda"
    ? (i.yeildAluguelPerc > 0 ? i.rendaMensalAlvoR / (i.yeildAluguelPerc / 100) : 0)
    : i.patrimonioAlvoR;

  // Sizing ITERATIVO: cada cota tem um mc diferente → valorização real ≠ T anos.
  // Incrementa cotas até que a soma dos valorImovelFinal individuais ≥ patrimonioAlvo.
  let numCotas = 0;
  {
    let somaAcum = 0;
    for (let c = 0; somaAcum < patrimonioAlvo; c++) {
      const mc = i.mesContemplacaoPrimeira + c * i.intervaloCotasMeses;
      if (mc >= horizonteMeses) break; // sem mais espaço no horizonte
      somaAcum += valorFuturo(C, vAnual, (horizonteMeses - mc) / 12);
      numCotas++;
    }
    numCotas = Math.max(numCotas, 1);
  }

  // Monta o plano de cotas com simulação mensal por cota
  const cotasPlano: CotaPlano[] = [];
  for (let c = 0; c < numCotas; c++) {
    const mc = i.mesContemplacaoPrimeira + c * i.intervaloCotasMeses;
    if (mc >= horizonteMeses) break;

    const sim = simularConsorcio({
      credito:           C,
      taxaAdm:           i.taxaAdmConsorcio,
      prazo:             i.prazoConsorcio,
      inccAnual:         i.taxaAtualizacaoAnual,
      mesContemplacao:   Math.min(mc, i.prazoConsorcio),
      lanceEmbutidoPerc: i.percLanceEmb || 0,
      lanceProprioR:     C * (i.percLance / 100),
      amortizacao:       "parcela",
    });

    const mesesDesdeContemplacao = horizonteMeses - mc;
    const valorImovelFinal = valorFuturo(C, vAnual, mesesDesdeContemplacao / 12);

    cotasPlano.push({
      numero: c + 1,
      valorCarta: C,
      mesContemplacaoAbsoluto: mc,
      parcelaMensal: sim.parcelaNominal,
      parcelaPosLance: sim.parcelaReduzida,
      lanceR: sim.lanceProprioR,
      totalPagoNaCota: sim.totalPagamentos, // custo total ao longo do plano (ROI/meta)
      valorImovelFinal,
    });
  }

  const patrimonioResultante = cotasPlano.reduce((acc, c) => acc + c.valorImovelFinal, 0);
  const investimentoMensalTotal = cotasPlano.reduce((acc, c) => acc + c.parcelaMensal, 0);
  const totalInvestido = cotasPlano.reduce((acc, c) => acc + c.totalPagoNaCota, 0);
  const valorCadaCarta = C;

  // Benefício fiscal (apenas Lucro Real abate)
  const beneficioFiscalAtivo = i.regimeTributario === "real";
  const fracTaxaNoInvest = (i.taxaAdmConsorcio / 100) / (1 + i.taxaAdmConsorcio / 100);
  const economiaFiscalTotal = beneficioFiscalAtivo
    ? totalInvestido * fracTaxaNoInvest * ((i.aliquotaEfetiva || 0) / 100) : 0;
  const custoRealTotal = Math.max(totalInvestido - economiaFiscalTotal, 0);

  return {
    numCotas: cotasPlano.length,
    valorCadaCarta,
    patrimonioTotalFinal: patrimonioResultante,
    rendaMensalFinalR: patrimonioResultante * (i.yeildAluguelPerc / 100),
    investimentoMensalTotal,
    totalInvestido,
    cotas: cotasPlano,
    economiaFiscalTotal,
    custoRealTotal,
    metaAtingida: patrimonioResultante >= patrimonioAlvo,
    deficitR: Math.max(patrimonioAlvo - patrimonioResultante, 0),
  };
}
