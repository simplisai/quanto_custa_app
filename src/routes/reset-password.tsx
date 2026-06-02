import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const nav = useNavigate();
  // true = session ready for password update
  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [busy, setBusy]         = useState(false);

  // Ref avoids stale closure no setTimeout
  const readyRef = useRef(false);

  const markReady = () => {
    readyRef.current = true;
    setReady(true);
  };

  useEffect(() => {
    // ── Verificação imediata da URL ────────────────────────────
    // Fluxo implícito: hash contém access_token + type=recovery
    // Fluxo PKCE:      query string contém ?code=xxx
    const hash   = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);

    const hasImplicit = hash.get("type") === "recovery" && !!hash.get("access_token");
    const hasPkce     = !!search.get("code");

    if (hasImplicit || hasPkce) {
      // URL válida — aguarda Supabase estabelecer a sessão (evento abaixo)
      // mas já sabemos que o link é legítimo
    }

    // ── Listener de sessão ─────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // PASSWORD_RECOVERY: fluxo implícito
      // SIGNED_IN: dispara após troca de code PKCE em alguns fluxos
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady();
      }
    });

    // Timeout de segurança — usa ref para evitar stale closure
    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        toast.error("Link inválido ou expirado. Solicite um novo.");
        nav({ to: "/forgot-password" });
      }
    }, 8000); // 8s dá tempo para troca de código PKCE

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // nav não muda — omitir da dep evita re-montagem acidental
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    await supabase.auth.signOut();
    nav({ to: "/login" });
  };

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
          <h1 className="mt-6 text-2xl font-extrabold text-center">Nova senha</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Escolha uma senha segura com no mínimo 8 caracteres.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Nova senha</label>
              <div className="relative">
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none"
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={8}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Confirmar nova senha</label>
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                type={showPwd ? "text" : "password"}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-[13px] text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
