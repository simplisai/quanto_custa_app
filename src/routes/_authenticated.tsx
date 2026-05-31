import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Home, Calculator, History, Users, BookCopy, CreditCard,
  LifeBuoy, Radio, LogOut, ChevronRight, ArrowLeft, Menu, X,
  ShieldAlert, Wallet, PanelLeftClose, PanelLeftOpen,
  LayoutDashboard, Gift, ClipboardList,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { readReferralCode, clearReferralCode } from "@/routes/$referralCode";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

// ─────────────────────────────────────────────────────────────────────────────
// Navigation definitions
// ─────────────────────────────────────────────────────────────────────────────

const USER_NAV = [
  { to: "/dashboard",   label: "Início",          icon: Home        },
  { to: "/simuladores", label: "Simuladores",     icon: Calculator  },
  { to: "/historico",   label: "Histórico",       icon: History     },
  { to: "/clientes",    label: "Clientes",        icon: Users       },
  { to: "/templates",   label: "Templates",       icon: BookCopy    },
  { to: "/indicar",     label: "Indicar & Ganhar", icon: Gift            },
  { to: "/formularios", label: "Formulários",     icon: ClipboardList  },
  { to: "/assinatura",  label: "Assinatura",      icon: CreditCard      },
  { to: "/suporte",     label: "Suporte",         icon: LifeBuoy    },
] as const;

const ADMIN_NAV_SECTIONS = [
  {
    section: "Operações",
    items: [
      { to: "/admin",             label: "Dashboard",   icon: LayoutDashboard },
      { to: "/admin/usuarios",    label: "Usuários",    icon: Users           },
      { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard      },
    ],
  },
  {
    section: "Financeiro",
    items: [
      { to: "/admin/financeiro",  label: "Financeiro",  icon: Wallet          },
    ],
  },
  {
    section: "Monitoramento",
    items: [
      { to: "/admin/suporte",     label: "Suporte",     icon: LifeBuoy        },
      { to: "/admin/webhooks",    label: "Webhooks",    icon: Radio           },
    ],
  },
  {
    section: "Produto",
    items: [
      { to: "/admin/simuladores", label: "Simuladores", icon: Calculator      },
    ],
  },
] as const;

// Rotas de simuladores — marcam "Simuladores" como ativo no sidebar
const SIMULATOR_ROUTES = [
  "/app",
  "/simuladores/lance",
  "/simuladores/aluguel-vs-consorcio",
  "/simuladores/renda-passiva",
  "/simuladores/flip-cota",
  "/simuladores/saida-financiamento",
  "/simuladores/meta-patrimonial",
  "/simuladores/consorcio-cnpj",
];

// Bottom nav bar items (mobile only — 5 primary destinations)
const BOTTOM_NAV = [
  { to: "/dashboard",   label: "Início",     icon: Home       },
  { to: "/simuladores", label: "Simular",    icon: Calculator },
  { to: "/historico",   label: "Histórico",  icon: History    },
  { to: "/clientes",    label: "Clientes",   icon: Users      },
  { to: "/assinatura",  label: "Conta",      icon: CreditCard },
] as const;

const SIDEBAR_KEY = "sidebar_collapsed";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isActive(pathname: string, to: string): boolean {
  if (pathname === to) return true;
  if (to === "/admin") return pathname === "/admin" || pathname === "/admin/";
  if (to === "/dashboard") return pathname === "/dashboard";
  if (to === "/simuladores")
    return SIMULATOR_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  return pathname.startsWith(to + "/");
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
}
function writeCollapsed(v: boolean) {
  try { localStorage.setItem(SIDEBAR_KEY, String(v)); } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// UserNavLink
// ─────────────────────────────────────────────────────────────────────────────

function UserNavLink({
  to, label, icon: Icon, pathname, onClick, collapsed, hasWarning,
}: {
  to: string; label: string; icon: React.ElementType;
  pathname: string; onClick?: () => void; collapsed?: boolean;
  hasWarning?: boolean;
}) {
  const active = isActive(pathname, to);
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={[
        "group flex items-center rounded-xl text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/60 hover:bg-accent/60 hover:text-foreground",
      ].join(" ")}
    >
      <span className="relative shrink-0">
        <Icon
          className={[
            "h-4 w-4 transition-opacity",
            active ? "opacity-100" : "opacity-50 group-hover:opacity-80",
          ].join(" ")}
        />
        {hasWarning && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-1 ring-background" />
        )}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && hasWarning && (
        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-destructive" />
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminNavLink
// ─────────────────────────────────────────────────────────────────────────────

function AdminNavLink({
  to, label, icon: Icon, pathname, onClick, collapsed,
}: {
  to: string; label: string; icon: React.ElementType;
  pathname: string; onClick?: () => void; collapsed?: boolean;
}) {
  const active = isActive(pathname, to);
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={[
        "flex items-center rounded-lg text-sm transition-all duration-150",
        collapsed ? "justify-center p-2.5 border-0" : "gap-3 px-3 py-2.5 border-l-2",
        active
          ? collapsed
            ? "bg-white/10 text-white"
            : "border-primary bg-white/8 text-white font-semibold"
          : collapsed
          ? "text-white/40 hover:bg-white/6 hover:text-white/80"
          : "border-transparent text-white/40 hover:bg-white/6 hover:text-white/80 hover:border-white/20",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function UserSidebar({
  pathname, email, isAdmin, onSignOut, onClose, collapsed, onToggle,
  subscriptionNeedsAttention,
}: {
  pathname: string; email?: string; isAdmin: boolean;
  onSignOut: () => void; onClose?: () => void;
  collapsed?: boolean; onToggle?: () => void;
  subscriptionNeedsAttention?: boolean;
}) {
  // collapsed is only meaningful on desktop (mobile drawer is always full-width)
  const isCollapsed = !!collapsed && !onClose;

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">

      {/* ── Brand + toggle (desktop) / Brand + close (mobile) ── */}
      <div
        className={[
          "flex shrink-0 pt-5 pb-4",
          isCollapsed
            ? "flex-col items-center gap-2 px-2"
            : "flex-row items-center justify-between px-5",
        ].join(" ")}
      >
        <Logo size={isCollapsed ? "sm" : "md"} collapsed={isCollapsed} />

        {/* Desktop toggle — in the header so it's clearly separate from sign-out */}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {isCollapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </button>
        )}

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav
        className={[
          "flex-1 overflow-y-auto space-y-0.5",
          isCollapsed ? "px-2" : "px-3",
        ].join(" ")}
      >
        {USER_NAV.map((item) => (
          <UserNavLink
            key={item.to}
            {...item}
            pathname={pathname}
            onClick={onClose}
            collapsed={isCollapsed}
            hasWarning={item.to === "/assinatura" && subscriptionNeedsAttention}
          />
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      {isCollapsed ? (
        /* Collapsed desktop: only show admin CTA icon — no sign-out to avoid confusion */
        isAdmin ? (
          <div className="mt-3 shrink-0 border-t border-border px-2 pt-3 pb-5">
            <Link
              to="/admin"
              title="Painel Admin"
              className="flex items-center justify-center rounded-xl p-2.5 bg-primary/10 hover:bg-primary/16 border border-primary/20 text-primary transition-all"
            >
              <ShieldAlert className="h-4 w-4" />
            </Link>
          </div>
        ) : null
      ) : (
        /* Expanded (desktop or mobile drawer): full footer */
        <div className="mt-3 shrink-0 border-t border-border pt-3 pb-5 px-3 space-y-1">
          {/* Admin CTA */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-primary/10 hover:bg-primary/16 border border-primary/20 hover:border-primary/35 text-sm font-semibold text-primary transition-all"
            >
              <span className="flex items-center gap-2.5">
                <ShieldAlert className="h-4 w-4" />
                Painel Admin
              </span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </Link>
          )}

          {/* Email + sign out */}
          <div className="flex items-center justify-between px-3 py-2">
            <p className="truncate text-xs text-muted-foreground" style={{ maxWidth: 130 }}>{email}</p>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Sidebar
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_BG = "oklch(0.12 0.025 260)";
const ADMIN_GREEN = "oklch(0.65 0.12 150)";

function AdminSidebar({
  pathname, email, onSignOut, onClose, collapsed, onToggle,
}: {
  pathname: string; email?: string;
  onSignOut: () => void; onClose?: () => void;
  collapsed?: boolean; onToggle?: () => void;
}) {
  const isCollapsed = !!collapsed && !onClose;

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: ADMIN_BG, color: "white" }}
    >
      {/* ── Brand + toggle (desktop) / Brand + close (mobile) ── */}
      <div
        className={[
          "flex shrink-0 pt-6 pb-4",
          isCollapsed
            ? "flex-col items-center gap-2 px-2"
            : "flex-row items-center justify-between px-5",
        ].join(" ")}
      >
        {/* Shield icon / branding */}
        <div className={["flex items-center", isCollapsed ? "" : "gap-3"].join(" ")}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "oklch(0.24 0.05 150 / 0.25)",
              border: "1px solid oklch(0.24 0.05 150 / 0.4)",
            }}
            title={isCollapsed ? "Painel Admin" : undefined}
          >
            <ShieldAlert className="h-4 w-4" style={{ color: ADMIN_GREEN }} />
          </div>
          {!isCollapsed && (
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: ADMIN_GREEN }}
              >
                Painel Admin
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Central de operações
              </p>
            </div>
          )}
        </div>

        {/* Desktop toggle — in the header */}
        {onToggle && (
          <button
            onClick={onToggle}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.3)";
              e.currentTarget.style.background = "";
            }}
          >
            {isCollapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />
            }
          </button>
        )}

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5"
            style={{ color: "rgba(255,255,255,0.3)" }}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Voltar ao app ─────────────────────────────────────── */}
      <div className={["pb-3 shrink-0", isCollapsed ? "px-2" : "px-3"].join(" ")}>
        <Link
          to="/dashboard"
          onClick={onClose}
          title={isCollapsed ? "Voltar ao app" : undefined}
          className={[
            "flex items-center rounded-lg py-2 text-xs transition-colors",
            isCollapsed ? "justify-center px-2" : "gap-2 px-3",
          ].join(" ")}
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.35)";
            e.currentTarget.style.background = "";
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          {!isCollapsed && "Voltar ao app"}
        </Link>
      </div>

      <div className="mx-3 mb-1 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

      {/* ── Nav sections ──────────────────────────────────────── */}
      <nav
        className={[
          "flex flex-1 flex-col overflow-y-auto py-4",
          isCollapsed ? "gap-2 px-2" : "gap-5 px-3",
        ].join(" ")}
      >
        {ADMIN_NAV_SECTIONS.map((group) => (
          <div key={group.section}>
            {isCollapsed ? (
              <div className="mb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
            ) : (
              <p
                className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.25)" }}
              >
                {group.section}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <AdminNavLink
                  key={item.to}
                  {...item}
                  pathname={pathname}
                  onClick={onClose}
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      {/* When collapsed: no footer — sign-out is not shown to avoid confusion */}
      {!isCollapsed && (
        <div
          className="shrink-0 pb-5 pt-3 px-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p
            className="truncate px-3 py-1.5 text-[11px]"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.25)" }}
          >
            {email}
          </p>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.35)";
              e.currentTarget.style.background = "";
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Navigation (mobile only)
// ─────────────────────────────────────────────────────────────────────────────

function BottomNav({
  pathname,
  subscriptionNeedsAttention,
}: {
  pathname: string;
  subscriptionNeedsAttention: boolean;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Frosted glass backdrop */}
      <div className="border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="flex h-14">
          {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
            const active = isActive(pathname, to);
            const hasWarning = to === "/assinatura" && subscriptionNeedsAttention;
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 select-none",
                  "transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground/55",
                ].join(" ")}
              >
                {/* Active top indicator — iOS-style pill */}
                {active && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-primary" />
                )}

                {/* Icon with optional warning dot */}
                <span className="relative">
                  <Icon
                    className={[
                      "h-[22px] w-[22px] transition-transform duration-150",
                      active ? "scale-105" : "opacity-70",
                    ].join(" ")}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  {hasWarning && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive ring-1 ring-background" />
                  )}
                </span>

                {/* Label */}
                <span
                  className={[
                    "text-[10px] font-semibold leading-none tracking-tight",
                    active ? "text-primary" : "text-muted-foreground/55",
                  ].join(" ")}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root layout
// ─────────────────────────────────────────────────────────────────────────────

// Pages blocked users can still access
const BLOCKED_WHITELIST = ["/assinatura", "/assinar"];

function AuthLayout() {
  const { isAuthenticated, loading, signOut, user, isAdmin, isAccessBlocked, subscription } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Collapsed state — persisted, desktop only
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapsed = () =>
    setCollapsed((prev) => { const next = !prev; writeCollapsed(next); return next; });

  const isAdminArea = loc.pathname === "/admin" || loc.pathname.startsWith("/admin/");

  // Subscription has a problem (not blocked, but needs attention)
  const subscriptionNeedsAttention =
    !loading &&
    !!subscription &&
    !["trialing", "active"].includes(subscription.status);

  useEffect(() => {
    if (!loading && !isAuthenticated) nav({ to: "/login" });
  }, [loading, isAuthenticated, nav]);

  useEffect(() => {
    if (!loading && isAuthenticated && isAdminArea && !isAdmin)
      nav({ to: "/dashboard" });
  }, [loading, isAuthenticated, isAdminArea, isAdmin, nav]);

  // Subscription access guard: blocked users can only visit whitelisted pages
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (!isAccessBlocked) return;
    const whitelisted = BLOCKED_WHITELIST.some(
      (p) => loc.pathname === p || loc.pathname.startsWith(p + "/")
    );
    if (!whitelisted) nav({ to: "/assinatura" });
  }, [loading, isAuthenticated, isAccessBlocked, loc.pathname, nav]);

  // Atribuição de indicação (rede secundária, cobre OAuth e confirmação de e-mail):
  // se houver código no localStorage, vincula no servidor (idempotente) e limpa.
  useEffect(() => {
    if (loading || !isAuthenticated || !user?.id) return;
    const code = readReferralCode();
    if (!code) return;
    supabase
      .rpc("apply_referral", { p_referral_code: code, p_referred_user_id: user.id, p_source: "client" })
      .then(() => clearReferralCode())
      .catch(() => { /* idempotente — mantém o código para nova tentativa */ });
  }, [loading, isAuthenticated, user?.id]);

  // Fecha o drawer mobile ao navegar
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  if (isAdminArea && !isAdmin) return null;

  const handleSignOut = () => signOut().then(() => nav({ to: "/" }));

  // Desktop sidebar width
  const desktopW = collapsed ? "w-16" : "w-60";
  // Main content left padding (transitions suavemente)
  const mainPad = collapsed ? "md:pl-16" : "md:pl-60";

  // ── Sidebar content (desktop — com toggle) ─────────────────
  const desktopSidebar = isAdminArea ? (
    <AdminSidebar
      pathname={loc.pathname}
      email={user?.email}
      onSignOut={handleSignOut}
      collapsed={collapsed}
      onToggle={toggleCollapsed}
    />
  ) : (
    <UserSidebar
      pathname={loc.pathname}
      email={user?.email}
      isAdmin={isAdmin}
      onSignOut={handleSignOut}
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      subscriptionNeedsAttention={subscriptionNeedsAttention}
    />
  );

  // ── Sidebar content (mobile drawer — sempre expandido) ──────
  const mobileSidebar = isAdminArea ? (
    <AdminSidebar
      pathname={loc.pathname}
      email={user?.email}
      onSignOut={handleSignOut}
      onClose={() => setMobileOpen(false)}
    />
  ) : (
    <UserSidebar
      pathname={loc.pathname}
      email={user?.email}
      isAdmin={isAdmin}
      onSignOut={handleSignOut}
      onClose={() => setMobileOpen(false)}
      subscriptionNeedsAttention={subscriptionNeedsAttention}
    />
  );

  return (
    <div className="min-h-screen bg-background">

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-border",
          "transition-[width] duration-200 ease-in-out",
          "md:flex",
          desktopW,
        ].join(" ")}
      >
        {desktopSidebar}
      </aside>

      {/* ── Mobile: backdrop ──────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: drawer ────────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 overflow-hidden shadow-2xl",
          "transition-transform duration-200 ease-in-out",
          "md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {mobileSidebar}
      </aside>

      {/* ── Mobile: topbar ────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <Logo size="sm" />
          {isAdminArea && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: "oklch(0.24 0.05 150 / 0.12)", color: "oklch(0.35 0.1 150)" }}
            >
              Admin
            </span>
          )}
        </div>

        {/* Ação contextual no topo mobile */}
        {isAdmin ? (
          isAdminArea ? (
            <Link
              to="/dashboard"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
              title="Voltar ao app"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              to="/admin"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
              title="Painel admin"
            >
              <ShieldAlert className="h-4 w-4" />
            </Link>
          )
        ) : (
          <div className="w-9" />
        )}
      </header>

      {/* ── Main content ──────────────────────────────────────── */}
      {/* ÚNICA fonte de padding e max-width — páginas não adicionam padding próprio */}
      <main
        className={[
          "transition-[padding-left] duration-200 ease-in-out",
          mainPad,
          // Clearance for the bottom nav bar on mobile (non-admin only)
          !isAdminArea ? "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto w-full px-4 py-5 md:px-8 md:py-8",
            isAdminArea ? "max-w-[1280px]" : "max-w-[960px]",
          ].join(" ")}
        >
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom navigation ──────────────────────────── */}
      {!isAdminArea && (
        <BottomNav
          pathname={loc.pathname}
          subscriptionNeedsAttention={subscriptionNeedsAttention}
        />
      )}

    </div>
  );
}
