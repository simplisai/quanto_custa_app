import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FlaskConical } from "lucide-react";
import { OPERATIONS, type Operation } from "@/lib/operations";

export const Route = createFileRoute("/_authenticated/simuladores")({
  component: SimuladoresPage,
});

// Simuladores planejados (em breve) — adicione aqui conforme evolução do produto
interface ComingSoon {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

const COMING_SOON: ComingSoon[] = [
  {
    slug: "fluxo-caixa",
    name: "Fluxo de Caixa",
    description: "Projete receitas e despesas mensais para avaliar a viabilidade financeira de um imóvel para renda.",
    icon: "💵",
    category: "Imobiliário",
  },
  {
    slug: "roi-locacao",
    name: "ROI de Locação",
    description: "Calcule o retorno sobre investimento de imóveis para aluguel comparando com outras aplicações.",
    icon: "📈",
    category: "Imobiliário",
  },
];

function SimuladoresPage() {
  const activeOps = OPERATIONS.filter((o) => o.isActive);

  // Todas as categorias únicas, mantendo ordem de aparição
  const categories = [...new Set([
    ...activeOps.map((o) => o.category),
    ...COMING_SOON.map((o) => o.category),
  ])];

  return (
    <div className="space-y-10">
      {/* ── Header ───────────────────────────────────────────── */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Simuladores</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-lg">
          Ferramentas de inteligência patrimonial para comparar, projetar e decidir com dados.
          Escolha o simulador ideal para o seu cenário.
        </p>
      </header>

      {/* ── Categorias ───────────────────────────────────────── */}
      {categories.map((category) => {
        const active: Operation[] = activeOps.filter((o) => o.category === category);
        const soon: ComingSoon[] = COMING_SOON.filter((o) => o.category === category);

        return (
          <section key={category} className="space-y-4">
            {/* Cabeçalho de categoria */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                {category}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Simuladores ativos */}
              {active.map((op) => (
                <Link
                  key={op.slug}
                  to={op.route}
                  className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                >
                  {/* Badge disponível */}
                  <span className="absolute top-4 right-4 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                    Disponível
                  </span>

                  {/* Ícone + título + descrição */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                      {op.icon}
                    </div>
                    <div>
                      <h2 className="pr-16 text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
                        {op.name}
                      </h2>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        {op.description}
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-primary">
                    Abrir simulador
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}

              {/* Em breve */}
              {soon.map((op) => (
                <div
                  key={op.slug}
                  className="relative flex flex-col gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-6 opacity-60 cursor-not-allowed select-none"
                >
                  <span className="absolute top-4 right-4 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Em breve
                  </span>

                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                      {op.icon}
                    </div>
                    <div>
                      <h2 className="pr-16 text-base font-bold leading-tight text-foreground">
                        {op.name}
                      </h2>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        {op.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Em desenvolvimento
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
