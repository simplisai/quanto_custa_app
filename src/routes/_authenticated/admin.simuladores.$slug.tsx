import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { OPERATIONS } from "@/lib/operations";
import { SEED_CONFIGS } from "@/lib/simulator-seed-configs";
import { runSimulatorConfig } from "@/lib/formula-engine";
import type { SimulatorConfig, SimulatorConfigRow } from "@/lib/simulator-config.types";
import { VersionCard } from "@/components/admin/VersionCard";
import { SimuladorDebuggerPanel } from "@/components/admin/SimuladorDebuggerPanel";
import { FormulaEditorV2 } from "@/components/admin/FormulaEditorV2";
import { ArrowLeft, Save, Sparkles, History, FlaskConical, BookOpen, Beaker } from "lucide-react";
// BookOpen is used for the canonical fields link in the header

export const Route = createFileRoute("/_authenticated/admin/simuladores/$slug")({
  component: AdminSimuladorEditorPage,
});

// ─── Helper: deep clone ───────────────────────────────────────────────────────
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Tab = "formulas" | "debugger" | "versoes";

// ─── Page ────────────────────────────────────────────────────────────────────
function AdminSimuladorEditorPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const operation = OPERATIONS.find((o) => o.slug === slug);
  const seedCfg   = SEED_CONFIGS.find((s) => s.slug === slug);

  const [tab, setTab] = useState<Tab>("formulas");
  const [versions, setVersions] = useState<SimulatorConfigRow[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [config, setConfig] = useState<SimulatorConfig>({
    schemaVersion: 1,
    inputs: [],
    intermediates: [],
    outputs: [],
    timeline: undefined,
  });
  const [saving,  setSaving]  = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Tester scope — kept for seed compatibility (not used in new debugger tabs)
  const testScope = useMemo(() => {
    const inputs: Record<string, number> = {};
    for (const f of config.inputs) {
      const raw = f.defaultValue ?? "0";
      inputs[f.key] = parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
    }
    try {
      return runSimulatorConfig(config, inputs).scope;
    } catch {
      return inputs;
    }
  }, [config]);

  async function loadVersions() {
    const { data } = await supabase
      .from("simulator_configs" as "templates")
      .select("*")
      .eq("slug" as "operation_slug", slug)
      .order("version_number" as "name", { ascending: false }) as unknown as { data: SimulatorConfigRow[] | null };

    const rows = data ?? [];
    setVersions(rows);

    // Load the latest (highest version) as the editing draft
    if (rows.length > 0) {
      const latest = rows[0];
      setDraftId(latest.id);
      setConfig(clone(latest.config));
    }
  }

  useEffect(() => { loadVersions(); }, [slug]);

  // ── Save current draft ───────────────────────────────────────────────────
  async function saveDraft() {
    if (!user) return;
    setSaving(true);
    try {
      if (draftId) {
        // Update existing draft
        const { error } = await supabase
          .from("simulator_configs" as "templates")
          .update({ config: config as unknown as Record<string, unknown> })
          .eq("id" as "user_id", draftId) as unknown as { error: Error | null };
        if (error) throw error;
        toast.success("Rascunho salvo.");
      } else {
        // Create new version 1
        const { data, error } = await supabase
          .from("simulator_configs" as "templates")
          .insert({
            slug,
            version_number: 1,
            version_label: "v1 — Criado manualmente",
            config: config as unknown as Record<string, unknown>,
            is_published: false,
          } as unknown as Record<string, unknown>)
          .select("id")
          .single() as unknown as { data: { id: string } | null; error: Error | null };
        if (error) throw error;
        if (data) {
          setDraftId(data.id);
          toast.success("Nova config criada.");
        }
      }
      await loadVersions();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  // ── Publish a version ─────────────────────────────────────────────────────
  async function publishVersion(id: string) {
    setPublishing(id);
    try {
      const { error } = await supabase.rpc("publish_simulator_config" as "bootstrap_admin", { p_id: id } as unknown as Record<string, never>);
      if (error) throw error;
      toast.success("Versão publicada! O simulador agora usa o motor de fórmulas.");
      await loadVersions();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao publicar.");
    } finally {
      setPublishing(null);
    }
  }

  // ── Duplicate a version ───────────────────────────────────────────────────
  async function duplicateVersion(id: string) {
    setDuplicating(id);
    try {
      const { data, error } = await supabase.rpc("duplicate_simulator_config" as "bootstrap_admin", { p_id: id, p_label: "Novo rascunho" } as unknown as Record<string, never>) as unknown as { data: string | null; error: Error | null };
      if (error) throw error;
      toast.success("Versão duplicada como rascunho.");
      await loadVersions();
      // Switch editing to the new draft
      if (data) setDraftId(data);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao duplicar.");
    } finally {
      setDuplicating(null);
    }
  }

  // ── Seed from TypeScript definition ───────────────────────────────────────
  async function seedFromTS() {
    if (!seedCfg) { toast.error("Seed config não disponível para este simulador."); return; }
    setSeeding(true);
    try {
      const { data: existing } = await supabase
        .from("simulator_configs" as "templates")
        .select("id")
        .eq("slug" as "operation_slug", slug)
        .limit(1) as unknown as { data: { id: string }[] | null };

      if (existing && existing.length > 0) {
        toast.error("Já existe pelo menos uma versão. Duplique a partir da aba Versões.");
        return;
      }

      const { data, error } = await supabase
        .from("simulator_configs" as "templates")
        .insert({
          slug,
          version_number: 1,
          version_label: seedCfg.version_label,
          notes: seedCfg.notes,
          config: seedCfg.config as unknown as Record<string, unknown>,
          is_published: false,
        } as unknown as Record<string, unknown>)
        .select("id")
        .single() as unknown as { data: { id: string } | null; error: Error | null };

      if (error) throw error;
      toast.success("Config v1 criada! Revise e publique quando estiver pronta.");
      await loadVersions();
      if (data) { setDraftId(data.id); setConfig(clone(seedCfg.config)); }
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao criar config.");
    } finally {
      setSeeding(false);
    }
  }

  // ── Config mutation helpers ───────────────────────────────────────────────
  const publishedVersion = versions.find((v) => v.is_published);
  const draftVersion     = versions.find((v) => v.id === draftId);

  // ── Tab rendering ─────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "formulas", label: "⚗️ Editor de Fórmulas", icon: Beaker      },
    { id: "debugger", label: "🔬 Calculadora de Auditoria", icon: FlaskConical },
    { id: "versoes",  label: `📋 Versões (${versions.length})`, icon: History },
  ];

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/simuladores"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Link
          to="/admin/campos"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Campos Canônicos
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">{operation?.icon ?? "⚙️"}</span>
            <h1 className="text-xl font-extrabold tracking-tight">
              {operation?.name ?? slug}
            </h1>
            {publishedVersion && (
              <span className="rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                v{publishedVersion.version_number} em produção
              </span>
            )}
            {!publishedVersion && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                Apenas TypeScript (sem config publicada)
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{slug}</p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {versions.length === 0 && seedCfg && (
            <button
              onClick={seedFromTS}
              disabled={seeding}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {seeding ? "Criando…" : "Seed v1 do TypeScript"}
            </button>
          )}
          <button
            onClick={saveDraft}
            disabled={saving || versions.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando…" : "Salvar rascunho"}
          </button>
        </div>
      </div>

      {/* Draft indicator */}
      {draftVersion && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <span>Editando:</span>
          <span className="font-bold text-foreground">
            v{draftVersion.version_number} — {draftVersion.version_label || "Sem label"}
          </span>
          {draftVersion.is_published && (
            <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">Em produção</span>
          )}
        </div>
      )}


      {/* ── Tab nav (sempre visível) ── */}
      <div className="flex gap-1 rounded-2xl border border-border bg-card p-1.5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
              tab === id
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB: Editor de Fórmulas ── */}
      {tab === "formulas" && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-extrabold text-foreground">⚗️ Editor de Fórmulas — Pipeline Visual</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <strong>①</strong> Defina variáveis de entrada com valores de teste ·{" "}
              <strong>②</strong> Escreva fórmulas em sequência — cada passo mostra o valor calculado ao vivo ·{" "}
              <strong>③</strong> Mapeie os resultados como KPIs e timeline.
              Use o <em>Debugger</em> para comparar com o motor TypeScript real.
            </p>
          </div>

          {/* Empty state — no config loaded */}
          {versions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
              <div className="text-3xl">📋</div>
              <p className="font-extrabold text-foreground">Nenhuma config criada ainda</p>
              <p className="text-sm text-muted-foreground">Crie uma versão para começar a editar as fórmulas.</p>
              {seedCfg && (
                <button
                  onClick={seedFromTS}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {seeding ? "Criando…" : "Criar v1 a partir do TypeScript"}
                </button>
              )}
            </div>
          ) : (
            <FormulaEditorV2
              config={config}
              onChange={(newConfig) => {
                setConfig(newConfig);
              }}
            />
          )}

          {/* Save button */}
          {versions.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando…" : "Salvar rascunho"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Calculadora de Auditoria ── */}
      {tab === "debugger" && (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-extrabold text-foreground">🔬 Calculadora de Auditoria</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Roda a função TypeScript <strong>real</strong> do simulador com os seus inputs.
              Mostra os resultados principais e todos os passos intermediários de cálculo.
              Os dados são os mesmos que alimentam os cards e gráficos do simulador ao vivo.
            </p>
          </div>
          <SimuladorDebuggerPanel slug={slug} />
        </div>
      )}

      {/* ── TAB: Versões ── */}
      {tab === "versoes" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-extrabold text-foreground">📋 Histórico de Versões</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cada versão é imutável após publicação. Publique qualquer versão anterior para rollback instantâneo.
              O Debugger acima sempre roda o código TypeScript — independente de versões publicadas.
            </p>
          </div>
          {versions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-4">
              <div className="text-4xl">📋</div>
              <p className="font-extrabold text-foreground">Nenhuma config no banco de dados</p>
              <p className="text-sm text-muted-foreground">O Debugger funciona direto do TypeScript — sem necessidade de publicar versão.</p>
              {seedCfg && (
                <button
                  onClick={seedFromTS}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {seeding ? "Criando…" : "Criar v1 a partir do TypeScript"}
                </button>
              )}
            </div>
          )}
          {versions.map((v) => (
            <VersionCard
              key={v.id}
              row={v}
              onPublish={publishVersion}
              onDuplicate={duplicateVersion}
              publishing={publishing === v.id}
              duplicating={duplicating === v.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper: move item in array (kept for compatibility) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function move<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const next = [...arr];
  const target = idx + dir;
  if (target < 0 || target >= next.length) return next;
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}
