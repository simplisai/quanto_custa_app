import { describe, it, expect } from "vitest";
import { calcFlipCota, defaultFlipCotaInputs } from "../calc-flip-cota";
import { calcLance, defaultLanceInputs } from "../calc-lance";
import { calcAluguelVsConsorcio, defaultAluguelInputs } from "../calc-aluguel-vs-consorcio";
import { calcRendaPassiva, defaultRendaPassivaInputs } from "../calc-renda-passiva";
import { calcSaidaFinanciamento, defaultSaidaInputs } from "../calc-saida-financiamento";
import { calcConsorcioCNPJ, defaultCNPJInputs } from "../calc-consorcio-cnpj";

describe("Flip de Cota", () => {
  it("desembolso total cresce ao contemplar mais tarde (parcelas reajustadas)", () => {
    const cedo = calcFlipCota({ ...defaultFlipCotaInputs, mesContemplacao: 12 });
    const tarde = calcFlipCota({ ...defaultFlipCotaInputs, mesContemplacao: 48 });
    expect(tarde.desembolsoTotal).toBeGreaterThan(cedo.desembolsoTotal);
  });

  it("desembolso total = soma das parcelas pagas + lance próprio", () => {
    const r = calcFlipCota({ ...defaultFlipCotaInputs, tipoLance: "proprio", lancePerc: 20 });
    const somaParc = r.timeline
      .filter((t) => t.mes <= r.paybackMes)
      .reduce((acc, t) => acc + t.parcela, 0);
    expect(r.desembolsoTotal).toBeCloseTo(somaParc + r.desembolsoLance, 2);
  });
});

describe("Simulador de Lance", () => {
  it("a parcela exibida cresce com o INCC (quadros refletem reajuste)", () => {
    const r = calcLance(defaultLanceInputs);
    const m1 = r.timeline[0].parcelaSemLance;
    const m13 = r.timeline[12].parcelaSemLance;
    expect(m13).toBeGreaterThan(m1);
  });

  it("campo-resumo parcelaPosLance == timeline pós-contemplação", () => {
    const r = calcLance({ ...defaultLanceInputs, lanceProprioR: 50_000, tipoLance: "combinado" });
    const mesPos = r.timeline.find((t) => t.mes === defaultLanceInputs.mesContemplacaoLance + 1)!;
    expect(r.parcelaPosLance).toBeCloseTo(mesPos.parcelaComLance, 2);
  });

  it("taxa de administração entra na parcela", () => {
    const semTaxa = calcLance({ ...defaultLanceInputs, taxaAdmTotal: 0 });
    const comTaxa = calcLance({ ...defaultLanceInputs, taxaAdmTotal: 18 });
    expect(comTaxa.parcelaPadrao).toBeGreaterThan(semTaxa.parcelaPadrao);
  });
});

describe("Aluguel vs Consórcio", () => {
  it("a parcela do consórcio reajusta pelo INCC ano a ano", () => {
    const r = calcAluguelVsConsorcio(defaultAluguelInputs);
    // mesContemplacao=12 → comparar dois pontos pós-contemplação separados por 1 ano
    expect(r.timeline[25].parcelaCons).toBeGreaterThan(r.timeline[13].parcelaCons);
  });

  it("parcelaPosLance muda conforme o mês de contemplação", () => {
    const cedo = calcAluguelVsConsorcio({ ...defaultAluguelInputs, mesContemplacao: 6 });
    const tarde = calcAluguelVsConsorcio({ ...defaultAluguelInputs, mesContemplacao: 36 });
    expect(tarde.parcelaPosLance).not.toBeCloseTo(cedo.parcelaPosLance, 1);
  });
});

describe("Renda Passiva", () => {
  it("parcela do consórcio reajusta pelo INCC ano a ano (pós-contemplação)", () => {
    const r = calcRendaPassiva(defaultRendaPassivaInputs);
    // mesContemplacao=12 → comparar dois pontos pós-contemplação separados por 1 ano
    expect(r.timeline[25].parcelaCons).toBeGreaterThan(r.timeline[13].parcelaCons);
  });
});

describe("Saída do Financiamento", () => {
  it("parcela do consórcio reflete reajuste do INCC (não fica congelada)", () => {
    const r = calcSaidaFinanciamento(defaultSaidaInputs);
    // comparar dois pontos pós-contemplação separados por ~1 ano
    expect(r.timeline[25].parcelaCons).toBeGreaterThan(r.timeline[13].parcelaCons);
  });
});

describe("Consórcio CNPJ — regime fiscal", () => {
  it("Lucro Real abate imposto; Lucro Presumido não (economia fiscal = 0)", () => {
    const real = calcConsorcioCNPJ({ ...defaultCNPJInputs, regimeTributario: "real" });
    const presumido = calcConsorcioCNPJ({ ...defaultCNPJInputs, regimeTributario: "presumido" });
    expect(real.totalEconomiaFiscalConsorcio).toBeGreaterThan(0);
    expect(presumido.totalEconomiaFiscalConsorcio).toBe(0);
    expect(real.beneficioFiscalAtivo).toBe(true);
    expect(presumido.beneficioFiscalAtivo).toBe(false);
  });

  it("os resultados líquidos diferem entre regimes", () => {
    const real = calcConsorcioCNPJ({ ...defaultCNPJInputs, regimeTributario: "real" });
    const presumido = calcConsorcioCNPJ({ ...defaultCNPJInputs, regimeTributario: "presumido" });
    expect(real.totalLiquidoConsorcio).toBeLessThan(presumido.totalLiquidoConsorcio);
  });
});
