import { describe, it, expect } from "vitest";
import { calcFlipCota, defaultFlipCotaInputs } from "../calc-flip-cota";
import { calcLance, defaultLanceInputs } from "../calc-lance";
import { calcAluguelVsConsorcio, defaultAluguelInputs } from "../calc-aluguel-vs-consorcio";
import { calcRendaPassiva, defaultRendaPassivaInputs } from "../calc-renda-passiva";
import { calcSaidaFinanciamento, defaultSaidaInputs } from "../calc-saida-financiamento";
import { calcConsorcioCNPJ, defaultCNPJInputs } from "../calc-consorcio-cnpj";
import { calcMetaPatrimonial, defaultMetaInputs } from "../calc-meta-patrimonial";

describe("Aluguel vs Consórcio — fonte única de verdade", () => {
  it("parcela mês 13 > mês 1 (INCC no aniversário do mês 12)", () => {
    // Contemplação tardia (mês 60) para comparar dois meses PRÉ-contemplação
    const r = calcAluguelVsConsorcio({ ...defaultAluguelInputs, mesContemplacao: 60 });
    const m1  = r.timeline.find(t => t.mes === 1)?.parcelaCons ?? 0;
    const m13 = r.timeline.find(t => t.mes === 13)?.parcelaCons ?? 0;
    expect(m13).toBeGreaterThan(m1);
    expect(m13 / m1).toBeCloseTo(1.04, 2);
  });

  it("parcelaPosLance muda conforme o mês de contemplação", () => {
    const cedo = calcAluguelVsConsorcio({ ...defaultAluguelInputs, mesContemplacao: 6 });
    const tarde = calcAluguelVsConsorcio({ ...defaultAluguelInputs, mesContemplacao: 36 });
    expect(tarde.parcelaPosLance).not.toBeCloseTo(cedo.parcelaPosLance, 1);
  });

  it("totalConsorcio NÃO inclui lance embutido (só L_proprio sai do bolso)", () => {
    const r = calcAluguelVsConsorcio({ ...defaultAluguelInputs, lanceProprioR: 0 });
    // sem lance próprio, parcelas pré + parcelas pós devem bater com totalConsorcio
    expect(r.totalConsorcio).toBeGreaterThan(0);
    expect(r.totalConsorcio).toBeLessThan(defaultAluguelInputs.cartaCredito * 2);
  });
});

describe("Simulador de Lance — fonte única de verdade", () => {
  it("taxa de administração entra na parcela", () => {
    const semTA = calcLance({ ...defaultLanceInputs, taxaAdmTotal: 0 });
    const comTA = calcLance({ ...defaultLanceInputs, taxaAdmTotal: 18 });
    expect(comTA.parcelaPadrao).toBeGreaterThan(semTA.parcelaPadrao);
  });

  it("parcela pós-lance < parcela padrão quando há lance", () => {
    const r = calcLance({ ...defaultLanceInputs, lanceProprioR: 50_000, tipoLance: "combinado" });
    expect(r.parcelaPosLance).toBeLessThan(r.parcelaPadrao);
  });

  it("timeline[0].parcelaSemLance == parcelaPadrao (cards == gráfico)", () => {
    const r = calcLance(defaultLanceInputs);
    expect(r.timeline[0].parcelaSemLance).toBeCloseTo(r.parcelaPadrao, 1);
  });

  it("parcelas crescem com INCC ao longo do tempo", () => {
    const r = calcLance(defaultLanceInputs);
    const m1  = r.timeline.find(t => t.mes === 1)?.parcelaSemLance ?? 0;
    const m25 = r.timeline.find(t => t.mes === 25)?.parcelaSemLance ?? 0;
    expect(m25).toBeGreaterThan(m1);
  });
});

describe("Flip de Cota — fonte única de verdade", () => {
  it("desembolsoTotal cresce com mais meses de contemplação (parcelas reajustadas)", () => {
    const cedo  = calcFlipCota({ ...defaultFlipCotaInputs, mesContemplacao: 12 });
    const tarde = calcFlipCota({ ...defaultFlipCotaInputs, mesContemplacao: 48 });
    expect(tarde.desembolsoTotal).toBeGreaterThan(cedo.desembolsoTotal);
  });

  it("meia parcela reduz o desembolso total pré-contemplação", () => {
    // Com meiaParcela=false, pagamos parcela cheia em todos os mc meses → mais caro
    const inteira = calcFlipCota({ ...defaultFlipCotaInputs, meiaParcela: false });
    const meia    = calcFlipCota({ ...defaultFlipCotaInputs, meiaParcela: true  });
    expect(meia.parcelaEfetiva).toBeLessThan(inteira.parcelaEfetiva);
    expect(meia.valorPagoParcelas).toBeLessThan(inteira.valorPagoParcelas);
  });
});

describe("Renda Passiva — CDI base corrigida pelo INCC", () => {
  it("cartaAtualizada > cartaCredito (INCC acumulado até a contemplação)", () => {
    const r = calcRendaPassiva({ ...defaultRendaPassivaInputs, taxaAtualizacaoAnual: 4, mesContemplacao: 24 });
    expect(r.cartaAtualizada).toBeGreaterThan(defaultRendaPassivaInputs.cartaCredito);
  });

  it("creditoFinalComCDI parte de cartaAtualizada (não do valor nominal)", () => {
    const r = calcRendaPassiva({
      ...defaultRendaPassivaInputs,
      usoCreditoContemplado: "credito_rende_cdi",
      taxaAtualizacaoAnual: 4,
      mesContemplacao: 24,
    });
    // creditoFinalComCDI deve ser maior que cartaAtualizada (rendeu CDI por N-m meses)
    expect(r.creditoFinalComCDI).toBeGreaterThan(r.cartaAtualizada);
  });

  it("parcela cresce com INCC ao longo do tempo (pré-contemplação)", () => {
    // contemplação tardia para comparar dois meses pré-contemplação
    const r = calcRendaPassiva({ ...defaultRendaPassivaInputs, mesContemplacao: 60 });
    const m1  = r.timeline.find(t => t.mes === 1)?.parcelaCons ?? 0;
    const m13 = r.timeline.find(t => t.mes === 13)?.parcelaCons ?? 0;
    expect(m13).toBeGreaterThan(m1);
  });
});

describe("Saída do Financiamento", () => {
  it("totalRestanteFin é positivo e razoável", () => {
    const r = calcSaidaFinanciamento(defaultSaidaInputs);
    expect(r.totalRestanteFin).toBeGreaterThan(defaultSaidaInputs.saldoDevedor);
  });

  it("parcela pós-contemplação cresce com INCC entre dois aniversários", () => {
    // mc = 8; compara dois pontos pós-contemplação separados por 12 meses
    const r = calcSaidaFinanciamento({ ...defaultSaidaInputs, taxaAtualizacaoAnual: 4 });
    const m13 = r.timeline.find(t => t.mes === 13)?.parcelaCons ?? 0;
    const m25 = r.timeline.find(t => t.mes === 25)?.parcelaCons ?? 0;
    expect(m25).toBeGreaterThan(m13);
  });
});

describe("Consórcio CNPJ — regime fiscal", () => {
  it("Lucro Real abate imposto; Presumido não (economia = 0)", () => {
    const real     = calcConsorcioCNPJ({ ...defaultCNPJInputs, regimeTributario: "real" });
    const presumido = calcConsorcioCNPJ({ ...defaultCNPJInputs, regimeTributario: "presumido" });
    expect(real.totalEconomiaFiscalConsorcio).toBeGreaterThan(0);
    expect(presumido.totalEconomiaFiscalConsorcio).toBe(0);
    expect(real.totalLiquidoConsorcio).toBeLessThan(presumido.totalLiquidoConsorcio);
  });
});

describe("Meta Patrimonial", () => {
  it("sizing iterativo: patrimonioTotalFinal >= patrimonioAlvoR", () => {
    // O numCotas correto garante que a soma real das cotas (cada uma com seu
    // próprio horizonte de valorização) atinge o alvo — metaAtingida=true.
    const r = calcMetaPatrimonial(defaultMetaInputs);
    expect(r.patrimonioTotalFinal).toBeGreaterThanOrEqual(defaultMetaInputs.patrimonioAlvoR);
    expect(r.metaAtingida).toBe(true);
  });

  it("numCotas ≥ 1 e cotas dentro do horizonte", () => {
    const r = calcMetaPatrimonial(defaultMetaInputs);
    expect(r.numCotas).toBeGreaterThanOrEqual(1);
    expect(r.cotas.length).toBe(r.numCotas);
  });

  it("só Lucro Real gera economia fiscal", () => {
    const real   = calcMetaPatrimonial({ ...defaultMetaInputs, regimeTributario: "real",   aliquotaEfetiva: 34 });
    const nenhum = calcMetaPatrimonial({ ...defaultMetaInputs, regimeTributario: "nenhum", aliquotaEfetiva: 0 });
    expect(real.economiaFiscalTotal).toBeGreaterThan(0);
    expect(nenhum.economiaFiscalTotal).toBe(0);
  });
});
