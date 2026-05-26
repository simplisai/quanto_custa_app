import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Target, Users, Clock, MessageSquareQuote, Calculator, ShieldCheck, Lightbulb, AlertTriangle } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/simuladores/estrategia/$slug"
)({
  component: EstrategiaPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Argumento {
  numero: number;
  frase: string;
  contexto: string;
}
interface Formula {
  label: string;
  expressao: string;
  descricao: string;
}
interface Objecao {
  objecao: string;
  resposta: string;
}
interface Passo {
  numero: number;
  acao: string;
  detalhe: string;
}
interface StrategyData {
  icon: string;
  route: string;
  title: string;
  subtitle: string;
  quickSummary: string;
  objetivo: string;
  perfilIdeal: { titulo: string; items: string[] };
  momentoIdeal: string[];
  passos: Passo[];
  argumentos: Argumento[];
  formulas: Formula[];
  objecoes: Objecao[];
  bulletsPro: string[];
  alerta?: string;
}

// ─── Base de Conhecimento Estratégico ─────────────────────────────────────────
const ESTRATEGIAS: Record<string, StrategyData> = {

  // ─── 1. CALCULADORA PATRIMONIAL ──────────────────────────────────────────
  "calculadora-patrimonial": {
    icon: "🏠",
    route: "/app",
    title: "Calculadora Patrimonial",
    subtitle: "SAC, PRICE e Consórcio — Manual de Uso Estratégico",
    quickSummary: "Destrua o argumento do financiamento bancário com os próprios números do cliente. Quando o cliente vê o delta de custo total na tela, a decisão racional já foi tomada.",
    objetivo: "Posicionar o consórcio como a escolha financeiramente superior ao financiamento bancário, usando os dados reais do cliente para criar um contraste irrefutável. Esse simulador transforma a reunião em uma sessão de análise consultiva — o vendedor deixa de \"vender\" e passa a mostrar a verdade matemática.",
    perfilIdeal: {
      titulo: "Cliente Ideal para Este Simulador",
      items: [
        "Está avaliando ou já recebeu proposta de financiamento bancário (Caixa, Itaú, Bradesco)",
        "Tem renda estável e horizonte de longo prazo (5+ anos)",
        "Prioriza patrimônio — não está com urgência extrema de mudança imediata",
        "Tem alguma reserva para lance ou entrada parcial",
        "Perfil analítico: gosta de ver números antes de decidir",
      ],
    },
    momentoIdeal: [
      "Logo após o cliente mostrar a proposta de financiamento do banco",
      "Quando o cliente diz \"o banco me aprovou por X\"",
      "Quando o cliente questiona \"mas no banco eu já tenho o imóvel garantido\"",
      "Em reuniões de planejamento financeiro com casal — o contraste visual convence os dois ao mesmo tempo",
    ],
    passos: [
      { numero: 1, acao: "Peça a proposta do banco", detalhe: "Taxa, prazo e valor financiado — dados reais geram impacto real. Não use números hipotéticos." },
      { numero: 2, acao: "Insira os dados do financiamento primeiro", detalhe: "Deixe o cliente ver o custo total do SAC/PRICE se formando na tela. O número assusta — e é intencional." },
      { numero: 3, acao: "Preencha o consórcio com os parâmetros ideais", detalhe: "Use o mesmo valor do imóvel, lance compatível com os recursos do cliente. Mostre a diferença de custo total." },
      { numero: 4, acao: "Mostre o gráfico de parcelas", detalhe: "A curva do financiamento começa alta e cai lentamente. O consórcio é estável. O visual fala por si só." },
      { numero: 5, acao: "Leia o quadro analítico em voz alta", detalhe: "\"Com o banco, você paga R$X a mais. Com o consórcio, seu patrimônio líquido ao final é R$Y maior.\"" },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"Você vai pagar R$X de juros ao banco em 20 anos. No consórcio, esse dinheiro fica no seu bolso.\"",
        contexto: "Use depois de mostrar o custo total do SAC. O delta de juros é sempre um número que choca.",
      },
      {
        numero: 2,
        frase: "\"A primeira parcela do banco é R$A. No consórcio, você começa pagando R$B — e ainda constrói patrimônio.\"",
        contexto: "Poderoso para clientes com renda ajustada. A diferença de parcela inicial cria margem para o lance.",
      },
      {
        numero: 3,
        frase: "\"No banco, você paga durante 30 anos e termina com o imóvel. No consórcio, termina com o imóvel E R$C a mais de patrimônio líquido.\"",
        contexto: "Argumento final — fecha a decisão racional. Use após mostrar o quadro patrimonial.",
      },
      {
        numero: 4,
        frase: "\"Os juros do banco sobem com a TR e o CDI. A parcela do consórcio só corrige pelo INCC — e você sabe exatamente quanto vai pagar.\"",
        contexto: "Para clientes que temem variação. Previsibilidade é um valor real.",
      },
    ],
    formulas: [
      {
        label: "Sistema SAC",
        expressao: "Parcela = Amortização fixa + Juros sobre saldo devedor",
        descricao: "Parcela decrescente. A amortização é constante; os juros caem conforme o saldo diminui. 1ª parcela é a mais cara.",
      },
      {
        label: "Sistema PRICE",
        expressao: "Parcela = PV × [i(1+i)ⁿ] / [(1+i)ⁿ−1]",
        descricao: "Parcela constante. Nos primeiros anos, a maior parte é juros — a dívida demora a cair. O custo total supera o SAC.",
      },
      {
        label: "Consórcio",
        expressao: "Parcela = Carta × (1 + taxa_adm%) / prazo",
        descricao: "Sem juros. A parcela inclui: fundo comum, taxa de administração e fundo de reserva. Corrige pelo INCC.",
      },
      {
        label: "Custo Total Comparado",
        expressao: "Custo = Σ parcelas + ITBI/cartório + custo do aluguel na espera",
        descricao: "A comparação justa inclui o custo do aluguel durante a espera do consórcio. Mesmo assim, o consórcio costuma ganhar.",
      },
    ],
    objecoes: [
      {
        objecao: "\"No banco eu já tenho o imóvel garantido.\"",
        resposta: "\"Exato — e você paga R$X a mais por essa antecipação. Veja o custo dessa garantia na tela. Com o lance certo, a contemplação também é previsível.\"",
      },
      {
        objecao: "\"Consórcio demora muito.\"",
        resposta: "\"Com lance de Y%, você é contemplado no mês Z. Isso é previsível e documentado. Não é sorte — é estratégia.\"",
      },
      {
        objecao: "\"Vou esperar os juros caírem para financiar.\"",
        resposta: "\"Enquanto os juros caem, você paga aluguel. Veja quanto isso representa em X anos no simulador. O consórcio não espera os juros — ele não tem juros.\"",
      },
    ],
    bulletsPro: [
      "Nunca insira números hipotéticos — peça a proposta real do banco do cliente antes da reunião.",
      "Mostre o custo do SAC primeiro, sozinho. Deixe o número impactar antes de mostrar o consórcio.",
      "O campo \"Aluguel atual\" é estratégico — adicione o aluguel do cliente para mostrar o custo real da espera.",
      "Se o cliente tiver entrada disponível, use parte como lance e parte como entrada — o simulador mostra o cenário híbrido.",
      "Salve a simulação com o nome do cliente e envie o PDF como material de apoio após a reunião.",
    ],
  },

  // ─── 2. SIMULADOR DE LANCE ───────────────────────────────────────────────
  "simulador-lance": {
    icon: "🎯",
    route: "/simuladores/lance",
    title: "Simulador de Lance",
    subtitle: "Contemplação Garantida — Manual de Uso Estratégico",
    quickSummary: "A pergunta #1 de todo cliente de consórcio é \"quando vou ser contemplado?\". Este simulador a responde com precisão — transformando incerteza em certeza vendável.",
    objetivo: "Eliminar a objeção da incerteza de contemplação mostrando, com números reais, o que o lance garante: mês exato de contemplação, nova parcela pós-lance, economia total e o break-even do investimento. Transforma o lance de 'custo extra' em 'ferramenta de controle do cronograma'.",
    perfilIdeal: {
      titulo: "Cliente Ideal para Este Simulador",
      items: [
        "Está interessado no consórcio mas com receio do prazo indefinido",
        "Tem reserva financeira disponível (para lance próprio ou embutido)",
        "É mais racional que emocional — precisa de certeza antes de decidir",
        "Tem uma data-alvo: casamento, aposentadoria, reforma, mudança",
        "Está comparando com financiamento pela questão da certeza de posse",
      ],
    },
    momentoIdeal: [
      "Logo após o cliente perguntar \"mas quando eu vou receber a carta?\"",
      "Quando o cliente tem capital parado em CDB ou poupança",
      "Quando o cliente compara com financiamento pela previsibilidade",
      "Para clientes que já estão em consórcio e querem antecipar a contemplação",
    ],
    passos: [
      { numero: 1, acao: "Identifique a data-alvo do cliente", detalhe: "\"Quando você precisa estar com o imóvel?\" — isso define o mês-alvo e quanto de lance é necessário." },
      { numero: 2, acao: "Calcule o lance mínimo para o mês-alvo", detalhe: "Insira o mês desejado e veja o percentual de lance necessário. Apresente como solução, não como custo." },
      { numero: 3, acao: "Compare os 3 cenários lado a lado", detalhe: "Sem lance (mês médio aleatório) vs. Lance embutido vs. Lance próprio. O cliente escolhe seu nível de controle." },
      { numero: 4, acao: "Mostre o break-even do lance próprio", detalhe: "\"No mês X, a economia de parcelas já cobriu o que você investiu no lance. A partir daí é lucro puro.\"" },
      { numero: 5, acao: "Feche com a parcela pós-lance", detalhe: "\"Com o lance, sua parcela cai de R$A para R$B. Você paga menos E ainda garante o prazo.\"" },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"Com X% de lance, você é contemplado garantidamente no mês Y. Sem depender de sorteio.\"",
        contexto: "Use para clientes que temem a aleatoriedade. Lance é certeza — não é aposta.",
      },
      {
        numero: 2,
        frase: "\"Sua parcela cai de R$A para R$B depois da contemplação — redução de R$C por mês para sempre.\"",
        contexto: "Mostre a parcela pós-lance antes do cliente ver o lance em si. A redução de parcela justifica o investimento.",
      },
      {
        numero: 3,
        frase: "\"O lance embutido não sai do seu bolso — vem da própria carta. Você antecipa a contemplação sem desembolso extra.\"",
        contexto: "Para clientes sem capital disponível. O lance embutido é o argumento perfeito — custo zero percebido.",
      },
      {
        numero: 4,
        frase: "\"Em comparação a não dar lance e ser sorteado no mês Z, você economiza R$D no total do plano.\"",
        contexto: "Argumento de economia total — convence clientes analíticos que comparam custos de longo prazo.",
      },
    ],
    formulas: [
      {
        label: "Parcela Padrão",
        expressao: "Parcela = Carta × (1 + taxa_adm%) / prazo",
        descricao: "Parcela mensal antes da contemplação — igual em todos os cenários. Serve como base de comparação.",
      },
      {
        label: "Saldo Pós-Lance",
        expressao: "Saldo = Carta − Lance_embutido − Lance_próprio",
        descricao: "O saldo que resta após o lance ser abatido. É sobre este valor que a parcela pós-contemplação é calculada.",
      },
      {
        label: "Parcela Pós-Lance",
        expressao: "Parcela_pós = Saldo × (1 + taxa_adm%) / prazo",
        descricao: "Parcela reduzida após contemplação com lance. Quanto maior o lance, menor a parcela restante.",
      },
      {
        label: "Break-even do Lance",
        expressao: "Mês_breakeven = Lance_próprio / (Parcela_padrão − Parcela_pós)",
        descricao: "Quantos meses de parcela reduzida são necessários para cobrir o investimento do lance próprio.",
      },
      {
        label: "Economia Total",
        expressao: "Economia = Total_sem_lance − Total_com_lance",
        descricao: "Diferença entre o custo total sem lance (contemplação aleatória no mês médio) e com lance. Sempre positiva se o lance for bem calibrado.",
      },
    ],
    objecoes: [
      {
        objecao: "\"O lance embutido reduz meu crédito — vou perder poder de compra.\"",
        resposta: "\"Exato. Por isso calculamos o lance ideal que equilibra contemplação rápida com crédito útil. Veja: com X% de embutido, seu crédito líquido ainda é R$Y — suficiente para o imóvel que você quer.\"",
      },
      {
        objecao: "\"Não tenho dinheiro para dar lance.\"",
        resposta: "\"Sem problema. O lance embutido usa a própria carta — sem desembolso do seu bolso. Você antecipa a contemplação sem gastar nada a mais.\"",
      },
      {
        objecao: "\"Mas e se outro participante der um lance maior?\"",
        resposta: "\"Esse risco é real em lances livres. Por isso calibramos o percentual acima da média histórica do grupo — o simulador mostra exatamente o lance necessário para competir com segurança.\"",
      },
    ],
    bulletsPro: [
      "Sempre comece pelo mês-alvo do cliente — não pela percentagem de lance. A data cria urgência; o lance é apenas a solução.",
      "Lance embutido é sua arma secreta para clientes sem capital: 'zero desembolso, contemplação garantida'.",
      "Mostre os 3 tipos de lance na mesma tela — deixe o cliente escolher o nível de controle que quer. Isso gera senso de autonomia.",
      "Se o cliente tiver recursos no CDB rendendo menos que a economia de parcelas, o lance próprio é financeiramente óbvio.",
      "O break-even é um argumento poderoso: 'a partir do mês X, cada mês que passa é lucro puro para você'.",
      "Use o campo 'mês médio sem lance' com a média real do grupo — dados reais da administradora aumentam a credibilidade.",
    ],
  },

  // ─── 3. ALUGUEL VS CONSÓRCIO ─────────────────────────────────────────────
  "aluguel-vs-consorcio": {
    icon: "⚖️",
    route: "/simuladores/aluguel-vs-consorcio",
    title: "Aluguel vs. Consórcio",
    subtitle: "O Argumento de Conversão — Manual de Uso Estratégico",
    quickSummary: "O maior mercado do consórcio imobiliário são os inquilinos. Este simulador converte quem 'não tem condição' em quem 'não tem escolha' — porque os números mostram que a parcela do consórcio pode ser menor que o aluguel atual.",
    objetivo: "Transformar inquilinos em compradores de consórcio. Esse é o simulador de CONVERSÃO por excelência — ataca a maior dor emocional do público-alvo (pagar aluguel sem construir nada) e apresenta uma solução com fluxo de caixa similar ao que o cliente já paga.",
    perfilIdeal: {
      titulo: "Cliente Ideal para Este Simulador",
      items: [
        "Inquilino — esse é o perfil perfeito. Representa mais de 50% do mercado potencial.",
        "Paga aluguel há pelo menos 2 anos (já sente a dor acumulada)",
        "Tem renda estável mas não tem entrada para financiamento",
        "Sente que 'nunca vai conseguir sair do aluguel'",
        "Tem família — o argumento patrimonial ressoa com responsabilidade familiar",
        "Aluguel atual próximo ou maior que a parcela do consórcio projetado",
      ],
    },
    momentoIdeal: [
      "No primeiro contato com qualquer inquilino",
      "Quando o cliente diz 'estou pagando aluguel e não consigo juntar dinheiro'",
      "Quando o cliente diz 'não tenho entrada para financiamento'",
      "Quando o cliente diz 'consórcio é caro demais para mim'",
      "Em visitas a imóveis alugados — o cliente já está no ambiente da dor",
    ],
    passos: [
      { numero: 1, acao: "Calcule o passado antes do futuro", detalhe: "Pergunte há quanto tempo paga aluguel e qual o valor inicial. Some o total retroativo. Esse número dói — e deve doer." },
      { numero: 2, acao: "Insira o aluguel atual e o horizonte", detalhe: "Use 20 anos como padrão. Mostre primeiro o headline: 'Em 20 anos: R$X pagos. Patrimônio: R$0,00'. Silêncio estratégico aqui." },
      { numero: 3, acao: "Configure o consórcio com parcela próxima ao aluguel", detalhe: "Esse é o segredo: mostre que a parcela pode ser igual ou menor ao aluguel. 'Você já paga isso todo mês — só que sem construir nada.'" },
      { numero: 4, acao: "Mostre o gráfico de área", detalhe: "Aluguel acumulado (vermelho subindo) vs. Patrimônio consórcio (verde). A curva verde decola após a contemplação — o visual é poderoso." },
      { numero: 5, acao: "Aponte o ponto de virada", detalhe: "O mês em que o patrimônio do imóvel supera o total gasto de aluguel. 'A partir do mês X, você 'virou o jogo'.'" },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"Você vai gastar R$X de aluguel nos próximos 20 anos. Esse dinheiro vai embora e não volta. No consórcio, ele vira imóvel.\"",
        contexto: "O argumento principal. Diga devagar. Deixe o número aterrissar. Não siga para o próximo argumento imediatamente.",
      },
      {
        numero: 2,
        frase: "\"A parcela do consórcio é R$X — igual ao seu aluguel atual. Você pagaria o mesmo, mas construindo patrimônio.\"",
        contexto: "Use quando a parcela for próxima ao aluguel. Destrói a objeção de 'não tenho condição' na hora.",
      },
      {
        numero: 3,
        frase: "\"No mês Z, você para de pagar aluguel e começa a morar no seu imóvel. A partir daí, cada real que pagava de aluguel fica no seu bolso.\"",
        contexto: "Cria uma imagem mental da mudança de vida. Poderoso para casais e famílias.",
      },
      {
        numero: 4,
        frase: "\"Com a valorização anual de X%, seu imóvel valerá R$Y em 20 anos. Você teria construído esse patrimônio pagando a mesma coisa que paga de aluguel hoje.\"",
        contexto: "Argumento de riqueza. Fecha com clientes que pensam em herança e futuro dos filhos.",
      },
    ],
    formulas: [
      {
        label: "Total de Aluguel Projetado",
        expressao: "Total = Σ Aluguel_mês × (1 + reajuste_anual)^ano",
        descricao: "Soma de todos os aluguéis ao longo do horizonte, com reajuste anual composto (IGPM ou IPCA). O total sempre surpreende o cliente.",
      },
      {
        label: "Patrimônio do Consórcio",
        expressao: "Patrimônio = Carta × (1 + valorização_anual)^anos",
        descricao: "Valor do imóvel ao final do horizonte, corrigido pela valorização anual estimada do mercado imobiliário.",
      },
      {
        label: "Ponto de Virada",
        expressao: "Mês onde: Patrimônio_imóvel > Total_aluguel_acumulado",
        descricao: "O mês em que o patrimônio do consórcio supera matematicamente o total gasto em aluguel. Visualmente marcado no gráfico.",
      },
    ],
    objecoes: [
      {
        objecao: "\"Não tenho entrada para o consórcio.\"",
        resposta: "\"No consórcio não existe entrada. Você começa pagando a parcela mensal — que é o que você já paga de aluguel. É exatamente isso que o simulador mostra.\"",
      },
      {
        objecao: "\"Prefiro guardar dinheiro antes.\"",
        resposta: "\"Enquanto você guarda, o aluguel sobe e o imóvel valoriza. Veja quanto esse 'guardar antes' custa em reais reais. O consórcio começa a construir agora.\"",
      },
      {
        objecao: "\"Mas e se eu precisar me mudar?\"",
        resposta: "\"A cota é transferível. Você pode vender a cota, ceder para outra pessoa ou usar o crédito em outro imóvel. Flexibilidade existe — o aluguel é que não volta.\"",
      },
    ],
    bulletsPro: [
      "SEMPRE calcule o retroativo primeiro — 'você já pagou R$X até hoje sem construir nada'. Isso cria urgência emocional imediata.",
      "Se o aluguel for igual ou maior que a parcela do consórcio, diga isso explicitamente: 'você já tem condição, só está pagando para o dono errado'.",
      "Use o gráfico de área na reunião — não é necessário explicar. O visual fala por si. Deixe 10 segundos de silêncio após mostrar.",
      "Adapte o horizonte à faixa etária: jovem = 30 anos; família estabelecida = 20 anos; próximo da aposentadoria = 10 anos.",
      "O reajuste do aluguel é uma das variáveis mais impactantes — use o IGPM real histórico (5-8% a.a.) para mostrar quanto o aluguel cresce.",
      "Depois de fechar, use esse simulador para os amigos e familiares do cliente — cada inquilino conhece outros inquilinos.",
    ],
  },

  // ─── 4. RENDA PASSIVA ────────────────────────────────────────────────────
  "renda-passiva-consorcio": {
    icon: "💰",
    route: "/simuladores/renda-passiva",
    title: "Renda Passiva com Consórcio",
    subtitle: "Consórcio como Investimento — Manual de Uso Estratégico",
    quickSummary: "Mude o vocabulário e mude o cliente. Este simulador não vende consórcio — apresenta uma estratégia de alocação de capital com retorno superior ao CDB e proteção contra inflação. Abre um mercado que o vendedor comum nunca atinge.",
    objetivo: "Converter investidores sofisticados que não precisam de moradia mas querem rentabilidade. O argumento central: o aluguel recebido cobre a parcela do consórcio (fluxo neutro a partir de certo mês), e ao final, o cliente tem um imóvel valorizado com ROI superior à renda fixa.",
    perfilIdeal: {
      titulo: "Cliente Ideal para Este Simulador",
      items: [
        "Já tem imóvel próprio — não está comprando para morar",
        "Tem capital disponível e busca alternativas ao CDB/Tesouro/FIIs",
        "Entende ROI, yield, fluxo de caixa — fala a língua financeira",
        "Profissionais liberais com renda alta: médicos, engenheiros, advogados",
        "Empreendedores que querem diversificar além do próprio negócio",
        "Investidores que já operam em fundos imobiliários e querem ativo físico",
      ],
    },
    momentoIdeal: [
      "Em reuniões sobre diversificação de carteira",
      "Quando o cliente reclama da rentabilidade da renda fixa com inflação",
      "Quando o cliente menciona que quer comprar imóvel para alugar mas 'não tem capital para entrada'",
      "Em eventos de networking com profissionais liberais",
      "Quando um cliente do consórcio convencional indica alguém com perfil investidor",
    ],
    passos: [
      { numero: 1, acao: "Mude o vocabulário desde o início", detalhe: "Não fale 'consórcio'. Fale 'alocação de capital em ativo imobiliário via instrumento de crédito colaborativo'. Postura de consultor, não de vendedor." },
      { numero: 2, acao: "Defina a taxa de retorno do aluguel esperado", detalhe: "Yield típico imobiliário: 0,4% a 0,6% ao mês do valor do imóvel. Isso define a renda a ser inserida no simulador." },
      { numero: 3, acao: "Mostre o fluxo de caixa mês a mês", detalhe: "Fase 1 (pré-contemplação): aporte mensal. Fase 2 (pós-contemplação): aluguel entra, parcela sai. Mostre o mês em que o fluxo vira neutro." },
      { numero: 4, acao: "Compare com CDB/Tesouro", detalhe: "Use a taxa CDI atual como referência. O simulador compara patrimônio final do consórcio+aluguel vs. aplicação equivalente em renda fixa." },
      { numero: 5, acao: "Feche com o ROI anual", detalhe: "\"Esse é o retorno anual implícito da operação. Compare com o que seu CDB está rendendo hoje.\"" },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"A partir do mês X, o aluguel paga a parcela do consórcio. Seu fluxo de caixa mensal é zero. O imóvel se paga sozinho.\"",
        contexto: "O argumento mais impactante. O conceito de 'fluxo neutro' é o que diferencia esse investimento de qualquer outro.",
      },
      {
        numero: 2,
        frase: "\"ROI anual de X% — contra Y% do CDB no mesmo período. Com a vantagem de que o imóvel ainda valoriza e a renda cresce com reajuste.\"",
        contexto: "Para clientes financeiramente sofisticados. Compare sempre com o CDI atual — é a referência mental deles.",
      },
      {
        numero: 3,
        frase: "\"O CDB rende em reais. O imóvel rende em reais E se protege da inflação — porque o aluguel e o valor do imóvel sobem com o IPCA.\"",
        contexto: "Argumento de proteção contra inflação. Poderoso em cenários de inflação alta ou incerteza econômica.",
      },
      {
        numero: 4,
        frase: "\"Com 2 cotas, você dobra a renda e o patrimônio. O aporte mensal é proporcional — a escala é o que diferencia o investidor do comum.\"",
        contexto: "Para fechar tickets maiores. Apresente o cenário de múltiplas cotas após o cliente aprovar a lógica de uma.",
      },
    ],
    formulas: [
      {
        label: "Yield do Aluguel",
        expressao: "Renda_mensal = Valor_imóvel × yield_mensal (0,4% a 0,6%)",
        descricao: "Taxa de retorno mensal do aluguel sobre o valor do imóvel. Use 0,5% como referência neutra para mercados urbanos.",
      },
      {
        label: "Fluxo Líquido Mensal",
        expressao: "Fluxo = Aluguel_mês − Parcela_consórcio",
        descricao: "Negativo antes da contemplação (apenas parcela). Cresce após contemplação com o aluguel. O mês em que ≥ 0 é o ponto de equilíbrio.",
      },
      {
        label: "ROI Anual",
        expressao: "ROI_anual = (Patrimônio_final / Total_investido)^(1/anos) − 1",
        descricao: "Taxa de retorno anual equivalente da operação completa. Inclui valorização do imóvel + renda de aluguel acumulada.",
      },
      {
        label: "Comparativo CDB",
        expressao: "CDB_futuro = Total_investido × (1 + CDI_mensal)^meses",
        descricao: "Quanto o mesmo capital investido teria gerado em CDB ao CDI vigente. A vantagem do consórcio aparece especialmente em horizontes ≥ 10 anos.",
      },
    ],
    objecoes: [
      {
        objecao: "\"Prefiro FIIs — mais liquidez e sem dor de cabeça.\"",
        resposta: "\"FII tem liquidez, mas você não tem controle do imóvel e o yield é tributado. No consórcio, você escolhe o imóvel, o inquilino e o reajuste. E o patrimônio é seu — não de um fundo.\"",
      },
      {
        objecao: "\"Gestão de imóvel dá muito trabalho.\"",
        resposta: "\"Imobiliária resolve isso por 8-10% da renda. Já está no modelo. Veja o fluxo com o custo de gestão descontado — ainda supera o CDB.\"",
      },
      {
        objecao: "\"O retorno só aparece daqui a 10 anos.\"",
        resposta: "\"Sim — e é por isso que os maiores patrimônios do Brasil são imobiliários. Mas a renda começa no mês X após a contemplação. E a partir do mês Y, o aluguel paga a parcela. Você está no positivo antes disso.\"",
      },
    ],
    bulletsPro: [
      "Use sempre o CDI atual como referência — não um número histórico. Quanto menor o CDI, mais fácil mostrar a vantagem imobiliária.",
      "Mude o vocabulário completamente: 'aporte', 'yield', 'fluxo', 'ROI', 'portfólio'. Não diga 'parcela' para esse perfil.",
      "Apresente múltiplas cotas depois que o cliente aprovar a lógica de uma — o ticket médio pode triplicar.",
      "Médicos e advogados indicam outros médicos e advogados. Um fechamento nesse perfil vale 3-5 indicações qualificadas.",
      "Mostre o cenário com valorização conservadora (4% a.a.) E otimista (8% a.a.) — transparência gera confiança.",
      "Se o CDI estiver alto, não ignore — reconheça e mostre a vantagem da proteção inflacionária e da valorização física do ativo.",
    ],
    alerta: "Este simulador usa premissas de mercado (valorização e yield de aluguel) que variam por região e ciclo econômico. Sempre declare as premissas ao cliente e use estimativas conservadoras para não gerar expectativa irreal.",
  },

  // ─── 5. FLIP DE COTA ─────────────────────────────────────────────────────
  "flip-cota": {
    icon: "📈",
    route: "/simuladores/flip-cota",
    title: "Alavancagem / Flip de Cota",
    subtitle: "Operação de Alta Rentabilidade — Manual de Uso Estratégico",
    quickSummary: "O simulador mais sofisticado do arsenal. Apresenta uma operação de investimento de curto prazo com TIR de 2% a 5% ao mês — números que poucos investimentos convencionais alcançam. Para clientes que entendem de negócio.",
    objetivo: "Mostrar ao investidor ativo que o consórcio pode ser um veículo de alavancagem financeira: compra-se uma cota, contempla-se com lance e vende-se a cota contemplada com ágio, gerando lucro em 24 a 48 meses com capital investido relativamente baixo em relação ao crédito controlado.",
    perfilIdeal: {
      titulo: "Cliente Ideal para Este Simulador",
      items: [
        "Investidor ativo com capital disponível (mínimo R$50k para operações menores)",
        "Já opera ou operou em renda variável, imóveis ou negócios",
        "Aceita liquidez reduzida por 24-48 meses em troca de retorno maior",
        "Perfil empreendedor — entende o conceito de 'comprar e vender com lucro'",
        "Tem relacionamento com imobiliária ou rede de compradores de cotas",
        "Busca ROI superior ao CDB sem a complexidade de um imóvel físico para gerir",
      ],
    },
    momentoIdeal: [
      "Em reuniões com investidores que já conhecem o mercado de consórcio",
      "Quando o cliente pergunta 'tem como ganhar dinheiro com consórcio?'",
      "Em eventos de investimento, clube de anjos, grupos de empreendedores",
      "Quando um cliente que fez consórcio indica um amigo com perfil mais agressivo",
      "Para clientes que já foram contemplados e querem entender como monetizar a cota",
    ],
    passos: [
      { numero: 1, acao: "Explique a operação em 3 frases", detalhe: "1) Você compra a cota. 2) Paga parcelas (com meia parcela, custo baixo). 3) É contemplado e vende com ágio. Simples assim." },
      { numero: 2, acao: "Defina o crédito e o perfil de lance", detalhe: "Créditos maiores (R$500k+) geram ágios maiores em valor absoluto. Lance de 40-60% costuma garantir contemplação rápida." },
      { numero: 3, acao: "Ative a opção 'Meia Parcela'", detalhe: "Quando disponível na administradora, reduz o desembolso pré-contemplação pela metade — aumenta o ROI significativamente." },
      { numero: 4, acao: "Calibre o ágio de venda", detalhe: "Ágio típico de mercado: 15-25% do crédito líquido. Use 20% como referência conservadora. Mercados aquecidos chegam a 30%+." },
      { numero: 5, acao: "Mostre a TIR e compare", detalhe: "TIR de 2-4% ao mês supera qualquer renda fixa. Compare com CDI e destaque: 'Este é o retorno de um negócio, não de uma aplicação.'" },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"Com R$X de capital alocado em parcelas, você controla R$Y de crédito. Isso é alavancagem.\"",
        contexto: "O conceito de alavancagem ressoa com investidores. Você 'controla' um crédito muito maior que o capital investido.",
      },
      {
        numero: 2,
        frase: "\"TIR de X% ao mês. Em Y meses, seu capital de R$Z virou R$W. Mostre isso para seu contador.\"",
        contexto: "Use números reais do simulador. TIR mensal superior a 2% chama atenção de qualquer investidor.",
      },
      {
        numero: 3,
        frase: "\"Com a meia parcela, seu desembolso total é R$X — menos que muitos investimentos que rendem metade disso.\"",
        contexto: "Quando a administradora oferece meia parcela, o desembolso cai pela metade e o ROI quase dobra.",
      },
      {
        numero: 4,
        frase: "\"O mercado de cotas contempladas tem compradores — imobiliárias especializadas, investidores, pessoas que querem carta rápida. A liquidez existe.\"",
        contexto: "Antecipe a objeção de liquidez. Mostre que existe um mercado secundário ativo de cotas contempladas.",
      },
    ],
    formulas: [
      {
        label: "Custo Total do Plano",
        expressao: "Custo_plano = Carta × (1 + taxa_adm% + fundo_reserva%) / prazo",
        descricao: "A parcela cheia mensal inclui taxa de administração E fundo de reserva — ambos entram no cálculo de rentabilidade.",
      },
      {
        label: "Parcela com Meia Parcela",
        expressao: "Parcela_efetiva = Parcela_cheia × 0,5 (se meia parcela ativa)",
        descricao: "Algumas administradoras permitem pagar 50% da parcela até a contemplação. Isso reduz o desembolso total em até 50% e aumenta o ROI proporcionalmente.",
      },
      {
        label: "Crédito Líquido",
        expressao: "Crédito_líquido = Carta − Lance_embutido",
        descricao: "O crédito disponível após descontar o lance embutido. É sobre esse valor que o ágio de venda é calculado.",
      },
      {
        label: "Valor do Ágio",
        expressao: "Ágio = Crédito_líquido × (% ágio / 100)",
        descricao: "O prêmio que o comprador da cota paga ao operador. É o lucro bruto da operação antes de descontar o desembolso.",
      },
      {
        label: "TIR Mensal",
        expressao: "TIR = (Ágio / Desembolso_total)^(1/mês_contemplação) − 1",
        descricao: "Taxa Interna de Retorno mensal. Representa a rentabilidade efetiva mensal do capital investido ao longo do período da operação.",
      },
      {
        label: "Lucro Líquido",
        expressao: "Lucro = Ágio − Desembolso_total",
        descricao: "O resultado financeiro da operação. Desembolso total = parcelas pagas + lance próprio (se houver). O ágio é toda a receita.",
      },
    ],
    objecoes: [
      {
        objecao: "\"E se eu não conseguir vender a cota com esse ágio?\"",
        resposta: "\"Essa é a única variável de mercado. Por isso usamos 20% como base conservadora — mercado aquecido paga mais. E se precisar, você pode usar a carta normalmente para comprar um imóvel.\"",
      },
      {
        objecao: "\"A administradora permite a cessão de cota?\"",
        resposta: "\"Verificamos isso antes de montar a operação. A maioria permite após a contemplação. Trabalhamos com administradoras que têm esse processo claro e ágil.\"",
      },
      {
        objecao: "\"Esse negócio parece complicado demais.\"",
        resposta: "\"É uma operação com 3 movimentos: comprar, contemplar e vender. A complexidade está nos números — e para isso existe este simulador. Deixa eu mostrar os números da sua operação específica.\"",
      },
    ],
    bulletsPro: [
      "Créditos maiores geram ágios maiores em valor absoluto — R$1M com 20% de ágio = R$200k de lucro potencial.",
      "A meia parcela é o multiplicador de ROI — sempre verifique se a administradora oferece antes de montar a proposta.",
      "Lance embutido de 50% + ágio de 20% é a combinação mais comum de alta rentabilidade com menor risco de contemplação.",
      "Construa sua rede de compradores de cota antes — imobiliárias e grupos de investidores. A liquidez na saída é o que sustenta a operação.",
      "Para apresentar a operação: use sempre 'capital alocado', 'crédito controlado', 'TIR', 'ROI'. Nunca 'parcela' ou 'sorteio'.",
      "Um cliente que fecha uma operação de flip e lucra indica 3 outros. O ROI do seu networking cresce exponencialmente.",
    ],
    alerta: "Esta operação depende da liquidez do mercado de cotas e da permissão da administradora para cessão. Sempre verifique o regulamento do grupo antes de comprometer o cliente. A TIR apresentada é estimativa baseada nas premissas inseridas — retornos reais podem variar.",
  },

  // ─── 6. SAÍDA DO FINANCIAMENTO ────────────────────────────────────────────
  "saida-financiamento": {
    icon: "🔓",
    route: "/simuladores/saida-financiamento",
    title: "Saída do Financiamento",
    subtitle: "O Resgate — Manual de Uso Estratégico",
    quickSummary: "O cliente já tem a dor. Não precisa ser convencido de que quer sair — quer saber SE dá pra sair e como. Quem responde com números reais na tela fecha na mesma reunião. Taxa de conversão estimada 3× maior que cold lead.",
    objetivo: "Usar o capital liberado pela venda do imóvel financiado para financiar o lance do consórcio — zerando a parcela bancária pesada e substituindo por uma parcela de consórcio menor, com patrimônio equivalente ou superior ao final. O simulador prova, com os dados reais do cliente, que a migração é financeiramente vantajosa.",
    perfilIdeal: {
      titulo: "Cliente Ideal — O Preso no Financiamento",
      items: [
        "Tem financiamento bancário ativo (Caixa, Itaú, Bradesco) com parcela pesada",
        "Já paga há mais de 3 anos — o saldo devedor caiu pouco, a dor está máxima",
        "O imóvel se valorizou — há capital líquido para lance na venda",
        "Está em mudança de vida: separação, promoção, aposentadoria — momento de repensar",
        "Renda apertada e parcela bancária comprometendo mais de 30% do orçamento",
        "19 milhões de contratos ativos de financiamento no Brasil — este é o maior mercado",
      ],
    },
    momentoIdeal: [
      "Cliente liga reclamando da parcela do financiamento — é lead quente, abra o simulador imediatamente",
      "Quando o cliente diz \"pago R$X de parcela há Y anos e não abaixou nada\"",
      "Em reuniões de revisão financeira — o cliente quer reorganizar a vida financeira",
      "Quando o imóvel valorizou e o cliente percebe que tem patrimônio para trabalhar",
      "Indicações de outros clientes — \"meu amigo também tá nessa situação\"",
    ],
    passos: [
      { numero: 1, acao: "Colete os dados do extrato do financiamento", detalhe: "Saldo devedor, parcela atual, prazo restante e taxa de juros. O cliente tem isso no app do banco ou no extrato." },
      { numero: 2, acao: "Insira o valor atual de mercado do imóvel", detalhe: "Pesquise no Zap/Viva Real rápido ou use avaliação informal. O cliente geralmente sabe. Esse número determina o capital disponível." },
      { numero: 3, acao: "Mostre o capital líquido da venda", detalhe: "\"Vendendo por R$X, depois de pagar o banco e os custos, sobram R$Y.\" Esse momento é de impacto — o cliente às vezes não sabia que tinha esse capital." },
      { numero: 4, acao: "Aplique o capital no lance do consórcio", detalhe: "Use o capital líquido como lance. Mostre a nova parcela do consórcio — sempre menor que a do financiamento." },
      { numero: 5, acao: "Compare o patrimônio final em ambos os cenários", detalhe: "Mostre o gráfico de evolução patrimonial. O consórcio chega no mesmo patamar com custo total menor." },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"Você tem R$X de patrimônio preso nesse imóvel. Com o consórcio, esse dinheiro trabalha por você — não para o banco.\"",
        contexto: "Use após mostrar o capital líquido. O cliente não percebia que tinha esse ativo disponível.",
      },
      {
        numero: 2,
        frase: "\"Sua parcela hoje é R$A. Com o consórcio e o lance da venda, você paga R$B por mês — e ainda tem R$C de sobra.\"",
        contexto: "O delta de parcela é o argumento mais poderoso. Mostre o número na tela enquanto fala.",
      },
      {
        numero: 3,
        frase: "\"No financiamento, você vai pagar mais R$X ao banco nos próximos Y anos. Esse é o custo da inércia.\"",
        contexto: "Quantifique o custo de não fazer nada. Torna a dor presente e mensurável.",
      },
      {
        numero: 4,
        frase: "\"O imóvel do consórcio valoriza igual. A diferença é que você chega lá pagando R$X a menos por mês.\"",
        contexto: "Para quem teme que a troca diminua o patrimônio. O gráfico de evolução patrimonial prova que não.",
      },
    ],
    formulas: [
      {
        label: "Capital Líquido da Venda",
        expressao: "Capital_líquido = Valor_mercado − Saldo_devedor − (Valor_mercado × % custos_venda)",
        descricao: "O que sobra após pagar o banco e os custos de venda (corretagem 5% + despesas ~1%). Esse é o capital disponível para o lance.",
      },
      {
        label: "Lance no Consórcio",
        expressao: "Lance = min(Capital_líquido, Carta × % lance)",
        descricao: "Aplica o capital como lance. O restante vira reserva de caixa do cliente.",
      },
      {
        label: "Parcela Pós-Lance",
        expressao: "Parcela_pós = (Carta − Lance) × (1 + taxa_adm%) / prazo",
        descricao: "Parcela do consórcio após contemplação, calculada sobre o saldo devedor reduzido pelo lance.",
      },
      {
        label: "Patrimônio Final",
        expressao: "Patrimônio = Carta × (1 + valoriz_mensal)^(prazo − mês_contemplação) + sobra_caixa",
        descricao: "Valor final do imóvel adquirido via consórcio, corrigido pela valorização anual, mais o capital que não foi ao lance.",
      },
    ],
    objecoes: [
      {
        objecao: "\"Mas eu já paguei tantos anos — perco tudo isso?\"",
        resposta: "\"Você não perde — você monetiza. O que foi pago virou saldo devedor menor e valorização do imóvel. O capital líquido de R$X é o resultado real dessas parcelas. Agora esse dinheiro vai trabalhar por você no consórcio.\"",
      },
      {
        objecao: "\"Consigo vender meu imóvel pelo valor que você colocou?\"",
        resposta: "\"Esse é o valor de mercado atual. Vamos confirmar com uma avaliação informal — costumo fazer isso antes de fechar qualquer proposta. Mas mesmo com 10% abaixo, os números ainda são favoráveis — quer ver?\"",
      },
      {
        objecao: "\"E se eu não encontrar comprador rápido?\"",
        resposta: "\"Enquanto vende, você segue pagando o financiamento normalmente — não há custo extra. Assim que fechar a venda, acionamos o consórcio. O processo costuma levar de 60 a 120 dias.\"",
      },
    ],
    bulletsPro: [
      "Abra o simulador antes de explicar qualquer coisa — os números falam mais rápido que qualquer argumento.",
      "Peça o extrato do banco na primeira reunião. Clientes com dados reais fecham 3× mais do que clientes com estimativas.",
      "O 'capital que sobra após o lance' é um argumento de reserva de emergência — ressoa com quem tem medo de ficar sem caixa.",
      "Insira os custos de venda de 6% (conservador) — nunca subestime para não frustrar depois.",
      "Se o imóvel caiu de valor e não há capital líquido: mude o ângulo. Simule o consórcio como segunda propriedade — o imóvel atual pode ser alugado para pagar o consórcio.",
      "Esse simulador gera leads de indicação poderosos: o cliente que saiu do financiamento conta para os amigos que ainda estão presos.",
    ],
  },

  // ─── 7. META PATRIMONIAL ──────────────────────────────────────────────────
  "meta-patrimonial": {
    icon: "🏆",
    route: "/simuladores/meta-patrimonial",
    title: "Meta Patrimonial",
    subtitle: "Planejador Reverso — Manual de Uso Estratégico",
    quickSummary: "Inverte a lógica da venda: o cliente deixa de pensar 'quanto custa uma cota' e passa a pensar 'quanto preciso investir por mês para chegar onde quero'. Fecha tickets maiores e gera indicações qualificadas — o cliente vira sócio do plano.",
    objetivo: "Transformar o vendedor em consultor de patrimônio: dado um objetivo claro (R$2M em 15 anos ou R$10k/mês de renda passiva), o simulador calcula o caminho reverso — quantas cotas, de qual valor, com qual prazo e cronograma de contemplações. O cliente não compra uma cota; adere a um plano patrimonial.",
    perfilIdeal: {
      titulo: "Cliente Ideal — O Construtor de Patrimônio",
      items: [
        "Tem renda estável acima de R$10k/mês e ainda não organizou o patrimônio",
        "Profissional liberal: médico, advogado, engenheiro — alto ganho, baixo patrimônio acumulado",
        "Está entre 35 e 50 anos — horizonte de 10-20 anos até aposentadoria",
        "Já conhece consórcio e está pronto para pensar em múltiplas cotas",
        "Diz 'quero me aposentar com renda de aluguel' — objetivo claro de renda passiva",
        "Investidor insatisfeito com renda fixa buscando ativos reais com maior ROI",
      ],
    },
    momentoIdeal: [
      "Quando o cliente declara um objetivo de longo prazo: 'quero ter X em Y anos'",
      "Reuniões de planejamento financeiro anual — quando o cliente está no modo estratégico",
      "Clientes que já fecharam uma cota e querem 'escalar' o patrimônio",
      "Indicações de contadores ou consultores financeiros que querem adicionar imóveis ao portfólio",
    ],
    passos: [
      { numero: 1, acao: "Pergunte o objetivo antes de abrir o simulador", detalhe: "'Qual é a sua meta patrimonial para daqui a 15 anos? Patrimônio total ou renda mensal?' — deixe o cliente declarar o número." },
      { numero: 2, acao: "Insira o objetivo e mostre o plano em segundos", detalhe: "O simulador calcula o número de cotas necessárias e o cronograma. O efeito visual é poderoso — transforma abstração em plano concreto." },
      { numero: 3, acao: "Mostre o investimento mensal total", detalhe: "É o custo do plano em parcelas mensais. Para a maioria dos clientes ideais, é acessível. Apresente como 'o custo do seu plano patrimonial'." },
      { numero: 4, acao: "Compare com o CDB/Tesouro Direto", detalhe: "O patrimônio imobiliário final costuma superar o CDB, especialmente com valorização de 6%+ a.a. O gráfico por cota é didático." },
      { numero: 5, acao: "Feche com o cronograma de contemplações", detalhe: "'Cota 1 contemplada no mês X. Cota 2 no mês Y. Cada contemplação é um imóvel adicionado ao seu patrimônio.' Torna o plano tangível." },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"Você quer R$X de renda passiva. Para isso, precisa de R$Y em imóveis. São Z cotas — e o plano começa com R$W por mês.\"",
        contexto: "O argumento reverso é imediato. Você substituiu 'quanto custa' por 'quanto você precisa investir para chegar lá'.",
      },
      {
        numero: 2,
        frase: "\"Em 15 anos, esse plano entrega R$X de patrimônio. O CDB com o mesmo aporte entregaria R$Y. A diferença é R$Z.\"",
        contexto: "Use a comparação CDB quando o cliente tem renda fixa significativa. A vantagem patrimonial é o argumento de migração.",
      },
      {
        numero: 3,
        frase: "\"Cada contemplação é um imóvel novo no seu portfólio. Não é uma parcela — é uma aquisição.\"",
        contexto: "Reframe mental. Muda o enquadramento de 'pagamento' para 'aquisição programada'. Muito eficaz com investidores.",
      },
      {
        numero: 4,
        frase: "\"Com Z cotas contempladas escalonadas, você nunca fica sem liquidez — sempre tem um imóvel gerando aluguel enquanto outro está sendo contemplado.\"",
        contexto: "Argumento de diversificação temporal. Reduz a objeção de imobilização de capital.",
      },
    ],
    formulas: [
      {
        label: "Cálculo Reverso de Cotas",
        expressao: "Carta_cota = (Patrimônio_alvo / N_cotas) / (1 + valoriz%)^(horizonte − mês_contemplação)",
        descricao: "Para cada cota contemplada em um mês específico, calcula o valor de carta necessário para que o imóvel atinja a parte do patrimônio-alvo ao final do horizonte.",
      },
      {
        label: "Renda Passiva",
        expressao: "Renda_mensal = Patrimônio_total × (yield% / 100)",
        descricao: "Yield típico de imóveis residenciais: 0,4%–0,6% a.m. Yield de comerciais: 0,6%–0,8% a.m. Sempre use o conservador para não frustrar expectativas.",
      },
      {
        label: "Patrimônio Final por Cota",
        expressao: "Valor_imovel_final = Carta × (1 + valoriz_mensal)^(meses_desde_contemplação)",
        descricao: "O imóvel valoriza desde a contemplação até o final do horizonte. Cotas contempladas cedo têm maior valorização acumulada.",
      },
      {
        label: "Comparativo CDB",
        expressao: "CDB_final = Total_investido × (1 + CDI_mensal)^prazo",
        descricao: "Aplica o CDI mensal sobre o total investido no consórcio. A comparação mostra o que a renda fixa entregaria com o mesmo aporte.",
      },
    ],
    objecoes: [
      {
        objecao: "\"Parece muito por mês. Não consigo pagar Z cotas simultâneas.\"",
        resposta: "\"Vamos ajustar o horizonte ou o número de cotas — o simulador recalcula em segundos. Muitos clientes começam com 2 cotas e adicionam quando a renda aumenta ou quando o primeiro imóvel já está gerando aluguel.\"",
      },
      {
        objecao: "\"E se eu precisar do dinheiro antes dos 15 anos?\"",
        resposta: "\"Imóvel tem liquidez — você pode vender ou usar como garantia. E os consórcios podem ser transferidos. Mas o poder desse plano está exatamente no horizonte longo — é quando a valorização faz diferença real.\"",
      },
      {
        objecao: "\"Prefiro CDB — é mais seguro.\"",
        resposta: "\"CDB protege o nominal. Mas em 15 anos com inflação real de 4%, o poder de compra cai. Imóvel corrige pela inflação da construção E valoriza acima disso. Olha a diferença de patrimônio no simulador.\"",
      },
    ],
    bulletsPro: [
      "Nunca abra o simulador com o número de cotas na mente — deixe o cliente dizer o objetivo primeiro. A surpresa do cálculo reverso é o elemento de impacto.",
      "Use modo 'renda passiva' com clientes acima de 45 anos — a pergunta 'quanto você quer receber por mês na aposentadoria' gera ancoragem emocional poderosa.",
      "Clientes com múltiplas cotas indicam naturalmente — estão construindo patrimônio, são bem-sucedidos e querem contar para amigos.",
      "Se o investimento mensal total parece alto: mostre que 1 ou 2 contemplações já pagam as parcelas das demais via aluguel — o plano se auto-sustenta.",
      "Salve o plano com o nome do cliente, envie o PDF e marque revisão em 90 dias — mostra comprometimento com o plano, não com a comissão.",
    ],
  },

  // ─── 8. CONSÓRCIO PARA CNPJ ───────────────────────────────────────────────
  "consorcio-cnpj": {
    icon: "🏢",
    route: "/simuladores/consorcio-cnpj",
    title: "Consórcio para CNPJ",
    subtitle: "O Mercado Inexplorado — Manual de Uso Estratégico",
    quickSummary: "PJ tem ticket médio 3–5× maior. A decisão é racional e financeira — e o simulador entrega exatamente os números que o contador vai pedir. O vendedor que apresenta isso vira o único no mercado que fala a língua do empresário.",
    objetivo: "Demonstrar ao empresário que o consórcio PJ tem custo real inferior ao financiamento bancário PJ, após considerar a dedutibilidade fiscal das parcelas. Em regimes de Lucro Presumido ou Real, a parcela do consórcio reduz a base de IRPJ+CSLL — criando uma economia fiscal que o financiamento não tem.",
    perfilIdeal: {
      titulo: "Cliente Ideal — O Empresário",
      items: [
        "Pessoa jurídica em Lucro Presumido ou Real (regime tributário definido)",
        "Médico, dentista, advogado, arquiteto com consultório/escritório próprio",
        "Empresário que precisa de imóvel comercial, galpão ou expansão de unidade",
        "Empresa com faturamento acima de R$500k/ano — parcela do consórcio é dedutível",
        "Dono de negócio que já paga financiamento PJ e quer comparar",
        "Profissional indicado por contador que busca eficiência fiscal",
      ],
    },
    momentoIdeal: [
      "Reunião com empresário ou profissional liberal que precisa de imóvel para o negócio",
      "Quando o cliente menciona o contador ou questões fiscais — é a abertura para o argumento",
      "Parceria com contadores: eles indicam clientes, você apresenta a solução com números",
      "Clientes PF que já fecharam consórcio e têm CNPJ — apresente como segunda operação",
    ],
    passos: [
      { numero: 1, acao: "Confirme o regime tributário antes de tudo", detalhe: "'Sua empresa é Lucro Presumido ou Real?' — isso define a alíquota efetiva. Se não souber, diga que é fácil verificar com o contador e avance com Presumido como padrão." },
      { numero: 2, acao: "Insira as alíquotas de IRPJ + CSLL", detalhe: "Presumido: IRPJ 15% (+ 10% adicional sobre excesso), CSLL 9% = até 34% efetivo. Use 24% como base conservadora para serviços." },
      { numero: 3, acao: "Mostre a parcela bruta vs. parcela líquida", detalhe: "'A parcela bruta é R$X. Mas como é dedutível, o custo real para sua empresa é R$Y.' O delta em 10 anos é a economia fiscal total." },
      { numero: 4, acao: "Compare com financiamento PJ", detalhe: "Financiamento PJ tem juros altos (1%–1,5% a.m.) e não gera dedução fiscal adicional além dos juros. O consórcio vence em custo total." },
      { numero: 5, acao: "Sugira validação com o contador", detalhe: "'Leve esse PDF para o seu contador — ele vai confirmar os números.' Isso aumenta a credibilidade e remove a objeção fiscal." },
    ],
    argumentos: [
      {
        numero: 1,
        frase: "\"A parcela do consórcio é despesa operacional dedutível. Sua empresa paga R$X, mas o custo real é R$Y — a diferença vai para o seu resultado, não para o governo.\"",
        contexto: "Argumento central. Use com empresários em Lucro Real — a economia é imediata e mensurável.",
      },
      {
        numero: 2,
        frase: "\"No financiamento bancário PJ, você paga R$X de juros ao longo do prazo. No consórcio, mesmo sem dedução, já pagaria R$Y a menos. Com o benefício fiscal, a diferença chega a R$Z.\"",
        contexto: "Argumento de custo total. Combine os dois benefícios: sem juros + dedução fiscal.",
      },
      {
        numero: 3,
        frase: "\"Leve isso para o seu contador — ele vai confirmar que a parcela do consórcio PJ é dedutível como despesa operacional do IRPJ e da CSLL.\"",
        contexto: "Dispa a objeção fiscal proativamente. Quem sugere o contador primeiro ganha credibilidade.",
      },
      {
        numero: 4,
        frase: "\"Para o seu imóvel comercial de R$X, a diferença entre financiar e fazer consórcio PJ é R$Y no custo total — é o equivalente a um salário de R$Z por mês voltando para o caixa.\"",
        contexto: "Traduz o benefício para a linguagem do empresário: 'caixa disponível por mês'.",
      },
    ],
    formulas: [
      {
        label: "Parcela Líquida (Custo Real PJ)",
        expressao: "Parcela_líquida = Parcela_bruta × (1 − alíquota_IRPJ% − alíquota_CSLL%)",
        descricao: "A parcela bruta do consórcio, multiplicada pelo complemento da alíquota efetiva, resulta no custo real para a empresa após o benefício fiscal.",
      },
      {
        label: "Economia Fiscal Total",
        expressao: "Eco_fiscal = Σ (Parcela_bruta_mês × alíquota_efetiva)",
        descricao: "Soma de todas as economias mensais ao longo do prazo. Inclui pré e pós-contemplação (parcelas diferentes).",
      },
      {
        label: "Parcela Price (Financiamento PJ)",
        expressao: "Parcela_fin = PV × [i × (1+i)^n] / [(1+i)^n − 1]",
        descricao: "Sistema PRICE para calcular a parcela fixa do financiamento PJ. Taxa mensal de 1%–1,5% é comum em crédito imobiliário PJ.",
      },
      {
        label: "Economia Total vs. Financiamento",
        expressao: "Eco_total = Total_financiamento − Custo_líquido_consórcio",
        descricao: "Diferença entre o total pago no financiamento PJ e o custo líquido real do consórcio (após benefício fiscal). É o número de fechamento.",
      },
    ],
    objecoes: [
      {
        objecao: "\"Meu contador vai recusar — não sei se é dedutível.\"",
        resposta: "\"A dedutibilidade de parcelas de consórcio PJ como despesa operacional está prevista na legislação tributária. Leve o PDF deste simulador para o contador — ele confirma. Já atendi outros clientes em Lucro Presumido que validaram isso.\"",
      },
      {
        objecao: "\"Prefiro financiamento — é mais simples.\"",
        resposta: "\"Mais simples em processo, sim. Mas R$X mais caro no total. Olha a diferença neste gráfico — é o equivalente a [Y meses de aluguel / Z salários]. A 'simplicidade' do financiamento tem um preço exato.\"",
      },
      {
        objecao: "\"E se a empresa precisar usar o dinheiro antes da contemplação?\"",
        resposta: "\"O consórcio pode ser transferido ou a cota vendida no mercado secundário. Mas o mais comum é que empresas usem esse imóvel como ativo de longo prazo — e o consórcio tem o custo mais baixo para essa finalidade.\"",
      },
    ],
    bulletsPro: [
      "Parceria com contadores é o canal mais eficiente: um contador com 50 clientes PJ é um pipeline enorme.",
      "Leve o PDF do simulador nas reuniões com empresários — 'mostre para o seu contador' é uma frase de fechamento, não de espera.",
      "Médicos e dentistas são os mais receptivos: renda alta, escritório físico, histórico de aquisição de equipamentos via consórcio.",
      "Combine com o Simulador de Meta Patrimonial para propor múltiplas cotas PJ — ticket médio pode chegar a R$2M–R$5M em cartas.",
      "Nunca dê conselho tributário — sempre direcione ao contador. Sua posição é mostrar os números; a validação é do profissional contábil.",
      "A alíquota efetiva de 24% é conservadora. Em Lucro Real com adicional de IRPJ (10%), a alíquota efetiva pode chegar a 34% — o benefício dobra.",
    ],
    alerta: "Este simulador apresenta uma estimativa do benefício fiscal com base nas alíquotas informadas. A dedutibilidade real depende do regime tributário, das atividades da empresa e da interpretação do contador. Sempre oriente o cliente a validar com seu profissional contábil antes de tomar decisões.",
  },
};

// ─── Componentes de UI ────────────────────────────────────────────────────────
function SectionBlock({ icon: Icon, title, children, accent }: {
  icon: React.ElementType; title: string; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${accent ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-foreground/80">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Bullet({ children, variant = "check" }: { children: React.ReactNode; variant?: "check" | "warning" | "arrow" }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {variant === "check" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
      {variant === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />}
      {variant === "arrow" && <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
      <span className="text-foreground/80 leading-relaxed">{children}</span>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function EstrategiaPage() {
  const { slug } = Route.useParams();
  const data = ESTRATEGIAS[slug];

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-bold">Manual não encontrado</h1>
        <p className="text-sm text-muted-foreground">O simulador "{slug}" não possui manual estratégico cadastrado.</p>
        <Link to="/simuladores" className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">
          Voltar aos Simuladores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Back + Breadcrumb ────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/simuladores" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Simuladores
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{data.title}</span>
        <span>/</span>
        <span className="text-foreground font-medium">Estratégia de Uso</span>
      </nav>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{data.icon}</span>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-primary mb-1">
              <BookOpen className="h-3 w-3" /> Manual Estratégico
            </div>
            <h1 className="text-2xl font-extrabold sm:text-3xl leading-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground">{data.subtitle}</p>
          </div>
        </div>
      </header>

      {/* ── Quick Summary (destaque) ─────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-5 sm:p-6">
        <p className="text-sm sm:text-base font-semibold text-primary leading-relaxed">{data.quickSummary}</p>
      </div>

      {/* ── Grid: Objetivo + Perfil ──────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Objetivo */}
        <SectionBlock icon={Target} title="Objetivo">
          <p className="text-sm text-foreground/80 leading-relaxed">{data.objetivo}</p>
        </SectionBlock>

        {/* Perfil Ideal */}
        <SectionBlock icon={Users} title={data.perfilIdeal.titulo}>
          <ul className="space-y-2">
            {data.perfilIdeal.items.map((item, i) => (
              <Bullet key={i} variant="arrow">{item}</Bullet>
            ))}
          </ul>
        </SectionBlock>
      </div>

      {/* ── Momento Ideal ────────────────────────────────────────────── */}
      <SectionBlock icon={Clock} title="Quando Usar Este Simulador">
        <ul className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 sm:space-y-0">
          {data.momentoIdeal.map((m, i) => (
            <Bullet key={i} variant="check">{m}</Bullet>
          ))}
        </ul>
      </SectionBlock>

      {/* ── Passo a Passo ────────────────────────────────────────────── */}
      <SectionBlock icon={Lightbulb} title="Como Conduzir a Reunião — Passo a Passo">
        <ol className="space-y-3">
          {data.passos.map((p) => (
            <li key={p.numero} className="flex gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
                {p.numero}
              </div>
              <div className="flex-1 pt-0.5">
                <span className="text-sm font-bold text-foreground">{p.acao}</span>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{p.detalhe}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionBlock>

      {/* ── Argumentos de Venda ──────────────────────────────────────── */}
      <SectionBlock icon={MessageSquareQuote} title="Argumentos Prontos para Usar com o Cliente">
        <div className="space-y-3">
          {data.argumentos.map((arg) => (
            <div key={arg.numero} className="rounded-xl border border-primary/15 bg-primary/4 p-4">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground">
                  {arg.numero}
                </span>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-foreground italic">
                    {arg.frase}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    💡 {arg.contexto}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* ── Fórmulas e Regras ────────────────────────────────────────── */}
      <SectionBlock icon={Calculator} title="Fórmulas e Regras — O que o Simulador Calcula">
        <div className="space-y-3">
          {data.formulas.map((f) => (
            <div key={f.label} className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wider text-primary mb-1.5">{f.label}</div>
              <div className="mb-1.5 rounded-lg bg-background border border-border px-3 py-2 font-mono text-xs font-bold text-foreground">
                {f.expressao}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.descricao}</p>
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* ── Objeções ─────────────────────────────────────────────────── */}
      <SectionBlock icon={ShieldCheck} title="Objeções que Este Simulador Destrói">
        <div className="space-y-3">
          {data.objecoes.map((obj, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-start gap-2.5 bg-danger/5 border-b border-border px-4 py-3">
                <span className="mt-0.5 text-sm">❌</span>
                <p className="text-sm font-semibold text-danger">{obj.objecao}</p>
              </div>
              <div className="flex items-start gap-2.5 px-4 py-3">
                <span className="mt-0.5 text-sm">✅</span>
                <p className="text-sm text-foreground/80 leading-relaxed">{obj.resposta}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* ── Bullets Estratégicos ─────────────────────────────────────── */}
      <SectionBlock icon={Lightbulb} title="Vantagens Competitivas — O que Poucos Vendedores Fazem" accent>
        <ul className="space-y-2.5">
          {data.bulletsPro.map((b, i) => (
            <Bullet key={i} variant="check">{b}</Bullet>
          ))}
        </ul>
      </SectionBlock>

      {/* ── Alerta (opcional) ─────────────────────────────────────────── */}
      {data.alerta && (
        <div className="rounded-2xl border border-warning/40 bg-warning/8 p-4 sm:p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-foreground mt-0.5" />
          <p className="text-sm text-warning-foreground leading-relaxed">
            <strong>Atenção: </strong>{data.alerta}
          </p>
        </div>
      )}

      {/* ── CTA Final ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="font-extrabold text-primary text-base">Pronto para simular?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Use este manual durante a reunião e o simulador para mostrar os números ao cliente.
          </p>
        </div>
        <Link
          to={data.route}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          Abrir {data.title}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* ── Navegação entre manuais ──────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-3">Outros Manuais Estratégicos</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ESTRATEGIAS)
            .filter(([k]) => k !== slug)
            .map(([k, d]) => (
              <Link
                key={k}
                to="/simuladores/estrategia/$slug"
                params={{ slug: k }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:border-primary/30 transition-colors"
              >
                {d.icon} {d.title}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
