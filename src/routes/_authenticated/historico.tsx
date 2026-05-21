import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/historico")({ component: HistoryPage });

function HistoryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["simulations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Histórico de Simulações</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Nenhuma simulação salva ainda.
        </div>
      )}
      <div className="space-y-3">
        {data?.map((s) => {
          const r: Record<string, unknown> = s.results as Record<string, unknown>;
          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="text-sm font-bold">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span>
                    SAC <b>{fmtBRL(r?.tSAC ?? 0)}</b>
                  </span>
                  <span>
                    PRICE <b>{fmtBRL(r?.tPrice ?? 0)}</b>
                  </span>
                  <span>
                    Consórcio <b>{fmtBRL(r?.tCons ?? 0)}</b>
                  </span>
                  <span className="text-success">
                    Patrimônio <b>{fmtBRL(r?.patrimonioConsTotal ?? 0)}</b>
                  </span>
                </div>
              </div>
              <button
                onClick={() => del.mutate(s.id)}
                className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Excluir
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
