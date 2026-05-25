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
    category: "Imobiliário",
  },
];

export function getOperation(slug: string): Operation | undefined {
  return OPERATIONS.find((o) => o.slug === slug);
}
