import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, FlaskConical } from "lucide-react";
import { OPERATIONS, type Operation } from "@/lib/operations";

export const Route = createFileRoute("/_authenticated/simuladores")({
  component: SimuladoresPage,
});

interface ComingSoon {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

const COMING_SOON: ComingSoon[] = [];

function SimuladoresPage() {
  const activeOps = OPERATIONS.filter((o) => o.isActive);

  return (
    <div className="space-y-10">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Simuladores</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-lg">
          Ferramentas de inteligência patrimonial para comparar, projetar e decidir com dados.
          Cada simulador inclui um <strong>manual estratégico</strong> com argumentos de venda prontos.
        </p>
      </header>

      {/* ── Simuladores ──────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Simuladores ativos */}
        {activeOps.map((op) => (
          <ActiveCard key={op.slug} op={op} />
        ))}

        {/* Em breve */}
        {COMING_SOON.map((op) => (
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
    </div>
  );
}

function ActiveCard({ op }: { op: Operation }) {
  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
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
          <h2 className="pr-16 text-base font-bold leading-tight text-foreground">
            {op.name}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {op.description}
          </p>
        </div>
      </div>

      {/* ── Dois botões ──────────────────────────────────────────── */}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Link
          to={op.route}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
        >
          Abrir
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          to="/simuladores/estrategia/$slug"
          params={{ slug: op.slug }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-extrabold text-foreground transition-colors hover:bg-accent hover:border-primary/30 active:scale-[0.97]"
        >
          <BookOpen className="h-3 w-3" />
          Estratégia
        </Link>
      </div>
    </div>
  );
}
