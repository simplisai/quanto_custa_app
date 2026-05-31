import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OPERATIONS } from "@/lib/operations";
import { SEED_CONFIGS } from "@/lib/simulator-seed-configs";
import type { SimulatorConfigRow } from "@/lib/simulator-config.types";
import {
  Calculator, ChevronRight, CheckCircle2, Code2, Sparkles, RefreshCw, BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/simuladores")({
  component: AdminSimuladoresPage,
});

type PublishedMap = Record<string, SimulatorConfigRow | undefined>;

function AdminSimuladoresPage() {
  const [published, setPublished] = useState<PublishedMap>({});
  const [allVersionCounts, setAllVersionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  async function loadData() {
    setLoading(true);
    const [pubRes, cntRes] = await Promise.all([
      supabase
        .from("simulator_configs" as "templates")
        .select("*")
        .eq("is_published" as "is_default", true) as unknown as Promise<{ data: SimulatorConfigRow[] | null }>,
      supabase
        .from("simulator_configs" as "templates")
        .select("slug, version_number") as unknown as Promise<{ data: { slug: string; version_number: number }[] | null }>,
    ]);

    const pubMap: PublishedMap = {};
    for (const row of pubRes.data ?? []) {
      pubMap[row.slug] = row;
    }

    const counts: Record<string, number> = {};
    for (const row of cntRes.data ?? []) {
      counts[row.slug] = (counts[row.slug] ?? 0) + 1;
    }

    setPublished(pubMap);
    setAllVersionCounts(counts);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function seedAll() {
    setSeeding(true);
    let ok = 0;
    for (const cfg of SEED_CONFIGS) {
      // Check if any version already exists for this slug
      const { data: existing } = await supabase
        .from("simulator_configs" as "templates")
        .select("id")
        .eq("slug" as "operation_slug", cfg.slug)
        .limit(1) as unknown as { data: { id: string }[] | null };

      if (existing && existing.length > 0) continue; // skip if exists

      const { error } = await supabase
        .from("simulator_configs" as "templates")
        .insert({
          slug: cfg.slug,
          version_number: 1,
          version_label: cfg.version_label,
          notes: cfg.notes,
          config: cfg.config,
          is_published: false,
        } as unknown as Record<string, unknown>);

      if (!error) ok++;
      else toast.error(`Erro ao seeder ${cfg.slug}: ${error.message}`);
    }
    toast.success(`${ok} config(s) criada(s) como rascunho v1.`);
    await loadData();
    setSeeding(false);
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gerenciar Simuladores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audite e corrija as fórmulas de cada simulador. Versões publicadas entram em produção imediatamente.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/campos"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-accent"
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Campos Canônicos
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={seedAll}
            disabled={seeding || loading}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {seeding ? "Criando…" : "Criar configs v1 (seed)"}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          Versão publicada no DB (motor de fórmulas ativo)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          TypeScript (padrão — sem config publicada)
        </span>
      </div>

      {/* Simulator cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {OPERATIONS.map((op) => {
          const pub = published[op.slug];
          const vCount = allVersionCounts[op.slug] ?? 0;

          return (
            <div
              key={op.slug}
              className={[
                "rounded-2xl border p-4 transition-all",
                pub ? "border-green-500/30 bg-green-500/5" : "border-border bg-card",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{op.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-foreground">{op.name}</span>
                    {pub ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                        <CheckCircle2 className="h-2.5 w-2.5" /> DB v{pub.version_number}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        <Code2 className="h-2.5 w-2.5" /> TypeScript (padrão)
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{op.slug}</p>

                  {pub && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {pub.version_label || `Versão ${pub.version_number}`}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calculator className="h-3 w-3" />
                      {vCount === 0
                        ? "Sem versões no DB"
                        : `${vCount} versão${vCount > 1 ? "ões" : ""}`}
                    </span>
                    {pub && (
                      <span>
                        Publicada {new Date(pub.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  to="/admin/simuladores/$slug"
                  params={{ slug: op.slug }}
                  className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent shrink-0"
                >
                  Gerenciar <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-extrabold">Como funciona o motor de fórmulas</h3>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-bold text-foreground">1. Criar config</p>
            <p>Clique "Gerenciar" num simulador. Use "Seed v1" para criar uma cópia inicial das fórmulas TypeScript, ou crie do zero.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">2. Editar e testar</p>
            <p>Edite fórmulas, campos e timeline. O testador ao lado mostra resultados em tempo real. Valide que os números estão corretos.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">3. Publicar</p>
            <p>Quando confirmado, publique a versão. O simulador passa a usar o motor de fórmulas DB. Para reverter, publique qualquer versão anterior.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
