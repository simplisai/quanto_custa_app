// ─── Seed Configs v1 ─────────────────────────────────────────────────────────
// These mirror the logic in each calc-*.ts file exactly.
// Used to seed the simulator_configs table with initial DB versions.
// Admins can review and publish via /admin/simuladores.

import type { SimulatorConfig } from "./simulator-config.types";

export const SEED_CONFIGS: Array<{
  slug: string;
  version_label: string;
  notes: string;
  config: SimulatorConfig;
}> = [
  // ─── 1. Simulador de Lance ──────────────────────────────────────────────────
  {
    slug: "simulador-lance",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-lance.ts. Revise antes de publicar.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "cartaCredito",        label: "Carta de crédito (R$)",         type: "money",   defaultValue: "500.000,00" },
        { key: "taxaAdmTotal",        label: "Taxa de administração total (%)",type: "percent", defaultValue: "18,00" },
        { key: "prazoMeses",          label: "Prazo do grupo (meses)",         type: "int",     defaultValue: "120" },
        { key: "percLanceEmb",        label: "Lance embutido (% da carta)",    type: "int",     defaultValue: "20" },
        { key: "lanceProprioR",       label: "Lance próprio (R$)",             type: "money",   defaultValue: "0,00" },
        { key: "mesContemplacaoLance",label: "Mês-alvo de contemplação c/ lance", type: "int", defaultValue: "12" },
        { key: "mesSemLance",         label: "Mês médio de contemplação s/ lance",type: "int", defaultValue: "72" },
      ],
      intermediates: [
        { key: "taxaAdmFrac",         label: "Taxa adm. em fração decimal",    formula: "taxaAdmTotal / 100",              description: "Ex: 18% → 0.18" },
        { key: "valorPlano",          label: "Valor total do plano (R$)",      formula: "cartaCredito * (1 + taxaAdmFrac)", description: "Carta × (1 + taxa_adm)" },
        { key: "parcelaPadrao",       label: "Parcela padrão (R$)",            formula: "valorPlano / prazoMeses",          type: "money" },
        { key: "lanceEmbR",           label: "Lance embutido em R$",           formula: "cartaCredito * (percLanceEmb / 100)", type: "money" },
        { key: "lanceProprio",        label: "Lance próprio em R$",            formula: "lanceProprioR",                    type: "money" },
        { key: "lanceTotalR",         label: "Lance total (R$)",               formula: "lanceEmbR + lanceProprio",         type: "money" },
        { key: "saldoPosLance",       label: "Saldo devedor pós-lance (R$)",   formula: "max(cartaCredito - lanceTotalR, 0)", type: "money" },
        { key: "parcelasRestantes",   label: "Meses restantes pós-contemplação", formula: "prazoMeses - mesContemplacaoLance" },
        { key: "parcelaPosLance",     label: "Parcela pós-lance (R$)",         formula: "parcelasRestantes > 0 ? (saldoPosLance * (1 + taxaAdmFrac)) / prazoMeses : 0", type: "money" },
        { key: "percLanceTotalSobreCarta", label: "Lance total (% da carta)", formula: "cartaCredito > 0 ? (lanceTotalR / cartaCredito) * 100 : 0", type: "percent" },
      ],
      outputs: [
        { key: "totalSemLance",       label: "Total sem lance (R$)",           formula: "parcelaPadrao * prazoMeses",                                                               type: "money",   displayOrder: 1, kpiVariant: "danger"   },
        { key: "totalComLance",       label: "Total com lance (R$)",           formula: "parcelaPadrao * mesContemplacaoLance + lanceProprio + parcelaPosLance * parcelasRestantes", type: "money",   displayOrder: 2, kpiVariant: "success"  },
        { key: "economia",            label: "Economia total (R$)",            formula: "totalSemLance - totalComLance",                                                             type: "money",   displayOrder: 3, kpiVariant: "primary"  },
      ],
      timeline: {
        loopVariable: "mes",
        lengthFormula: "prazoMeses",
        fields: [
          { key: "parcelaSemLance",   label: "Parcela s/ lance (R$)",  formula: "parcelaPadrao",  type: "money" },
          { key: "parcelaComLance",   label: "Parcela c/ lance (R$)",  formula: "mes <= mesContemplacaoLance ? parcelaPadrao : parcelaPosLance", type: "money" },
        ],
        accumulators: [
          { key: "desembolsoAcumSemLance", label: "Desembolso acum. s/ lance", initialValue: "0", formula: "desembolsoAcumSemLance + parcelaSemLance" },
          { key: "desembolsoAcumComLance", label: "Desembolso acum. c/ lance", initialValue: "0", formula: "desembolsoAcumComLance + parcelaComLance" },
        ],
      },
    },
  },

  // ─── 2. Aluguel vs Consórcio ────────────────────────────────────────────────
  {
    slug: "aluguel-vs-consorcio",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-aluguel-vs-consorcio.ts.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "aluguelAtual",         label: "Aluguel atual (R$/mês)",           type: "money",   defaultValue: "3.500,00" },
        { key: "reajusteAluguelAnual", label: "Reajuste anual do aluguel (%)",    type: "percent", defaultValue: "5,00" },
        { key: "horizonte",            label: "Horizonte de análise (anos)",      type: "int",     defaultValue: "20" },
        { key: "cartaCredito",         label: "Carta de crédito / imóvel (R$)",   type: "money",   defaultValue: "500.000,00" },
        { key: "taxaAdmTotal",         label: "Taxa de administração total (%)",  type: "percent", defaultValue: "18,00" },
        { key: "prazoMeses",           label: "Prazo do grupo (meses)",           type: "int",     defaultValue: "120" },
        { key: "percLance",            label: "Lance ofertado (% da carta)",      type: "int",     defaultValue: "25" },
        { key: "lanceProprioR",        label: "Lance próprio (R$)",               type: "money",   defaultValue: "0,00" },
        { key: "mesContemplacao",      label: "Mês estimado de contemplação",     type: "int",     defaultValue: "12" },
        { key: "valorizacaoAnual",     label: "Valorização anual do imóvel (%)",  type: "percent", defaultValue: "6,00" },
      ],
      intermediates: [
        { key: "horizonteMeses",       label: "Horizonte em meses",              formula: "horizonte * 12" },
        { key: "taxaAdmFrac",          label: "Taxa adm. (fração)",              formula: "taxaAdmTotal / 100" },
        { key: "lanceEmbR",            label: "Lance embutido (R$)",             formula: "cartaCredito * (percLance / 100)", type: "money" },
        { key: "saldoPosLance",        label: "Saldo devedor pós-lance (R$)",    formula: "max(cartaCredito - lanceEmbR - lanceProprioR, 0)", type: "money" },
        { key: "valorPlano",           label: "Valor total do plano",            formula: "cartaCredito * (1 + taxaAdmFrac)", type: "money" },
        { key: "parcelaPadrao",        label: "Parcela padrão (R$)",             formula: "valorPlano / prazoMeses", type: "money" },
        { key: "parcelaPosLance",      label: "Parcela pós-lance (R$)",          formula: "prazoMeses > mesContemplacao ? (saldoPosLance * (1 + taxaAdmFrac)) / prazoMeses : 0", type: "money" },
        { key: "valorizMensal",        label: "Valorização mensal (fração)",     formula: "pow(1 + valorizacaoAnual / 100, 1/12) - 1" },
        { key: "reajusteMensal",       label: "Reajuste mensal do aluguel",      formula: "pow(1 + reajusteAluguelAnual / 100, 1/12) - 1" },
        { key: "valorImovelFinal",     label: "Valor do imóvel no horizonte",    formula: "cartaCredito * pow(1 + valorizacaoAnual / 100, horizonte)", type: "money" },
      ],
      outputs: [
        { key: "patrimonioConsorcio",  label: "Patrimônio com consórcio (R$)",   formula: "valorImovelFinal", type: "money", displayOrder: 1, kpiVariant: "success" },
        { key: "vantagemPatrimonial",  label: "Vantagem patrimonial (R$)",       formula: "valorImovelFinal", type: "money", displayOrder: 3, kpiVariant: "primary" },
      ],
      timeline: {
        loopVariable: "mes",
        lengthFormula: "horizonteMeses",
        fields: [
          { key: "aluguelMes",         label: "Aluguel do mês (R$)",             formula: "aluguelAtual * pow(1 + reajusteMensal, mes - 1)", type: "money" },
          { key: "parcelaCons",        label: "Parcela consórcio (R$)",          formula: "mes <= prazoMeses ? (mes <= mesContemplacao ? parcelaPadrao : parcelaPosLance) : 0", type: "money" },
          { key: "patrimonioConsorcioMes", label: "Patrimônio imóvel (R$)",     formula: "mes >= mesContemplacao ? cartaCredito * pow(1 + valorizMensal, mes - mesContemplacao) : 0", type: "money" },
        ],
        accumulators: [
          { key: "aluguelAcum",        label: "Aluguel acumulado",               initialValue: "0", formula: "aluguelAcum + aluguelMes" },
          { key: "consAcum",           label: "Consórcio acumulado",             initialValue: "0", formula: "consAcum + parcelaCons" },
        ],
      },
    },
  },

  // ─── 3. Renda Passiva ───────────────────────────────────────────────────────
  {
    slug: "renda-passiva-consorcio",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-renda-passiva.ts.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "cartaCredito",         label: "Carta de crédito (R$)",           type: "money",   defaultValue: "500.000,00" },
        { key: "taxaAdmTotal",         label: "Taxa de administração total (%)",  type: "percent", defaultValue: "18,00" },
        { key: "prazoMeses",           label: "Prazo do grupo (meses)",           type: "int",     defaultValue: "120" },
        { key: "percLance",            label: "Lance ofertado (% da carta)",      type: "int",     defaultValue: "25" },
        { key: "lanceProprioR",        label: "Lance próprio (R$)",               type: "money",   defaultValue: "0,00" },
        { key: "mesContemplacao",      label: "Mês estimado de contemplação",     type: "int",     defaultValue: "12" },
        { key: "rendaAluguelMensal",   label: "Renda de aluguel mensal (R$)",     type: "money",   defaultValue: "2.500,00" },
        { key: "reajusteAluguelAnual", label: "Reajuste anual do aluguel (%)",    type: "percent", defaultValue: "5,00" },
        { key: "valorizacaoAnual",     label: "Valorização anual do imóvel (%)",  type: "percent", defaultValue: "6,00" },
        { key: "taxaCDIAnual",         label: "Taxa CDI anual comparativa (%)",   type: "percent", defaultValue: "13,00" },
      ],
      intermediates: [
        { key: "taxaAdmFrac",          label: "Taxa adm. (fração)",              formula: "taxaAdmTotal / 100" },
        { key: "lanceEmbR",            label: "Lance embutido (R$)",             formula: "cartaCredito * (percLance / 100)", type: "money" },
        { key: "saldoPosLance",        label: "Saldo devedor pós-lance",         formula: "max(cartaCredito - lanceEmbR - lanceProprioR, 0)", type: "money" },
        { key: "valorPlano",           label: "Valor total do plano",            formula: "cartaCredito * (1 + taxaAdmFrac)" },
        { key: "parcelaPadrao",        label: "Parcela padrão (R$)",             formula: "valorPlano / prazoMeses", type: "money" },
        { key: "parcelaPosLance",      label: "Parcela pós-lance (R$)",          formula: "prazoMeses > mesContemplacao ? (saldoPosLance * (1 + taxaAdmFrac)) / prazoMeses : 0", type: "money" },
        { key: "valorizMensal",        label: "Valorização mensal",              formula: "pow(1 + valorizacaoAnual / 100, 1/12) - 1" },
        { key: "reajusteMensal",       label: "Reajuste mensal do aluguel",      formula: "pow(1 + reajusteAluguelAnual / 100, 1/12) - 1" },
        { key: "cdiMensal",            label: "CDI mensal",                      formula: "pow(1 + taxaCDIAnual / 100, 1/12) - 1" },
      ],
      outputs: [
        { key: "totalInvestido",       label: "Total investido (R$)",            formula: "parcelaPadrao * prazoMeses + lanceProprioR", type: "money", displayOrder: 1, kpiVariant: "default"  },
        { key: "valorImovelFinal",     label: "Valor do imóvel ao final (R$)",   formula: "cartaCredito * pow(1 + valorizMensal, prazoMeses)", type: "money", displayOrder: 2, kpiVariant: "success"  },
        { key: "cdbFuturo",            label: "CDB equivalente (R$)",            formula: "totalInvestido * pow(1 + cdiMensal, prazoMeses)", type: "money", displayOrder: 4, kpiVariant: "warning"  },
      ],
      timeline: {
        loopVariable: "mes",
        lengthFormula: "prazoMeses",
        fields: [
          { key: "parcelaCons",        label: "Parcela consórcio (R$)",          formula: "mes <= mesContemplacao ? parcelaPadrao : parcelaPosLance", type: "money" },
          { key: "rendaAluguel",       label: "Renda de aluguel (R$)",           formula: "mes > mesContemplacao ? rendaAluguelMensal * pow(1 + reajusteMensal, mes - mesContemplacao - 1) : 0", type: "money" },
          { key: "fluxoLiquido",       label: "Fluxo líquido do mês (R$)",       formula: "rendaAluguel - parcelaCons", type: "money" },
          { key: "patrimonioImovel",   label: "Patrimônio imóvel (R$)",          formula: "mes >= mesContemplacao ? cartaCredito * pow(1 + valorizMensal, mes - mesContemplacao) : 0", type: "money" },
        ],
        accumulators: [
          { key: "totalInvestidoAcum", label: "Total investido acumulado",       initialValue: "0", formula: "totalInvestidoAcum + parcelaCons" },
          { key: "totalRendaAcum",     label: "Renda acumulada",                 initialValue: "0", formula: "totalRendaAcum + rendaAluguel" },
          { key: "fluxoAcum",          label: "Fluxo acumulado",                 initialValue: "0", formula: "fluxoAcum + fluxoLiquido" },
        ],
      },
    },
  },

  // ─── 4. Flip de Cota ────────────────────────────────────────────────────────
  {
    slug: "flip-cota",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-flip-cota.ts.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "cartaCredito",         label: "Carta de crédito (R$)",           type: "money",   defaultValue: "500.000,00" },
        { key: "prazo",                label: "Prazo do grupo (meses)",           type: "int",     defaultValue: "120" },
        { key: "taxaAdm",              label: "Taxa de administração (%)",        type: "percent", defaultValue: "18,00" },
        { key: "fundoReserva",         label: "Fundo de reserva (%)",             type: "percent", defaultValue: "2,00" },
        { key: "lancePerc",            label: "Lance ofertado (% da carta)",      type: "int",     defaultValue: "30" },
        { key: "mesContemplacao",      label: "Mês de contemplação c/ lance",     type: "int",     defaultValue: "8" },
        { key: "agioVenda",            label: "Ágio na venda da carta (%)",       type: "percent", defaultValue: "12,00" },
      ],
      intermediates: [
        { key: "taxaTotal",            label: "Taxa total (adm + fundo) fração",  formula: "(taxaAdm + fundoReserva) / 100" },
        { key: "valorPlano",           label: "Valor total do plano",             formula: "cartaCredito * (1 + taxaTotal)" },
        { key: "parcelaMensal",        label: "Parcela mensal (R$)",              formula: "valorPlano / prazo", type: "money" },
        { key: "lanceR",               label: "Lance em R$",                      formula: "cartaCredito * (lancePerc / 100)", type: "money" },
        { key: "saldoPosLance",        label: "Saldo pós-lance (R$)",             formula: "max(cartaCredito - lanceR, 0)", type: "money" },
        { key: "parcelasPreLance",     label: "Parcelas antes do lance",          formula: "parcelaMensal * mesContemplacao", type: "money" },
        { key: "totalDesembolso",      label: "Total desembolsado (R$)",          formula: "parcelasPreLance + lanceR", type: "money" },
        { key: "valorVenda",           label: "Valor de venda da carta (R$)",     formula: "cartaCredito * (1 + agioVenda / 100)", type: "money" },
        { key: "lucroFlip",            label: "Lucro do flip (R$)",               formula: "valorVenda - totalDesembolso", type: "money" },
        { key: "roiFlip",              label: "ROI do flip (%)",                  formula: "totalDesembolso > 0 ? (lucroFlip / totalDesembolso) * 100 : 0", type: "percent" },
      ],
      outputs: [
        { key: "lucroFlipOut",         label: "Lucro do flip (R$)",              formula: "lucroFlip",     type: "money",   displayOrder: 1, kpiVariant: "success" },
        { key: "roiFlipOut",           label: "ROI da operação (%)",             formula: "roiFlip",       type: "percent", displayOrder: 2, kpiVariant: "primary" },
        { key: "totalDesembolsoOut",   label: "Total desembolsado (R$)",         formula: "totalDesembolso", type: "money", displayOrder: 3, kpiVariant: "default" },
        { key: "valorVendaOut",        label: "Valor de venda da carta (R$)",    formula: "valorVenda",    type: "money",   displayOrder: 4, kpiVariant: "default" },
      ],
    },
  },

  // ─── 5. Saída do Financiamento ──────────────────────────────────────────────
  {
    slug: "saida-financiamento",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-saida-financiamento.ts.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "valorImovelAtual",     label: "Valor atual do imóvel (R$)",       type: "money",   defaultValue: "800.000,00" },
        { key: "saldoDevedor",         label: "Saldo devedor ao banco (R$)",       type: "money",   defaultValue: "400.000,00" },
        { key: "parcelaAtual",         label: "Parcela atual (R$)",                type: "money",   defaultValue: "4.500,00" },
        { key: "prazoRestanteMeses",   label: "Prazo restante (meses)",            type: "int",     defaultValue: "180" },
        { key: "taxaJurosMensal",      label: "Taxa de juros mensal (%)",          type: "percent", defaultValue: "0,85" },
        { key: "cartaConsorcio",       label: "Carta de crédito consórcio (R$)",   type: "money",   defaultValue: "500.000,00" },
        { key: "taxaAdmConsorcio",     label: "Taxa de adm. consórcio (%)",        type: "percent", defaultValue: "18,00" },
        { key: "prazoConsorcio",       label: "Prazo do grupo (meses)",            type: "int",     defaultValue: "120" },
        { key: "percLance",            label: "Lance ofertado (% da carta)",       type: "int",     defaultValue: "30" },
        { key: "mesContemplacaoConsorcio", label: "Mês de contemplação",          type: "int",     defaultValue: "10" },
        { key: "valorizacaoAnual",     label: "Valorização anual do imóvel (%)",   type: "percent", defaultValue: "6,00" },
        { key: "custosVenda",          label: "Custos de venda do imóvel (%)",     type: "percent", defaultValue: "6,00", hint: "Corretagem + ITBI + despesas" },
      ],
      intermediates: [
        { key: "taxaAdmFrac",          label: "Taxa adm. consórcio (fração)",     formula: "taxaAdmConsorcio / 100" },
        { key: "custosVendaR",         label: "Custos de venda em R$",            formula: "valorImovelAtual * (custosVenda / 100)", type: "money" },
        { key: "capitalLiquidoVenda",  label: "Capital líquido da venda (R$)",    formula: "valorImovelAtual - saldoDevedor - custosVendaR", type: "money" },
        { key: "lanceEmReaisConsorcio",label: "Lance em R$ no consórcio",         formula: "cartaConsorcio * (percLance / 100)", type: "money" },
        { key: "sobra",                label: "Capital que sobra após lance",      formula: "capitalLiquidoVenda - lanceEmReaisConsorcio", type: "money" },
        { key: "saldoPosLance",        label: "Saldo devedor pós-lance consórcio",formula: "max(cartaConsorcio - lanceEmReaisConsorcio, 0)", type: "money" },
        { key: "parcelaConsorcio",     label: "Parcela consórcio pré-lance (R$)", formula: "cartaConsorcio * (1 + taxaAdmFrac) / prazoConsorcio", type: "money" },
        { key: "parcelaPosLance",      label: "Parcela consórcio pós-lance (R$)", formula: "saldoPosLance * (1 + taxaAdmFrac) / prazoConsorcio", type: "money" },
        { key: "economiaParcelaMensal",label: "Economia mensal (R$)",             formula: "parcelaAtual - parcelaPosLance", type: "money" },
      ],
      outputs: [
        { key: "capitalLiquidoVendaOut",  label: "Capital líquido da venda (R$)", formula: "capitalLiquidoVenda",  type: "money", displayOrder: 1, kpiVariant: "primary"  },
        { key: "parcelaPosLanceOut",      label: "Parcela pós-lance (R$)",        formula: "parcelaPosLance",       type: "money", displayOrder: 2, kpiVariant: "success"  },
        { key: "economiaParcelaMensalOut",label: "Economia mensal (R$)",          formula: "economiaParcelaMensal", type: "money", displayOrder: 3, kpiVariant: "success"  },
        { key: "sobraOut",               label: "Capital que sobra (R$)",         formula: "sobra",                 type: "money", displayOrder: 4, kpiVariant: "default"  },
      ],
    },
  },

  // ─── 6. Meta Patrimonial ────────────────────────────────────────────────────
  {
    slug: "meta-patrimonial",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-meta-patrimonial.ts. Simulador de cálculo reverso — lógica iterativa simplificada aqui.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "patrimonioAlvoR",      label: "Meta de patrimônio (R$)",          type: "money",   defaultValue: "2.000.000,00" },
        { key: "horizonteAnos",        label: "Horizonte de tempo (anos)",         type: "int",     defaultValue: "15" },
        { key: "valorizacaoAnual",     label: "Valorização anual do imóvel (%)",   type: "percent", defaultValue: "6,00" },
        { key: "taxaAdmConsorcio",     label: "Taxa de adm. consórcio (%)",        type: "percent", defaultValue: "18,00" },
        { key: "prazoConsorcio",       label: "Prazo do grupo (meses)",            type: "int",     defaultValue: "120" },
        { key: "percLance",            label: "Lance ofertado (% da carta)",       type: "int",     defaultValue: "25" },
        { key: "mesContemplacaoPrimeira",label: "Mês de contemplação (1ª cota)",   type: "int",     defaultValue: "12" },
        { key: "yeildAluguelPerc",     label: "Yield do aluguel (% a.m.)",         type: "percent", defaultValue: "0,50" },
        { key: "cdiAnual",             label: "CDI anual comparativo (%)",         type: "percent", defaultValue: "13,00" },
      ],
      intermediates: [
        { key: "horizonteMeses",       label: "Horizonte em meses",               formula: "horizonteAnos * 12" },
        { key: "valorizMensal",        label: "Valorização mensal",               formula: "pow(1 + valorizacaoAnual / 100, 1/12) - 1" },
        { key: "taxaAdmFrac",          label: "Taxa adm. (fração)",               formula: "taxaAdmConsorcio / 100" },
        { key: "cartaNecessaria",      label: "Carta de crédito necessária (R$)", formula: "patrimonioAlvoR / pow(1 + valorizacaoAnual / 100, horizonteAnos)", type: "money", description: "Valor presente da carta para atingir a meta" },
        { key: "lanceR",               label: "Lance em R$",                      formula: "cartaNecessaria * (percLance / 100)", type: "money" },
        { key: "saldoPosLance",        label: "Saldo pós-lance",                  formula: "max(cartaNecessaria - lanceR, 0)", type: "money" },
        { key: "parcelaCons",          label: "Parcela mensal do consórcio",      formula: "cartaNecessaria * (1 + taxaAdmFrac) / prazoConsorcio", type: "money" },
        { key: "totalInvestido",       label: "Total investido estimado",         formula: "parcelaCons * prazoConsorcio + lanceR", type: "money" },
        { key: "cdiMensal",            label: "CDI mensal",                       formula: "pow(1 + cdiAnual / 100, 1/12) - 1" },
        { key: "cdbFinal",             label: "CDB equivalente (R$)",             formula: "totalInvestido * pow(1 + cdiMensal, horizonteMeses)", type: "money" },
        { key: "rendaMensalFinalR",    label: "Renda mensal gerada (R$)",         formula: "patrimonioAlvoR * (yeildAluguelPerc / 100)", type: "money" },
      ],
      outputs: [
        { key: "cartaNecessariaOut",   label: "Carta de crédito necessária (R$)", formula: "cartaNecessaria",   type: "money",   displayOrder: 1, kpiVariant: "primary"  },
        { key: "patrimonioAlvo",       label: "Meta patrimonial (R$)",            formula: "patrimonioAlvoR",   type: "money",   displayOrder: 2, kpiVariant: "success"  },
        { key: "totalInvestidoOut",    label: "Total investido (R$)",             formula: "totalInvestido",    type: "money",   displayOrder: 3, kpiVariant: "default"  },
        { key: "rendaMensalOut",       label: "Renda mensal gerada (R$)",         formula: "rendaMensalFinalR", type: "money",   displayOrder: 4, kpiVariant: "success"  },
        { key: "cdbFinalOut",          label: "CDB equivalente (R$)",             formula: "cdbFinal",          type: "money",   displayOrder: 5, kpiVariant: "warning"  },
        { key: "vantageVsCDB",         label: "Vantagem vs. CDB (R$)",            formula: "patrimonioAlvoR - cdbFinal", type: "money", displayOrder: 6, kpiVariant: "primary" },
      ],
    },
  },

  // ─── 7. Consórcio para CNPJ ─────────────────────────────────────────────────
  {
    slug: "consorcio-cnpj",
    version_label: "v1 — Configuração inicial (espelho TypeScript)",
    notes: "Gerado automaticamente a partir de calc-consorcio-cnpj.ts.",
    config: {
      schemaVersion: 1,
      inputs: [
        { key: "cartaCredito",         label: "Carta de crédito (R$)",            type: "money",   defaultValue: "1.000.000,00" },
        { key: "taxaAdmConsorcio",     label: "Taxa de adm. consórcio (%)",       type: "percent", defaultValue: "18,00" },
        { key: "prazoConsorcio",       label: "Prazo do grupo (meses)",           type: "int",     defaultValue: "120" },
        { key: "percLance",            label: "Lance ofertado (% da carta)",      type: "int",     defaultValue: "30" },
        { key: "mesContemplacaoConsorcio", label: "Mês de contemplação",         type: "int",     defaultValue: "10" },
        { key: "taxaJurosMensalFin",   label: "Taxa de juros financiamento PJ (% a.m.)", type: "percent", defaultValue: "1,20" },
        { key: "prazoFinanciamentoMeses", label: "Prazo financiamento PJ (meses)",type: "int",     defaultValue: "120" },
        { key: "aliquotaIRPJ",         label: "Alíquota IRPJ (%)",               type: "int",     defaultValue: "15", hint: "15% presunção simplificada" },
        { key: "aliquotaCSLL",         label: "Alíquota CSLL (%)",               type: "int",     defaultValue: "9",  hint: "9% padrão" },
      ],
      intermediates: [
        { key: "aliquotaEfetivaTotal", label: "Alíquota fiscal efetiva total (%)", formula: "aliquotaIRPJ + aliquotaCSLL", type: "percent" },
        { key: "aliquotaEfetiva",      label: "Alíquota efetiva (fração)",        formula: "aliquotaEfetivaTotal / 100" },
        { key: "taxaAdmFrac",          label: "Taxa adm. (fração)",               formula: "taxaAdmConsorcio / 100" },
        { key: "parcelaBrutaConsorcio",label: "Parcela bruta consórcio (R$)",    formula: "cartaCredito * (1 + taxaAdmFrac) / prazoConsorcio", type: "money" },
        { key: "economiaFiscalMensal", label: "Economia fiscal mensal (R$)",     formula: "parcelaBrutaConsorcio * aliquotaEfetiva", type: "money" },
        { key: "parcelaLiquidaConsorcio",label: "Parcela líquida consórcio (R$)",formula: "parcelaBrutaConsorcio * (1 - aliquotaEfetiva)", type: "money" },
        { key: "lanceR",               label: "Lance em R$",                     formula: "cartaCredito * (percLance / 100)", type: "money" },
        { key: "saldoPosLance",        label: "Saldo pós-lance",                 formula: "max(cartaCredito - lanceR, 0)", type: "money" },
        { key: "parcelaBrutaPosLance", label: "Parcela bruta pós-lance (R$)",    formula: "saldoPosLance * (1 + taxaAdmFrac) / prazoConsorcio", type: "money" },
        { key: "parcelaLiquidaPosLance",label: "Parcela líquida pós-lance (R$)", formula: "parcelaBrutaPosLance * (1 - aliquotaEfetiva)", type: "money" },
        { key: "taxaJurosFrac",        label: "Taxa juros fin. (fração)",        formula: "taxaJurosMensalFin / 100" },
        { key: "coefPrice",            label: "Coeficiente Price",               formula: "(taxaJurosFrac * pow(1 + taxaJurosFrac, prazoFinanciamentoMeses)) / (pow(1 + taxaJurosFrac, prazoFinanciamentoMeses) - 1)" },
        { key: "parcelaFinanciamento", label: "Parcela financiamento PJ (R$)",   formula: "cartaCredito * coefPrice", type: "money" },
        { key: "totalBrutoConsorcio",  label: "Total bruto consórcio (R$)",      formula: "parcelaBrutaConsorcio * prazoConsorcio", type: "money" },
        { key: "totalEconomiaFiscal",  label: "Economia fiscal total (R$)",      formula: "economiaFiscalMensal * prazoConsorcio", type: "money" },
        { key: "totalLiquidoConsorcio",label: "Total líquido consórcio (R$)",    formula: "totalBrutoConsorcio - totalEconomiaFiscal", type: "money" },
        { key: "totalFinanciamento",   label: "Total financiamento PJ (R$)",     formula: "parcelaFinanciamento * prazoFinanciamentoMeses", type: "money" },
        { key: "economiaTotalVsFin",   label: "Economia vs. financiamento (R$)", formula: "totalFinanciamento - totalLiquidoConsorcio", type: "money" },
      ],
      outputs: [
        { key: "parcelaLiquidaConsorcioOut",label: "Parcela líquida consórcio (R$)", formula: "parcelaLiquidaConsorcio", type: "money", displayOrder: 1, kpiVariant: "success" },
        { key: "parcelaFinanciamentoOut",   label: "Parcela financiamento PJ (R$)",  formula: "parcelaFinanciamento",    type: "money", displayOrder: 2, kpiVariant: "danger"  },
        { key: "economiaFiscalMensalOut",   label: "Economia fiscal/mês (R$)",       formula: "economiaFiscalMensal",    type: "money", displayOrder: 3, kpiVariant: "primary" },
        { key: "economiaTotalVsFinOut",     label: "Economia total vs. fin. (R$)",   formula: "economiaTotalVsFin",      type: "money", displayOrder: 4, kpiVariant: "primary" },
        { key: "aliquotaEfetivaTotalOut",   label: "Alíquota efetiva total (%)",     formula: "aliquotaEfetivaTotal",    type: "percent",displayOrder: 5, kpiVariant: "default" },
      ],
    },
  },

  // ─── 8. Calculadora Patrimonial (SAC/PRICE vs Consórcio) ───────────────────
  {
    slug: "calculadora-patrimonial",
    version_label: "v2 — Configuração completa: todos os campos e fórmulas editáveis",
    notes: "Espelho completo de calculator.ts. Cobre todos os campos do bloco 'Cenário Consórcio Estratégico' e o comparativo SAC/PRICE. Inclui timeline com loop mensal do consórcio para saldo devedor e CDI precisos.",
    config: {
      schemaVersion: 1,
      inputs: [
        // Imóvel e entrada
        { key: "valorImovel",            label: "Valor do imóvel (R$)",                  type: "money",   defaultValue: "500.000,00" },
        { key: "entrada",                label: "Entrada própria (R$)",                  type: "money",   defaultValue: "100.000,00" },
        // Financiamento
        { key: "jFinAnual",              label: "Taxa de juros anual fin. (%)",          type: "percent", defaultValue: "10,20",  hint: "Taxa anual — o editor converte para mensal internamente" },
        { key: "trAnual",                label: "TR / ajuste anual (%)",                 type: "percent", defaultValue: "0,00",   hint: "Reajuste anual do saldo devedor bancário (TR)" },
        { key: "prazoFinanciamento",     label: "Prazo financiamento (meses)",           type: "int",     defaultValue: "360" },
        // Consórcio
        { key: "creditoCons",            label: "Carta de crédito consórcio (R$)",       type: "money",   defaultValue: "500.000,00" },
        { key: "taxaAdmConsorcio",       label: "Taxa de adm. consórcio (%)",            type: "percent", defaultValue: "18,00" },
        { key: "prazoConsorcio",         label: "Prazo do plano (meses)",                type: "int",     defaultValue: "120" },
        { key: "percLanceEmb",           label: "Lance embutido (% da carta)",           type: "int",     defaultValue: "20",    hint: "% do crédito corrigido pelo INCC usado como lance embutido" },
        { key: "lanceProprio",           label: "Lance recurso próprio (R$)",            type: "money",   defaultValue: "0,00" },
        { key: "mesContemplacao",        label: "Mês de contemplação",                   type: "int",     defaultValue: "24" },
        { key: "inccAnual",              label: "INCC anual estimado (%)",               type: "percent", defaultValue: "4,00",   hint: "Reajusta a carta de crédito e o saldo do plano anualmente" },
        { key: "percReducao",            label: "Redução parcela pré-contemplação (%)",  type: "int",     defaultValue: "0",     hint: "Alguns grupos permitem pagar parcela reduzida antes da contemplação" },
        // Custo de oportunidade e despesas
        { key: "aluguel",                label: "Aluguel mensal durante espera (R$)",    type: "money",   defaultValue: "0,00" },
        { key: "taxaOportunidadeMensal", label: "Taxa de oportunidade mensal (%)",       type: "percent", defaultValue: "0,80",   hint: "Rendimento mensal da entrada aplicada (CDI, poupança, etc.)" },
        { key: "valorizacaoAnual",       label: "Valorização anual do imóvel (%)",       type: "percent", defaultValue: "6,00" },
        { key: "percItbi",               label: "ITBI / Cartório (%)",                   type: "percent", defaultValue: "2,00" },
      ],
      intermediates: [
        // ── Financiamento ────────────────────────────────────────────────────
        { key: "valorFinanciado",        label: "Valor financiado (R$)",                 formula: "valorImovel - entrada",                                                                                                                   type: "money",   description: "Saldo a financiar após subtrair a entrada" },
        { key: "taxaJurosMensalFin",     label: "Taxa de juros mensal fin. (fração)",    formula: "jFinAnual / 100 / 12",                                                                                                                                     description: "Converte taxa anual → mensal: jAnual / 100 / 12" },
        { key: "coefPrice",              label: "Coeficiente Price",                     formula: "taxaJurosMensalFin > 0 ? (taxaJurosMensalFin * pow(1 + taxaJurosMensalFin, prazoFinanciamento)) / (pow(1 + taxaJurosMensalFin, prazoFinanciamento) - 1) : 1 / prazoFinanciamento", description: "Fator multiplicador da tabela Price" },
        { key: "parcelaPrice",           label: "Parcela PRICE (R$)",                    formula: "valorFinanciado * coefPrice",                                                                                                             type: "money" },
        { key: "totalPrice",             label: "Total pago PRICE (R$)",                 formula: "parcelaPrice * prazoFinanciamento",                                                                                                        type: "money" },
        { key: "jurosPrice",             label: "Juros totais PRICE (R$)",               formula: "totalPrice - valorFinanciado",                                                                                                             type: "money" },
        { key: "amortizacaoSAC",         label: "Amortização mensal SAC (R$)",           formula: "valorFinanciado / prazoFinanciamento",                                                                                                     type: "money" },
        { key: "primeiraParcelaSAC",     label: "1ª parcela SAC (R$)",                   formula: "amortizacaoSAC + valorFinanciado * taxaJurosMensalFin",                                                                                   type: "money" },
        { key: "totalSAC",               label: "Total pago SAC (R$)",                   formula: "amortizacaoSAC * prazoFinanciamento + (valorFinanciado * taxaJurosMensalFin * (prazoFinanciamento + 1)) / 2",                             type: "money",   description: "Soma de todas as parcelas SAC (amortização + juros decrescentes)" },
        { key: "jurosSAC",               label: "Juros totais SAC (R$)",                 formula: "totalSAC - valorFinanciado",                                                                                                              type: "money" },
        // ── Consórcio — base ─────────────────────────────────────────────────
        { key: "tAdmFrac",               label: "Taxa adm. (fração decimal)",            formula: "taxaAdmConsorcio / 100",                                                                                                                                   description: "Ex: 18% → 0.18" },
        { key: "montanteComTaxa",        label: "Montante do plano c/ taxa adm. (R$)",   formula: "creditoCons * (1 + tAdmFrac)",                                                                                                            type: "money",   description: "Saldo inicial do grupo = carta × (1 + taxa_adm)" },
        { key: "parcelaBaseConsorcio",   label: "Parcela base consórcio (R$)",           formula: "montanteComTaxa / prazoConsorcio",                                                                                                         type: "money",   description: "Parcela padrão pré-contemplação (sem redução)" },
        { key: "custoITBIConsorcio",     label: "Custo ITBI/Cartório — consórcio (R$)",  formula: "valorImovel * (percItbi / 100)",                                                                                                           type: "money" },
        { key: "custoAluguel",           label: "Custo aluguel na espera (R$)",          formula: "aluguel * mesContemplacao",                                                                                                                type: "money",   description: "Total pago de aluguel enquanto aguarda contemplação" },
        // ── INCC e contemplação ───────────────────────────────────────────────
        { key: "anosContemplacao",       label: "Anos até contemplação",                 formula: "floor((mesContemplacao - 1) / 12)",                                                                                                                        description: "Quantos aniversários do plano ocorrem antes da contemplação" },
        { key: "multINCC",               label: "Multiplicador INCC acumulado",          formula: "pow(1 + inccAnual / 100, anosContemplacao)",                                                                                                               description: "Fator de correção pelo INCC até a contemplação" },
        { key: "creditoAtualizado",      label: "Crédito atualizado pelo INCC (R$)",     formula: "creditoCons * multINCC",                                                                                                                   type: "money",   description: "Valor real da carta na data da contemplação após reajuste INCC" },
        { key: "montanteReajustado",     label: "Montante do plano reajustado (R$)",     formula: "montanteComTaxa * multINCC",                                                                                                               type: "money",   description: "Saldo total do plano corrigido pelo INCC (base=plano)" },
        // ── Lance embutido (base=crédito, caso padrão) ───────────────────────
        { key: "lanceEmbR",              label: "Lance embutido em R$ (INCC-ajustado)",  formula: "creditoAtualizado * (percLanceEmb / 100)",                                                                                                 type: "money",   description: "Lance embutido calculado sobre o crédito já corrigido pelo INCC. Para base=plano, substitua creditoAtualizado por montanteReajustado." },
        { key: "lanceTotalR",            label: "Lance total (embutido + próprio) (R$)", formula: "lanceEmbR + lanceProprio",                                                                                                                 type: "money" },
        { key: "poderCompraLiq",         label: "Poder de compra líquido (R$)",          formula: "max(creditoAtualizado - lanceEmbR, 0)",                                                                                                    type: "money",   description: "Crédito disponível após descontar o lance embutido" },
        // ── Saldo devedor pós-lance (aproximação sem INCC loop) ─────────────
        { key: "saldoDevedorPreLance",   label: "Saldo devedor antes do lance (R$)",     formula: "max(montanteComTaxa - parcelaBaseConsorcio * mesContemplacao, 0)",                                                                        type: "money",   description: "Saldo restante após pagar parcelas até a contemplação (sem INCC intra-anual)" },
        { key: "saldoDevedorPosLance",   label: "Saldo devedor pós-lance (R$)",          formula: "max(saldoDevedorPreLance - lanceTotalR, 0)",                                                                                               type: "money",   description: "Saldo devedor após aplicar o lance total na contemplação" },
        // ── Imóvel e patrimônio ───────────────────────────────────────────────
        { key: "imovelCorrigido",        label: "Valor do imóvel corrigido (R$)",        formula: "valorImovel * pow(1 + valorizacaoAnual / 100, prazoConsorcio / 12)",                                                                      type: "money",   description: "Valor projetado do imóvel ao final do prazo do consórcio" },
        { key: "patrimonioFinalCDI",     label: "Patrimônio final CDI (R$)",             formula: "max(entrada * pow(1 + taxaOportunidadeMensal / 100, prazoConsorcio) - lanceProprio, 0)",                                                  type: "money",   description: "Entrada aplicada rendendo à taxa de oportunidade pelo prazo do consórcio, menos o lance próprio" },
        // ── Comparativo totais ────────────────────────────────────────────────
        { key: "totalConsorcioEst",      label: "Total estimado pago consórcio (R$)",    formula: "parcelaBaseConsorcio * prazoConsorcio + lanceProprio",                                                                                     type: "money",   description: "Estimativa do desembolso total no consórcio (parcelas + lance próprio)" },
        { key: "economiaCons",           label: "Economia consórcio vs. PRICE (R$)",     formula: "totalPrice - totalConsorcioEst",                                                                                                           type: "money" },
      ],
      outputs: [
        // ── Cenário Consórcio Estratégico (espelha app.tsx linhas 477-488) ───
        { key: "creditoNominalOut",      label: "Crédito da Carta Nominal (R$)",         formula: "creditoCons",           type: "money",   displayOrder: 1,  kpiVariant: "default"  },
        { key: "creditoAtualizadoOut",   label: "Crédito Atualizado (INCC) (R$)",        formula: "creditoAtualizado",     type: "money",   displayOrder: 2,  kpiVariant: "primary"  },
        { key: "lanceEmbOut",            label: "Lance Embutido Utilizado (R$)",         formula: "lanceEmbR",             type: "money",   displayOrder: 3,  kpiVariant: "default"  },
        { key: "poderCompraOut",         label: "Poder de Compra Líquido (R$)",          formula: "poderCompraLiq",        type: "money",   displayOrder: 4,  kpiVariant: "success"  },
        { key: "saldoDevedorOut",        label: "Saldo Devedor Pós-Lance (R$)",          formula: "saldoDevedorPosLance",  type: "money",   displayOrder: 5,  kpiVariant: "primary"  },
        { key: "custoAluguelOut",        label: "Custo C/ Aluguel (Espera) (R$)",        formula: "custoAluguel",          type: "money",   displayOrder: 6,  kpiVariant: "danger"   },
        { key: "imovelCorrigidoOut",     label: "Valor do Imóvel (Corrigido) (R$)",      formula: "imovelCorrigido",       type: "money",   displayOrder: 7,  kpiVariant: "success"  },
        { key: "patrimonioFinalOut",     label: "Patrimônio Líquido Final (CDI) (R$)",   formula: "patrimonioFinalCDI",    type: "money",   displayOrder: 8,  kpiVariant: "success"  },
        // ── Comparativo SAC / PRICE / Consórcio ──────────────────────────────
        { key: "parcelaPriceOut",        label: "Parcela PRICE (R$)",                    formula: "parcelaPrice",          type: "money",   displayOrder: 9,  kpiVariant: "danger"   },
        { key: "totalPriceOut",          label: "Total pago PRICE (R$)",                 formula: "totalPrice",            type: "money",   displayOrder: 10, kpiVariant: "danger"   },
        { key: "parcelaConsOut",         label: "Parcela base consórcio (R$)",           formula: "parcelaBaseConsorcio",  type: "money",   displayOrder: 11, kpiVariant: "success"  },
        { key: "totalConsorcioOut",      label: "Total estimado consórcio (R$)",         formula: "totalConsorcioEst",     type: "money",   displayOrder: 12, kpiVariant: "success"  },
        { key: "economiaConsOut",        label: "Economia vs. PRICE (R$)",               formula: "economiaCons",          type: "money",   displayOrder: 13, kpiVariant: "primary"  },
      ],
      // ── Timeline: loop mensal do consórcio ──────────────────────────────────
      // Calcula saldo devedor e CDI mês a mês para valores precisos no editor.
      // saldoConsAcum → reflete o saldo real pós-lance na contemplação.
      // cdiConsAcum   → entrada rendendo à taxa de oportunidade, descontando o lance próprio na contemplação.
      timeline: {
        loopVariable: "mes",
        lengthFormula: "prazoConsorcio",
        fields: [
          { key: "parcelaConsMes",  label: "Parcela consórcio (R$)",   formula: "mes <= mesContemplacao ? parcelaBaseConsorcio * (1 - percReducao/100) : parcelaBaseConsorcio", type: "money" },
          { key: "cdiEntrada",      label: "Entrada com CDI (R$)",     formula: "entrada * pow(1 + taxaOportunidadeMensal/100, mes)",                                          type: "money" },
        ],
        accumulators: [
          {
            key: "saldoConsAcum",
            label: "Saldo devedor consórcio acumulado (R$)",
            initialValue: "montanteComTaxa",
            formula: "mes == mesContemplacao ? max(saldoConsAcum - parcelaConsMes - lanceTotalR, 0) : max(saldoConsAcum - parcelaConsMes, 0)",
          },
          {
            key: "cdiConsAcum",
            label: "CDI acumulado sobre a entrada (R$)",
            initialValue: "entrada",
            formula: "mes == mesContemplacao ? max(cdiConsAcum * (1 + taxaOportunidadeMensal/100) - lanceProprio, 0) : cdiConsAcum * (1 + taxaOportunidadeMensal/100)",
          },
        ],
      },
    },
  },
];
