import { createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/checkout")({ component: CheckoutPage });

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHLY_PRICE   = "R$ 99,00/mês";
const ANNUAL_PRICE    = "R$ 799,00/ano";
const ANNUAL_MONTHLY  = "R$ 66,58/mês";

// ─── Formatters ──────────────────────────────────────────────────────────────

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) =>
    e ? `${a}.${b}.${c}-${e}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a
  );
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCard(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
function maskExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
function rawDigits(v: string) {
  return v.replace(/\D/g, "");
}

// ─── CPF Validation ───────────────────────────────────────────────────────────

function validateCPF(cpf: string): boolean {
  const d = rawDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = 11 - (sum % 11);
  if (r >= 10) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = 11 - (sum % 11);
  if (r >= 10) r = 0;
  return r === +d[10];
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text", required = true, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-foreground/80">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
      />
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
      <span>{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CheckoutPage() {
  const nav      = useNavigate();
  const location = useLocation();

  // Determine plan from URL (?plan=monthly|annual)
  // Also try localStorage (set before Google OAuth redirect)
  const planParam = new URLSearchParams(location.search).get("plan")
    ?? (typeof localStorage !== "undefined" ? localStorage.getItem("checkout_plan") : null)
    ?? "monthly";
  const initialCycle: "monthly" | "annual" = planParam === "annual" ? "annual" : "monthly";

  // Session state
  const [sessionLoading, setSessionLoading] = useState(true);
  const [existingUser, setExistingUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "annual">(initialCycle);

  // Account fields (only for new users)
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // Personal data (always required)
  const [cpf, setCpf]           = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone]       = useState("");

  // Address
  const [cep, setCep]               = useState("");
  const [street, setStreet]         = useState("");
  const [number, setNumber]         = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity]             = useState("");
  const [state, setState]           = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  // Card
  const [cardNumber, setCardNumber]   = useState("");
  const [cardHolder, setCardHolder]   = useState("");
  const [cardExpiry, setCardExpiry]   = useState("");
  const [cardCvv, setCardCvv]         = useState("");

  const [submitting, setSubmitting]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  // ── Detect existing session (Google OAuth callback or already logged in) ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setExistingUser({
          id:    session.user.id,
          email: session.user.email ?? "",
          name:  session.user.user_metadata?.full_name as string | undefined,
        });
        // Pre-fill name/email from session
        setEmail(session.user.email ?? "");
        setName(session.user.user_metadata?.full_name ?? "");
        // Clear saved plan after successful OAuth return
        if (typeof localStorage !== "undefined") localStorage.removeItem("checkout_plan");
      }
      setSessionLoading(false);
    });
  }, []);

  // Sync cycle with URL plan param (on mount only)
  useEffect(() => {
    setCycle(initialCycle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CEP lookup ───────────────────────────────────────────────────────────
  const lookupCep = async (rawCep: string) => {
    const d = rawDigits(rawCep);
    if (d.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json() as {
        erro?: boolean; logradouro?: string; bairro?: string;
        localidade?: string; uf?: string;
      };
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      setStreet(data.logradouro ?? "");
      setNeighborhood(data.bairro ?? "");
      setCity(data.localidade ?? "");
      setState(data.uf ?? "");
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  // ── Google OAuth ─────────────────────────────────────────────────────────
  const handleGoogleAuth = async () => {
    // Save plan to localStorage so it survives the OAuth redirect
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("checkout_plan", cycle);
    }
    setOauthLoading(true);
    try {
      const redirectUri = typeof window !== "undefined"
        ? `${window.location.origin}/checkout?plan=${cycle}`
        : `/checkout?plan=${cycle}`;

      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUri });
      if (result.error) {
        toast.error("Erro ao iniciar login com Google.");
        setOauthLoading(false);
      }
      // If result.redirected === true, browser is redirecting — nothing to do
    } catch {
      toast.error("Erro ao iniciar login com Google.");
      setOauthLoading(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCPF(cpf)) { toast.error("CPF inválido"); return; }
    const expiryParts = cardExpiry.split("/");
    if (expiryParts.length !== 2 || rawDigits(cardExpiry).length < 6) {
      toast.error("Validade do cartão inválida (MM/AAAA)"); return;
    }
    if (rawDigits(cardNumber).length < 13) { toast.error("Número de cartão inválido"); return; }
    if (cardCvv.length < 3) { toast.error("CVV inválido"); return; }
    if (!existingUser && password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres"); return;
    }

    setSubmitting(true);
    try {
      if (existingUser) {
        // ── Authenticated path (Google OAuth or existing session) ─────────
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { toast.error("Sessão expirada. Recarregue a página."); return; }

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-subscription`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              idempotencyKey: idempotencyKey.current,
              billingCycle: cycle,
              customer: {
                name: name.trim(),
                email: email.trim(),
                cpf: rawDigits(cpf),
                birthDate,
                phone: rawDigits(phone),
              },
              address: {
                street: street.trim(),
                number: number.trim(),
                complement: complement.trim() || undefined,
                neighborhood: neighborhood.trim(),
                city: city.trim(),
                state: state.trim().toUpperCase(),
                zipCode: rawDigits(cep),
              },
              card: {
                holderName: cardHolder.trim().toUpperCase(),
                number: rawDigits(cardNumber),
                securityCode: cardCvv.trim(),
                expiry: cardExpiry,
              },
            }),
          }
        );
        const body2 = await res.json() as { error?: string; subscriptionId?: string };
        if (!res.ok) { toast.error(body2.error ?? "Erro ao processar pagamento"); return; }

        toast.success("Trial iniciado! 14 dias grátis.");
        nav({ to: "/assinatura" });

      } else {
        // ── New user path — call checkout-subscribe ───────────────────────
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkout-subscribe`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              idempotencyKey: idempotencyKey.current,
              billingCycle: cycle,
              customer: {
                name: name.trim(),
                email: email.trim(),
                password,
                cpf: rawDigits(cpf),
                birthDate,
                phone: rawDigits(phone),
              },
              address: {
                street: street.trim(),
                number: number.trim(),
                complement: complement.trim() || undefined,
                neighborhood: neighborhood.trim(),
                city: city.trim(),
                state: state.trim().toUpperCase(),
                zipCode: rawDigits(cep),
              },
              card: {
                holderName: cardHolder.trim().toUpperCase(),
                number: rawDigits(cardNumber),
                securityCode: cardCvv.trim(),
                expiry: cardExpiry,
              },
            }),
          }
        );

        const body3 = await res.json() as {
          error?: string; code?: string;
          success?: boolean; subscriptionId?: string;
        };

        if (!res.ok) {
          if (body3.code === "EMAIL_EXISTS") {
            toast.error("E-mail já cadastrado. Faça login para continuar.", { duration: 6000 });
            // Redirect to login with plan param so they can come back to checkout
            nav({ to: `/login?plan=${cycle}` as any });
            return;
          }
          toast.error(body3.error ?? "Erro ao processar pagamento");
          return;
        }

        // Sign in client-side now that the account exists
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) {
          // Payment succeeded, account created, but sign-in failed
          // Just redirect to login — they can log in with their new credentials
          toast.success("Conta criada! Faça login para acessar a plataforma.");
          nav({ to: "/login" });
          return;
        }

        toast.success("Trial iniciado! 14 dias grátis. Bem-vindo ao Quanto Custa!");
        nav({ to: "/assinatura" });
      }
    } catch (err) {
      toast.error((err as Error).message || "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  const trialEndDate = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString("pt-BR");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </a>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Já tem conta?</span>
            <Link
              to={`/login?plan=${cycle}` as any}
              className="font-semibold text-primary hover:underline"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Hero */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Checkout</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Assinar o Quanto Custa</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            14 dias grátis · sem compromisso · cancele quando quiser
          </p>
        </header>

        {/* Plan selector */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <SectionHeader>Escolha o plano</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-xl border-2 p-4 text-left transition ${
                cycle === "monthly" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mensal</div>
              <div className="mt-1 text-2xl font-extrabold">R$ 99</div>
              <div className="text-xs text-muted-foreground">por mês</div>
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`relative rounded-xl border-2 p-4 text-left transition ${
                cycle === "annual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="absolute -top-2.5 right-3 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                -33%
              </div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Anual</div>
              <div className="mt-1 text-2xl font-extrabold">R$ 66</div>
              <div className="text-xs text-muted-foreground">por mês · R$ 799/ano</div>
            </button>
          </div>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 px-4 py-2.5 text-sm font-semibold text-green-700 dark:text-green-400">
            14 dias grátis — sem cobrança até {trialEndDate}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account section — only for new users */}
          {!existingUser && (
            <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <SectionHeader>Criar sua conta</SectionHeader>

              {/* Google OAuth button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:bg-accent disabled:opacity-50"
              >
                {oauthLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {oauthLoading ? "Aguardando Google…" : "Continuar com Google"}
              </button>

              <div className="relative flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">ou com e-mail</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Field
                label="Nome completo"
                value={name}
                onChange={setName}
                placeholder="João da Silva"
                autoComplete="name"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
                <Field
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>
            </section>
          )}

          {/* Google user banner */}
          {existingUser && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Conectado como</p>
                <p className="text-sm font-semibold">{existingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setExistingUser(null);
                  setEmail("");
                  setName("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Trocar conta
              </button>
            </div>
          )}

          {/* Personal data */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <SectionHeader>Dados pessoais</SectionHeader>
            {existingUser && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome completo" value={name} onChange={setName} placeholder="João da Silva" autoComplete="name" />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="CPF"
                value={cpf}
                onChange={(v) => setCpf(maskCPF(v))}
                placeholder="000.000.000-00"
                autoComplete="off"
              />
              <Field
                label="Data de nascimento"
                type="date"
                value={birthDate}
                onChange={setBirthDate}
                autoComplete="bday"
              />
            </div>
            <div className="md:w-1/2">
              <Field
                label="Telefone"
                value={phone}
                onChange={(v) => setPhone(maskPhone(v))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </div>
          </section>

          {/* Address */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <SectionHeader>Endereço de cobrança</SectionHeader>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground/80">
                  CEP<span className="ml-0.5 text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={cep}
                    onChange={(e) => setCep(maskCEP(e.target.value))}
                    onBlur={() => lookupCep(cep)}
                    placeholder="00000-000"
                    required
                    autoComplete="postal-code"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => lookupCep(cep)}
                    disabled={loadingCep}
                    className="rounded-lg border border-border px-3 py-2.5 text-xs font-semibold hover:bg-accent disabled:opacity-50 transition"
                  >
                    {loadingCep ? "…" : "Buscar"}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <Field label="Logradouro" value={street} onChange={setStreet} placeholder="Rua das Flores" autoComplete="street-address" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Número" value={number} onChange={setNumber} placeholder="123" />
              <Field label="Complemento" value={complement} onChange={setComplement} placeholder="Apto 4" required={false} />
              <Field label="Bairro" value={neighborhood} onChange={setNeighborhood} placeholder="Centro" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Field label="Cidade" value={city} onChange={setCity} placeholder="São Paulo" autoComplete="address-level2" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground/80">
                  Estado<span className="ml-0.5 text-red-500">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none transition"
                >
                  <option value="">UF</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Card */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <SectionHeader>Cartão de crédito</SectionHeader>
            <Field
              label="Número do cartão"
              value={cardNumber}
              onChange={(v) => setCardNumber(maskCard(v))}
              placeholder="0000 0000 0000 0000"
              autoComplete="cc-number"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <Field
                  label="Nome no cartão"
                  value={cardHolder}
                  onChange={(v) => setCardHolder(v.toUpperCase())}
                  placeholder="JOÃO DA SILVA"
                  autoComplete="cc-name"
                />
              </div>
              <Field
                label="Validade (MM/AAAA)"
                value={cardExpiry}
                onChange={(v) => setCardExpiry(maskExpiry(v))}
                placeholder="12/2028"
                autoComplete="cc-exp"
              />
              <Field
                label="CVV"
                value={cardCvv}
                onChange={(v) => setCardCvv(v.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                type="password"
                autoComplete="cc-csc"
              />
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              🔒 Seus dados de cartão são enviados diretamente ao gateway de pagamento. Não armazenamos o número completo.
            </div>
          </section>

          {/* Submit */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={submitting || oauthLoading}
              className="w-full rounded-xl bg-primary px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-50 transition"
            >
              {submitting
                ? "Processando…"
                : `Iniciar trial gratuito de 14 dias — ${cycle === "monthly" ? MONTHLY_PRICE : ANNUAL_PRICE} após`}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Após o trial, {cycle === "monthly"
                ? MONTHLY_PRICE
                : `${ANNUAL_MONTHLY} (cobrado como ${ANNUAL_PRICE})`}.
              Cancele a qualquer momento antes do fim do trial sem nenhuma cobrança.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}

// ─── Google Icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M47.532 24.552c0-1.636-.132-3.2-.378-4.704H24v9.02h13.2c-.576 3.072-2.28 5.676-4.848 7.404v6.156h7.848c4.584-4.224 7.332-10.44 7.332-17.876z" fill="#4285F4"/>
      <path d="M24 48c6.6 0 12.132-2.184 16.176-5.916l-7.848-6.156c-2.184 1.464-4.98 2.328-8.328 2.328-6.396 0-11.82-4.32-13.752-10.128H2.136v6.36C6.156 42.564 14.532 48 24 48z" fill="#34A853"/>
      <path d="M10.248 28.128A14.396 14.396 0 0 1 9.6 24c0-1.428.24-2.808.648-4.128V13.512H2.136A23.953 23.953 0 0 0 0 24c0 3.864.924 7.512 2.136 10.488l8.112-6.36z" fill="#FBBC05"/>
      <path d="M24 9.744c3.612 0 6.84 1.236 9.396 3.672l7.02-7.02C36.132 2.4 30.6 0 24 0 14.532 0 6.156 5.436 2.136 13.512l8.112 6.36C12.18 14.064 17.604 9.744 24 9.744z" fill="#EA4335"/>
    </svg>
  );
}
