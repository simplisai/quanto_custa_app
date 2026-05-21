import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"users" | "plans">("users");

  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/app" });
  }, [loading, isAdmin, nav]);

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: subs } = await supabase.from("subscriptions").select("*, plans(name)");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return profiles.map((p) => ({
        ...p,
        subscription: subs?.find((s) => s.user_id === p.id),
        roles: roles?.filter((r) => r.user_id === p.id).map((r) => r.role) || [],
      }));
    },
  });

  const plansQ = useQuery({
    queryKey: ["admin-plans"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const toggleAdmin = async (userId: string, isAdminNow: boolean) => {
    if (isAdminNow) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
    }
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const changePlan = async (userId: string, planId: string) => {
    const { error } = await supabase
      .from("subscriptions")
      .upsert({ user_id: userId, plan_id: planId }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const toggleSub = async (userId: string, currentStatus: string) => {
    const next = currentStatus === "active" ? "blocked" : "active";
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: next })
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "Acesso liberado" : "Acesso bloqueado");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    monthly_simulation_limit: "",
  });
  const createPlan = async () => {
    if (!newPlan.name) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("plans").insert({
      name: newPlan.name,
      description: newPlan.description || null,
      monthly_simulation_limit: newPlan.monthly_simulation_limit
        ? parseInt(newPlan.monthly_simulation_limit)
        : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Plano criado");
    setNewPlan({ name: "", description: "", monthly_simulation_limit: "" });
    qc.invalidateQueries({ queryKey: ["admin-plans"] });
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Administração</h1>
      <div className="flex gap-2 border-b border-border">
        {(["users", "plans"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold transition ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "users" ? "Usuários & Assinaturas" : "Planos"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Usuário</th>
                <th className="p-3 text-left">Plano</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Admin</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {usersQ.data?.map(
                (u: Record<string, string | string[] | Record<string, unknown>>) => {
                  const roles = u.roles as string[];
                  const isAdminUser = roles.includes("admin");
                  return (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3">
                        <div className="font-semibold">{u.full_name || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.subscription?.plan_id || ""}
                          onChange={(e) => changePlan(u.id, e.target.value)}
                          className="rounded border border-input bg-background px-2 py-1 text-xs"
                        >
                          {plansQ.data?.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.subscription?.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}
                        >
                          {u.subscription?.status || "—"}
                        </span>
                      </td>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isAdminUser}
                          onChange={() => toggleAdmin(u.id, isAdminUser)}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toggleSub(u.id, u.subscription?.status || "active")}
                          className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"
                        >
                          {u.subscription?.status === "active" ? "Bloquear" : "Liberar"}
                        </button>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
              Criar novo plano
            </h3>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                placeholder="Nome"
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder="Descrição"
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2"
              />
              <input
                placeholder="Limite mensal (opcional)"
                value={newPlan.monthly_simulation_limit}
                onChange={(e) =>
                  setNewPlan({ ...newPlan, monthly_simulation_limit: e.target.value })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={createPlan}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Adicionar plano
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Descrição</th>
                  <th className="p-3 text-left">Limite/mês</th>
                  <th className="p-3 text-left">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {plansQ.data?.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{p.description || "—"}</td>
                    <td className="p-3">{p.monthly_simulation_limit ?? "Ilimitado"}</td>
                    <td className="p-3">{p.is_active ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
