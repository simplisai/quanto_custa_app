import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/assinar")({ component: AssinarPage });

// ── Formatters ────────────────────────────────────────────────────────────────

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

// ── CPF Validation ────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text", required = true,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-foreground/80">
        {label}{required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
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

// ── Main Page ─────────────────────────────────────────────────────────────────

function AssinarPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  // Read plan from URL — e.g. /assinar?plan=annual
  const planParam = new URLSearchParams(location.search).get("plan");
  const initialCycle: "monthly" | "annual" = planParam === "annual" ? "annual" : "monthly";

  const [checking, setChecking] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "annual">(initialCycle);

  // Customer
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  // Address
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  // Card
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  // Check if user already has active subscription
  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .not("status", "in", "(canceled,expired)")
      .maybeSingle()
      .then(({ data }) => {
        if (data) nav({ to: "/assinatura" });
        else setChecking(false);
      });
  }, [user, nav]);

  // Pre-fill email from auth
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  // CEP lookup
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCPF(cpf)) { toast.error("CPF inválido"); return; }
    const expiryParts = cardExpiry.split("/");
    if (expiryParts.length !== 2 || rawDigits(cardExpiry).length < 6) {
      toast.error("Validade do cartão inválida (MM/AAAA)"); return;
    }
    if (rawDigits(cardNumber).length < 13) { toast.error("Número de cartão inválido"); return; }
    if (cardCvv.length < 3) { toast.error("CVV inválido"); return; }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada, faça login novamente"); return; }

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

      const body = await res.json() as { error?: string; subscriptionId?: string };

      if (!res.ok) {
        toast.error(body.error ?? "Erro ao processar pagamento");
        return;
      }

      toast.success("Trial iniciado! 14 dias grátis.");
      nav({ to: "/assinatura" });
    } catch (e) {
      toast.error((e as Error).message || "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Verificando assinatura…
      </div>
    );
  }

  const monthlyPrice = "R$ 99,00/mês";
  const annualPrice = "R$ 799,00/ano";
  const annualMonthly = "R$ 66,58/mês";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
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
              cycle === "monthly"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mensal</div>
            <div className="mt-1 text-2xl font-extrabold">R$ 99</div>
            <div className="text-xs text-muted-foreground">por mês</div>
          </button>
          <button
            type="button"
            onClick={() => setCycle("annual")}
            className={`rounded-xl border-2 p-4 text-left transition relative ${
              cycle === "annual"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="absolute -top-2 right-3 rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-success-foreground">
              Melhor valor
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Anual</div>
            <div className="mt-1 text-2xl font-extrabold">R$ 66</div>
            <div className="text-xs text-muted-foreground">por mês · R$ 799/ano</div>
          </button>
        </div>
        <div className="rounded-lg bg-success/10 px-4 py-2.5 text-sm font-semibold text-success-foreground">
          14 dias grátis — sem cobrança até {new Date(Date.now() + 14 * 86_400_000).toLocaleDateString("pt-BR")}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal data */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <SectionHeader>Seus dados</SectionHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo" value={name} onChange={setName} placeholder="João da Silva" />
            <Field
              label="CPF"
              value={cpf}
              onChange={(v) => setCpf(maskCPF(v))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" />
            <Field
              label="Data de nascimento"
              type="date"
              value={birthDate}
              onChange={setBirthDate}
              placeholder="1990-01-01"
            />
          </div>
          <div className="md:w-1/2">
            <Field
              label="Telefone (celular)"
              value={phone}
              onChange={(v) => setPhone(maskPhone(v))}
              placeholder="(11) 99999-9999"
            />
          </div>
        </section>

        {/* Address */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <SectionHeader>Endereço de cobrança</SectionHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/80">
                CEP<span className="ml-0.5 text-danger">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={cep}
                  onChange={(e) => setCep(maskCEP(e.target.value))}
                  onBlur={() => lookupCep(cep)}
                  placeholder="00000-000"
                  required
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
                <button
                  type="button"
                  onClick={() => lookupCep(cep)}
                  disabled={loadingCep}
                  className="rounded-lg border border-border px-3 py-2.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                >
                  {loadingCep ? "…" : "Buscar"}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <Field label="Logradouro" value={street} onChange={setStreet} placeholder="Rua das Flores" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Número" value={number} onChange={setNumber} placeholder="123" />
            <Field label="Complemento" value={complement} onChange={setComplement} placeholder="Apto 4" required={false} />
            <Field label="Bairro" value={neighborhood} onChange={setNeighborhood} placeholder="Centro" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Field label="Cidade" value={city} onChange={setCity} placeholder="São Paulo" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground/80">
                Estado<span className="ml-0.5 text-danger">*</span>
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
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
          />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <Field
                label="Nome no cartão"
                value={cardHolder}
                onChange={(v) => setCardHolder(v.toUpperCase())}
                placeholder="JOÃO DA SILVA"
              />
            </div>
            <Field
              label="Validade (MM/AAAA)"
              value={cardExpiry}
              onChange={(v) => setCardExpiry(maskExpiry(v))}
              placeholder="12/2028"
            />
            <Field
              label="CVV"
              value={cardCvv}
              onChange={(v) => setCardCvv(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              type="password"
            />
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Seus dados de cartão são enviados diretamente ao gateway de pagamento. Não armazenamos o número completo.
          </div>
        </section>

        {/* Submit */}
        <div className="space-y-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant hover:opacity-95 disabled:opacity-50"
          >
            {submitting
              ? "Processando…"
              : `Iniciar trial gratuito de 14 dias — ${cycle === "monthly" ? monthlyPrice : annualMonthly + ` (total ${annualPrice})`} após`}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Após o trial, {cycle === "monthly" ? monthlyPrice : `${annualMonthly} (cobrado como ${annualPrice})`}.
            Cancele a qualquer momento antes do fim do trial sem nenhuma cobrança.
          </p>
        </div>
      </form>
    </div>
  );
}
