import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/app", data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail se necessário.");
    nav({ to: "/app" });
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (r.error) toast.error(r.error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/" className="text-xs text-muted-foreground hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comece a usar gratuitamente no plano Teste.
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
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Criando..." : "Criar conta"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
