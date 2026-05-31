import { describe, it, expect } from "vitest";
import {
  parcelaNominalFn,
  parcelaPrice,
  cartaCorrigidaFn,
  valorFuturo,
  somaPGAnual,
  tirMensalSimples,
  simularConsorcio,
} from "../consorcio-core";

describe("primitivos matemáticos", () => {
  it("parcelaNominal = C*(1+TA)/N", () => {
    expect(parcelaNominalFn(100_000, 0.18, 100)).toBeCloseTo(1_180, 2);
    expect(parcelaNominalFn(500_000, 0.18, 120)).toBeCloseTo(4_916.67, 1);
  });

  it("parcelaPrice = C*j/(1-(1+j)^-N)", () => {
    expect(parcelaPrice(100_000, 0.01, 120)).toBeCloseTo(1_434.71, 0);
    expect(parcelaPrice(120_000, 0, 120)).toBeCloseTo(1_000, 5);
  });

  it("cartaCorrigida — INCC discreto: expoente ⌊mc/12⌋", () => {
    // mc=11: 1.04^0 = 100.000 (nenhum aniversário ainda)
    expect(cartaCorrigidaFn(100_000, 0.04, 11)).toBeCloseTo(100_000, 1);
    // mc=12: 1.04^1 = 104.000
    expect(cartaCorrigidaFn(100_000, 0.04, 12)).toBeCloseTo(104_000, 0);
    // mc=24: 1.04^2 = 108.160
    expect(cartaCorrigidaFn(100_000, 0.04, 24)).toBeCloseTo(100_000 * 1.04 ** 2, 0);
    // mc=6: 1.04^0 = 100.000
    expect(cartaCorrigidaFn(100_000, 0.04, 6)).toBeCloseTo(100_000, 1);
  });

  it("valorFuturo = V*(1+v)^T", () => {
    expect(valorFuturo(500_000, 0.06, 20)).toBeCloseTo(500_000 * Math.pow(1.06, 20), 0);
  });

  it("somaPGAnual: i=0 → base*T", () => {
    expect(somaPGAnual(12_000, 0, 10)).toBeCloseTo(120_000, 2);
  });

  it("tirMensalSimples: dobrar em 12m ≈ 5.95%", () => {
    expect(tirMensalSimples(100, 200, 12)).toBeCloseTo(5.946, 2);
  });
});

describe("simularConsorcio — motor mensal canônico", () => {
  const base = {
    carta: 500_000,
    taxaAdm: 18,
    prazo: 120,
    inccAnual: 4,
    mesContemplacao: 12,
  };

  it("parcelaNominal inicial = C*(1+TA)/N", () => {
    const r = simularConsorcio(base);
    expect(r.parcelaNominal).toBeCloseTo(500_000 * 1.18 / 120, 1);
  });

  it("a parcela cresce com o INCC no aniversário (mês 12)", () => {
    const r = simularConsorcio({ ...base, mesContemplacao: 60 });
    const p11 = r.timeline[10].parcelaNominal; // mês 11 (antes do aniversário)
    const p12 = r.timeline[11].parcelaNominal; // mês 12 (aniversário aplicado)
    expect(p12).toBeGreaterThan(p11);
    expect(p12 / p11).toBeCloseTo(1.04, 3);
  });

  it("custoGlobal = snapshot (parcelas até contemplação + próprio + saldo pós-lance)", () => {
    const r = simularConsorcio({ ...base, lanceProprioR: 50_000 });
    // custoGlobal é o snapshot do Validador HTML
    expect(r.custoGlobal).toBeCloseTo(
      r.parcelasAteContemplacao + r.lanceProprioR + r.saldoDevedor, 2,
    );
    // e é MENOR que a soma de todos os desembolsos do plano inteiro
    expect(r.custoGlobal).toBeLessThan(r.totalPagamentos);
  });

  it("lance embutido reduz poder de compra E abate o saldo devedor", () => {
    const semEmb = simularConsorcio({ ...base, lanceEmbutidoPerc: 0 });
    const comEmb = simularConsorcio({ ...base, lanceEmbutidoPerc: 25 });
    expect(comEmb.poderDeCompra).toBeLessThan(semEmb.poderDeCompra);
    expect(comEmb.saldoDevedor).toBeLessThan(semEmb.saldoDevedor);
    // embutido NÃO sai do bolso → não entra como lance próprio
    expect(comEmb.lanceProprioR).toBe(0);
  });

  it("meia parcela = parcelaNominal / 2 antes da contemplação", () => {
    const r = simularConsorcio({ ...base, meiaParcela: true, mesContemplacao: 24 });
    const preMes = r.timeline.find(t => t.mes === 6)!; // bem antes da contemplação
    expect(preMes.parcela).toBeCloseTo(preMes.parcelaNominal / 2, 4);
  });

  it("cases de borda não quebram", () => {
    expect(() => simularConsorcio({ ...base, prazo: 1, mesContemplacao: 1 })).not.toThrow();
    expect(() => simularConsorcio({ ...base, mesContemplacao: 999 })).not.toThrow();
    const r = simularConsorcio({ ...base, lanceProprioR: 99_999_999 });
    expect(r.saldoDevedor).toBe(0);
  });
});
