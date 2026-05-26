// ─── Definições de campos de template por simulador ─────────────────────────
// Cada entrada define os grupos de campos que aparecem no editor de template
// para o simulador correspondente.
// As chaves (key) são as mesmas chaves do payload armazenado no Supabase
// e são mapeadas diretamente para o estado do simulador.

export type FieldType = "money" | "percent" | "int";

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
}

export interface TemplateFieldGroup {
  title: string;
  fields: TemplateField[];
}

export const SIMULATOR_FIELD_GROUPS: Record<string, TemplateFieldGroup[]> = {

  // ─── Calculadora Patrimonial (/app) ──────────────────────────────────────
  "calculadora-patrimonial": [
    {
      title: "Dados Iniciais",
      fields: [
        { key: "valorImovel", label: "Valor do Imóvel Alvo (R$)", type: "money" },
        { key: "entrada", label: "Entrada Própria Disponível (R$)", type: "money" },
      ],
    },
    {
      title: "Financiamento Bancário",
      fields: [
        { key: "prazoF", label: "Prazo do Financiamento (meses)", type: "int" },
        { key: "jFinAnual", label: "Taxa de Juros Anual (%)", type: "percent" },
        { key: "trAnual", label: "Estimativa de TR / Ajuste (%)", type: "percent" },
      ],
    },
    {
      title: "Consórcio",
      fields: [
        { key: "creditoCons", label: "Valor de Crédito da Carta (R$)", type: "money" },
        { key: "percLanceEmb", label: "Lance Embutido (%)", type: "int" },
        { key: "lanceProprio", label: "Lance Recurso Próprio (R$)", type: "money" },
        { key: "tAdm", label: "Taxa de Administração (%)", type: "percent" },
        { key: "prazoC", label: "Prazo do Plano (meses)", type: "int" },
        { key: "inccAnual", label: "INCC / Reajuste (%)", type: "percent" },
        { key: "percReducao", label: "Redução Parcela Inicial (%)", type: "int" },
        { key: "mesContemplacao", label: "Contemplação (mês)", type: "int" },
      ],
    },
    {
      title: "Premissas Avançadas",
      fields: [
        { key: "aluguel", label: "Custo de Aluguel (R$/mês)", type: "money" },
        { key: "taxaOportunidadeMensal", label: "CDI (% ao mês)", type: "percent" },
        { key: "valorizacaoAnual", label: "Valorização do Imóvel (% a.a.)", type: "percent" },
        { key: "percItbi", label: "ITBI/Cartório (%)", type: "percent" },
      ],
    },
  ],

  // ─── Simulador de Lance ───────────────────────────────────────────────────
  "simulador-lance": [
    {
      title: "Consórcio",
      fields: [
        { key: "cartaCredito", label: "Carta de Crédito (R$)", type: "money" },
        { key: "taxaAdmTotal", label: "Taxa de Administração Total (%)", type: "percent", hint: "Ex: 18%" },
        { key: "prazoMeses", label: "Prazo do Grupo (meses)", type: "int" },
      ],
    },
    {
      title: "Estratégia de Lance",
      fields: [
        { key: "percLanceEmb", label: "Lance Embutido (%)", type: "int" },
        { key: "lanceProprioR", label: "Lance Próprio (R$)", type: "money" },
        { key: "mesContemplacaoLance", label: "Mês-alvo de Contemplação (com lance)", type: "int" },
        { key: "mesSemLance", label: "Mês médio sem lance", type: "int" },
      ],
    },
  ],

  // ─── Aluguel vs Consórcio ─────────────────────────────────────────────────
  "aluguel-vs-consorcio": [
    {
      title: "Cenário do Aluguel",
      fields: [
        { key: "aluguelAtual", label: "Aluguel Atual (R$/mês)", type: "money" },
        { key: "reajusteAluguelAnual", label: "Reajuste Anual do Aluguel (%)", type: "percent", hint: "IGPM ou IPCA" },
        { key: "horizonte", label: "Horizonte de Análise (anos)", type: "int" },
      ],
    },
    {
      title: "Consórcio",
      fields: [
        { key: "cartaCredito", label: "Carta de Crédito (R$)", type: "money" },
        { key: "taxaAdmTotal", label: "Taxa de Administração Total (%)", type: "percent" },
        { key: "prazoMeses", label: "Prazo do Grupo (meses)", type: "int" },
        { key: "percLance", label: "Lance Ofertado (%)", type: "int" },
        { key: "lanceProprioR", label: "Lance Próprio (R$)", type: "money" },
        { key: "mesContemplacao", label: "Mês de Contemplação", type: "int" },
        { key: "valorizacaoAnual", label: "Valorização Anual do Imóvel (%)", type: "percent" },
      ],
    },
  ],

  // ─── Renda Passiva com Consórcio ─────────────────────────────────────────
  "renda-passiva-consorcio": [
    {
      title: "Consórcio",
      fields: [
        { key: "cartaCredito", label: "Carta de Crédito (R$)", type: "money" },
        { key: "taxaAdmTotal", label: "Taxa de Administração Total (%)", type: "percent" },
        { key: "prazoMeses", label: "Prazo do Grupo (meses)", type: "int" },
        { key: "percLance", label: "Lance Ofertado (%)", type: "int" },
        { key: "lanceProprioR", label: "Lance Próprio (R$)", type: "money" },
        { key: "mesContemplacao", label: "Mês de Contemplação", type: "int" },
      ],
    },
    {
      title: "Premissas de Renda e Valorização",
      fields: [
        { key: "rendaAluguelMensal", label: "Renda de Aluguel Mensal (R$)", type: "money" },
        { key: "reajusteAluguelAnual", label: "Reajuste Anual do Aluguel (%)", type: "percent" },
        { key: "valorizacaoAnual", label: "Valorização Anual do Imóvel (%)", type: "percent" },
        { key: "taxaCDIAnual", label: "CDI Anual (%) — Comparativo", type: "percent" },
      ],
    },
  ],

  // ─── Flip de Cota ─────────────────────────────────────────────────────────
  "flip-cota": [
    {
      title: "Operação",
      fields: [
        { key: "cartaCredito", label: "Valor do Crédito Original (R$)", type: "money" },
        { key: "prazo", label: "Prazo do Plano (meses)", type: "int" },
        { key: "taxaAdm", label: "Taxa de Administração (%)", type: "percent" },
        { key: "fundoReserva", label: "Fundo de Reserva (%)", type: "percent" },
        { key: "lancePerc", label: "Lance (%)", type: "int" },
        { key: "mesContemplacao", label: "Mês de Contemplação", type: "int" },
        { key: "agioVenda", label: "Ágio de Venda (%)", type: "int" },
      ],
    },
  ],

  // ─── Saída do Financiamento ───────────────────────────────────────────────
  "saida-financiamento": [
    {
      title: "Financiamento Atual",
      fields: [
        { key: "valorImovelAtual", label: "Valor atual do imóvel (R$)", type: "money" },
        { key: "saldoDevedor", label: "Saldo devedor (R$)", type: "money" },
        { key: "parcelaAtual", label: "Parcela atual (R$)", type: "money" },
        { key: "prazoRestanteMeses", label: "Prazo restante (meses)", type: "int" },
        { key: "taxaJurosMensal", label: "Taxa de juros mensal (%)", type: "percent" },
        { key: "custosVenda", label: "Custos de venda (%)", type: "percent", hint: "Corretagem + despesas" },
      ],
    },
    {
      title: "Consórcio Destino",
      fields: [
        { key: "cartaConsorcio", label: "Carta de crédito (R$)", type: "money" },
        { key: "taxaAdmConsorcio", label: "Taxa de administração (%)", type: "percent" },
        { key: "prazoConsorcio", label: "Prazo do grupo (meses)", type: "int" },
        { key: "percLance", label: "Lance ofertado (%)", type: "int" },
        { key: "mesContemplacaoConsorcio", label: "Mês de contemplação", type: "int" },
        { key: "valorizacaoAnual", label: "Valorização anual (%)", type: "percent" },
      ],
    },
  ],

  // ─── Meta Patrimonial ─────────────────────────────────────────────────────
  "meta-patrimonial": [
    {
      title: "Meta",
      fields: [
        { key: "patrimonioAlvoR", label: "Patrimônio-alvo (R$)", type: "money" },
        { key: "rendaMensalAlvoR", label: "Renda passiva mensal desejada (R$)", type: "money" },
        { key: "yeildAluguelPerc", label: "Yield de aluguel (% a.m.)", type: "percent", hint: "Tipicamente 0,4%–0,6%" },
        { key: "horizonteAnos", label: "Horizonte (anos)", type: "int" },
        { key: "valorizacaoAnual", label: "Valorização anual dos imóveis (%)", type: "percent" },
        { key: "cdiAnual", label: "CDI anual (%)", type: "percent" },
      ],
    },
    {
      title: "Consórcio",
      fields: [
        { key: "taxaAdmConsorcio", label: "Taxa de administração (%)", type: "percent" },
        { key: "prazoConsorcio", label: "Prazo do grupo (meses)", type: "int" },
        { key: "percLance", label: "Lance médio ofertado (%)", type: "int" },
        { key: "mesContemplacaoPrimeira", label: "Mês da 1ª contemplação", type: "int" },
        { key: "intervaloCotasMeses", label: "Intervalo entre contemplações (meses)", type: "int" },
      ],
    },
  ],

  // ─── Consórcio para CNPJ ─────────────────────────────────────────────────
  "consorcio-cnpj": [
    {
      title: "Consórcio PJ",
      fields: [
        { key: "cartaCredito", label: "Carta de crédito (R$)", type: "money" },
        { key: "taxaAdmConsorcio", label: "Taxa de administração (%)", type: "percent" },
        { key: "prazoConsorcio", label: "Prazo do grupo (meses)", type: "int" },
        { key: "percLance", label: "Lance ofertado (%)", type: "int" },
        { key: "mesContemplacaoConsorcio", label: "Mês de contemplação", type: "int" },
        { key: "valorizacaoAnual", label: "Valorização anual (%)", type: "percent" },
      ],
    },
    {
      title: "Financiamento PJ (Comparativo)",
      fields: [
        { key: "taxaJurosMensalFin", label: "Taxa de juros mensal (% a.m.)", type: "percent" },
        { key: "prazoFinanciamentoMeses", label: "Prazo financiamento (meses)", type: "int" },
      ],
    },
    {
      title: "Fiscal",
      fields: [
        { key: "aliquotaIRPJ", label: "Alíquota IRPJ (%)", type: "int" },
        { key: "aliquotaCSLL", label: "Alíquota CSLL (%)", type: "int" },
      ],
    },
  ],
};

// ─── Templates de exemplo para seed ──────────────────────────────────────────
export const SEED_TEMPLATES = [
  // Calculadora Patrimonial
  {
    name: "Imóvel R$500k — Caixa 10% a.a.",
    operation_slug: "calculadora-patrimonial",
    is_default: true,
    payload: { valorImovel: "500.000,00", prazoF: "360", jFinAnual: "10,00", tAdm: "18,00", prazoC: "120", mesContemplacao: "12", valorizacaoAnual: "6,00" },
  },
  {
    name: "Imóvel R$800k — Itaú 12% a.a.",
    operation_slug: "calculadora-patrimonial",
    is_default: false,
    payload: { valorImovel: "800.000,00", prazoF: "300", jFinAnual: "12,00", tAdm: "20,00", prazoC: "180", mesContemplacao: "18", valorizacaoAnual: "5,00" },
  },
  // Simulador de Lance
  {
    name: "Carta R$500k — Lance 20% embutido",
    operation_slug: "simulador-lance",
    is_default: true,
    payload: { cartaCredito: "500.000,00", taxaAdmTotal: "18,00", prazoMeses: "120", percLanceEmb: "20", mesContemplacaoLance: "12", mesSemLance: "72" },
  },
  {
    name: "Carta R$1M — Lance 30% embutido",
    operation_slug: "simulador-lance",
    is_default: false,
    payload: { cartaCredito: "1.000.000,00", taxaAdmTotal: "18,00", prazoMeses: "120", percLanceEmb: "30", mesContemplacaoLance: "8", mesSemLance: "60" },
  },
  // Aluguel vs Consórcio
  {
    name: "Aluguel R$3k → Carta R$500k / 20 anos",
    operation_slug: "aluguel-vs-consorcio",
    is_default: true,
    payload: { aluguelAtual: "3.000,00", reajusteAluguelAnual: "5,00", horizonte: "20", cartaCredito: "500.000,00", taxaAdmTotal: "18,00", prazoMeses: "120", percLance: "20", mesContemplacao: "12", valorizacaoAnual: "6,00" },
  },
  {
    name: "Aluguel R$5k → Carta R$800k / 20 anos",
    operation_slug: "aluguel-vs-consorcio",
    is_default: false,
    payload: { aluguelAtual: "5.000,00", reajusteAluguelAnual: "6,00", horizonte: "20", cartaCredito: "800.000,00", taxaAdmTotal: "18,00", prazoMeses: "120", percLance: "25", mesContemplacao: "10", valorizacaoAnual: "6,00" },
  },
  // Renda Passiva
  {
    name: "Carta R$500k — Aluguel R$2.500/mês",
    operation_slug: "renda-passiva-consorcio",
    is_default: true,
    payload: { cartaCredito: "500.000,00", taxaAdmTotal: "18,00", prazoMeses: "120", percLance: "20", mesContemplacao: "12", rendaAluguelMensal: "2.500,00", reajusteAluguelAnual: "5,00", valorizacaoAnual: "6,00", taxaCDIAnual: "10,50" },
  },
  // Flip de Cota
  {
    name: "Flip R$500k — Ágio 20% — 24 meses",
    operation_slug: "flip-cota",
    is_default: true,
    payload: { cartaCredito: "500.000,00", prazo: "120", taxaAdm: "18", fundoReserva: "2", lancePerc: "40", mesContemplacao: "12", agioVenda: "20" },
  },
  {
    name: "Flip R$1M — Ágio 25% — 18 meses",
    operation_slug: "flip-cota",
    is_default: false,
    payload: { cartaCredito: "1.000.000,00", prazo: "120", taxaAdm: "18", fundoReserva: "2", lancePerc: "50", mesContemplacao: "10", agioVenda: "25" },
  },
  // Saída do Financiamento
  {
    name: "Saída Caixa — Imóvel R$600k / Saldo R$380k",
    operation_slug: "saida-financiamento",
    is_default: true,
    payload: { valorImovelAtual: "600.000,00", saldoDevedor: "380.000,00", parcelaAtual: "4.200,00", prazoRestanteMeses: "264", taxaJurosMensal: "0,83", cartaConsorcio: "500.000,00", taxaAdmConsorcio: "18,00", prazoConsorcio: "120", percLance: "25", mesContemplacaoConsorcio: "8", valorizacaoAnual: "6,00", custosVenda: "6,00" },
  },
  // Meta Patrimonial
  {
    name: "Meta R$2M em 15 anos",
    operation_slug: "meta-patrimonial",
    is_default: true,
    payload: { patrimonioAlvoR: "2.000.000,00", yeildAluguelPerc: "0,50", horizonteAnos: "15", valorizacaoAnual: "6,00", cdiAnual: "10,50", taxaAdmConsorcio: "18,00", prazoConsorcio: "120", percLance: "20", mesContemplacaoPrimeira: "12", intervaloCotasMeses: "24" },
  },
  {
    name: "Renda Passiva R$10k/mês em 15 anos",
    operation_slug: "meta-patrimonial",
    is_default: false,
    payload: { rendaMensalAlvoR: "10.000,00", yeildAluguelPerc: "0,50", horizonteAnos: "15", valorizacaoAnual: "6,00", cdiAnual: "10,50", taxaAdmConsorcio: "18,00", prazoConsorcio: "120", percLance: "20", mesContemplacaoPrimeira: "12", intervaloCotasMeses: "24" },
  },
  // Consórcio para CNPJ
  {
    name: "CNPJ Lucro Presumido — Carta R$800k",
    operation_slug: "consorcio-cnpj",
    is_default: true,
    payload: { cartaCredito: "800.000,00", taxaAdmConsorcio: "18,00", prazoConsorcio: "120", percLance: "20", mesContemplacaoConsorcio: "10", taxaJurosMensalFin: "1,20", prazoFinanciamentoMeses: "120", aliquotaIRPJ: "15", aliquotaCSLL: "9", valorizacaoAnual: "6,00" },
  },
  {
    name: "CNPJ Lucro Real — Carta R$1,5M",
    operation_slug: "consorcio-cnpj",
    is_default: false,
    payload: { cartaCredito: "1.500.000,00", taxaAdmConsorcio: "18,00", prazoConsorcio: "120", percLance: "20", mesContemplacaoConsorcio: "8", taxaJurosMensalFin: "1,00", prazoFinanciamentoMeses: "120", aliquotaIRPJ: "25", aliquotaCSLL: "9", valorizacaoAnual: "6,00" },
  },
];
