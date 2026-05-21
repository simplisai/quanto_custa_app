import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-bold text-gradient-brand">Quanto custa? <span className="text-foreground">Imobiliário</span></div>
          <nav className="flex gap-3 text-sm">
            {isAuthenticated ? (
              <Link to="/app" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90">Abrir app</Link>
            ) : (
              <>
                <Link to="/login" className="rounded-md px-4 py-2 font-medium text-foreground hover:bg-accent">Entrar</Link>
                <Link to="/signup" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90">Criar conta</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <span className="inline-block rounded-full bg-accent px-4 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground">Sistema de Inteligência Patrimonial</span>
        <h1 className="mt-6 text-5xl font-extrabold leading-tight md:text-6xl">
          Compare <span className="text-gradient-brand">financiamento e consórcio</span><br />com clareza profissional.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Simule SAC, PRICE e estratégias alavancadas com consórcio. Gere relatórios em PDF, salve o histórico e tome decisões patrimoniais com dados.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link to={isAuthenticated ? "/app" : "/signup"} className="rounded-xl bg-gradient-brand px-8 py-4 text-base font-bold text-primary-foreground shadow-elegant hover:opacity-95">
            {isAuthenticated ? "Abrir calculadora" : "Começar grátis"}
          </Link>
          {!isAuthenticated && <Link to="/login" className="rounded-xl border border-border px-8 py-4 text-base font-semibold hover:bg-accent">Já tenho conta</Link>}
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { t: "Cálculos precisos", d: "SAC, PRICE e consórcio com TR, INCC, lance embutido e amortização." },
            { t: "Relatório em PDF", d: "Documento profissional para apresentar ao cliente." },
            { t: "Histórico salvo", d: "Reabra simulações antigas com 1 clique." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
              <div className="text-base font-bold">{f.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Quanto custa? Imobiliário
      </footer>
    </div>
  );
}
