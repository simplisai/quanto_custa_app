// ─── Simulador: Meta Patrimonial ─────────────────────────────────────────────
// Cálculo reverso: dado patrimônio-alvo ou renda passiva-alvo,
// mostra quantas cotas, de qual valor e prazo o cliente precisa contratar.

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
  cdiAnual: number;              // CDI anual para comparação (%)

  // Parâmetros do consórcio
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

  // Comparativo CDB
  cdbFinal: number;
  vantageVsCDB: number;

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
  cdiAnual: 10.5,
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
    horizonteAnos, valorizacaoAnual, cdiAnual,
    taxaAdmConsorcio, prazoConsorcio, percLance, percLanceEmb,
    mesContemplacaoPrimeira, intervaloCotasMeses,
    aliquotaEfetiva,
  } = i;

  const horizonteMeses = horizonteAnos * 12;
  const valorizMensal = Math.pow(1 + valorizacaoAnual / 100, 1 / 12) - 1;
  const cdiMensal = Math.pow(1 + cdiAnual / 100, 1 / 12) - 1;
  const taxaAdmFrac = taxaAdmConsorcio / 100;

  // Patrimônio-alvo efetivo
  const patrimonioAlvo =
    modo === "renda"
      ? (yeildAluguelPerc > 0 ? rendaMensalAlvoR / (yeildAluguelPerc / 100) : 0)
      : patrimonioAlvoR;

  // Descobrir quantas cotas e de qual valor são necessárias
  // Estratégia: cartas iguais, contemplações escalonadas, valor de cada carta
  // cresce com a valorização até o final do horizonte.
  // Processo iterativo: aumenta num. cotas até atingir meta.

  // Valor de uma carta que, valorizada até o final, entrega 1 unidade de patrimônio
  // valorFinal = cartaBase × (1 + valorizMensal)^(horizonteMeses - mesContemplacaoAbsoluto)
  // Para a primeira cota:
  const cartaBaseUnitaria = (mes: number) =>
    1 / Math.pow(1 + valorizMensal, Math.max(horizonteMeses - mes, 0));

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
      // Carta necessária para entregar partePatrimonio no final
      const cartaNec = partePatrimonio / Math.pow(1 + valorizMensal, mesesDesdeContemplacao);

      const lanceEmbR = cartaNec * ((percLanceEmb || 0) / 100);
      const lanceR = cartaNec * (percLance / 100); // próprio (desembolso real)
      const saldoPosLance = Math.max(cartaNec - lanceR - lanceEmbR, 0);
      const valorPlano = cartaNec * (1 + taxaAdmFrac);
      const parcelaMensal = valorPlano / prazoConsorcio;
      const parcelasPos = prazoConsorcio - mesContemplacao;
      const parcelaPosLance =
        parcelasPos > 0
          ? (saldoPosLance * (1 + taxaAdmFrac)) / Math.max(parcelasPos, 1)
          : 0;

      const totalNaCota =
        parcelaMensal * Math.min(mesContemplacao, prazoConsorcio) +
        lanceR +
        parcelaPosLance * Math.max(parcelasPos, 0);

      totalInvestidoCalc += totalNaCota;
      const valorImovelFinal = cartaNec * Math.pow(1 + valorizMensal, mesesDesdeContemplacao);
      patrimonioResultante += valorImovelFinal;

      cotas.push({
        numero: c + 1,
        valorCarta: cartaNec,
        mesContemplacaoAbsoluto: mesContemplacao,
        parcelaMensal,
        parcelaPosLance,
        lanceR,
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

  // CDB: mesmo dinheiro investido mensalmente
  const cdbFinal = totalInvestido * Math.pow(1 + cdiMensal, horizonteMeses);
  const vantageVsCDB = patrimonioResultante - cdbFinal;

  const rendaMensalFinalR = patrimonioResultante * (yeildAluguelPerc / 100);
  const metaAtingida = patrimonioResultante >= patrimonioAlvo;
  const deficitR = metaAtingida ? 0 : patrimonioAlvo - patrimonioResultante;

  // Benefício fiscal: parcelas são dedutíveis como despesa operacional (PJ)
  const economiaFiscalTotal = totalInvestido * ((aliquotaEfetiva || 0) / 100);
  const custoRealTotal = Math.max(totalInvestido - economiaFiscalTotal, 0);

  return {
    numCotas: cotasPlano.length,
    valorCadaCarta,
    patrimonioTotalFinal: patrimonioResultante,
    rendaMensalFinalR,
    investimentoMensalTotal,
    totalInvestido,
    cotas: cotasPlano,
    cdbFinal,
    vantageVsCDB,
    economiaFiscalTotal,
    custoRealTotal,
    metaAtingida,
    deficitR,
  };
}
