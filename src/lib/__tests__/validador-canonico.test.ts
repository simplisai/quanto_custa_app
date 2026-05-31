import { describe, it, expect } from "vitest";
import { simularConsorcio, cartaCorrigidaFn } from "../consorcio-core";

// ─── Validação dos KPIs do Simulador de Lance ────────────────────────────────
// Inputs canônicos: Carta=1.000.000, TA=18%, N=240, INCC=4%, lance no mês 12,
// embutido=20%, próprio=0.
//
// Diretriz canônica (alinhada com o Validador HTML):
//   - INCC: Fator_incc = (1+INCC)^⌊mc/12⌋ — saltos discretos nos aniversários
//   - Lance embutido abate saldo devedor e reduz poder de compra
//   - Só o lance próprio sai do bolso (cash)
//   - Custo Global = SNAPSHOT = parcelasAteContemplacao + lanceProprio + saldoDevedor
//     (≠ totalPagamentos, que é a soma de todos os desembolsos do plano)
//
// Nota: para mc=12 o resultado é idêntico ao Validador HTML (1.04^1 = 1.04)

describe("Validador Matemático — Estratégia de Lance (gabarito oficial)", () => {
  const sim = simularConsorcio({
    carta: 1_000_000,
    taxaAdm: 18,
    prazo: 240,
    inccAnual: 4,
    mesContemplacao: 12,
    lanceEmbutidoPerc: 20,
    lanceProprioR: 0,
    amortizacao: "parcela",
  });

  it("parcela nominal (mês 1) = R$ 4.916,67", () => {
    expect(sim.parcelaNominal).toBeCloseTo(4_916.67, 2);
  });

  it("carta corrigida na contemplação (mês 12) = R$ 1.040.000 (1 aniversário)", () => {
    expect(sim.cartaCorrigida).toBeCloseTo(1_040_000, 2);
  });

  it("lance embutido = R$ 208.000 (20% da carta corrigida)", () => {
    expect(sim.lanceEmbutidoR).toBeCloseTo(208_000, 2);
  });

  it("poder de compra líquido = R$ 832.000 (carta corrigida − embutido)", () => {
    expect(sim.poderDeCompra).toBeCloseTo(832_000, 2);
  });

  it("saldo devedor pós-lance = R$ 957.840,00", () => {
    expect(sim.saldoDevedor).toBeCloseTo(957_840, 0);
  });

  it("parcela reduzida pós-lance ≈ R$ 4.201,05", () => {
    expect(sim.parcelaReduzida).toBeCloseTo(4_201.05, 1);
  });

  it("parcelas pagas até a contemplação ≈ R$ 59.196,67", () => {
    expect(sim.parcelasAteContemplacao).toBeCloseTo(59_196.67, 1);
  });

  it("CUSTO GLOBAL = snapshot na contemplação (gabarito do Validador HTML)", () => {
    // Total Desembolsado (Custo Real) = parcelas até contemplação + lance + saldo pós-lance
    expect(sim.custoGlobal).toBeCloseTo(
      sim.parcelasAteContemplacao + sim.lanceProprioR + sim.saldoDevedor, 2,
    );
    // valor concreto do gabarito: ≈ 59.196,67 + 0 + 957.840 ≈ 1.017.037
    expect(sim.custoGlobal).toBeCloseTo(1_017_036.67, 0);
    // o snapshot é MENOR que a soma de todos os desembolsos do plano inteiro
    expect(sim.custoGlobal).toBeLessThan(sim.totalPagamentos);
  });
});

describe("Cenário SEM lance (referência do validador)", () => {
  // Mesmos parâmetros, mês de referência sem lance = 72, sem embutido/próprio.
  const sim = simularConsorcio({
    carta: 1_000_000,
    taxaAdm: 18,
    prazo: 240,
    inccAnual: 4,
    mesContemplacao: 72,
    lanceEmbutidoPerc: 0,
    lanceProprioR: 0,
  });

  it("sem lance, poder de compra = carta corrigida (sem abatimento)", () => {
    expect(sim.poderDeCompra).toBeCloseTo(sim.cartaCorrigida, 2);
  });

  it("carta corrigida no mês 72 = carta × 1.04^(72/12) = carta × 1.04^6", () => {
    // 72/12 = 6 exato → fracional e inteiro coincidem
    expect(sim.cartaCorrigida).toBeCloseTo(1_000_000 * Math.pow(1.04, 72 / 12), 0);
  });
});

describe("cartaCorrigidaFn — INCC discreto: Fator_incc = (1+INCC)^⌊mc/12⌋", () => {
  it("mc=11 → 1.04^0 = 1.000.000 (nenhum aniversário ainda)", () => {
    expect(cartaCorrigidaFn(1_000_000, 0.04, 11)).toBeCloseTo(1_000_000, 2);
  });
  it("mc=12 → 1.04^1 = 1.040.000 (1 aniversário)", () => {
    expect(cartaCorrigidaFn(1_000_000, 0.04, 12)).toBeCloseTo(1_040_000, 2);
  });
  it("mc=24 → 1.04^2 = 1.081.600 (2 aniversários)", () => {
    expect(cartaCorrigidaFn(1_000_000, 0.04, 24)).toBeCloseTo(1_000_000 * 1.04 ** 2, 2);
  });
  it("mc=25 → 1.04^2 (ainda 2 aniversários)", () => {
    expect(cartaCorrigidaFn(1_000_000, 0.04, 25)).toBeCloseTo(1_000_000 * 1.04 ** 2, 2);
  });
  it("mc=6 → 1.04^0 = 1.000.000", () => {
    expect(cartaCorrigidaFn(1_000_000, 0.04, 6)).toBeCloseTo(1_000_000, 2);
  });
});
