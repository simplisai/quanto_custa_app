import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { isAuthenticated, loading, signOut, user, isAdmin } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) nav({ to: "/login" });
  }, [loading, isAuthenticated, nav]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const link = (to: string, label: string) => {
    const active = loc.pathname === to;
    return (
      <Link
        to={to}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar p-4 md:flex">
        <div className="px-2 pb-6 pt-2">
          <div className="text-sm font-extrabold text-sidebar-foreground">Quanto custa?</div>
          <div className="text-xs text-sidebar-foreground/60">Imobiliário</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {link("/app", "Calculadora")}
          {link("/historico", "Histórico")}
          {isAdmin && link("/admin", "Administração")}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <div className="px-2 pb-2 text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
          <button
            onClick={() => signOut().then(() => nav({ to: "/" }))}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Sair
          </button>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="text-sm font-extrabold">Quanto custa?</div>
        <div className="flex gap-2 text-xs">
          <Link to="/app" className="rounded bg-accent px-2 py-1 font-semibold">
            Calc
          </Link>
          <Link to="/historico" className="rounded bg-accent px-2 py-1 font-semibold">
            Histórico
          </Link>
          {isAdmin && (
            <Link to="/admin" className="rounded bg-accent px-2 py-1 font-semibold">
              Admin
            </Link>
          )}
          <button
            onClick={() => signOut().then(() => nav({ to: "/" }))}
            className="rounded bg-accent px-2 py-1 font-semibold"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
