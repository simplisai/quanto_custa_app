// ─── Núcleo de Matemática Financeira do Consórcio ────────────────────────────
// FONTE ÚNICA DE VERDADE para todos os simuladores.
//
// Regras canônicas (validadas pelo especialista do domínio):
//
//   crédito atualizado (INCC) + taxa adm + fundo reserva = saldo devedor
//   saldo devedor / prazo = parcela
//   meia parcela = parcela / 2
//   parcela = crédito atualizado × (1 + taxa adm) / prazo
//
// Princípios que evitam os bugs recorrentes:
//   1. A parcela e o saldo devedor são SEMPRE derivados do crédito ATUALIZADO
//      pelo INCC — nunca do crédito nominal congelado.
//   2. O reajuste do INCC ocorre no aniversário do grupo (a cada 12 meses).
//   3. Os campos-resumo dos simuladores DEVEM ser lidos da timeline gerada aqui,
//      garantindo uma única fonte de verdade (quadros == gráficos).
//   4. Lance embutido reduz o CRÉDITO LÍQUIDO (poder de compra); lance próprio
//      amortiza o SALDO DEVEDOR (reduz prazo = mantém parcela; reduz parcela =
//      mantém prazo).

/** Quantos aniversários (reajustes anuais) já ocorreram ao chegar no mês `mes`.
 *  Meses 1–12 → 0 reajustes; 13–24 → 1; e assim por diante. */
export function aniversariosAte(mes: number): number {
  return Math.floor((Math.max(mes, 1) - 1) / 12);
}

/** Correção contínua de um valor por uma taxa anual ao longo de `meses`.
 *  Ex.: crédito no momento da contemplação. */
export function corrigirContinuo(valor: number, taxaAnualPerc: number, meses: number): number {
  return valor * Math.pow(1 + (taxaAnualPerc || 0) / 100, meses / 12);
}

/** Correção por aniversário (degraus anuais) — usada nas parcelas mês a mês. */
export function corrigirAniversario(valor: number, taxaAnualPerc: number, mes: number): number {
  return valor * Math.pow(1 + (taxaAnualPerc || 0) / 100, aniversariosAte(mes));
}

/** Conversão de taxa anual (%) para fator mensal equivalente. */
export function mensalFromAnual(taxaAnualPerc: number): number {
  return Math.pow(1 + (taxaAnualPerc || 0) / 100, 1 / 12) - 1;
}

/** Saldo devedor = crédito atualizado × (1 + (taxaAdm + fundoReserva)/100). */
export function saldoDevedorPlano(
  creditoAtualizado: number,
  taxaAdmPerc: number,
  fundoReservaPerc = 0,
): number {
  return creditoAtualizado * (1 + (taxaAdmPerc + fundoReservaPerc) / 100);
}

/** Parcela = crédito atualizado × (1 + taxa total) / prazo (meia parcela opcional). */
export function valorParcela(
  creditoAtualizado: number,
  taxaTotalPerc: number,
  prazo: number,
  opts: { meiaParcela?: boolean } = {},
): number {
  const prazoSafe = Math.max(prazo, 1);
  const cheia = saldoDevedorPlano(creditoAtualizado, taxaTotalPerc) / prazoSafe;
  return opts.meiaParcela ? cheia / 2 : cheia;
}

/** TIR mensal de uma operação de entrada única → saída única. */
export function tirMensalSimples(
  desembolso: number,
  retorno: number,
  meses: number,
): number {
  if (desembolso <= 0 || retorno <= 0 || meses <= 0) return 0;
  return (Math.pow(retorno / desembolso, 1 / meses) - 1) * 100;
}

/** TIR mensal a partir de um vetor de fluxos de caixa (fluxos[0] = mês 0).
 *  Método de bisseção — robusto e sem dependências externas. */
export function tirMensalFluxos(fluxos: number[]): number {
  const vpl = (taxa: number) =>
    fluxos.reduce((acc, f, t) => acc + f / Math.pow(1 + taxa, t), 0);
  // Precisa haver ao menos um fluxo negativo e um positivo
  const temNeg = fluxos.some((f) => f < 0);
  const temPos = fluxos.some((f) => f > 0);
  if (!temNeg || !temPos) return 0;
  let lo = -0.9999;
  let hi = 1; // 100% a.m. — limite superior generoso
  let fLo = vpl(lo);
  let fHi = vpl(hi);
  if (fLo * fHi > 0) return 0; // sem raiz no intervalo
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = vpl(mid);
    if (Math.abs(fMid) < 1e-7) return mid * 100;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return ((lo + hi) / 2) * 100;
}

export function anualFromMensal(taxaMensalPerc: number): number {
  return (Math.pow(1 + taxaMensalPerc / 100, 12) - 1) * 100;
}

// ─── Simulação completa de uma cota de consórcio ─────────────────────────────

export interface ConsorcioParams {
  credito: number;              // Crédito nominal da carta (R$)
  taxaAdm: number;              // Taxa de administração (%)
  fundoReserva?: number;        // Fundo de reserva (%) — default 0
  prazo: number;                // Prazo do grupo (meses)
  inccAnual: number;            // Atualização anual da carta pelo INCC (% a.a.)
  mesContemplacao: number;      // Mês estimado de contemplação
  lanceEmbutidoPerc?: number;   // Lance embutido (% da carta)
  lanceProprioR?: number;       // Lance próprio (R$) — sempre amortiza o saldo devedor
  // Como o lance embutido atua:
  //   "credito"      → reduz o crédito líquido (poder de compra); NÃO amortiza saldo (default)
  //   "saldoDevedor" → cliente recebe a carta cheia; o embutido amortiza o saldo devedor
  abatimentoEmbutido?: "credito" | "saldoDevedor";
  amortizacao?: "prazo" | "parcela"; // Como o lance amortiza o saldo (default "parcela")
  meiaParcela?: boolean;        // Paga meia parcela até a contemplação
  horizonteMeses?: number;      // Quantos meses gerar na timeline (default = prazo)
}

export interface ConsorcioMes {
  mes: number;
  creditoCorrigido: number;  // Crédito corrigido pelo INCC neste mês
  parcela: number;           // Parcela efetivamente paga no mês (já reajustada; meia se aplicável)
  parcelaCheia: number;      // Parcela integral do mês (sem meia parcela)
  saldoDevedor: number;      // Saldo devedor ao final do mês
  desembolsoMes: number;     // Desembolso real do mês (parcela + lance próprio no mês da contemplação)
  contemplado: boolean;      // Já foi contemplado neste mês?
}

export interface ConsorcioResumo {
  taxaTotal: number;                    // taxaAdm + fundoReserva
  creditoAtualizadoContemplacao: number; // Crédito corrigido pelo INCC na contemplação
  creditoLiquido: number;               // Crédito disponível após lance embutido (poder de compra)
  lanceEmbutidoR: number;               // Lance embutido em R$ (sobre crédito atualizado)
  lanceProprioR: number;                // Lance próprio em R$
  parcelaInicial: number;               // Parcela paga no mês 1
  parcelaCheiaInicial: number;          // Parcela integral no mês 1 (sem meia)
  parcelaContemplacao: number;          // Parcela integral no mês da contemplação
  parcelaPosLance: number;              // Parcela após aplicar o lance próprio
  saldoDevedorContemplacao: number;     // Saldo devedor no mês da contemplação (antes do lance)
  saldoDevedorPosLance: number;         // Saldo devedor após o lance próprio
  prazoPosLance: number;                // Prazo restante após o lance
  desembolsoTotal: number;              // Soma real de todos os desembolsos (parcelas + lance próprio)
  totalParcelas: number;                // Soma apenas das parcelas pagas
  timeline: ConsorcioMes[];
}

/**
 * Simula uma cota de consórcio mês a mês com reajuste de INCC no aniversário,
 * lance embutido (reduz crédito líquido) e lance próprio (amortiza saldo).
 * É a base de todos os simuladores — garante parcela e saldo devedor sempre
 * derivados do crédito ATUALIZADO.
 */
export function simularConsorcio(p: ConsorcioParams): ConsorcioResumo {
  const credito = Math.max(p.credito, 0);
  const taxaTotal = (p.taxaAdm || 0) + (p.fundoReserva || 0);
  const prazo = Math.max(Math.round(p.prazo), 1);
  const incc = p.inccAnual || 0;
  const mc = Math.min(Math.max(Math.round(p.mesContemplacao), 1), prazo);
  const amortizacao = p.amortizacao ?? "parcela";
  const horizonte = Math.max(p.horizonteMeses ?? prazo, prazo);

  // Crédito atualizado no momento da contemplação (correção contínua)
  const creditoAtualizadoContemplacao = corrigirContinuo(credito, incc, mc);

  // Lance embutido (sobre o crédito atualizado)
  const abatimentoEmbutido = p.abatimentoEmbutido ?? "credito";
  const lanceEmbutidoR = creditoAtualizadoContemplacao * ((p.lanceEmbutidoPerc || 0) / 100);
  // "credito" → reduz poder de compra; "saldoDevedor" → recebe carta cheia
  const creditoLiquido =
    abatimentoEmbutido === "credito"
      ? Math.max(creditoAtualizadoContemplacao - lanceEmbutidoR, 0)
      : creditoAtualizadoContemplacao;

  const lanceProprioR = Math.max(p.lanceProprioR || 0, 0);

  // Crédito corrigido por aniversário no mês da contemplação (degraus anuais)
  const creditoAnivMc = corrigirAniversario(credito, incc, mc);
  const valorPlanoMc = saldoDevedorPlano(creditoAnivMc, taxaTotal, 0);
  const parcelaContemplacao = valorPlanoMc / prazo;

  // Saldo devedor na contemplação = fração restante do plano corrigido
  const saldoDevedorContemplacao = valorPlanoMc * ((prazo - mc) / prazo);

  // Lance próprio sempre amortiza o saldo; embutido amortiza só no modo "saldoDevedor"
  const lanceTotalAmortiza =
    lanceProprioR + (abatimentoEmbutido === "saldoDevedor" ? lanceEmbutidoR : 0);
  const saldoDevedorPosLance = Math.max(saldoDevedorContemplacao - lanceTotalAmortiza, 0);

  let prazoPosLance: number;
  let parcelaPosLanceBaseMc: number; // parcela pós-lance avaliada no mês da contemplação
  const parcelasRestantes = prazo - mc;
  if (amortizacao === "prazo") {
    // Mantém a parcela cheia, reduz o prazo
    prazoPosLance = parcelaContemplacao > 0 ? Math.ceil(saldoDevedorPosLance / parcelaContemplacao) : 0;
    parcelaPosLanceBaseMc = parcelaContemplacao;
  } else {
    // Mantém o prazo restante, reduz a parcela
    prazoPosLance = parcelasRestantes;
    parcelaPosLanceBaseMc = parcelasRestantes > 0 ? saldoDevedorPosLance / parcelasRestantes : 0;
  }

  // Fator INCC por aniversário no mês da contemplação (para reajustar a parcela pós-lance)
  const fatorAnivMc = Math.pow(1 + incc / 100, aniversariosAte(mc));

  // ── Timeline mês a mês ─────────────────────────────────────────────────────
  const timeline: ConsorcioMes[] = [];
  let totalParcelas = 0;
  let desembolsoTotal = 0;
  // mês final de pagamento do consórcio (após contemplação)
  const mesFimPagamento = amortizacao === "prazo" ? mc + prazoPosLance : prazo;

  for (let m = 1; m <= horizonte; m++) {
    const fatorAniv = Math.pow(1 + incc / 100, aniversariosAte(m));
    const creditoCorrigido = credito * fatorAniv;
    const valorPlanoM = saldoDevedorPlano(creditoCorrigido, taxaTotal, 0);
    const parcelaCheia = valorPlanoM / prazo;

    let parcela = 0;
    let saldoDevedor = 0;
    const contemplado = m >= mc;

    if (m <= mc) {
      // Pré-contemplação (inclui o mês da contemplação): parcela cheia (ou meia)
      parcela = p.meiaParcela ? parcelaCheia / 2 : parcelaCheia;
      saldoDevedor = valorPlanoM * ((prazo - m) / prazo);
    } else if (m <= mesFimPagamento) {
      // Pós-contemplação: parcela pós-lance, reajustada pelo INCC relativo à contemplação
      parcela = parcelaPosLanceBaseMc * (fatorAniv / fatorAnivMc);
      const mesesPagosPos = m - mc;
      const mesesTotaisPos = mesFimPagamento - mc;
      const fracaoRestante = mesesTotaisPos > 0 ? (mesesTotaisPos - mesesPagosPos) / mesesTotaisPos : 0;
      saldoDevedor = saldoDevedorPosLance * (fatorAniv / fatorAnivMc) * fracaoRestante;
    } else {
      // Consórcio encerrado
      parcela = 0;
      saldoDevedor = 0;
    }

    let desembolsoMes = parcela;
    if (m === mc) desembolsoMes += lanceProprioR;

    if (m <= mesFimPagamento) {
      totalParcelas += parcela;
    }
    desembolsoTotal += desembolsoMes;

    timeline.push({
      mes: m,
      creditoCorrigido,
      parcela,
      parcelaCheia,
      saldoDevedor: Math.max(saldoDevedor, 0),
      desembolsoMes,
      contemplado,
    });
  }

  const parcelaInicial = timeline[0]?.parcela ?? 0;
  const parcelaCheiaInicial = timeline[0]?.parcelaCheia ?? 0;
  // Parcela pós-lance "de referência" = primeira parcela após a contemplação
  const parcelaPosLance =
    timeline.find((t) => t.mes === mc + 1)?.parcela ?? parcelaPosLanceBaseMc;

  return {
    taxaTotal,
    creditoAtualizadoContemplacao,
    creditoLiquido,
    lanceEmbutidoR,
    lanceProprioR,
    parcelaInicial,
    parcelaCheiaInicial,
    parcelaContemplacao,
    parcelaPosLance,
    saldoDevedorContemplacao,
    saldoDevedorPosLance,
    prazoPosLance,
    desembolsoTotal,
    totalParcelas,
    timeline,
  };
}
