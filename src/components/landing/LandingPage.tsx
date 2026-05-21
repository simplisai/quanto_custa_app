import { useState, useEffect } from "react";
import { ArrowRight, ArrowUpRight, Check, Minus, Plus, Menu, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

/* ----------------------------- DATA ----------------------------- */

const nav = [
  { label: "Problema", href: "#problema" },
  { label: "Sistema", href: "#sistema" },
  { label: "Arsenal", href: "#arsenal" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

const features = [
  {
    n: "01",
    kicker: "Comparativo",
    title: "SAC × PRICE × Consórcio.",
    body: "Sua estratégia de crédito lado a lado com financiamentos tradicionais. O Desembolso Financeiro Total exposto em tempo real — o vermelho do banco contra o verde da sua proposta.",
  },
  {
    n: "02",
    kicker: "Engenharia",
    title: "Lances com exatidão matemática.",
    body: "Embutido sobre crédito ou sobre plano, recurso próprio e redução de parcela calculados em segundo plano. Mostre ao cliente o Poder de Compra Líquido real.",
  },
  {
    n: "03",
    kicker: "Xeque-mate",
    title: "Custo de oportunidade.",
    body: "Custo do aluguel durante a espera contra rentabilidade do CDI e valorização do imóvel. Prove que, mesmo pagando aluguel, a alavancagem deixa o cliente mais rico.",
  },
];

const principles = [
  "Comparação matemática entre SAC, PRICE e estratégia de consórcio.",
  "Lance embutido, recurso próprio e redução de parcela com fórmulas auditáveis.",
  "Custo de oportunidade contra CDI e valorização do imóvel calculado automaticamente.",
  "Relatórios em PDF padrão Family Office, prontos em segundos.",
];

const trust = [
  {
    title: "Matemática verificável",
    body: "Cada cálculo baseado em fórmulas auditáveis de amortização, INCC, ITBI e CDI. Sem caixa preta.",
  },
  {
    title: "100% adaptável",
    body: "Taxa de administração, INCC e regras de lance configuráveis. Bancorbrás, Porto, Embracon e outras.",
  },
  {
    title: "Apresentação ao vivo",
    body: "Interface responsiva projetada para reuniões. Gire o tablet e apresente direto na mesa.",
  },
  {
    title: "Relatórios de autoridade",
    body: "PDF profissional exportado em um clique. Continua vendendo depois que o cliente sai da reunião.",
  },
];

const audience = [
  "Estrategistas que atendem clientes high ticket",
  "Corretores cansados de perder por falta de clareza",
  "Planejadores financeiros e family officers",
  "Consultores que vendem inteligência, não cota",
];

const faqs = [
  {
    q: "O sistema calcula taxas de qualquer administradora?",
    a: "Sim. Você insere manualmente a taxa de administração, o INCC estimado e as regras de lance, tornando a ferramenta 100% adaptável a qualquer produto — Bancorbrás, Porto Seguro, Embracon e outras.",
  },
  {
    q: "Preciso ser um gênio da matemática financeira?",
    a: "Não. O painel foi desenhado para ser intuitivo. Você preenche os campos do planejamento e o sistema executa todos os cálculos de CDI, ITBI, Amortização e Lances instantaneamente em segundo plano.",
  },
  {
    q: "Posso usar no celular durante a reunião?",
    a: "Sim. O sistema é 100% responsivo. Gire o tablet ou smartphone e apresente os gráficos dinâmicos direto para o cliente na mesa.",
  },
  {
    q: "Em quanto tempo a ferramenta paga sua assinatura?",
    a: "Com apenas um fechamento adicional no ano — perfeitamente alcançável com o aumento de conversão — a ferramenta paga sua assinatura várias vezes. ROI imediato.",
  },
];

/* ----------------------------- ATOMS ----------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
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

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <span className="font-display text-[18px] leading-none">Q</span>
      </div>
      <span className="font-sans-display text-[15px] font-medium text-foreground">
        Quanto Custa?
      </span>
    </a>
  );
}

/* ----------------------------- HEADER ----------------------------- */

function Header() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-border/40 bg-background/75 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-5 sm:h-16 sm:px-10">
          <Logo />
          <nav className="hidden items-center gap-10 md:flex">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to={isAuthenticated ? "/app" : "/login"}
              className="hidden text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              {isAuthenticated ? "Abrir App" : "Entrar"}
            </Link>
            <a
              href={isAuthenticated ? "/app" : "#planos"}
              className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium tracking-[-0.01em] text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex"
            >
              {isAuthenticated ? "Visualizar Sistema" : "Assinar"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        className={`fixed inset-0 z-[60] md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-x-3 top-3 rounded-3xl border border-border bg-background p-5 shadow-2xl transition-all duration-300 ${
            open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          }`}
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="mt-6 flex flex-col">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between border-t border-border py-4 font-sans-display text-[22px] font-medium tracking-[-0.03em] text-foreground"
              >
                {n.label}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </a>
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
            {isAuthenticated ? "Acessar Plataforma" : "Assinar agora"}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </>
  );
}

/* ----------------------------- HERO ----------------------------- */

function Hero() {
  const { isAuthenticated } = useAuth();
  return (
    <section id="top" className="relative overflow-hidden border-b border-border/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 78% 35%, oklch(0.78 0.05 150 / 0.28), transparent 70%), radial-gradient(45% 40% at 95% 90%, oklch(0.5 0.06 150 / 0.16), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="relative mx-auto max-w-[1280px] px-5 pt-16 pb-24 sm:px-10 sm:pt-24 sm:pb-32 lg:pt-32 lg:pb-40">
        <div className="mb-10 flex items-center gap-3 sm:mb-14">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Eyebrow>Para corretores, planejadores e consultores de elite</Eyebrow>
        </div>

        <h1 className="font-sans-display max-w-[18ch] text-[clamp(2.5rem,9vw,7rem)] font-medium leading-[0.95] tracking-[-0.05em] text-foreground">
          Pare de vender cota.
          <br />
          <span className="text-muted-foreground">Comece a vender</span>
          <br />
          <span className="font-display italic tracking-[-0.02em]">inteligência patrimonial.</span>
        </h1>

        <div className="mt-12 grid gap-10 sm:mt-20 sm:gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <p className="max-w-[44ch] text-[16px] leading-[1.55] tracking-[-0.01em] text-muted-foreground sm:text-[19px]">
            O primeiro SaaS do mercado que prova{" "}
            <span className="text-foreground">matematicamente e visualmente</span> que a sua
            estratégia de alavancagem com consórcio esmaga qualquer financiamento bancário.
          </p>
          <div className="flex flex-col items-stretch gap-5 lg:items-end">
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                to={isAuthenticated ? "/app" : "/signup"}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium tracking-[-0.01em] text-primary-foreground transition-all hover:gap-3 sm:h-auto sm:py-3.5"
              >
                {isAuthenticated ? "Abrir Calculadora" : "Multiplicar meus fechamentos"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#arsenal"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background/60 px-6 text-[14px] font-medium tracking-[-0.01em] text-foreground transition-colors hover:bg-secondary sm:h-auto sm:py-3.5"
              >
                Ver o sistema
              </a>
            </div>
            <span className="self-start lg:self-end">
              <Eyebrow>v7.4 — Sinergia Total</Eyebrow>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- SECTION HEADER ----------------------------- */

function SectionHead({
  eyebrow,
  title,
  italic,
  lede,
}: {
  eyebrow: string;
  title: React.ReactNode;
  italic?: React.ReactNode;
  lede?: React.ReactNode;
}) {
  return (
    <div className="mb-14 grid gap-8 sm:mb-20 sm:gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
      <div>
        <div className="mb-6 flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h2 className="font-sans-display max-w-[20ch] text-[clamp(1.875rem,6.5vw,4rem)] font-medium leading-[1.02] tracking-[-0.04em] text-foreground">
          {title}
          {italic && <span className="font-display italic tracking-[-0.02em]"> {italic}</span>}
        </h2>
      </div>
      {lede && (
        <p className="max-w-[42ch] text-[15px] leading-[1.6] tracking-[-0.01em] text-muted-foreground sm:text-[17px] lg:justify-self-end">
          {lede}
        </p>
      )}
    </div>
  );
}

/* ----------------------------- PROBLEMA ----------------------------- */

function Problema() {
  return (
    <SectionShell id="problema" tone="muted">
      <SectionHead
        eyebrow="O Problema"
        title="Você está perdendo vendas"
        italic="para o gerente do banco."
      />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="space-y-6 text-[17px] leading-[1.65] tracking-[-0.01em] text-muted-foreground">
          <p>
            Quando você senta na frente de um cliente qualificado — empresários, médicos,
            investidores — ele já tem uma simulação SAC ou PRICE na mão. O banco oferece{" "}
            <span className="text-foreground">segurança imediata</span>.
          </p>
          <p>
            O que você oferece? Uma promessa de contemplação e uma planilha de Excel que o cliente
            não entende e, pior, <span className="text-foreground">não confia</span>.
          </p>
        </div>
        <div className="space-y-6 text-[17px] leading-[1.65] tracking-[-0.01em] text-muted-foreground">
          <p>
            Se você continua argumentando que “consórcio não tem juros”, está jogando o jogo dos
            amadores. O cliente de alto padrão não quer saber o que é mais barato — quer saber o que{" "}
            <span className="text-foreground">gera mais patrimônio</span>.
          </p>
          <p className="font-display text-[24px] italic leading-[1.35] tracking-[-0.01em] text-foreground">
            Enquanto você rabisca lance embutido no papel, ele vai embora e assina com o banco.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

/* ----------------------------- SOLUÇÃO ----------------------------- */

function Solucao() {
  return (
    <SectionShell id="sistema">
      <SectionHead
        eyebrow="A Virada de Chave"
        title="Inteligência patrimonial"
        italic="estruturada para o high ticket."
        lede={
          <>
            O Quanto Custa? Imobiliário transforma matemática financeira em gráficos de impacto e
            relatórios padrão Family Office, gerados em segundos. Você deixa de convencer — passa a{" "}
            <span className="text-foreground">provar</span>.
          </>
        }
      />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
        {principles.map((p, i) => (
          <div key={i} className="flex items-start gap-5 bg-background p-8 lg:p-10">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[15px] leading-[1.55] tracking-[-0.01em] text-foreground">{p}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ----------------------------- ARSENAL ----------------------------- */

function Arsenal() {
  const [active, setActive] = useState(0);
  return (
    <SectionShell id="arsenal" tone="muted">
      <SectionHead
        eyebrow="Arsenal de Fechamento"
        title="Três motores que tornam"
        italic="seu argumento à prova de balas."
        lede="A planilha de Excel é substituída por uma narrativa visual que o cliente entende, confia e fecha."
      />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:rounded-3xl lg:grid-cols-3">
        {features.map((f, i) => (
          <button
            key={f.n}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            className={`group flex flex-col gap-7 p-7 text-left transition-colors duration-300 sm:gap-10 sm:p-10 ${
              active === i
                ? "bg-primary text-primary-foreground"
                : "bg-background lg:hover:bg-background/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-[11px] tabular-nums tracking-[0.12em] ${
                  active === i ? "text-primary-foreground/60" : "text-muted-foreground"
                }`}
              >
                {f.n} — {f.kicker.toUpperCase()}
              </span>
              <ArrowUpRight
                className={`h-4 w-4 transition-transform duration-300 ${
                  active === i ? "-translate-y-0.5 translate-x-0.5" : ""
                }`}
              />
            </div>
            <h3 className="font-sans-display text-[24px] font-medium leading-[1.05] tracking-[-0.035em] sm:text-[28px] lg:text-[30px]">
              {f.title}
            </h3>
            <p
              className={`text-[14px] leading-[1.6] tracking-[-0.01em] sm:text-[14.5px] ${
                active === i ? "text-primary-foreground/75" : "text-muted-foreground"
              }`}
            >
              {f.body}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 rounded-2xl border border-border bg-background p-6 sm:mt-6 sm:rounded-3xl sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
        <div>
          <Eyebrow>Curva de Alavancagem Patrimonial</Eyebrow>
          <p className="mt-3 max-w-2xl text-[14px] leading-[1.6] tracking-[-0.01em] text-muted-foreground sm:text-[15px]">
            Gráficos interativos mostram a evolução das parcelas e o crescimento do patrimônio
            líquido contra o custo global. O cliente vê a riqueza sendo construída em tempo real.
          </p>
        </div>
        <div className="flex items-end gap-2">
          {[18, 28, 42, 60, 84].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-8 rounded-sm bg-primary/15" style={{ height: `${h}px` }}>
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${h * 0.6 + i * 6}%` }}
                />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                +{[3, 8, 16, 32, 50][i]}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

/* ----------------------------- ENTREGÁVEL ----------------------------- */

function Entregavel() {
  return (
    <SectionShell>
      <SectionHead
        eyebrow="O Entregável"
        title="Relatórios em PDF que"
        italic="gritam autoridade."
        lede="A venda não termina na mesa — termina quando o cliente discute a proposta em casa. Com um clique, o sistema exporta o Relatório de Inteligência Patrimonial: um PDF que continua vendendo por você."
      />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
        {trust.map((t, i) => (
          <div key={t.title} className="flex flex-col gap-6 bg-background p-8 lg:p-10">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-sans-display text-[20px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground">
              {t.title}
            </h3>
            <p className="text-[14.5px] leading-[1.6] tracking-[-0.01em] text-muted-foreground">
              {t.body}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ----------------------------- AUDIÊNCIA ----------------------------- */

function Audiencia() {
  return (
    <SectionShell tone="muted">
      <SectionHead
        eyebrow="Prova Lógica"
        title="Desenhado"
        italic="exclusivamente para quem atende alto padrão."
      />
      <div className="divide-y divide-border border-y border-border">
        {audience.map((a, i) => (
          <div
            key={a}
            className="flex items-start justify-between gap-4 py-5 sm:items-center sm:py-7"
          >
            <div className="flex items-start gap-4 sm:items-center sm:gap-6">
              <span className="mt-1.5 font-mono text-[11px] tabular-nums text-muted-foreground sm:mt-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-sans-display text-[17px] font-medium leading-[1.2] tracking-[-0.025em] text-foreground sm:text-[22px]">
                {a}
              </span>
            </div>
            <Check className="mt-1 h-4 w-4 shrink-0 text-foreground sm:mt-0" />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ----------------------------- PLANOS ----------------------------- */

function Planos() {
  const plans = [
    {
      name: "Mensal",
      price: "R$ 197",
      period: "/mês",
      desc: "Para testar o impacto na próxima reunião.",
      features: [
        "Acesso completo ao sistema",
        "Relatórios PDF ilimitados",
        "Atualizações contínuas",
        "Suporte por e-mail",
      ],
      cta: "Assinar mensal",
      highlight: false,
    },
    {
      name: "Anual",
      price: "R$ 1.497",
      period: "/ano",
      desc: "Economize 37% e trave o preço por 12 meses.",
      features: [
        "Tudo do plano mensal",
        "Economia de R$ 867 no ano",
        "Suporte prioritário",
        "Acesso antecipado a novos módulos",
      ],
      cta: "Quero o plano anual",
      highlight: true,
      badge: "Recomendado",
    },
  ];

  return (
    <SectionShell id="planos">
      <SectionHead
        eyebrow="Planos"
        title="Assuma o controle"
        italic="das suas vendas."
        lede="Continue perdendo tempo com planilhas que não convertem — ou invista na ferramenta que paga sua assinatura com uma única venda adicional no ano."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col justify-between rounded-3xl border p-7 sm:p-10 lg:p-12 ${
              p.highlight
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {p.badge && (
              <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-accent-foreground sm:left-10">
                {p.badge}
              </span>
            )}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-sans-display text-[28px] font-medium tracking-[-0.035em]">
                  {p.name}
                </h3>
                <Eyebrow>{p.highlight ? "Anual" : "Mensal"}</Eyebrow>
              </div>
              <p
                className={`mt-2 text-[14px] leading-[1.5] ${
                  p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {p.desc}
              </p>
              <div className="mt-10 flex items-baseline gap-1.5 sm:mt-12">
                <span className="font-sans-display text-[52px] font-medium leading-none tracking-[-0.05em] sm:text-[64px]">
                  {p.price}
                </span>
                <span
                  className={`text-[14px] ${
                    p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {p.period}
                </span>
              </div>
              <ul className="mt-10 space-y-3.5 sm:mt-12">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14.5px] tracking-[-0.01em]">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        p.highlight ? "text-primary-foreground/80" : "text-foreground"
                      }`}
                    />
                    <span
                      className={p.highlight ? "text-primary-foreground/90" : "text-foreground"}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              to="/signup"
              className={`group mt-10 inline-flex h-12 items-center justify-between rounded-full px-6 text-[14px] font-medium tracking-[-0.01em] transition-all sm:mt-14 sm:h-auto sm:py-3.5 ${
                p.highlight ? "bg-background text-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              <span>{p.cta}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ----------------------------- FAQ ----------------------------- */

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <SectionShell id="faq" tone="muted">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
        <div>
          <div className="mb-6 flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <Eyebrow>FAQ</Eyebrow>
          </div>
          <h2 className="font-sans-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1] tracking-[-0.04em] text-foreground">
            Dúvidas
            <br />
            <span className="font-display italic tracking-[-0.02em]">frequentes.</span>
          </h2>
          <p className="mt-8 max-w-sm text-[15px] leading-[1.6] tracking-[-0.01em] text-muted-foreground">
            Não encontrou sua resposta? Fale com nosso time em{" "}
            <a
              href="mailto:contato@quantocusta.app"
              className="text-foreground underline decoration-foreground/30 underline-offset-4"
            >
              contato@quantocusta.app
            </a>
            .
          </p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <button
                key={i}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full flex-col gap-3 py-6 text-left sm:gap-4 sm:py-7"
              >
                <div className="flex items-start justify-between gap-4 sm:gap-6">
                  <span className="font-sans-display text-[16px] font-medium leading-[1.25] tracking-[-0.025em] text-foreground sm:text-[20px]">
                    {f.q}
                  </span>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border">
                    {isOpen ? (
                      <Minus className="h-3.5 w-3.5 text-foreground" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-foreground" />
                    )}
                  </span>
                </div>
                {isOpen && (
                  <p className="max-w-2xl pr-10 text-[14px] leading-[1.65] tracking-[-0.01em] text-muted-foreground sm:pr-12 sm:text-[15px]">
                    {f.a}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

/* ----------------------------- FINAL CTA ----------------------------- */

function FinalCTA() {
  const { isAuthenticated } = useAuth();
  return (
    <SectionShell>
      <div className="relative overflow-hidden rounded-[1.5rem] bg-primary p-8 text-primary-foreground sm:rounded-[2rem] sm:p-12 lg:p-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(50% 60% at 80% 20%, oklch(0.78 0.05 150 / 0.6), transparent 70%)",
          }}
        />
        <div className="relative grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <h2 className="font-sans-display max-w-[14ch] text-[clamp(2rem,7vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.045em]">
            Pare de explicar.
            <br />
            <span className="font-display italic tracking-[-0.02em] text-primary-foreground/60">
              Comece a provar.
            </span>
          </h2>
          <div className="space-y-6 sm:space-y-8">
            <p className="text-[15px] leading-[1.6] tracking-[-0.01em] text-primary-foreground/75 sm:text-[17px]">
              Acesse o Sistema de Inteligência Patrimonial e transforme a próxima reunião em um
              fechamento high ticket.
            </p>
            <Link
              to={isAuthenticated ? "/app" : "/signup"}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-background px-6 text-[14px] font-medium tracking-[-0.01em] text-foreground transition-all hover:gap-3 sm:h-auto sm:w-auto sm:py-3.5"
            >
              {isAuthenticated ? "Abrir Plataforma" : "Quero assinar agora"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ----------------------------- FOOTER ----------------------------- */

function Footer() {
  return (
    <footer className="bg-background">
      <div
        className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 text-[13px] text-muted-foreground sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
      >
        <div className="flex items-center gap-6">
          <Logo />
          <span className="hidden sm:inline">
            <Eyebrow>v7.4 — Sinergia Total</Eyebrow>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 tracking-[-0.01em]">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-foreground">
              {n.label}
            </a>
          ))}
        </div>
        <p className="font-mono text-[11px] tracking-[0.05em]">
          © {new Date().getFullYear()} Quanto Custa? Imobiliário
        </p>
      </div>
    </footer>
  );
}

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
    <div
      className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 pointer-events-none"
      }`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="mx-3 rounded-full border border-border bg-background/85 p-1.5 shadow-xl backdrop-blur-xl">
        <Link
          to={isAuthenticated ? "/app" : "/signup"}
          className="group flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium tracking-[-0.01em] text-primary-foreground"
        >
          {isAuthenticated ? "Abrir App" : "Multiplicar meus fechamentos"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

/* ----------------------------- PAGE ----------------------------- */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Problema />
        <Solucao />
        <Arsenal />
        <Entregavel />
        <Audiencia />
        <Planos />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <MobileCTA />
    </div>
  );
}
