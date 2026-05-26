import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { OPERATIONS } from "@/lib/operations";
import { SEED_CONFIGS } from "@/lib/simulator-seed-configs";
import { getAvailableVarsAt, runSimulatorConfig } from "@/lib/formula-engine";
import type {
  SimulatorConfig, SimulatorConfigRow, InputField,
  FormulaStep, OutputField, AccumulatorDef, TimelineField,
} from "@/lib/simulator-config.types";
import { FormulaInput } from "@/components/admin/FormulaInput";
import { SimulatorTester } from "@/components/admin/SimulatorTester";
import { VersionCard } from "@/components/admin/VersionCard";
import {
  ArrowLeft, Plus, Trash2, Save, Sparkles, History,
  FlaskConical, Layers, BarChart3, GitBranch, ChevronDown, ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/simuladores/$slug")({
  component: AdminSimuladorEditorPage,
});

// ─── Field type options ───────────────────────────────────────────────────────
const FIELD_TYPES = ["money", "percent", "int", "enum", "bool"] as const;
const STEP_TYPES  = ["money", "percent", "number", ""] as const;
const KPI_VARIANTS = ["default", "success", "primary", "warning", "danger"] as const;

// ─── Helper: deep clone ───────────────────────────────────────────────────────
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ─── Blank starters ──────────────────────────────────────────────────────────
const blankInput   = (): InputField   => ({ key: "", label: "", type: "money", defaultValue: "0" });
const blankStep    = (): FormulaStep  => ({ key: "", label: "", formula: "" });
const blankOutput  = (): OutputField  => ({ key: "", label: "", formula: "", displayOrder: 99, kpiVariant: "default" });
const blankAccum   = (): AccumulatorDef => ({ key: "", initialValue: "0", formula: "" });
const blankTlField = (): TimelineField => ({ key: "", label: "", formula: "" });

type Tab = "campos" | "intermediarios" | "resultados" | "timeline" | "versoes";

// ─── Page ────────────────────────────────────────────────────────────────────
function AdminSimuladorEditorPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const operation = OPERATIONS.find((o) => o.slug === slug);
  const seedCfg   = SEED_CONFIGS.find((s) => s.slug === slug);

  const [tab, setTab] = useState<Tab>("campos");
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

  // Tester scope — computed from current config + default input values
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
  const setInputs = (fn: (prev: InputField[]) => InputField[]) =>
    setConfig((c) => ({ ...c, inputs: fn(c.inputs) }));
  const setIntermediates = (fn: (prev: FormulaStep[]) => FormulaStep[]) =>
    setConfig((c) => ({ ...c, intermediates: fn(c.intermediates) }));
  const setOutputs = (fn: (prev: OutputField[]) => OutputField[]) =>
    setConfig((c) => ({ ...c, outputs: fn(c.outputs) }));

  const updateTimeline = (patch: Partial<NonNullable<SimulatorConfig["timeline"]>>) =>
    setConfig((c) => ({
      ...c,
      timeline: c.timeline ? { ...c.timeline, ...patch } : {
        loopVariable: "mes", lengthFormula: "prazoMeses",
        fields: [], accumulators: [],
        ...patch,
      },
    }));

  const publishedVersion = versions.find((v) => v.is_published);
  const draftVersion     = versions.find((v) => v.id === draftId);

  // ── Tab rendering ─────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "campos",        label: "Campos",         icon: Layers      },
    { id: "intermediarios",label: "Intermediários",  icon: FlaskConical},
    { id: "resultados",    label: "Resultados",      icon: BarChart3   },
    { id: "timeline",      label: "Timeline",        icon: GitBranch   },
    { id: "versoes",       label: `Versões (${versions.length})`, icon: History },
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

      {/* Empty state */}
      {versions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-4">
          <div className="text-4xl">📋</div>
          <div>
            <p className="font-extrabold text-foreground">Nenhuma config no banco de dados</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este simulador usa a função TypeScript hardcoded como fonte de verdade.
            </p>
          </div>
          {seedCfg ? (
            <button
              onClick={seedFromTS}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {seeding ? "Criando…" : "Criar v1 a partir do código TypeScript"}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma seed config disponível para este simulador.</p>
          )}
        </div>
      )}

      {/* Editor + Tester layout */}
      {versions.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left: tabs editor */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Tab nav */}
            <div className="flex gap-1 rounded-2xl border border-border bg-card p-1.5 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={[
                    "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all",
                    tab === id
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {/* ── TAB: Campos de Entrada ───────────────────────────────── */}
            {tab === "campos" && (
              <div className="space-y-3">
                <SectionHeader
                  title="Campos de Entrada"
                  description="Defina os inputs que o usuário preencherá no formulário. A key é usada nas fórmulas."
                />
                {config.inputs.map((f, idx) => (
                  <InputFieldCard
                    key={idx}
                    field={f}
                    onChange={(upd) => setInputs((prev) => prev.map((x, i) => i === idx ? upd : x))}
                    onRemove={() => setInputs((prev) => prev.filter((_, i) => i !== idx))}
                    onMoveUp={() => setInputs((prev) => move(prev, idx, -1))}
                    onMoveDown={() => setInputs((prev) => move(prev, idx, 1))}
                  />
                ))}
                <button
                  onClick={() => setInputs((prev) => [...prev, blankInput()])}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary w-full justify-center"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar campo
                </button>
              </div>
            )}

            {/* ── TAB: Intermediários ──────────────────────────────────── */}
            {tab === "intermediarios" && (
              <div className="space-y-3">
                <SectionHeader
                  title="Variáveis Intermediárias"
                  description="Calculadas em ordem. Cada variável fica disponível para as seguintes. Pense em etapas de uma calculadora científica."
                />
                {config.intermediates.map((step, idx) => (
                  <FormulaStepCard
                    key={idx}
                    step={step}
                    index={idx}
                    scope={testScope}
                    availableVars={getAvailableVarsAt(config, step.key)}
                    showType
                    onChange={(upd) => setIntermediates((prev) => prev.map((x, i) => i === idx ? upd : x))}
                    onRemove={() => setIntermediates((prev) => prev.filter((_, i) => i !== idx))}
                    onMoveUp={() => setIntermediates((prev) => move(prev, idx, -1))}
                    onMoveDown={() => setIntermediates((prev) => move(prev, idx, 1))}
                  />
                ))}
                <button
                  onClick={() => setIntermediates((prev) => [...prev, blankStep()])}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary w-full justify-center"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar variável intermediária
                </button>
              </div>
            )}

            {/* ── TAB: Resultados ──────────────────────────────────────── */}
            {tab === "resultados" && (
              <div className="space-y-3">
                <SectionHeader
                  title="Resultados (Outputs)"
                  description="Os valores exibidos como KPIs ao usuário. Podem referenciar inputs e intermediários."
                />
                {[...config.outputs]
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((out, idx) => {
                    const realIdx = config.outputs.indexOf(out);
                    return (
                      <OutputFieldCard
                        key={idx}
                        output={out}
                        scope={testScope}
                        availableVars={[
                          ...config.inputs.map((f) => f.key),
                          ...config.intermediates.map((s) => s.key),
                        ]}
                        onChange={(upd) => setOutputs((prev) => prev.map((x, i) => i === realIdx ? upd : x))}
                        onRemove={() => setOutputs((prev) => prev.filter((_, i) => i !== realIdx))}
                      />
                    );
                  })}
                <button
                  onClick={() => setOutputs((prev) => [...prev, { ...blankOutput(), displayOrder: prev.length + 1 }])}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary w-full justify-center"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar resultado
                </button>
              </div>
            )}

            {/* ── TAB: Timeline ────────────────────────────────────────── */}
            {tab === "timeline" && (
              <div className="space-y-4">
                <SectionHeader
                  title="Timeline (Loop mensal)"
                  description="Configuração do loop mês-a-mês. A variável do loop fica disponível nas fórmulas dos campos da timeline."
                />
                {/* Toggle */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!config.timeline}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateTimeline({ loopVariable: "mes", lengthFormula: "prazoMeses", fields: [], accumulators: [] });
                        } else {
                          setConfig((c) => ({ ...c, timeline: undefined }));
                        }
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm font-bold">Este simulador tem loop mensal (timeline)</span>
                  </label>
                </div>

                {config.timeline && (
                  <>
                    {/* Loop params */}
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Parâmetros do Loop</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Variável do loop</label>
                          <input
                            value={config.timeline.loopVariable}
                            onChange={(e) => updateTimeline({ loopVariable: e.target.value })}
                            placeholder="mes"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Quantidade de iterações (fórmula)</label>
                          <input
                            value={config.timeline.lengthFormula}
                            onChange={(e) => updateTimeline({ lengthFormula: e.target.value })}
                            placeholder="prazoMeses"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Timeline fields */}
                    <div className="space-y-3">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Campos da Timeline</p>
                      {config.timeline.fields.map((field, idx) => (
                        <FormulaStepCard
                          key={idx}
                          step={field}
                          index={idx}
                          scope={{ ...testScope, [config.timeline!.loopVariable]: 1 }}
                          availableVars={[
                            ...config.inputs.map((f) => f.key),
                            ...config.intermediates.map((s) => s.key),
                            ...config.outputs.map((o) => o.key),
                            config.timeline!.loopVariable,
                            ...(config.timeline?.accumulators ?? []).map((a) => a.key),
                          ]}
                          showType
                          onChange={(upd) => updateTimeline({
                            fields: config.timeline!.fields.map((x, i) => i === idx ? upd as TimelineField : x),
                          })}
                          onRemove={() => updateTimeline({
                            fields: config.timeline!.fields.filter((_, i) => i !== idx),
                          })}
                          onMoveUp={() => updateTimeline({ fields: move(config.timeline!.fields, idx, -1) })}
                          onMoveDown={() => updateTimeline({ fields: move(config.timeline!.fields, idx, 1) })}
                        />
                      ))}
                      <button
                        onClick={() => updateTimeline({ fields: [...config.timeline!.fields, blankTlField()] })}
                        className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary w-full justify-center"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar campo de timeline
                      </button>
                    </div>

                    {/* Accumulators */}
                    <div className="space-y-3">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Acumuladores</p>
                      {(config.timeline.accumulators ?? []).map((acc, idx) => (
                        <AccumulatorCard
                          key={idx}
                          acc={acc}
                          onChange={(upd) => updateTimeline({
                            accumulators: (config.timeline!.accumulators ?? []).map((x, i) => i === idx ? upd : x),
                          })}
                          onRemove={() => updateTimeline({
                            accumulators: (config.timeline!.accumulators ?? []).filter((_, i) => i !== idx),
                          })}
                        />
                      ))}
                      <button
                        onClick={() => updateTimeline({ accumulators: [...(config.timeline!.accumulators ?? []), blankAccum()] })}
                        className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary w-full justify-center"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar acumulador
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB: Versões ─────────────────────────────────────────── */}
            {tab === "versoes" && (
              <div className="space-y-3">
                <SectionHeader
                  title="Histórico de Versões"
                  description="Cada versão é imutável após publicação. Publique qualquer versão anterior para fazer rollback instantâneo."
                />
                {versions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma versão criada ainda.</p>
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

          {/* Right: tester */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            <div className="sticky top-4">
              <SimulatorTester config={config} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: move item in array ───────────────────────────────────────────────
function move<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const next = [...arr];
  const target = idx + dir;
  if (target < 0 || target >= next.length) return next;
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <p className="text-sm font-extrabold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// ─── Input field card ─────────────────────────────────────────────────────────
function InputFieldCard({ field, onChange, onRemove, onMoveUp, onMoveDown }: {
  field: InputField;
  onChange: (f: InputField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);
  const up = <T extends InputField, K extends keyof T>(k: K, v: T[K]) => onChange({ ...field, [k]: v });

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{field.type}</span>
          <span className="font-mono text-xs font-bold text-foreground truncate">{field.key || "(sem key)"}</span>
          <span className="text-xs text-muted-foreground truncate">{field.label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 rounded hover:bg-muted cursor-pointer"><ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <span onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 rounded hover:bg-muted cursor-pointer"><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Key (nome na fórmula)">
              <input value={field.key} onChange={(e) => up("key", e.target.value)} placeholder="cartaCredito" className={inputCls} />
            </Field>
            <Field label="Label (exibição)">
              <input value={field.label} onChange={(e) => up("label", e.target.value)} placeholder="Carta de crédito (R$)" className={inputCls} />
            </Field>
            <Field label="Tipo">
              <select value={field.type} onChange={(e) => up("type", e.target.value as InputField["type"])} className={inputCls}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Valor padrão">
              <input value={field.defaultValue} onChange={(e) => up("defaultValue", e.target.value)} placeholder="500.000,00" className={inputCls} />
            </Field>
          </div>
          <Field label="Hint (opcional)">
            <input value={field.hint ?? ""} onChange={(e) => up("hint", e.target.value)} placeholder="Explicação para o usuário" className={inputCls} />
          </Field>
          <button onClick={onRemove} className="flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="h-3 w-3" /> Remover campo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Formula step card ────────────────────────────────────────────────────────
function FormulaStepCard({ step, index, scope, availableVars, showType, onChange, onRemove, onMoveUp, onMoveDown }: {
  step: FormulaStep | TimelineField;
  index: number;
  scope: Record<string, number>;
  availableVars: string[];
  showType?: boolean;
  onChange: (s: FormulaStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);
  const up = <T extends FormulaStep, K extends keyof T>(k: K, v: T[K]) => onChange({ ...step, [k]: v } as FormulaStep);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-primary">{index + 1}</span>
          <span className="font-mono text-xs font-bold text-foreground">{step.key || "(sem key)"}</span>
          <span className="font-mono text-[11px] text-muted-foreground truncate">{step.formula || "…"}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 rounded hover:bg-muted cursor-pointer"><ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <span onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 rounded hover:bg-muted cursor-pointer"><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Key (variável)">
              <input value={step.key} onChange={(e) => up("key", e.target.value)} placeholder="taxaAdmFrac" className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Label (descrição)">
              <input value={step.label} onChange={(e) => up("label", e.target.value)} placeholder="Taxa adm. em fração" className={inputCls} />
            </Field>
          </div>
          {showType && (
            <Field label="Tipo do resultado">
              <select value={(step as FormulaStep).type ?? ""} onChange={(e) => up("type" as keyof FormulaStep, e.target.value as FormulaStep["type"])} className={inputCls}>
                {STEP_TYPES.map((t) => <option key={t} value={t}>{t || "number (padrão)"}</option>)}
              </select>
            </Field>
          )}
          <Field label="Fórmula (expressão mathjs)">
            <FormulaInput
              value={step.formula}
              onChange={(v) => up("formula", v)}
              scope={scope}
              availableVars={availableVars}
              type={(step as FormulaStep).type as "money" | "percent" | "number" ?? "number"}
            />
          </Field>
          <Field label="Descrição (para auditoria)">
            <input
              value={(step as FormulaStep).description ?? ""}
              onChange={(e) => up("description" as keyof FormulaStep, e.target.value)}
              placeholder="Explique em linguagem simples o que esta fórmula calcula"
              className={inputCls}
            />
          </Field>
          <button onClick={onRemove} className="flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="h-3 w-3" /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Output field card ────────────────────────────────────────────────────────
function OutputFieldCard({ output, scope, availableVars, onChange, onRemove }: {
  output: OutputField;
  scope: Record<string, number>;
  availableVars: string[];
  onChange: (o: OutputField) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const up = <K extends keyof OutputField>(k: K, v: OutputField[K]) => onChange({ ...output, [k]: v });

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{output.displayOrder}</span>
          <span className="font-mono text-xs font-bold text-foreground">{output.key || "(sem key)"}</span>
          <span className="text-xs text-muted-foreground truncate">{output.label}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Key">
              <input value={output.key} onChange={(e) => up("key", e.target.value)} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Label">
              <input value={output.label} onChange={(e) => up("label", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ordem de exibição">
              <input type="number" value={output.displayOrder} onChange={(e) => up("displayOrder", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select value={output.type ?? ""} onChange={(e) => up("type", e.target.value as OutputField["type"])} className={inputCls}>
                {STEP_TYPES.map((t) => <option key={t} value={t}>{t || "number (padrão)"}</option>)}
              </select>
            </Field>
            <Field label="Variante KPI (cor)">
              <select value={output.kpiVariant ?? "default"} onChange={(e) => up("kpiVariant", e.target.value as OutputField["kpiVariant"])} className={inputCls}>
                {KPI_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Fórmula">
            <FormulaInput
              value={output.formula}
              onChange={(v) => up("formula", v)}
              scope={scope}
              availableVars={availableVars}
              type={output.type as "money" | "percent" | "number" ?? "number"}
            />
          </Field>
          <button onClick={onRemove} className="flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="h-3 w-3" /> Remover
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Accumulator card ─────────────────────────────────────────────────────────
function AccumulatorCard({ acc, onChange, onRemove }: {
  acc: AccumulatorDef;
  onChange: (a: AccumulatorDef) => void;
  onRemove: () => void;
}) {
  const up = <K extends keyof AccumulatorDef>(k: K, v: AccumulatorDef[K]) => onChange({ ...acc, [k]: v });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Key do acumulador">
          <input value={acc.key} onChange={(e) => up("key", e.target.value)} placeholder="acumSemLance" className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Valor inicial (fórmula)">
          <input value={acc.initialValue} onChange={(e) => up("initialValue", e.target.value)} placeholder="0" className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Label">
          <input value={acc.label ?? ""} onChange={(e) => up("label", e.target.value)} placeholder="Desembolso acumulado" className={inputCls} />
        </Field>
      </div>
      <Field label="Fórmula de atualização (por iteração)">
        <input value={acc.formula} onChange={(e) => up("formula", e.target.value)} placeholder="acumSemLance + parcelaSemLance" className={`${inputCls} font-mono`} />
      </Field>
      <button onClick={onRemove} className="flex items-center gap-1 text-xs text-destructive hover:underline">
        <Trash2 className="h-3 w-3" /> Remover acumulador
      </button>
    </div>
  );
}

// ─── Generic field wrapper ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";
