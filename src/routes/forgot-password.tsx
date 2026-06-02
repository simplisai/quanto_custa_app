import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const redirectTo = typeof window !== "undefined"
      ? window.location.origin + "/reset-password"
      : "/reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
          <div className="flex items-center justify-between">
            <Link to="/login" className="text-xs text-muted-foreground hover:underline">
              ← Voltar ao login
            </Link>
          </div>
          <div className="mt-4 flex justify-center">
            <Logo size="lg" />
          </div>

          {sent ? (
            <div className="mt-8 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-extrabold">Verifique seu e-mail</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de redefinição para <span className="font-semibold text-foreground">{email}</span>.
                Verifique sua caixa de entrada e a pasta de spam.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-extrabold text-center">Esqueceu sua senha?</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">E-mail</label>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-[13px] text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Enviando…" : "Enviar link de redefinição"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
