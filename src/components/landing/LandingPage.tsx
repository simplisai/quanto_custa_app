import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  ArrowRight, ArrowUpRight, Check, Minus, Plus, Menu, X,
  Scan, TrendingUp, BarChart2, Crown, Shield, Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/Logo";

/* ─── Chart color palette ──────────────────────────────────── */
const G = "#22c55e";
const G2 = "#86efac";
const R = "#ef4444";
const R2 = "#fca5a5";
const DARK = "#0d1c12";
const GRID = "#1a3326";
const TXT = "rgba(255,255,255,0.35)";

/* ─── Formatters ──────────────────────────────────────────── */
const fmtM = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`
    : `R$ ${(v / 1_000).toFixed(0)}k`;

const fmtK = (v: number) => `R$ ${(v / 1_000).toFixed(0)}k`;

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

/* ─── Animation helpers ───────────────────────────────────── */
function FadeIn({
  children,
  delay = 0,
  className = "",
  y = 28,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Recharts custom tooltip ─────────────────────────────── */
function ChartTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
      className="rounded-xl px-3 py-2 text-xs shadow-2xl"
    >
      {label && <p className="mb-1.5 font-mono text-white/40">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color || p.fill }}>
          {p.name}: {fmt ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── Dark chart panel wrapper ────────────────────────────── */
function ChartPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 sm:p-6 ${className}`}
      style={{ background: DARK }}
    >
      {children}
    </div>
  );
}

/* ─── Chart data ──────────────────────────────────────────── */
const heroBarData = [
  { name: "Banco", total: 1820000 },
  { name: "Consórcio", total: 580000 },
];

const aluguelData = [
  { ano: "Ano 1", aluguel: 45600, patrimonio: 4000 },
  { ano: "Ano 2", aluguel: 91200, patrimonio: 22000 },
  { ano: "Ano 3", aluguel: 136800, patrimonio: 68000 },
  { ano: "Ano 4", aluguel: 182400, patrimonio: 148000 },
  { ano: "Ano 5", aluguel: 228000, patrimonio: 268000 },
  { ano: "Ano 6", aluguel: 273600, patrimonio: 430000 },
  { ano: "Ano 7", aluguel: 319200, patrimonio: 640000 },
  { ano: "Ano 8", aluguel: 364800, patrimonio: 910000 },
  { ano: "Ano 9", aluguel: 410400, patrimonio: 1240000 },
  { ano: "Ano 10", aluguel: 456000, patrimonio: 1640000 },
];

const financData = [
  { name: "Banco", valor: 1465000 },
  { name: "Consórcio", valor: 575000 },
];

const flipData = [
  { mes: "M1", valor: -80000 },
  { mes: "M4", valor: -72000 },
  { mes: "M8", valor: -58000 },
  { mes: "M12", valor: -30000 },
  { mes: "M15", valor: 0 },
  { mes: "M18", valor: 150000 },
];

const rendaData = [
  { mes: "M12", fluxo: -5800 },
  { mes: "M24", fluxo: -4200 },
  { mes: "M36", fluxo: -2100 },
  { mes: "M48", fluxo: -300 },
  { mes: "M60", fluxo: 1800 },
  { mes: "M72", fluxo: 3800 },
  { mes: "M84", fluxo: 5900 },
  { mes: "M96", fluxo: 8200 },
];

/* ─── Hero marquee data ───────────────────────────────────── */
const STRATEGIES = [
  "SAC × PRICE × Consórcio",
  "Lance Embutido",
  "Flip de Cota",
  "Renda Passiva Infinita",
  "IRPJ + CSLL",
  "Break-even Financeiro",
  "TIR 3,8% a.m.",
  "Family Office PDF",
  "Resgate de Financiamento",
  "Consórcio PJ",
];

/* ─── Nav ─────────────────────────────────────────────────── */
const nav = [
  { label: "O Problema", href: "#problema" },
  { label: "O Motor", href: "#captacao" },
  { label: "7 Estratégias", href: "#arsenal" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

/* ─── Atoms ───────────────────────────────────────────────── */
function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span
      className={`eyebrow ${light ? "text-white/40" : ""}`}
    >
      {children}
    </span>
  );
}

function SectionShell({
  id,
  tone = "default",
  children,
}: {
  id?: string;
  tone?: "default" | "muted";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`border-b border-border/60 ${tone === "muted" ? "bg-secondary/40" : "bg-background"}`}
    >
      <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 sm:py-28 lg:py-36">{children}</div>
    </section>
  );
}

function BrandLogo({ white = false }: { white?: boolean }) {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <Logo size="md" white={white} />
    </a>
  );
}

/* ─── Header (Floating Pill) ──────────────────────────────── */
function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScrolled(window.scrollY > 0);
      }, 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Fixed header zone ───────────────────────────────── */}
      <div
        className="fixed inset-x-0 top-0 z-50"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* At-top: only centered logo */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              key="top-bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mx-auto flex h-16 max-w-[1280px] items-center justify-center px-5 sm:px-10"
            >
              <BrandLogo white />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrolled: pill floater */}
        <AnimatePresence>
          {scrolled && (
            <motion.div
              key="pill"
              initial={{ y: -72, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -72, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="flex justify-center px-4 pt-3"
            >
              <div
                className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-border/40 bg-background/75 px-4 py-2 backdrop-blur-xl sm:gap-6 sm:px-5 sm:py-2.5"
                style={{
                  boxShadow:
                    "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                {/* Logo */}
                <a href="#top" className="flex shrink-0 items-center">
                  <Logo size="sm" />
                </a>

                {/* Nav */}
                <nav className="hidden items-center gap-5 md:flex">
                  {nav.map((n) => (
                    <a
                      key={n.href}
                      href={n.href}
                      className="text-[12.5px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      {n.label}
                    </a>
                  ))}
                </nav>

                {/* Right */}
                <div className="flex shrink-0 items-center gap-2.5">
                  <Link
                    to={isAuthenticated ? "/app" : "/login"}
                    className="hidden text-[12.5px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
                  >
                    {isAuthenticated ? "Abrir App" : "Entrar"}
                  </Link>
                  <a
                    href={isAuthenticated ? "/app" : "#planos"}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12.5px] font-medium tracking-[-0.01em] text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
                  >
                    {isAuthenticated ? "App" : "Assinar"}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                  <button
                    onClick={() => setOpen(true)}
                    aria-label="Menu"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border/50 text-foreground md:hidden"
                  >
                    <Menu className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] md:hidden"
          >
            <motion.div
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: -16, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -16, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="absolute inset-x-3 top-3 rounded-3xl border border-border bg-background p-5 shadow-2xl"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
            >
              <div className="flex items-center justify-between">
                <BrandLogo white />
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-6 flex flex-col">
                {nav.map((n, i) => (
                  <motion.a
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 + 0.1 }}
                    className="flex items-center justify-between border-t border-border py-4 font-sans-display text-[22px] font-medium tracking-[-0.03em] text-foreground"
                  >
                    {n.label}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </motion.a>
                ))}
                <Link
                  to={isAuthenticated ? "/app" : "/login"}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-t border-border py-4 font-sans-display text-[22px] font-medium tracking-[-0.03em] text-foreground"
                >
                  {isAuthenticated ? "Abrir App" : "Entrar / Login"}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </nav>
              <a
                href={isAuthenticated ? "/app" : "#planos"}
                onClick={() => setOpen(false)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-[14px] font-medium tracking-[-0.01em] text-primary-foreground"
              >
                {isAuthenticated ? "Acessar Plataforma" : "Dominar minhas reuniões"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Hero Right Column: Intelligence Card + Marquee ────────── */
function HeroRightColumn() {
  return (
    <div className="space-y-4">
      {/* ── Card 1: Intelligence Analysis ───────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, delay: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl"
      >
        {/* Top-right glow orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)" }}
        />

        <div className="relative z-10">
          {/* ── Header row ── */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: "rgba(34,197,94,0.15)", boxShadow: "0 0 0 1px rgba(34,197,94,0.25)" }}
              >
                <BarChart2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                  Análise de Conversão
                </p>
                <p className="text-[13px] font-semibold leading-snug text-white/85">
                  Comparativo ao Vivo
                </p>
              </div>
            </div>
            {/* Live badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-green-400">
                Live
              </span>
            </div>
          </div>

          {/* ── Main metric ── */}
          <div className="mb-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/30">
              Economia Comprovada vs. Banco
            </p>
            <p
              className="mt-1 font-mono text-[30px] font-bold tabular-nums leading-none text-green-400"
              style={{ textShadow: "0 0 28px rgba(34,197,94,0.55)" }}
            >
              R$ 1.240.000
            </p>
            <p className="mt-1.5 font-mono text-[10px] text-white/25">
              por carta de R$ 500k · SAC/PRICE eliminado
            </p>
          </div>

          {/* ── Comparison bars ── */}
          <div className="mb-6 space-y-3.5">
            {/* Bank */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-red-400/70">
                  Banco (SAC/PRICE)
                </span>
                <span className="font-mono text-[11px] font-bold text-red-400">R$ 1.820.000</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.1, delay: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #dc2626, #ef4444, #f87171)" }}
                />
              </div>
            </div>
            {/* Ours */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-green-400/70">
                  Nossa Estratégia
                </span>
                <span className="font-mono text-[11px] font-bold text-green-400">R$ 580.000</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "32%" }}
                  transition={{ duration: 1.1, delay: 1.0, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #16a34a, #22c55e, #4ade80)" }}
                />
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="mb-5 h-px w-full bg-white/8" />

          {/* ── Mini stats grid ── */}
          <div className="mb-6 grid grid-cols-3 gap-0">
            {[
              { value: "7", label: "Estratégias" },
              { value: "PDF", label: "Family Office" },
              { value: "100%", label: "Auditável" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col items-center py-2 transition-transform hover:-translate-y-0.5 cursor-default ${
                  i === 1 ? "border-x border-white/8" : ""
                }`}
              >
                <span className="font-mono text-[17px] font-bold tabular-nums text-white">{s.value}</span>
                <span className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wider text-white/30">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Status pills ── */}
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <Zap className="h-3 w-3 text-green-400" />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
                Ativo
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <Crown className="h-3 w-3 text-amber-400" />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
                Premium
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <Shield className="h-3 w-3 text-sky-400" />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-white/55">
                Auditável
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Card 2: Strategy Marquee ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 py-5 backdrop-blur-xl"
      >
        <p className="mb-4 px-6 font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/30">
          7 Estratégias de Fechamento
        </p>
        <div
          className="relative flex overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
          }}
        >
          {/* Marquee track */}
          <div
            className="flex gap-3 whitespace-nowrap"
            style={{ animation: "hero-marquee 38s linear infinite" }}
          >
            {[...STRATEGIES, ...STRATEGIES, ...STRATEGIES].map((s, i) => (
              <div
                key={i}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/45 transition-all hover:border-white/20 hover:text-white/80"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "rgba(34,197,94,0.7)" }}
                />
                {s}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────── */
const heroStagger = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  },
  item: {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] } },
  },
};

function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #030d06 0%, #061410 35%, #040c07 65%, #020604 100%)" }}
    >
      {/* Marquee keyframe — scoped */}
      <style>{`
        @keyframes hero-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
      `}</style>

      {/* Grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* Atmospheric glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 65% 45%, rgba(34,197,94,0.14), transparent 70%), " +
            "radial-gradient(ellipse 45% 35% at 90% 80%, rgba(22,163,74,0.09), transparent 65%), " +
            "radial-gradient(ellipse 40% 30% at 10% 20%, rgba(74,222,128,0.06), transparent 60%)",
        }}
      />

      {/* Bottom fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(3,13,6,0.8))",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-16 pt-24 sm:px-10 sm:pt-28 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 lg:py-0">

        {/* ── Left: Copy ─────────────────────────────── */}
        <motion.div
          variants={heroStagger.container}
          initial="hidden"
          animate="show"
          className="flex flex-col justify-center space-y-7 lg:col-span-7 lg:pt-8"
        >
          {/* Eyebrow badge (styled like reference) */}
          <motion.div variants={heroStagger.item}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/65">
                Para estrategistas, corretores e consultores de elite.
              </span>
            </div>
          </motion.div>

          {/* H1 — gradient word treatment */}
          <motion.h1
            variants={heroStagger.item}
            className="font-sans-display text-[clamp(2rem,5.5vw,4.75rem)] font-medium leading-[0.91] tracking-[-0.05em] text-white"
          >
            A infraestrutura definitiva para{" "}
            <span
              className="font-display italic"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #d1fae5 40%, #4ade80 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              provar
            </span>
            {" "}— e não apenas prometer — que o seu consórcio esmaga o banco.
          </motion.h1>

          {/* Body */}
          <motion.p
            variants={heroStagger.item}
            className="max-w-[42ch] text-[15px] leading-[1.7] tracking-[-0.01em] text-white/50 sm:text-[17px]"
          >
            Pare de perder vendas high ticket por falta de clareza. Transforme objeções
            financeiras em contratos assinados usando{" "}
            <span className="text-white/80">
              inteligência visual que cria contraste irrefutável
            </span>{" "}
            na mente do seu cliente. Ter essa ferramenta não é um luxo — é uma{" "}
            <span className="font-medium text-white/90">vantagem competitiva desleal.</span>
          </motion.p>

          {/* CTAs — styled like reference (white primary) */}
          <motion.div
            variants={heroStagger.item}
            className="flex flex-col gap-4 sm:flex-row"
          >
            <Link
              to={isAuthenticated ? "/app" : "/checkout"}
              className="group inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-7 text-[14px] font-semibold tracking-[-0.01em] text-zinc-950 transition-all hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98] sm:h-auto sm:py-3.5"
            >
              Quero dominar minhas reuniões
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#arsenal"
              className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 bg-white/6 px-7 text-[14px] font-semibold tracking-[-0.01em] text-white backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/10 sm:h-auto sm:py-3.5"
            >
              Ver a infraestrutura em ação
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </motion.div>
        </motion.div>

        {/* ── Right: Cards ───────────────────────────── */}
        <div className="mt-12 lg:col-span-5 lg:mt-12">
          <HeroRightColumn />
        </div>
      </div>
    </section>
  );
}

/* ─── Transição (Amadorismo) ──────────────────────────────── */
function Transicao() {
  return (
    <SectionShell id="problema" tone="muted">
      <FadeIn>
        <div className="mb-4 flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Eyebrow>O Abismo</Eyebrow>
        </div>
        <h2 className="font-sans-display max-w-[22ch] text-[clamp(1.875rem,5.5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em] text-foreground">
          O abismo entre você e o gerente do banco não é o produto.{" "}
          <span className="font-display italic tracking-[-0.02em]">É a apresentação.</span>
        </h2>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div className="mt-10 grid gap-6 text-[17px] leading-[1.65] tracking-[-0.01em] text-muted-foreground lg:grid-cols-2 lg:gap-16">
          <p>
            Quando você senta com um médico ou empresário, ele já tem a simulação SAC/PRICE do banco
            na mão. O banco vende{" "}
            <span className="text-foreground font-medium">"segurança visual"</span>. Você tenta vender
            uma "cota" rabiscando lances no papel ou usando uma planilha de Excel que o cliente não
            entende e não confia.
          </p>
          <p className="font-display text-[22px] italic leading-[1.4] tracking-[-0.01em] text-foreground">
            Enquanto você tenta explicar que consórcio não tem juros, ele agradece e vai assinar com
            o banco. Você acabou de perder uma comissão de 5 dígitos porque não soube{" "}
            <span className="not-italic font-sans-display font-medium text-foreground/70">
              tangibilizar a riqueza.
            </span>
          </p>
        </div>
      </FadeIn>

      {/* Before/After visual */}
      <div className="mt-16 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <FadeIn delay={0.1}>
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-background h-full" style={{ minHeight: 280 }}>
            {/* Excel top bar */}
            <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/40 px-3 py-2">
              <span className="rounded-sm bg-green-700 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">X</span>
              <span className="font-mono text-[10px] text-muted-foreground/60 truncate">simulacao_consorcio_v3_FINAL.xlsx</span>
            </div>
            {/* Formula bar */}
            <div className="flex items-center gap-2 border-b border-border/40 bg-background px-3 py-1">
              <span className="font-mono text-[9px] text-muted-foreground/50 w-12 shrink-0">D12</span>
              <div className="h-px w-px bg-muted-foreground/30" />
              <span className="font-mono text-[9px] text-muted-foreground/50 truncate">=IF(B4&gt;0,C4/B4*TAXA_ADM,"#REF!")</span>
            </div>
            {/* Table */}
            <div className="overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[28px_1fr_1fr_1fr] border-b border-border/40 bg-muted/30">
                <div className="border-r border-border/30 px-1 py-1 font-mono text-[8px] text-muted-foreground/40 text-center" />
                {["A", "B", "C"].map(h => (
                  <div key={h} className="border-r border-border/30 px-1 py-1 text-center font-mono text-[9px] font-medium text-muted-foreground/60 bg-muted/50">{h}</div>
                ))}
              </div>
              {/* Rows */}
              {[
                ["1", "Crédito", "=B1*1.25", "#REF!"],
                ["2", "Taxa Adm", "0.18%", "#DIV/0!"],
                ["3", "INCC", "=ÍNDICE(", "##########"],
                ["4", "Lance", "=B2*C3", "ERRO!"],
                ["5", "Parcela", "R$0,00", "=IF(A4>"],
                ["6", "TOTAL", "=SUM(", "???"],
              ].map(([row, ...cells]) => (
                <div key={row} className="grid grid-cols-[28px_1fr_1fr_1fr] border-b border-border/20">
                  <div className="border-r border-border/30 bg-muted/20 px-1 py-1 text-center font-mono text-[8px] text-muted-foreground/40">{row}</div>
                  {cells.map((val, ci) => (
                    <div key={ci} className={`border-r border-border/20 px-1.5 py-1 font-mono text-[8px] truncate ${val.includes('#') || val.includes('ERRO') || val.includes('???') ? "text-red-500/70" : "text-muted-foreground/55"}`}>
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Error popup */}
            <div className="absolute bottom-3 left-3 right-3 rounded border-l-2 border-red-500 bg-red-950/80 px-3 py-2 shadow-xl backdrop-blur-sm">
              <p className="font-mono text-[10px] font-bold text-red-400">⛔ ERRO DE REFERÊNCIA</p>
              <p className="mt-0.5 font-mono text-[9px] text-red-400/70">O cliente não entendeu. Reunião encerrada.</p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <motion.div
            className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl p-6"
            style={{ background: "linear-gradient(145deg, #091a0e 0%, #0d1c12 60%, #071209 100%)" }}
          >
            {/* top label */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "#4ade80" }}>
                  Depois
                </span>
              </div>
              <span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                style={{ background: "rgba(34,197,94,0.1)", color: "rgba(134,239,172,0.7)", border: "1px solid rgba(34,197,94,0.2)" }}>
                Inteligência Patrimonial
              </span>
            </div>

            {/* main number */}
            <div className="my-4">
              <p className="mb-2 font-mono text-[11px]" style={{ color: "rgba(134,239,172,0.5)" }}>
                Patrimônio Líquido Acumulado
              </p>
              <motion.p
                initial={{ scale: 0.85, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", delay: 0.35, stiffness: 180, damping: 18 }}
                className="font-sans-display text-[clamp(2rem,6vw,3rem)] font-medium leading-none tracking-[-0.04em] drop-shadow-[0_0_18px_rgba(34,197,94,0.55)]"
                style={{
                  color: G,
                  textShadow: `0 0 20px rgba(34,197,94,0.7), 0 0 50px rgba(34,197,94,0.35), 0 0 100px rgba(34,197,94,0.15)`,
                }}
              >
                R$ 2.450.000
              </motion.p>
              <p className="mt-3 font-mono text-[10px]" style={{ color: "rgba(134,239,172,0.35)" }}>
                vs. R$ 980.000 em juros pagos ao banco.
              </p>
            </div>

            {/* progress + label side-by-side */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: "rgba(134,239,172,0.4)" }}>Patrimônio acumulado</span>
                <span className="font-mono text-[11px] font-bold" style={{ color: G }}>+320%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(34,197,94,0.12)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "75%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, #16a34a, #4ade80)` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[8px]" style={{ color: "rgba(134,239,172,0.3)" }}>
                <span>Ano 1</span><span>Ano 10</span>
              </div>
            </div>

            {/* glow orb */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 rounded-full"
              style={{ background: `radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 65%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full"
              style={{ background: `radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)` }}
            />
          </motion.div>
        </FadeIn>
      </div>
    </SectionShell>
  );
}

/* ─── Motor de Captação ───────────────────────────────────── */
const quizOptions = [
  {
    label: "Comprar meu imóvel",
    icon: "🏠",
    result: {
      title: "Cenário: Compra com Consórcio",
      stats: [
        { label: "Economia vs Banco", value: "R$ 1.240.000" },
        { label: "Parcela Estimada", value: "R$ 3.200/mês" },
        { label: "Carta de Crédito", value: "R$ 500.000" },
      ],
      color: G,
    },
  },
  {
    label: "Investir com alavancagem",
    icon: "📈",
    result: {
      title: "Cenário: Flip de Cota",
      stats: [
        { label: "TIR Estimada", value: "3,8% a.m." },
        { label: "Lucro Líquido", value: "R$ 150.000" },
        { label: "Capital Investido", value: "R$ 80.000" },
      ],
      color: "#f59e0b",
    },
  },
  {
    label: "Sair de um financiamento",
    icon: "🔓",
    result: {
      title: "Cenário: Resgate de Financiamento",
      stats: [
        { label: "Redução de Parcela", value: "62%↓" },
        { label: "Economia Mensal", value: "R$ 5.300/mês" },
        { label: "Parcela Nova", value: "R$ 3.200/mês" },
      ],
      color: "#a78bfa",
    },
  },
];

function MotorCaptacao() {
  const [selected, setSelected] = useState<number | null>(0);

  return (
    <SectionShell id="captacao">
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 lg:items-center">
        <div>
          <FadeIn>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <Eyebrow>Raio-X Financeiro Pré-Reunião</Eyebrow>
            </div>
            <h2 className="font-sans-display text-[clamp(1.875rem,5.5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.04em] text-foreground">
              Leia a mente do cliente{" "}
              <span className="font-display italic tracking-[-0.02em]">antes de sentar na mesa.</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-8 max-w-[44ch] text-[16px] leading-[1.65] tracking-[-0.01em] text-muted-foreground sm:text-[17px]">
              Envie nosso Formulário Inteligente interativo por WhatsApp. O cliente preenche suas dores,
              rendas e objetivos. Quando a reunião começa, o sistema já processou os dados e preparou
              o xeque-mate.{" "}
              <span className="text-foreground">Você não faz perguntas chatas; você entrega a solução.</span>
            </p>
          </FadeIn>
        </div>

        {/* Interactive quiz */}
        <FadeIn delay={0.15}>
          <div
            className="overflow-hidden rounded-2xl border border-border/50 p-5 sm:p-7"
            style={{ background: DARK }}
          >
            <div className="mb-5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500/50" />
                <div className="h-2 w-2 rounded-full bg-yellow-500/40" />
                <div className="h-2 w-2 rounded-full bg-green-500/50" />
              </div>
              <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: TXT }}>
                Formulário Inteligente
              </span>
            </div>

            <p className="mb-4 text-[13px] font-medium text-white/70">
              Qual seu objetivo principal?
            </p>

            <div className="space-y-2">
              {quizOptions.map((opt, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected(selected === i ? null : i)}
                  animate={{ opacity: selected !== null && selected !== i ? 0.4 : 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[13px] font-medium transition-all duration-200 ${
                    selected === i
                      ? "border-green-500/40 bg-green-500/10 text-white shadow-[0_0_20px_rgba(34,197,94,0.12)]"
                      : "border-white/8 bg-white/4 text-white/55 hover:border-white/20 hover:bg-white/8 hover:text-white/85"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                  {selected === i && <Check className="ml-auto h-4 w-4 text-green-400" />}
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {selected !== null && (
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="mt-5 rounded-xl p-4"
                  style={{
                    background: `${quizOptions[selected].result.color}0e`,
                    border: `1px solid ${quizOptions[selected].result.color}30`,
                    boxShadow: `0 0 36px ${quizOptions[selected].result.color}1a`,
                  }}
                >
                  <p
                    className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: quizOptions[selected].result.color }}
                  >
                    Cenário Pronto ↗
                  </p>
                  <p className="mb-4 text-[13px] font-semibold text-white">
                    {quizOptions[selected].result.title}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {quizOptions[selected].result.stats.map((s, i) => (
                      <div key={i}>
                        <p className="text-[10px] text-white/40">{s.label}</p>
                        <p
                          className="mt-0.5 font-mono text-[13px] font-bold"
                          style={{ color: quizOptions[selected].result.color }}
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  );
}

/* ─── 7 Estratégias de Fechamento ─────────────────────────── */
const tabs = [
  {
    n: "01",
    title: "O Fim do Aluguel",
    kicker: "Inquilinos",
    copy: "Converta inquilinos mostrando o sangue financeiro. Prove graficamente o mês exato em que o patrimônio gerado cruza e supera o dinheiro jogado fora no aluguel. A parcela fica igual, mas ele constrói riqueza.",
    chart: "aluguel",
  },
  {
    n: "02",
    title: "Destruidor de Financiamentos",
    kicker: "SAC / PRICE",
    copy: "Pegue a simulação da Caixa ou Itaú que o cliente trouxe. Insira no sistema. Mostre, lado a lado, que a garantia imediata do banco custa literalmente um imóvel a mais em juros.",
    chart: "financia",
  },
  {
    n: "03",
    title: "Alavancagem Agressiva",
    kicker: "Flip de Cota",
    copy: "Fale a língua do investidor que busca ROI. Mostre como controlar R$ 1 Milhão em crédito usando o mínimo de capital, contemplar com lance embutido e vender com ágio gerando TIR superior a 3% ao mês.",
    chart: "flip",
  },
  {
    n: "04",
    title: "Renda Passiva Infinita",
    kicker: "Aposentadoria",
    copy: "Para clientes focados em aposentadoria. O sistema calcula a partir de que mês exato o aluguel do imóvel começa a pagar a própria parcela, gerando fluxo de caixa livre e patrimônio superior à Renda Fixa.",
    chart: "renda",
  },
  {
    n: "05",
    title: "O Resgate",
    kicker: "Saída do Banco",
    copy: "Para o cliente preso em parcelas altas há anos. Mostre como substituir a parcela pesada do banco por uma parcela menor do consórcio, mantendo o estilo de vida. Matemática irrecusável.",
    chart: "resgate",
  },
  {
    n: "06",
    title: "Matemática da Certeza",
    kicker: "Controle do Lance",
    copy: "O cliente tem medo de depender da sorte? Calcule com exatidão o lance necessário. Prove o break-even financeiro e entregue a ele a data de contemplação como um projeto — não como um jogo de azar.",
    chart: "slider",
  },
  {
    n: "07",
    title: "O Paraíso Fiscal",
    kicker: "Consórcio PJ",
    copy: "Ticket médio 5x maior. O sistema prova para empresários a economia absurda usando a dedutibilidade do IRPJ e CSLL sobre a parcela. O contador do cliente vai implorar para ele assinar.",
    chart: "pj",
  },
];

function TabChartAluguel() {
  return (
    <ChartPanel>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
        Aluguel Acumulado vs. Patrimônio do Consórcio (10 anos)
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={aluguelData}>
          <defs>
            <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={G} stopOpacity={0.3} />
              <stop offset="95%" stopColor={G} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={R} stopOpacity={0.25} />
              <stop offset="95%" stopColor={R} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="ano" tick={{ fill: TXT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<ChartTooltip fmt={fmtM} />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
          <ReferenceLine
            x="Ano 4"
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="4 3"
            label={{ value: "Ponto de Virada ↗", fill: G2, fontSize: 9, dy: -8 }}
          />
          <Area
            type="monotone"
            dataKey="aluguel"
            stroke={R}
            strokeWidth={2}
            fill="url(#gradRed)"
            name="Aluguel Acumulado"
          />
          <Area
            type="monotone"
            dataKey="patrimonio"
            stroke={G}
            strokeWidth={2.5}
            fill="url(#gradGreen)"
            name="Patrimônio Consórcio"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-full" style={{ background: R }} />
          <span className="font-mono text-[10px]" style={{ color: TXT }}>Aluguel Acumulado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-full" style={{ background: G }} />
          <span className="font-mono text-[10px]" style={{ color: TXT }}>Patrimônio Consórcio</span>
        </div>
      </div>
    </ChartPanel>
  );
}

function TabChartFinancia() {
  return (
    <ChartPanel>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
        Desembolso Total — Banco vs. Consórcio
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={financData} layout="vertical" barCategoryGap="38%" margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip content={<ChartTooltip fmt={fmtM} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={52} name="Custo Total">
            {financData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? R : G} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: `${R}10`, border: `1px solid ${R}20` }}
        >
          <p className="font-mono text-[10px]" style={{ color: R2 }}>Banco (total)</p>
          <p className="font-mono text-[15px] font-bold text-red-400">R$ 1.465.000</p>
        </div>
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: `${G}10`, border: `1px solid ${G}20` }}
        >
          <p className="font-mono text-[10px]" style={{ color: G2 }}>Consórcio (total)</p>
          <p className="font-mono text-[15px] font-bold text-green-400">R$ 575.000</p>
        </div>
      </div>
    </ChartPanel>
  );
}

function TabChartFlip() {
  return (
    <ChartPanel>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
        Fluxo de Caixa — Flip de Cota (18 meses)
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={flipData}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="mes" tick={{ fill: TXT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(0)}k`}
            tick={{ fill: TXT, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip fmt={fmtK} />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={G}
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, index } = props;
              const lastIdx = flipData.length - 1;
              const breakEvenIdx = flipData.findIndex((d) => d.valor >= 0 && flipData[Math.max(0, flipData.indexOf(d) - 1)]?.valor < 0) || flipData.findIndex((d) => d.valor === 0);
              if (index === lastIdx)
                return <circle key="peak" cx={cx} cy={cy} r={6} fill={G} stroke={DARK} strokeWidth={2} />;
              if (index === breakEvenIdx)
                return <circle key="zero" cx={cx} cy={cy} r={5} fill="#f59e0b" stroke={DARK} strokeWidth={2} />;
              return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={G} opacity={0.45} />;
            }}
            name="Retorno"
          />
        </LineChart>
      </ResponsiveContainer>
      <div
        className="mt-3 flex items-center justify-between rounded-xl px-4 py-2.5"
        style={{ background: `${G}10`, border: `1px solid ${G}20` }}
      >
        <span className="text-[12px] text-green-400/60">Lucro Líquido no M18:</span>
        <span className="font-mono text-[16px] font-bold text-green-400">R$ 150.000</span>
      </div>
    </ChartPanel>
  );
}

function TabChartRenda() {
  return (
    <ChartPanel>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
        Fluxo de Caixa Mensal — Renda Passiva
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rendaData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="mes" tick={{ fill: TXT, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(0)}k`}
            tick={{ fill: TXT, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip fmt={fmtK} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" label={{ value: "Break-even", fill: "#f59e0b", fontSize: 9 }} />
          <Bar dataKey="fluxo" radius={[4, 4, 0, 0]} maxBarSize={48} name="Fluxo de Caixa">
            {rendaData.map((d, i) => (
              <Cell key={i} fill={d.fluxo >= 0 ? G : R} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div
        className="mt-3 flex items-center justify-between rounded-xl px-4 py-2.5"
        style={{ background: `${G}10`, border: `1px solid ${G}20` }}
      >
        <span className="text-[12px] text-green-400/60">Renda passiva no M96:</span>
        <span className="font-mono text-[16px] font-bold text-green-400">R$ 8.200/mês</span>
      </div>
    </ChartPanel>
  );
}

function TabChartResgate() {
  return (
    <ChartPanel className="flex flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
        Comparativo de Parcelas
      </p>
      <div className="space-y-3">
        {/* Bank card */}
        <div
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #1c0606 0%, #2d0a0a 100%)",
            border: "1px solid rgba(239,68,68,0.22)",
          }}
        >
          {/* chip */}
          <div className="absolute right-5 top-4 flex gap-1">
            <div className="h-5 w-4 rounded-sm" style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.35)" }} />
            <div className="h-5 w-4 rounded-sm" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }} />
          </div>
          {/* card noise texture */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E\")" }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: "rgba(239,68,68,0.5)" }}>Banco · Parcela Atual</p>
          <p className="mt-2 font-mono text-[30px] font-bold leading-none tracking-[-0.03em] text-red-400">R$ 8.500</p>
          <p className="mt-1.5 font-mono text-[9px]" style={{ color: TXT }}>/mês · financiamento SAC/PRICE</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-px flex-1 rounded-full" style={{ background: "rgba(134,239,172,0.15)" }} />
          <motion.div animate={{ y: [0, 3, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
            <ArrowRight className="h-4 w-4 rotate-90" style={{ color: "rgba(134,239,172,0.5)" }} />
          </motion.div>
          <div className="h-px flex-1 rounded-full" style={{ background: "rgba(134,239,172,0.15)" }} />
        </div>

        {/* Consórcio card */}
        <div
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #021407 0%, #04220e 100%)",
            border: "1px solid rgba(34,197,94,0.25)",
            boxShadow: "0 0 24px rgba(34,197,94,0.06)",
          }}
        >
          <div className="absolute right-5 top-4 flex gap-1">
            <div className="h-5 w-4 rounded-sm" style={{ background: "rgba(34,197,94,0.25)", border: "1px solid rgba(34,197,94,0.35)" }} />
            <div className="h-5 w-4 rounded-sm" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.25)" }} />
          </div>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E\")" }} />
          <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: "rgba(74,222,128,0.55)" }}>Consórcio · Nova Parcela</p>
          <p className="mt-2 font-mono text-[30px] font-bold leading-none tracking-[-0.03em] text-green-400">R$ 3.200</p>
          <p className="mt-1.5 font-mono text-[9px]" style={{ color: TXT }}>/mês · mesmo patrimônio</p>
        </div>

        {/* Savings */}
        <div
          className="rounded-xl px-4 py-2.5 text-center"
          style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}
        >
          <span className="font-mono text-[12px] font-bold text-green-300">Economia de R$ 5.300/mês</span>
          <span className="ml-1.5 font-mono text-[10px]" style={{ color: G2 }}>→ R$ 63.600/ano</span>
        </div>
      </div>
    </ChartPanel>
  );
}

function TabChartSlider() {
  const [lance, setLance] = useState(20);
  const mesRaw = Math.max(6, Math.round(36 - (lance * 28) / 80));
  const color = lance > 50 ? G : lance > 25 ? "#f59e0b" : "#f97316";
  const [displayMes, setDisplayMes] = useState(mesRaw);
  const fromRef = useRef(mesRaw);

  useEffect(() => {
    const from = fromRef.current;
    const controls = animate(from, mesRaw, {
      type: "spring",
      stiffness: 200,
      damping: 24,
      onUpdate: (v) => {
        fromRef.current = v;
        setDisplayMes(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [mesRaw]);

  return (
    <ChartPanel className="flex flex-col gap-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
        Controle do Prazo de Contemplação
      </p>

      <div>
        <div className="mb-3 flex justify-between">
          <span className="text-[12px]" style={{ color: TXT }}>
            Lance Ofertado
          </span>
          <motion.span
            key={lance}
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="font-mono text-[14px] font-bold text-white"
          >
            {lance}%
          </motion.span>
        </div>
        <input
          type="range"
          min={0}
          max={80}
          value={lance}
          onChange={(e) => setLance(Number(e.target.value))}
          className="w-full cursor-pointer appearance-none
            [&::-webkit-slider-runnable-track]:h-1.5
            [&::-webkit-slider-runnable-track]:rounded-full
            [&::-webkit-slider-runnable-track]:bg-white/10
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white/30
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-100
            [&::-webkit-slider-thumb]:active:scale-125
            [&::-webkit-slider-thumb]:-mt-[7px]
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white/30"
          style={{ accentColor: color }}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[9px]" style={{ color: TXT }}>
          <span>0%</span>
          <span>80%</span>
        </div>
      </div>

      <motion.div
        animate={{ borderColor: `${color}40`, background: `${color}0d` }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl p-5 text-center"
        style={{ border: `1.5px solid ${color}30` }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: `${color}80` }}>
          Mês Estimado de Contemplação
        </p>
        <motion.p
          animate={{ color }}
          transition={{ duration: 0.3 }}
          className="mt-2 font-sans-display text-[56px] font-bold leading-none tracking-[-0.04em] tabular-nums"
        >
          {displayMes}
        </motion.p>
        <p className="mt-1 font-mono text-[12px]" style={{ color: TXT }}>
          meses para o imóvel
        </p>
      </motion.div>

      <p className="text-center text-[11px]" style={{ color: TXT }}>
        Arraste para ver o nível de controle que você tem na mão.
      </p>
    </ChartPanel>
  );
}

function TabChartPJ() {
  const [pjAtivo, setPjAtivo] = useState(false);
  const custoBase = 575000;
  const custoFinal = pjAtivo ? Math.round(custoBase * 0.66) : custoBase;
  const economia = custoBase - custoFinal;

  return (
    <ChartPanel className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TXT }}>
          Benefício Fiscal PJ
        </p>
        <motion.button
          onClick={() => setPjAtivo(!pjAtivo)}
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors"
          style={{
            background: pjAtivo ? `${G}20` : "rgba(255,255,255,0.06)",
            border: `1px solid ${pjAtivo ? G + "40" : "rgba(255,255,255,0.1)"}`,
            color: pjAtivo ? G : "rgba(255,255,255,0.5)",
          }}
          whileTap={{ scale: 0.96 }}
        >
          <motion.div
            animate={{ scale: pjAtivo ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className="h-3 w-3 rounded-full"
            style={{ background: pjAtivo ? G : "rgba(255,255,255,0.3)" }}
          />
          Aplicar Benefício Fiscal PJ
        </motion.button>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)" }}>
        <p className="mb-2 font-mono text-[10px]" style={{ color: TXT }}>
          Custo Total do Projeto
        </p>
        <div className="flex items-end gap-3">
          <AnimatePresence mode="wait">
            <motion.p
              key={custoFinal}
              initial={{ y: -22, opacity: 0, scale: 0.75 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 22, opacity: 0, scale: 0.75 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="font-sans-display text-[clamp(1.8rem,5vw,2.5rem)] font-bold leading-none tracking-[-0.04em]"
              style={{ color: pjAtivo ? G : "rgba(255,255,255,0.85)" }}
            >
              {fmtBRL(custoFinal)}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence>
            {pjAtivo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.2, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.2 }}
                transition={{ type: "spring", stiffness: 420, damping: 14 }}
                className="mb-1"
              >
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
                  style={{ background: `${G}25`, color: G, border: `1px solid ${G}40` }}
                >
                  -34%
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {pjAtivo && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 font-mono text-[12px]"
            style={{ color: G2 }}
          >
            Economia fiscal: {fmtBRL(economia)} (IRPJ + CSLL)
          </motion.p>
        )}
      </div>

      <AnimatePresence>
        {pjAtivo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl px-4 py-3 text-center text-[12px] font-medium"
            style={{ background: `${G}10`, border: `1px solid ${G}25`, color: G }}
          >
            💰 Dedutível via IRPJ + CSLL. O contador vai implorar para ele assinar.
          </motion.div>
        )}
      </AnimatePresence>

      {!pjAtivo && (
        <p className="text-center text-[11px]" style={{ color: TXT }}>
          Ative o toggle acima para mostrar o benefício fiscal PJ ao cliente.
        </p>
      )}
    </ChartPanel>
  );
}

const tabCharts: Record<string, React.FC> = {
  aluguel: TabChartAluguel,
  financia: TabChartFinancia,
  flip: TabChartFlip,
  renda: TabChartRenda,
  resgate: TabChartResgate,
  slider: TabChartSlider,
  pj: TabChartPJ,
};

function SetteChaves() {
  const [active, setActive] = useState(0);
  const ActiveChart = tabCharts[tabs[active].chart];

  return (
    <SectionShell id="arsenal" tone="muted">
      <FadeIn>
        <div className="mb-4 flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Eyebrow>As 7 Estratégias de Fechamento</Eyebrow>
        </div>
        <h2 className="font-sans-display max-w-[22ch] text-[clamp(1.875rem,5.5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em] text-foreground">
          Sete armas que tornam sua proposta{" "}
          <span className="font-display italic tracking-[-0.02em]">à prova de objeções.</span>
        </h2>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mt-14 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
          {/* Tabs */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory lg:mb-0 lg:flex-col lg:overflow-visible lg:pb-0 lg:snap-none">
            {tabs.map((t, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`group relative flex shrink-0 snap-start flex-col gap-1 rounded-xl px-4 py-3 text-left transition-all lg:flex-row lg:items-center lg:gap-3 ${
                  active === i
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground border border-border/50"
                }`}
              >
                <span
                  className={`font-mono text-[10px] tabular-nums lg:w-6 ${
                    active === i ? "text-primary-foreground/50" : "text-muted-foreground/60"
                  }`}
                >
                  {t.n}
                </span>
                <span className="font-sans-display text-[13px] font-medium leading-tight tracking-[-0.02em]">
                  {t.title}
                </span>
                {active === i && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute right-3 top-1/2 hidden h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary-foreground/60 lg:block"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="rounded-2xl border border-border/60 bg-background p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start"
              >
                {/* copy */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {tabs[active].n} — {tabs[active].kicker}
                    </span>
                  </div>
                  <h3 className="font-sans-display text-[22px] font-medium leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[26px]">
                    {tabs[active].title}
                  </h3>
                  <p className="mt-5 text-[15px] leading-[1.65] tracking-[-0.01em] text-muted-foreground">
                    {tabs[active].copy}
                  </p>
                  <a
                    href="#planos"
                    className="group mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/60"
                  >
                    Quero essa estratégia
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </div>

                {/* chart */}
                <div>
                  <ActiveChart />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </FadeIn>
    </SectionShell>
  );
}

/* ─── Coroação (PDF) ──────────────────────────────────────── */
const pdfElements = [
  { x: -52, y: -38, label: "AreaChart", delay: 0 },
  { x: 48, y: -45, label: "BarChart", delay: 0.08 },
  { x: -58, y: 26, label: "Análise PJ", delay: 0.16 },
  { x: 52, y: 32, label: "Métricas", delay: 0.24 },
];

function Coroacao() {
  return (
    <SectionShell>
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 lg:items-center">
        <div>
          <FadeIn>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <Eyebrow>O Entregável Premium</Eyebrow>
            </div>
            <h2 className="font-sans-display text-[clamp(1.875rem,5.5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.04em] text-foreground">
              A venda não termina na mesa. Ela termina quando o cliente{" "}
              <span className="font-display italic tracking-[-0.02em]">
                mostra o plano para o sócio.
              </span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-8 max-w-[44ch] text-[16px] leading-[1.65] tracking-[-0.01em] text-muted-foreground sm:text-[17px]">
              Não envie um PDF de sistema bancário feio. Com um clique, gere um{" "}
              <span className="text-foreground font-medium">
                Relatório de Inteligência Patrimonial
              </span>{" "}
              com a sua marca. Padrão Family Office. Matemática auditável, sem caixas pretas. O
              relatório continua defendendo e vendendo o seu projeto mesmo depois que você vai embora.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Design Padrão Family Office", icon: "✦" },
                { label: "Fórmulas Auditáveis", icon: "✦" },
                { label: "Gerado em 1 clique", icon: "✦" },
                { label: "Com sua marca", icon: "✦" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <span className="text-accent text-[10px]">{f.icon}</span>
                  <span className="text-[14px] tracking-[-0.01em] text-foreground">{f.label}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>

        {/* PDF Animation */}
        <FadeIn delay={0.2}>
          <div className="relative flex h-80 items-center justify-center overflow-hidden rounded-2xl sm:h-88">
            {/* floating chart pieces */}
            {pdfElements.map((el, i) => (
              <motion.div
                key={i}
                initial={{ x: el.x, y: el.y, opacity: 0, scale: 0.7 }}
                whileInView={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                viewport={{ once: false }}
                animate={{ x: el.x, y: el.y, opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0] }}
                transition={{
                  duration: 2.5,
                  delay: el.delay,
                  repeat: Infinity,
                  repeatDelay: 1.5,
                  times: [0, 0.3, 0.7, 1],
                }}
                className="absolute rounded-lg border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-sm"
              >
                <div className="h-1 w-8 rounded-full" style={{ background: i % 2 === 0 ? G : R }} />
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/70">{el.label}</p>
              </motion.div>
            ))}

            {/* PDF document — premium design */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 12 }}
              whileInView={{ scale: 1, opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring", delay: 0.3, stiffness: 120, damping: 20 }}
              className="relative z-10 w-56 overflow-hidden shadow-2xl sm:w-64"
              style={{
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {/* doc header — dark premium */}
              <div
                className="px-5 py-4"
                style={{ background: "linear-gradient(135deg, #0a1f10 0%, #111f14 100%)", borderBottom: "1px solid rgba(34,197,94,0.15)" }}
              >
                <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: "rgba(134,239,172,0.45)" }}>
                  Relatório de Inteligência Patrimonial
                </p>
                {/* serif title = "alto padrão" */}
                <p className="mt-1 font-display text-[17px] italic tracking-[-0.01em] text-white/90">
                  Family Office Report
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-px flex-1 rounded-full" style={{ background: "rgba(34,197,94,0.25)" }} />
                  <span className="font-mono text-[8px]" style={{ color: "rgba(134,239,172,0.4)" }}>CONFIDENCIAL</span>
                  <div className="h-px flex-1 rounded-full" style={{ background: "rgba(34,197,94,0.25)" }} />
                </div>
              </div>

              {/* doc body — off-white paper look */}
              <div className="space-y-2.5 bg-[#f8f9f6] px-5 py-4">
                <div className="flex items-center justify-between border-b border-gray-200/70 pb-2">
                  <span className="font-mono text-[9px] text-gray-500">Patrimônio Projetado</span>
                  <span className="font-mono text-[10px] font-bold text-green-700">R$ 2.45M</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200/70 pb-2">
                  <span className="font-mono text-[9px] text-gray-500">TIR da Operação</span>
                  <span className="font-mono text-[10px] font-bold text-amber-700">3,8% a.m.</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <span className="font-mono text-[9px] text-gray-500">Economia vs Banco</span>
                  <span className="font-mono text-[10px] font-bold text-green-700">R$ 1.24M</span>
                </div>
                {/* mini chart bars */}
                <div className="mt-2 flex items-end gap-1 pt-1">
                  {[30, 45, 38, 60, 52, 75, 68, 90].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h * 0.4}px`, background: i > 4 ? "#16a34a" : "#86efac80" }} />
                  ))}
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div className="h-full w-[75%] rounded-full bg-green-600" />
                </div>
              </div>

              {/* Scan icon — scan animation */}
              <motion.div
                animate={{ y: [0, 56, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
                className="pointer-events-none absolute left-0 right-0 z-20"
                style={{ top: "60px" }}
              >
                <div className="relative">
                  <div className="h-px w-full" style={{ background: "rgba(34,197,94,0.5)", boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />
                </div>
              </motion.div>

              {/* Scan icon badge */}
              <motion.div
                animate={{ x: [8, 32, 8], y: [4, 4, 4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
                className="absolute top-14 z-30 flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
                style={{ background: "rgba(34,197,94,0.9)", boxShadow: "0 0 12px rgba(34,197,94,0.5)" }}
              >
                <Scan className="h-3.5 w-3.5 text-white" />
              </motion.div>
            </motion.div>
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  );
}

/* ─── Oferta (Planos) ─────────────────────────────────────── */
const planFeatures = [
  "Acesso às 7 Estratégias de Fechamento",
  "Formulários Inteligentes Ilimitados",
  "Geração de PDFs Padrão Family Office",
  "Comparativo SAC × PRICE × Consórcio em tempo real",
  "Cálculo de lances (embutido, recurso próprio, redução)",
  "Análise de renda passiva e flip de cota",
  "Benefício fiscal PJ com cálculo de IRPJ + CSLL",
];

function Oferta() {
  const { isAuthenticated } = useAuth();

  return (
    <SectionShell id="planos">
      <FadeIn>
        <div className="mb-4 flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Eyebrow>Assuma o controle.</Eyebrow>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 className="font-sans-display text-[clamp(1.875rem,5.5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em] text-foreground">
            Qual é o custo de continuar perdendo comissões de 5 dígitos{" "}
            <span className="font-display italic tracking-[-0.02em]">por falta de clareza?</span>
          </h2>
          <p className="text-[16px] leading-[1.65] tracking-[-0.01em] text-muted-foreground">
            Fechar apenas{" "}
            <span className="text-foreground font-medium">
              UMA única carta de R$ 500 mil a mais neste ano
            </span>{" "}
            por causa das nossas telas paga a sua assinatura por uma década. O risco é inteiramente
            nosso.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* Mensal */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-col justify-between rounded-3xl border border-border bg-background p-7 sm:p-10"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-sans-display text-[28px] font-medium tracking-[-0.035em]">Mensal</h3>
                <Eyebrow>Mensal</Eyebrow>
              </div>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Para testar o impacto na próxima reunião.
              </p>
              <div className="mt-10 flex items-baseline gap-1.5">
                <span className="font-sans-display text-[52px] font-medium leading-none tracking-[-0.05em]">
                  R$ 99
                </span>
                <span className="text-[14px] text-muted-foreground">/mês</span>
              </div>
              <ul className="mt-10 space-y-3">
                {planFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14px] tracking-[-0.01em] text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={isAuthenticated ? "/assinar?plan=monthly" : "/checkout?plan=monthly"}
              className="group mt-10 inline-flex h-12 items-center justify-between rounded-full bg-primary px-6 text-[14px] font-medium tracking-[-0.01em] text-primary-foreground transition-opacity hover:opacity-90 sm:h-auto sm:py-3.5"
            >
              Assinar mensal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          {/* Anual */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative flex flex-col justify-between rounded-3xl bg-primary p-7 text-primary-foreground sm:p-10"
          >
            <span className="absolute -top-3.5 left-7 rounded-full bg-accent px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent-foreground sm:left-10">
              O Arsenal Completo
            </span>

            {/* glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-30"
              style={{
                background:
                  "radial-gradient(50% 50% at 80% 20%, oklch(0.78 0.05 150 / 0.5), transparent 70%)",
              }}
            />

            <div className="relative">
              <div className="flex items-center justify-between">
                <h3 className="font-sans-display text-[28px] font-medium tracking-[-0.035em]">Anual</h3>
                <Eyebrow light>Anual</Eyebrow>
              </div>
              <p className="mt-2 text-[14px] text-primary-foreground/70">
                Economize e trave o preço. Multiplique o retorno.
              </p>
              <div className="mt-10 flex items-baseline gap-2">
                <span className="font-sans-display text-[52px] font-medium leading-none tracking-[-0.05em]">
                  R$ 66
                </span>
                <div>
                  <p className="text-[14px] text-primary-foreground/70">/mês</p>
                  <p className="text-[12px] font-medium text-primary-foreground/50">
                    Total: R$ 799/ano
                  </p>
                </div>
              </div>

              <ul className="mt-10 space-y-3">
                {[...planFeatures, "Suporte prioritário", "Acesso antecipado a novos módulos"].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14px] tracking-[-0.01em]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground/70" />
                    <span className="text-primary-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              {/* ROI Guarantee seal */}
              <div className="mt-8 flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="relative shrink-0 flex h-[76px] w-[76px] cursor-default items-center justify-center rounded-full"
                  style={{
                    border: "1.5px solid rgba(251,191,36,0.45)",
                    background: "rgba(251,191,36,0.07)",
                    boxShadow: "0 0 22px rgba(251,191,36,0.12), inset 0 0 12px rgba(251,191,36,0.06)",
                  }}
                >
                  {/* outer ring pulse */}
                  <motion.div
                    animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.0, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full"
                    style={{ border: "1px solid rgba(251,191,36,0.35)" }}
                  />
                  <div className="flex flex-col items-center justify-center gap-0 text-center">
                    <span className="font-mono text-[10px] font-black uppercase leading-none tracking-[0.18em] text-amber-400">
                      ROI
                    </span>
                    <div className="my-[3px] h-px w-8 rounded-full bg-amber-400/35" />
                    <span className="font-mono text-[7px] font-bold uppercase leading-none tracking-[0.1em] text-amber-300/80">
                      Garantido
                    </span>
                    <span className="mt-[3px] font-display text-[10px] italic leading-none text-amber-300/65">
                      7 dias
                    </span>
                  </div>
                </motion.div>
                <p className="text-[12px] leading-[1.55] text-primary-foreground/60">
                  Não gerou ROI em 7 dias? Devolvemos 100% do seu dinheiro. Sem perguntas.
                </p>
              </div>
            </div>

            <a
              href={isAuthenticated ? "/assinar?plan=annual" : "/checkout?plan=annual"}
              className="group relative mt-10 inline-flex h-12 items-center justify-between rounded-full bg-background px-6 text-[14px] font-medium tracking-[-0.01em] text-foreground transition-opacity hover:opacity-90 sm:h-auto sm:py-3.5"
            >
              Quero o arsenal completo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </motion.div>
        </div>
      </FadeIn>
    </SectionShell>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────── */
const faqs = [
  {
    q: "O sistema calcula taxas de qualquer administradora?",
    a: "Sim. Você insere a taxa de administração, o INCC estimado e as regras de lance. A ferramenta é 100% adaptável — Bancorbrás, Porto Seguro, Embracon e qualquer outra administradora.",
  },
  {
    q: "Preciso ser um expert em matemática financeira?",
    a: "Não. O painel foi desenhado para ser intuitivo. Você preenche os campos do planejamento e o sistema executa todos os cálculos de CDI, ITBI, Amortização e Lances instantaneamente em segundo plano.",
  },
  {
    q: "Posso usar no celular durante a reunião?",
    a: "Sim. O sistema é 100% responsivo. Gire o tablet ou smartphone e apresente os gráficos dinâmicos direto para o cliente na mesa — interface projetada para reuniões ao vivo.",
  },
  {
    q: "Em quanto tempo a ferramenta paga sua assinatura?",
    a: "Com apenas um fechamento adicional no ano — carta de R$ 500 mil gera comissão de R$ 15.000 a R$ 30.000 dependendo da administradora. Isso paga a assinatura por mais de uma década.",
  },
  {
    q: "O cliente precisa entender matemática financeira?",
    a: "Este é exatamente o ponto. O cliente não precisa entender nada. Os gráficos falam por si. Uma barra vermelha gigante (banco) ao lado de uma barra verde pequena (consórcio) é irrefutável para qualquer CEO ou médico.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SectionShell id="faq" tone="muted">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
        <FadeIn>
          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <Eyebrow>FAQ</Eyebrow>
            </div>
            <h2 className="font-sans-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1] tracking-[-0.04em] text-foreground">
              Dúvidas{" "}
              <span className="font-display italic tracking-[-0.02em]">frequentes.</span>
            </h2>
            <p className="mt-8 max-w-sm text-[15px] leading-[1.6] tracking-[-0.01em] text-muted-foreground">
              Não encontrou sua resposta? Fale conosco em{" "}
              <a
                href="mailto:contato@quantocusta.app"
                className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground/70"
              >
                contato@quantocusta.app
              </a>
              .
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="divide-y divide-border border-y border-border">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-start justify-between gap-4 py-6 text-left sm:py-7"
                  >
                    <span className="font-sans-display text-[16px] font-medium leading-[1.25] tracking-[-0.025em] text-foreground sm:text-[18px]">
                      {f.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border"
                    >
                      {isOpen ? (
                        <Minus className="h-3.5 w-3.5 text-foreground" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-foreground" />
                      )}
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.21, 0.47, 0.32, 0.98] }}
                        className="overflow-hidden"
                      >
                        <p className="pb-6 pr-10 text-[14px] leading-[1.65] tracking-[-0.01em] text-muted-foreground sm:pr-12 sm:text-[15px]">
                          {f.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </FadeIn>
      </div>
    </SectionShell>
  );
}

/* ─── Final CTA ───────────────────────────────────────────── */
function FinalCTA() {
  const { isAuthenticated } = useAuth();
  return (
    <SectionShell>
      <FadeIn>
        <motion.div
          className="relative overflow-hidden rounded-[1.75rem] bg-primary p-8 text-primary-foreground sm:rounded-[2.25rem] sm:p-12 lg:p-20"
          whileHover={{ scale: 1.005 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background:
                "radial-gradient(55% 65% at 80% 15%, oklch(0.78 0.05 150 / 0.7), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <h2 className="font-sans-display max-w-[14ch] text-[clamp(2rem,7vw,4.5rem)] font-medium leading-[0.97] tracking-[-0.045em]">
              Pare de explicar.
              <br />
              <span className="font-display italic tracking-[-0.02em] text-primary-foreground/60">
                Comece a provar.
              </span>
            </h2>
            <div className="space-y-6 sm:space-y-8">
              <p className="text-[15px] leading-[1.6] tracking-[-0.01em] text-primary-foreground/75 sm:text-[17px]">
                Acesse a Infraestrutura de Inteligência de Conversão e transforme a próxima reunião em
                um fechamento high ticket.
              </p>
              <Link
                to={isAuthenticated ? "/app" : "/checkout"}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-background px-6 text-[14px] font-medium tracking-[-0.01em] text-foreground transition-all hover:gap-3 sm:h-auto sm:w-auto sm:py-3.5"
              >
                {isAuthenticated ? "Abrir Plataforma" : "Quero dominar minhas reuniões"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </FadeIn>
    </SectionShell>
  );
}

/* ─── Footer ──────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-[#030d06] border-t border-white/5 pt-20 pb-12">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        {/* Main Footer Grid */}
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-20">
          {/* Brand & Description */}
          <div className="space-y-6">
            <BrandLogo white />
            <p className="max-w-xs text-[15px] leading-relaxed text-white/40">
              A infraestrutura definitiva para estrategistas que provam — e não apenas prometem — que o consórcio esmaga o banco.
            </p>
            <div className="flex gap-4">
              <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:border-white/20 hover:text-white">
                <Zap className="h-4 w-4" />
              </a>
              <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:border-white/20 hover:text-white">
                <BarChart2 className="h-4 w-4" />
              </a>
              <a href="#" className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:border-white/20 hover:text-white">
                <Shield className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-6">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/25">Plataforma</h4>
            <nav className="flex flex-col gap-4">
              {nav.map((n) => (
                <a key={n.href} href={n.href} className="text-[14px] text-white/50 transition-colors hover:text-white">
                  {n.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Legal / Company */}
          <div className="space-y-6">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/25">Legal</h4>
            <nav className="flex flex-col gap-4">
              <a href="#" className="text-[14px] text-white/50 transition-colors hover:text-white">Termos de Uso</a>
              <a href="#" className="text-[14px] text-white/50 transition-colors hover:text-white">Privacidade</a>
              <a href="#" className="text-[14px] text-white/50 transition-colors hover:text-white">Cookies</a>
            </nav>
          </div>

          {/* Support */}
          <div className="space-y-6">
            <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/25">Suporte</h4>
            <div className="space-y-4">
              <p className="text-[14px] text-white/50">suporte@quantocusta.com</p>
              <a href="#" className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-[12px] font-medium text-green-400 border border-green-500/20">
                <Zap className="h-3 w-3" />
                Central de Ajuda
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <p className="font-mono text-[11px] tracking-[0.05em] text-white/20">
              © {new Date().getFullYear()} Quanto Custa? Imobiliário.
            </p>
            <div className="h-1 w-1 rounded-full bg-white/10" />
            <span className="font-mono text-[11px] text-white/20">v7.4.2</span>
          </div>
          <p className="text-[11px] text-white/15">
            Feito com excelência para o mercado imobiliário brasileiro.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Mobile sticky CTA ───────────────────────────────────── */
function MobileCTA() {
  const [show, setShow] = useState(false);
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <motion.div
      animate={{ y: show ? 0 : 24, opacity: show ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="pointer-events-auto mx-3 rounded-full border border-border bg-background/85 p-1.5 shadow-xl backdrop-blur-xl">
        <Link
          to={isAuthenticated ? "/app" : "/checkout"}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium tracking-[-0.01em] text-primary-foreground"
        >
          {isAuthenticated ? "Abrir App" : "Dominar minhas reuniões"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Transicao />
        <MotorCaptacao />
        <SetteChaves />
        <Coroacao />
        <Oferta />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <MobileCTA />
    </div>
  );
}
