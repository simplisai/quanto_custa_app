import { createFileRoute, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ArrowRight } from "lucide-react";
import { readReferralCode } from "@/routes/$referralCode";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const PLAN_LABELS: Record<string, { label: string; price: string }> = {
  monthly: { label: "Mensal", price: "R$ 99/mês" },
  annual:  { label: "Anual",  price: "R$ 799/ano" },
};

function SignupPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Read plan param from URL — passed from landing page plan buttons
  const planParam = new URLSearchParams(location.search).get("plan") ?? "";
  const planInfo = PLAN_LABELS[planParam] ?? null;
  const emailRedirectTo = typeof window !== "undefined"
    ? window.location.origin + (planParam ? `/checkout?plan=${planParam}` : "/app")
    : "/app";

  const goAfterAuth = () => {
    if (planParam) {
      nav({ to: `/checkout?plan=${planParam}` as any });
    } else {
      nav({ to: "/app" });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('=== Iniciando cadastro ===');
    console.log('Nome:', fullName);
    console.log('Email:', email);
    console.log('Password:', password ? '****' : 'vazio');
    console.log('Plan Param:', planParam);
    console.log('Email Redirect:', emailRedirectTo);
    
    if (!email || !password || !fullName) {
      toast.error("Preencha todos os campos!");
      return;
    }
    
    setBusy(true);
    
    try {
      // Código de indicação capturado no clique do link (/{code}) — enviado no
      // metadata para que o trigger handle_new_user grave o vínculo no servidor,
      // imune ao localStorage expirar entre o cadastro e o checkout.
      const referralCode = readReferralCode() ?? undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: { full_name: fullName, ...(referralCode ? { referral_code: referralCode } : {}) },
        },
      });
      
      console.log('=== Supabase Response ===');
      console.log('Data:', data);
      console.log('Error:', error);
      
      setBusy(false);
      
      if (error) {
        console.error('Signup Error:', error);
        toast.error(error.message);
        return;
      }
      
      toast.success("Conta criada com sucesso!");
      
      // Sempre tenta redirecionar (mesmo que precise confirmar email depois)
      goAfterAuth();
      
    } catch (err) {
      console.error('Unexpected error:', err);
      setBusy(false);
      toast.error("Ocorreu um erro. Tente novamente.");
    }
  };

  const google = async () => {
    const referralCode = readReferralCode() ?? undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: emailRedirectTo,
        queryParams: referralCode ? { referral_code: referralCode } : undefined,
        data: referralCode ? { referral_code: referralCode } : undefined,
      },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-5">

        {/* Plan context banner */}
        {planInfo && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Você selecionou
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-sans-display text-xl font-medium tracking-tight text-foreground">
                Plano {planInfo.label}
              </span>
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                {planInfo.price}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Crie sua conta para continuar para o checkout.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">
              ← Voltar
            </Link>
          </div>
          <div className="mt-4 flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold text-center">Criar conta</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {planInfo ? "Preencha seus dados para ir ao checkout." : "Comece a usar gratuitamente no plano Teste."}
          </p>

          <button
            onClick={google}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-accent"
          >
            Continuar com Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Nome completo</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">E-mail</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Senha (mín. 6 caracteres)</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Criando..." : planInfo ? (
                <>Criar conta e ir ao checkout <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
              ) : "Criar conta"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link
              to={`/login${planParam ? `?plan=${planParam}` : ""}`}
              className="font-semibold text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
