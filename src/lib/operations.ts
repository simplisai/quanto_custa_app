// Catálogo central de operações do SaaS
export interface Operation {
  slug: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  isActive: boolean;
  category: string;
}

export const OPERATIONS: Operation[] = [
  {
    slug: "calculadora-patrimonial",
    name: "Calculadora Patrimonial",
    description: "Compare financiamento bancário (SAC/PRICE) e consórcio imobiliário com simulações completas mês a mês, custo total e evolução patrimonial.",
    icon: "🏠",
    route: "/app",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "simulador-lance",
    name: "Simulador de Lance",
    description: "Descubra quanto de lance ofertar para ser contemplado no mês-alvo e quanto economiza em relação à contemplação aleatória.",
    icon: "🎯",
    route: "/simuladores/lance",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "aluguel-vs-consorcio",
    name: "Aluguel vs Consórcio",
    description: "Mostre ao cliente quanto dinheiro está sendo 'jogado fora' no aluguel e o patrimônio que o consórcio pode gerar no mesmo período.",
    icon: "⚖️",
    route: "/simuladores/aluguel-vs-consorcio",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "renda-passiva-consorcio",
    name: "Renda Passiva com Consórcio",
    description: "Simule o consórcio como investimento: o aluguel paga a parcela, o imóvel se valoriza e gera ROI superior ao CDB.",
    icon: "💰",
    route: "/simuladores/renda-passiva",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "flip-cota",
    name: "Alavancagem / Flip de Cota",
    description: "Calcule a rentabilidade de comprar uma cota, ser contemplado com lance e vender com ágio. Mostre o ROI e TIR mensal da operação.",
    icon: "📈",
    route: "/simuladores/flip-cota",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "saida-financiamento",
    name: "Saída do Financiamento",
    description: "Mostre ao cliente preso num financiamento bancário quanto economiza migrando para o consórcio — com o capital da própria venda do imóvel.",
    icon: "🔓",
    route: "/simuladores/saida-financiamento",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "meta-patrimonial",
    name: "Meta Patrimonial",
    description: "Calculadora reversa: dado o patrimônio-alvo ou renda passiva desejada, mostra quantas cotas e qual plano montar.",
    icon: "🏆",
    route: "/simuladores/meta-patrimonial",
    isActive: true,
    category: "Consórcio",
  },
  {
    slug: "consorcio-cnpj",
    name: "Consórcio para CNPJ",
    description: "Demonstre o benefício fiscal do consórcio empresarial — parcelas dedutíveis reduzem o custo real da operação vs. financiamento PJ.",
    icon: "🏢",
    route: "/simuladores/consorcio-cnpj",
    isActive: true,
    category: "Consórcio",
  },
];

export function getOperation(slug: string): Operation | undefined {
  return OPERATIONS.find((o) => o.slug === slug);
}
