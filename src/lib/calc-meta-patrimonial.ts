// ─── Simulador: Meta Patrimonial ─────────────────────────────────────────────
// Cálculo reverso: dado patrimônio-alvo ou renda passiva-alvo,
// mostra quantas cotas, de qual valor e prazo o cliente precisa contratar.

import { simularConsorcio } from "./consorcio-core";

export type ModoMeta = "patrimonio" | "renda";
export type RegimeTributario = "nenhum" | "simples" | "presumido" | "real";

export interface MetaPatrimonialInputs {
  modo: ModoMeta;

  // Meta
  patrimonioAlvoR: number;       // Patrimônio imobiliário desejado (R$) — modo "patrimonio"
  rendaMensalAlvoR: number;      // Renda passiva mensal desejada (R$) — modo "renda"
  yeildAluguelPerc: number;      // Yield mensal de aluguel esperado (% a.m. — ex: 0,5%)

  // Horizonte e premissas
  horizonteAnos: number;         // Prazo total do plano (anos)
  valorizacaoAnual: number;      // Valorização anual dos imóveis (%)

  // Parâmetros do consórcio
  taxaAtualizacaoAnual: number;  // Taxa de atualização anual da carta (INCC, % a.a.)
  taxaAdmConsorcio: number;      // Taxa de administração total (%)
  prazoConsorcio: number;        // Prazo do grupo (meses)
  percLance: number;             // Lance médio ofertado (% da carta)
  percLanceEmb: number;          // Lance embutido (% da carta) — não sai do bolso
  mesContemplacaoPrimeira: number; // Mês de contemplação da 1ª cota
  intervaloCotasMeses: number;   // Intervalo entre contemplações de cotas adicionais (meses)

  // Benefício fiscal (PJ)
  regimeTributario: RegimeTributario;
  aliquotaEfetiva: number;       // % efetivo de imposto sobre as parcelas
}

export interface CotaPlano {
  numero: number;
  valorCarta: number;
  mesContemplacaoAbsoluto: number;
  parcelaMensal: number;
  parcelaPosLance: number;
  lanceR: number;
  totalPagoNaCota: number;
  valorImovelFinal: number;    // Carta valorizada até o fim do horizonte
}

export interface MetaPatrimonialResults {
  // Resultado do plano
  numCotas: number;
  valorCadaCarta: number;
  patrimonioTotalFinal: number;
  rendaMensalFinalR: number;    // patrimônio × yield

  // Custo do plano
  investimentoMensalTotal: number; // soma das parcelas em vigor simultaneamente
  totalInvestido: number;
  cotas: CotaPlano[];

  // Benefício fiscal (PJ)
  economiaFiscalTotal: number;  // aliquota × totalInvestido (parcelas dedutíveis)
  custoRealTotal: number;       // totalInvestido - economiaFiscalTotal

  // Meta atingida?
  metaAtingida: boolean;
  deficitR: number;             // 0 se meta atingida
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
  regimeTributario: "nenhum",
  aliquotaEfetiva: 0,
};

export function calcMetaPatrimonial(i: MetaPatrimonialInputs): MetaPatrimonialResults {
  const {
    modo, patrimonioAlvoR, rendaMensalAlvoR, yeildAluguelPerc,
    horizonteAnos, valorizacaoAnual, taxaAtualizacaoAnual,
    taxaAdmConsorcio, prazoConsorcio, percLance, percLanceEmb,
    mesContemplacaoPrimeira, intervaloCotasMeses,
    regimeTributario, aliquotaEfetiva,
  } = i;

  const horizonteMeses = horizonteAnos * 12;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;

  // Patrimônio-alvo efetivo
  const patrimonioAlvo =
    modo === "renda"
      ? (yeildAluguelPerc > 0 ? rendaMensalAlvoR / (yeildAluguelPerc / 100) : 0)
      : patrimonioAlvoR;

  // Descobrir quantas cotas e de qual valor são necessárias
  // Estratégia: cartas iguais, contemplações escalonadas, valor de cada carta
  // cresce com a valorização até o final do horizonte.
  // Processo iterativo: aumenta num. cotas até atingir meta.

  const maxCotas = 20;
  let numCotas = 1;
  let cotasPlano: CotaPlano[] = [];
  let patrimonioResultante = 0;

  while (numCotas <= maxCotas) {
    cotasPlano = [];
    patrimonioResultante = 0;

    // Determinar o valor de carta necessário — cada cota entrega a mesma parte
    // Simplificação: cotas com mesmo valor de carta, escalonadas no tempo.
    // Usamos o valor de carta que a primeira cota precisa ter para que
    // N cotas entreguem o patrimônio total.
    const partePatrimonio = patrimonioAlvo / numCotas;

    const cotas: CotaPlano[] = [];
    let totalInvestidoCalc = 0;

    for (let c = 0; c < numCotas; c++) {
      const mesContemplacao = mesContemplacaoPrimeira + c * intervaloCotasMeses;
      // Não contemplar além do horizonte
      if (mesContemplacao >= horizonteMeses) break;

      const mesesDesdeContemplacao = horizonteMeses - mesContemplacao;
      
      // Fator INCC até a contemplação
      const fatorINCC = Math.pow(1 + taxaAtualizacaoAnual / 100, Math.floor(Math.max(mesContemplacao - 1, 0) / 12));
      
      // Carta inicial necessária (C0) para que, após INCC e valorização, entregue partePatrimonio
      const cartaNec = partePatrimonio / (fatorINCC * Math.pow(1 + valorizMensal, mesesDesdeContemplacao));

      const sim = simularConsorcio({
        credito: cartaNec,
        taxaAdm: taxaAdmConsorcio,
        prazo: prazoConsorcio,
        inccAnual: taxaAtualizacaoAnual,
        mesContemplacao,
        lanceEmbutidoPerc: percLanceEmb || 0,
        lanceProprioR: cartaNec * fatorINCC * (percLance / 100), // Lance ofertado no valor atualizado
        abatimentoEmbutido: "saldoDevedor",
        amortizacao: "parcela",
        horizonteMeses: prazoConsorcio
      });

      const totalNaCota = sim.desembolsoTotal;
      totalInvestidoCalc += totalNaCota;
      
      // O valor final do imóvel será o crédito atualizado na contemplação vezes a valorização
      const valorImovelFinal = sim.creditoAtualizadoContemplacao * Math.pow(1 + valorizMensal, mesesDesdeContemplacao);
      patrimonioResultante += valorImovelFinal;

      cotas.push({
        numero: c + 1,
        valorCarta: cartaNec,
        mesContemplacaoAbsoluto: mesContemplacao,
        parcelaMensal: sim.parcelaInicial,
        parcelaPosLance: sim.parcelaPosLance,
        lanceR: sim.lanceProprioR,
        totalPagoNaCota: totalNaCota,
        valorImovelFinal,
      });
    }

    if (cotas.length === numCotas) {
      cotasPlano = cotas;
      if (patrimonioResultante >= patrimonioAlvo) break;
    }
    numCotas++;
  }

  // Investimento mensal total no pico (quando todas cotas estão em andamento)
  const investimentoMensalTotal = cotasPlano.reduce((acc, c) => acc + c.parcelaMensal, 0);
  const totalInvestido = cotasPlano.reduce((acc, c) => acc + c.totalPagoNaCota, 0);

  const valorCadaCarta =
    cotasPlano.length > 0 ? cotasPlano[0].valorCarta : 0;

  const rendaMensalFinalR = patrimonioResultante * (yeildAluguelPerc / 100);
  const metaAtingida = patrimonioResultante >= patrimonioAlvo;
  const deficitR = metaAtingida ? 0 : patrimonioAlvo - patrimonioResultante;

  // Benefício fiscal: só no Lucro Real a taxa de adm é dedutível como despesa
  // operacional (abate IRPJ/CSLL). Presumido/Simples/Nenhum → sem abatimento direto.
  const beneficioFiscalAtivo = regimeTributario === "real";
  // A dedução incide sobre a parte de TAXA DE ADM embutida no investimento.
  const fracTaxaNoInvest = taxaAdmConsorcio / (100 + taxaAdmConsorcio);
  const economiaFiscalTotal = beneficioFiscalAtivo
    ? totalInvestido * fracTaxaNoInvest * ((aliquotaEfetiva || 0) / 100)
    : 0;
  const custoRealTotal = Math.max(totalInvestido - economiaFiscalTotal, 0);

  return {
    numCotas: cotasPlano.length,
    valorCadaCarta,
    patrimonioTotalFinal: patrimonioResultante,
    rendaMensalFinalR,
    investimentoMensalTotal,
    totalInvestido,
    cotas: cotasPlano,
    economiaFiscalTotal,
    custoRealTotal,
    metaAtingida,
    deficitR,
  };
}
