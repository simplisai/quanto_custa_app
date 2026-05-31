// ─── Núcleo de Matemática Financeira — Motor Mensal Unificado ─────────────────
//
// FONTE ÚNICA DE VERDADE. Todos os simuladores derivam KPIs e timelines daqui.
//
// NOMENCLATURA CANÔNICA (alinhada com Validador Matemático e Quanto Custa v7.4):
//
//   carta            = valor nominal da carta de crédito
//   cartaCorrigida   = carta × (1+INCC)^anosCompletos  (aniversários do grupo)
//   poderDeCompra    = cartaCorrigida − lanceEmbutidoR  (o que o cliente realmente compra)
//   parcelaNominal   = (carta × (1+TA)) / N             (parcela no mês 1)
//   parcelaReduzida  = saldo pós-lance / meses restantes (parcela após o lance)
//   saldoDevedor     = saldo do plano após aplicar o lance
//   parcelasAteContemplacao = Σ parcelas pagas do mês 1 até mc (inclusive)
//
// DOIS CONCEITOS DE "TOTAL" (a principal fonte de confusão anterior):
//
//   custoGlobal   = parcelasAteContemplacao + lanceProprioR + saldoDevedor
//                   ↑ snapshot na contemplação — mesma lógica dos 2 HTMLs de referência:
//                     Lance Validator: totalDesembolsado = parcelas + lance + saldo
//                     Quanto Custa v7.4: tCons = parcelas + lance + saldo
//                   Usado em: comparativos (SAC vs PRICE vs Consórcio, com/sem lance)
//
//   totalPagamentos = Σ(desembolsoMes) ao longo de TODOS os meses do plano
//                   Usado em: ROI de longo prazo, renda passiva, meta patrimonial
//
// INCC: capitalização composta anual aplicada de forma DISCRETA (saltos).
//   → Convenção canônica (Validador HTML): reajuste nos aniversários do grupo,
//     gatilho m % 12 === 0 (meses 12, 24, 36…), aplicado no início do mês.
//   → cartaCorrigida = carta × (1+INCC)^⌊mc/12⌋
//   KPI e timeline usam EXATAMENTE a mesma base discreta (coerência total).
//
// Lance embutido: reduz o poderDeCompra (não sai do bolso — é abatido da carta recebida).
// Lance próprio:  sai do bolso no mês da contemplação; amortiza o saldoDevedor.

// ── Primitivos matemáticos (exportados para helpers e testes) ──────────────────

/** Parcela Price: C × j / (1 − (1+j)^−N).  j = juros mensal em fração. */
export function parcelaPrice(credito: number, jurosMensalFrac: number, prazo: number): number {
  const N = Math.max(prazo, 1);
  if (jurosMensalFrac <= 0) return credito / N;
  return credito * (jurosMensalFrac / (1 - Math.pow(1 + jurosMensalFrac, -N)));
}

/**
 * Carta corrigida pelo INCC na data da contemplação.
 *
 * CONVENÇÃO DISCRETA (igual ao Validador Matemático HTML e ao loop mensal):
 *   O INCC é aplicado em SALTOS nos aniversários do grupo (meses 12, 24, 36…),
 *   gatilho m % 12 === 0. Logo, no mês mc já incidiram ⌊mc/12⌋ reajustes.
 *
 *   Fator_incc = (1 + I_incc)^⌊mc/12⌋
 *   C_atualizado = C_n × Fator_incc
 *
 *   mc=6  → carta × 1.04^0  = carta × 1.00000  (nenhum aniversário ainda)
 *   mc=11 → carta × 1.04^0  = carta × 1.00000
 *   mc=12 → carta × 1.04^1  = carta × 1.04000  (1 aniversário)
 *   mc=24 → carta × 1.04^2  = carta × 1.08160  (2 aniversários)
 *   mc=25 → carta × 1.04^2  = carta × 1.08160
 */
export function cartaCorrigidaFn(carta: number, inccAnualFrac: number, mc: number): number {
  return carta * Math.pow(1 + inccAnualFrac, Math.floor(Math.max(mc, 0) / 12));
}

/** Alias de retrocompatibilidade para `cartaCorrigidaFn`. */
export const creditoAtualizado = cartaCorrigidaFn;

/** Valor futuro: V × (1+v)^anos.  v = taxa anual em fração. */
export function valorFuturo(valor: number, taxaAnualFrac: number, anos: number): number {
  return valor * Math.pow(1 + taxaAnualFrac, Math.max(anos, 0));
}

/**
 * Soma PG anual fechada.  base = valor anual inicial; i = taxa anual frac; T = anos.
 * Total = base × ((1+i)^T − 1) / i   (se i=0: base × T)
 */
export function somaPGAnual(baseAnual: number, taxaAnualFrac: number, anos: number): number {
  const T = Math.max(anos, 0);
  if (taxaAnualFrac === 0) return baseAnual * T;
  return baseAnual * ((Math.pow(1 + taxaAnualFrac, T) - 1) / taxaAnualFrac);
}

/** TIR mensal de entrada→saída única: (ret/des)^(1/m) − 1, em %. */
export function tirMensalSimples(desembolso: number, retorno: number, meses: number): number {
  if (desembolso <= 0 || retorno <= 0 || meses <= 0) return 0;
  return (Math.pow(retorno / desembolso, 1 / meses) - 1) * 100;
}

/** Taxa mensal (%) → anual equivalente (%). */
export function anualFromMensalPerc(taxaMensalPerc: number): number {
  return (Math.pow(1 + taxaMensalPerc / 100, 12) - 1) * 100;
}

/** Parcela nominal inicial: (C×(1+TA))/N. */
export function parcelaNominalFn(carta: number, taxaAdmFrac: number, prazo: number): number {
  return (carta * (1 + taxaAdmFrac)) / Math.max(prazo, 1);
}

/** Alias de compatibilidade. */
export const parcelaPadrao = parcelaNominalFn;

// ── Interface da linha do tempo mensal ───────────────────────────────────────

export interface SimMes {
  mes: number;
  cartaCorrigida: number;  // carta × (1+INCC)^k  (k = aniversários acumulados)
  parcelaNominal: number;  // parcela cheia do mês (cresce com INCC nos aniversários)
  parcela: number;         // parcela efetivamente paga (meia ou reduzida pós-lance)
  saldoPlano: number;      // saldo residual do plano ao final do mês
  desembolsoMes: number;   // saída de caixa: parcela + lanceProprioR (no mc)
  contemplado: boolean;
}

// ── Interface do resumo derivado ──────────────────────────────────────────────

export interface SimResult {
  /** Timeline mês a mês — FONTE ÚNICA. Cards e gráficos leem daqui. */
  timeline: SimMes[];

  // ── Campos renomeados conforme nomenclatura canônica ──────────────────────
  taxaTotal: number;                  // taxaAdm + fundoReserva (%)
  parcelaNominal: number;             // parcela no mês 1 (era: parcelaPadrao)
  parcelaReduzida: number;            // parcela pós-lance (era: parcelaPosLance)
  cartaCorrigida: number;             // carta × (1+INCC)^k na contemplação (era: creditoAtualizadoContemplacao)
  poderDeCompra: number;              // cartaCorrigida − lanceEmbutidoR (era: creditoLiquido)
  lanceEmbutidoR: number;
  lanceProprioR: number;
  saldoAntesLance: number;            // saldo do plano ANTES de aplicar o lance (era: saldoDevedorContemplacao)
  saldoDevedor: number;               // saldo do plano APÓS o lance (era: saldoDevedorPosLance)
  prazoPosLance: number;              // meses restantes após a contemplação

  // ── NOVOS campos canônicos ─────────────────────────────────────────────────
  /** Soma das parcelas pagas do mês 1 até o mês da contemplação (inclusive). */
  parcelasAteContemplacao: number;
  /**
   * CUSTO GLOBAL — SNAPSHOT na contemplação (gabarito do Validador HTML):
   *   custoGlobal = parcelasAteContemplacao + lanceProprioR + saldoDevedor
   * É o "Total Desembolsado (Custo Real)" do Validador e o `tCons` do Quanto Custa.
   * Use em COMPARATIVOS de antecipação (Simulador de Lance: com vs. sem lance).
   * ATENÇÃO: é DIFERENTE de `totalPagamentos` (≠ soma do plano inteiro).
   */
  custoGlobal: number;
  /**
   * TOTAL DE PAGAMENTOS — soma de TODOS os desembolsos mensais ao longo do
   * plano inteiro (Σ desembolsoMes). Use em custo total de longo prazo
   * (Aluguel vs Consórcio, Meta Patrimonial, Saída de Financiamento, CNPJ, ROI).
   */
  totalPagamentos: number;
  /**
   * SALDO DE CAIXA (Diretriz D): P_liq − C_atualizado
   * Positivo = sobra de crédito além do custo da carta.
   * Negativo = déficit (lance embutido reduziu o poder de compra abaixo da carta).
   */
  saldoCaixa: number;

  // ── Aliases de retrocompatibilidade ───────────────────────────────────────
  /** @deprecated use cartaCorrigida */
  creditoAtualizadoContemplacao: number;
  /** @deprecated use poderDeCompra */
  creditoLiquido: number;
  /** @deprecated use saldoDevedor */
  saldoDevedorPosLance: number;
  /** @deprecated use parcelaNominal */
  parcelaPadrao: number;
  /** @deprecated use parcelaReduzida */
  parcelaPosLance: number;
  /** @deprecated use totalPagamentos */
  desembolsoTotal: number;
  /** Soma apenas das parcelas (sem lanceProprioR). */
  totalParcelas: number;
}

// ── Parâmetros da simulação ───────────────────────────────────────────────────

export interface SimParams {
  /** Valor nominal da carta de crédito (R$). */
  carta?: number;
  /** @deprecated use carta */
  credito?: number;
  taxaAdm: number;                      // % total (ex.: 18)
  fundoReserva?: number;                // % adicional (ex.: 1.5)
  prazo: number;                        // meses do plano
  inccAnual: number;                    // % a.a.
  mesContemplacao: number;
  /** Lance embutido (%): reduz o poderDeCompra. NÃO é desembolso de caixa. */
  lanceEmbutidoPerc?: number;
  /** Lance próprio (R$): desembolso real no mês da contemplação; amortiza o saldo. */
  lanceProprioR?: number;
  /** @deprecated ignorado */
  abatimentoEmbutido?: "credito" | "saldoDevedor";
  /** Como o lance amortiza o saldo: "parcela" (reduz parcela) | "prazo" (reduz prazo). */
  amortizacao?: "parcela" | "prazo";
  /** Se true, paga 50% da parcela nos meses anteriores à contemplação. */
  meiaParcela?: boolean;
  /**
   * Limita a quantidade de meses gerados na timeline.
   * Se omitido: gera até o prazo completo.
   * Usado internamente (ex.: flip que só vai até a contemplação).
   */
  horizonteMeses?: number;
}

// ── Motor central ─────────────────────────────────────────────────────────────

export function simularConsorcio(p: SimParams): SimResult {
  const C = Math.max(p.carta ?? p.credito ?? 0, 0);
  const TA = (p.taxaAdm || 0) / 100;
  const FR = (p.fundoReserva || 0) / 100;
  const taxaTotal = TA + FR;
  const N = Math.max(Math.round(p.prazo), 1);
  const incc = (p.inccAnual || 0) / 100;
  const mc = Math.min(Math.max(Math.round(p.mesContemplacao), 1), N);
  const amort = p.amortizacao ?? "parcela";
  const H = p.horizonteMeses != null ? Math.max(p.horizonteMeses, 1) : N;

  // ── Estado inicial ────────────────────────────────────────────────────────
  let cartaBase = C;                         // cresce a cada aniversário (meses 13, 25…)
  let saldoPlano = C * (1 + taxaTotal);      // saldo do plano; diminui com parcelas
  let parcelaCheia = saldoPlano / N;         // parcela cheia; recalculada nos aniversários e pós-lance

  const timeline: SimMes[] = [];
  const lanceProprio = Math.max(p.lanceProprioR || 0, 0);
  let lanceEmbutidoR = 0;
  let cartaCorrigida = C;                    // carta no momento da contemplação
  let poderDeCompra = C;
  let saldoAntesLance = 0;
  let saldoDevedorPosLance = 0;
  let prazoPosLance = N - mc;
  let parcelaReduzidaRef = 0;

  for (let m = 1; m <= H; m++) {
    // ── Reajuste anual: meses MÚLTIPLOS DE 12 (12, 24, 36…) ──────────────────
    // Convenção canônica do Validador Matemático: gatilho m % 12 === 0,
    // aplicado no INÍCIO do mês (antes de pagar a parcela daquele mês).
    if (m > 1 && m % 12 === 0 && m <= N) {
      cartaBase   *= (1 + incc);
      saldoPlano  *= (1 + incc);
      parcelaCheia *= (1 + incc);
    }

    const contemplado = m >= mc;
    let parcelaMes: number;
    let desembolsoMes: number;

    if (m < mc) {
      // Pré-contemplação
      parcelaMes    = p.meiaParcela ? parcelaCheia / 2 : parcelaCheia;
      desembolsoMes = parcelaMes;
      saldoPlano   -= parcelaMes;
      if (saldoPlano < 0) saldoPlano = 0;

    } else if (m === mc) {
      // Mês da contemplação
      parcelaMes = p.meiaParcela ? parcelaCheia / 2 : parcelaCheia;
      saldoPlano -= parcelaMes;
      if (saldoPlano < 0) saldoPlano = 0;

      // INCC discreto: a carta no ato é o cartaBase já reajustado pelos
      // aniversários (m % 12 === 0) ocorridos até mc — idêntico à timeline e
      // ao Validador HTML. Equivale a C × (1+incc)^⌊mc/12⌋.
      cartaCorrigida  = cartaBase;
      // Diretriz B: L_valor = C_atualizado × L_%
      lanceEmbutidoR  = cartaCorrigida * ((p.lanceEmbutidoPerc || 0) / 100);
      // Diretriz C: P_liq = C_atualizado − L_valor
      poderDeCompra   = Math.max(cartaCorrigida - lanceEmbutidoR, 0);

      // O LANCE TOTAL (embutido + próprio) amortiza o saldo devedor do plano.
      // Convenção canônica (Validador): saldo -= lanceEmbutido + lanceProprio.
      // Só o lance PRÓPRIO sai do bolso (cash); o embutido vem da própria carta.
      saldoAntesLance      = saldoPlano;
      saldoPlano           = Math.max(saldoPlano - lanceEmbutidoR - lanceProprio, 0);
      saldoDevedorPosLance = saldoPlano;

      const mesesRestantes = N - mc;
      prazoPosLance = mesesRestantes;
      if (mesesRestantes > 0) {
        if (amort === "parcela") {
          parcelaCheia = saldoPlano / mesesRestantes;
        } else {
          prazoPosLance = parcelaCheia > 0 ? Math.ceil(saldoPlano / parcelaCheia) : 0;
        }
      } else {
        parcelaCheia = 0;
      }
      parcelaReduzidaRef = parcelaCheia;
      desembolsoMes = parcelaMes + lanceProprio;

    } else {
      // Pós-contemplação
      const mesFim = amort === "prazo" ? mc + prazoPosLance : N;
      if (m <= mesFim && saldoPlano > 0.01) {
        parcelaMes = Math.min(parcelaCheia, saldoPlano);
        saldoPlano -= parcelaMes;
        if (saldoPlano < 0) saldoPlano = 0;
      } else {
        parcelaMes = 0;
      }
      desembolsoMes = parcelaMes;
    }

    timeline.push({
      mes: m,
      cartaCorrigida: cartaBase,
      parcelaNominal: parcelaCheia,
      parcela: parcelaMes,
      saldoPlano: Math.max(saldoPlano, 0),
      desembolsoMes,
      contemplado,
    });
  }

  // ── Resumo derivado 100% da timeline ─────────────────────────────────────
  const parcelaNominal = timeline[0]?.parcelaNominal ?? 0;
  const parcelaReduzida =
    timeline.find(t => t.mes === mc + 1)?.parcela ?? parcelaReduzidaRef;

  const parcelasAteContemplacao =
    timeline.filter(t => t.mes <= mc).reduce((acc, t) => acc + t.parcela, 0);

  const totalPagamentos = timeline.reduce((acc, t) => acc + t.desembolsoMes, 0);
  // CUSTO GLOBAL = snapshot na contemplação (gabarito do Validador HTML):
  //   parcelas pagas até a contemplação + lance próprio + saldo devedor pós-lance.
  const custoGlobal = parcelasAteContemplacao + lanceProprio + saldoDevedorPosLance;
  const totalParcelas   = timeline.reduce((acc, t) => acc + t.parcela, 0);
  // Diretriz D: Saldo_caixa = P_liq − C_atualizado
  const saldoCaixa = poderDeCompra - cartaCorrigida;

  return {
    timeline,
    taxaTotal,
    parcelaNominal,
    parcelaReduzida,
    cartaCorrigida,
    poderDeCompra,
    lanceEmbutidoR,
    lanceProprioR: lanceProprio,
    saldoAntesLance,
    saldoDevedor: saldoDevedorPosLance,
    prazoPosLance,
    parcelasAteContemplacao,
    custoGlobal,
    totalPagamentos,
    totalParcelas,
    saldoCaixa,
    // aliases de retrocompatibilidade
    creditoAtualizadoContemplacao: cartaCorrigida,
    creditoLiquido:                poderDeCompra,
    saldoDevedorPosLance,
    parcelaPadrao:                 parcelaNominal,
    parcelaPosLance:               parcelaReduzida,
    desembolsoTotal:               totalPagamentos,
  };
}
