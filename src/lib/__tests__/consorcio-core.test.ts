import { describe, it, expect } from "vitest";
import {
  aniversariosAte,
  corrigirContinuo,
  corrigirAniversario,
  saldoDevedorPlano,
  valorParcela,
  tirMensalSimples,
  tirMensalFluxos,
  simularConsorcio,
} from "../consorcio-core";

describe("primitivas de correção", () => {
  it("conta aniversários por ano de grupo", () => {
    expect(aniversariosAte(1)).toBe(0);
    expect(aniversariosAte(12)).toBe(0);
    expect(aniversariosAte(13)).toBe(1);
    expect(aniversariosAte(24)).toBe(1);
    expect(aniversariosAte(25)).toBe(2);
  });

  it("corrigirContinuo aplica (1+incc)^(meses/12)", () => {
    expect(corrigirContinuo(100_000, 4, 12)).toBeCloseTo(104_000, 0);
    expect(corrigirContinuo(100_000, 4, 24)).toBeCloseTo(108_160, 0);
  });

  it("corrigirAniversario aplica degraus anuais", () => {
    expect(corrigirAniversario(100_000, 4, 6)).toBeCloseTo(100_000, 0); // ano 1
    expect(corrigirAniversario(100_000, 4, 13)).toBeCloseTo(104_000, 0); // ano 2
  });
});

describe("fórmulas canônicas do usuário", () => {
  it("saldo devedor = crédito atualizado × (1 + taxa total)", () => {
    expect(saldoDevedorPlano(100_000, 18, 0)).toBeCloseTo(118_000, 0);
    expect(saldoDevedorPlano(100_000, 23.5, 1.5)).toBeCloseTo(125_000, 0);
  });

  it("parcela = saldo devedor / prazo", () => {
    // 100k carta, 18% adm, 100 meses → plano 118k / 100 = 1180
    expect(valorParcela(100_000, 18, 100)).toBeCloseTo(1_180, 2);
  });

  it("meia parcela = parcela / 2", () => {
    expect(valorParcela(100_000, 18, 100, { meiaParcela: true })).toBeCloseTo(590, 2);
  });
});

describe("TIR", () => {
  it("TIR simples de entrada→saída única", () => {
    // dobrar o capital em 12 meses ≈ 5.95% a.m.
    expect(tirMensalSimples(100, 200, 12)).toBeCloseTo(5.946, 2);
  });

  it("TIR por fluxos converge para a taxa que zera o VPL", () => {
    // -100 hoje, +110 em 1 mês → 10% a.m.
    expect(tirMensalFluxos([-100, 110])).toBeCloseTo(10, 1);
  });
});

describe("simularConsorcio — trava das causas-raiz", () => {
  const base = {
    credito: 500_000,
    taxaAdm: 18,
    prazo: 120,
    inccAnual: 4,
    mesContemplacao: 12,
  };

  it("CAUSA A: a parcela cresce com o INCC ano a ano", () => {
    const r = simularConsorcio(base);
    const parcelaAno1 = r.timeline[0].parcela; // mês 1
    const parcelaAno2 = r.timeline[12].parcela; // mês 13 (após 1 aniversário)
    expect(parcelaAno2).toBeGreaterThan(parcelaAno1);
    // 1 aniversário de 4% → +4%
    expect(parcelaAno2 / parcelaAno1).toBeCloseTo(1.04, 3);
  });

  it("CAUSA A: parcela inicial segue a fórmula canônica", () => {
    const r = simularConsorcio(base);
    // 500k × 1.18 / 120 = 4916.67
    expect(r.parcelaCheiaInicial).toBeCloseTo(4_916.67, 1);
  });

  it("CAUSA B: campo-resumo == valor da timeline (fonte única)", () => {
    const r = simularConsorcio(base);
    const mesPos = r.timeline.find((t) => t.mes === base.mesContemplacao + 1)!;
    expect(r.parcelaPosLance).toBeCloseTo(mesPos.parcela, 6);
  });

  it("o crédito atualizado muda conforme o mês de contemplação", () => {
    const cedo = simularConsorcio({ ...base, mesContemplacao: 6 });
    const tarde = simularConsorcio({ ...base, mesContemplacao: 48 });
    expect(tarde.creditoAtualizadoContemplacao).toBeGreaterThan(
      cedo.creditoAtualizadoContemplacao,
    );
  });

  it("lance embutido reduz o crédito líquido (poder de compra)", () => {
    const semLance = simularConsorcio(base);
    const comLance = simularConsorcio({ ...base, lanceEmbutidoPerc: 25 });
    expect(comLance.creditoLiquido).toBeLessThan(semLance.creditoLiquido);
    expect(comLance.creditoLiquido).toBeCloseTo(
      comLance.creditoAtualizadoContemplacao * 0.75,
      0,
    );
  });

  it("lance próprio amortiza o saldo devedor", () => {
    const semLance = simularConsorcio(base);
    const comLance = simularConsorcio({ ...base, lanceProprioR: 100_000 });
    expect(comLance.saldoDevedorPosLance).toBeCloseTo(
      semLance.saldoDevedorContemplacao - 100_000,
      0,
    );
  });

  it("amortização 'parcela' mantém prazo e reduz a parcela", () => {
    const semLance = simularConsorcio(base);
    const r = simularConsorcio({ ...base, lanceProprioR: 100_000, amortizacao: "parcela" });
    expect(r.prazoPosLance).toBe(base.prazo - base.mesContemplacao);
    expect(r.parcelaPosLance).toBeLessThan(semLance.parcelaContemplacao);
  });

  it("amortização 'prazo' mantém a parcela cheia e reduz o prazo", () => {
    const r = simularConsorcio({ ...base, lanceProprioR: 100_000, amortizacao: "prazo" });
    expect(r.prazoPosLance).toBeLessThan(base.prazo - base.mesContemplacao);
    // No modo "prazo" a parcela NÃO é reduzida: pós-lance == parcela cheia do mês
    const mesPos = r.timeline.find((t) => t.mes === base.mesContemplacao + 1)!;
    expect(r.parcelaPosLance).toBeCloseTo(mesPos.parcelaCheia, 0);
  });

  it("desembolso total = soma das parcelas reajustadas + lance próprio", () => {
    const r = simularConsorcio({ ...base, lanceProprioR: 50_000 });
    const somaTimeline = r.timeline.reduce((acc, t) => acc + t.desembolsoMes, 0);
    expect(r.desembolsoTotal).toBeCloseTo(somaTimeline, 2);
    expect(r.desembolsoTotal).toBeCloseTo(r.totalParcelas + 50_000, 2);
  });

  it("casos de borda não quebram", () => {
    expect(() => simularConsorcio({ ...base, prazo: 1, mesContemplacao: 1 })).not.toThrow();
    expect(() => simularConsorcio({ ...base, mesContemplacao: 999 })).not.toThrow();
    expect(() => simularConsorcio({ ...base, lanceProprioR: 9_999_999 })).not.toThrow();
    const r = simularConsorcio({ ...base, lanceProprioR: 9_999_999 });
    expect(r.saldoDevedorPosLance).toBe(0);
  });
});
