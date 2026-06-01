// ─── FormulaEditorV2 — Editor de Fórmulas Estilo Metabase ────────────────────
//
// Três painéis lado a lado:
//   ① VARIÁVEIS — inputs nomeados com valores de teste editáveis
//   ② PIPELINE — cada cálculo em sequência, valor computado ao vivo
//   ③ RESULTADOS — KPIs + timeline config
//
// Princípio: qualquer especialista financeiro (sem código) consegue:
//   • Ver o que cada variável vale com os inputs de teste
//   • Escrever ou editar uma fórmula e ver o resultado instantaneamente
//   • Identificar exatamente qual passo está errado
//   • Adicionar, reordenar ou remover passos

import { useCallback, useMemo, useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  ArrowRight, GripVertical, Copy, Eye, EyeOff,
} from "lucide-react";
import {
  runSimulatorConfig,
  evaluateWithDiagnostic,
  validateFormula,
} from "@/lib/formula-engine";
import { FormulaInput } from "./FormulaInput";
import type {
  SimulatorConfig, InputField, FormulaStep, OutputField,
  TimelineField, AccumulatorDef,
} from "@/lib/simulator-config.types";

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

const FIELD_TYPES = ["money", "percent", "int", "enum", "bool"] as const;
const RESULT_TYPES = ["money", "percent", "number"] as const;
const KPI_VARIANTS = ["default", "success", "primary", "warning", "danger"] as const;

// ── Helpers de formatação ─────────────────────────────────────────────────────

function fmtScope(v: number, type?: string): string {
  if (!isFinite(v)) return "—";
  if (type === "money" || (!type && Math.abs(v) > 100)) {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(2)}k`;
    return `R$ ${v.toFixed(2)}`;
  }
  if (type === "percent") return `${v.toFixed(4)}%`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
}

function parseDefaultValue(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function varColor(type?: string): string {
  if (type === "money") return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  if (type === "percent") return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
  if (type === "int") return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
  return "bg-muted text-muted-foreground";
}

// ── Blank starters ────────────────────────────────────────────────────────────

const blankInput = (): InputField => ({ key: "", label: "", type: "money", defaultValue: "0" });
const blankStep = (): FormulaStep => ({ key: "", label: "", formula: "", type: "number" });
const blankOutput = (order: number): OutputField => ({
  key: "", label: "", formula: "", displayOrder: order, kpiVariant: "default", type: "money",
});
const blankTlField = (): TimelineField => ({ key: "", label: "", formula: "", type: "money" });
const blankAccum = (): AccumulatorDef => ({ key: "", initialValue: "0", formula: "", label: "" });

function move<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const next = [...arr];
  const target = idx + dir;
  if (target < 0 || target >= next.length) return next;
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormulaEditorV2Props {
  config: SimulatorConfig;
  onChange: (c: SimulatorConfig) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function FormulaEditorV2({ config, onChange }: FormulaEditorV2Props) {
  // Test values: user can change these to preview formula results
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  // Build test scope from input defaults + overrides
  const testScope = useMemo(() => {
    const scope: Record<string, number> = {};
    for (const f of config.inputs) {
      const override = testValues[f.key];
      scope[f.key] = override !== undefined
        ? (parseFloat(override.replace(",", ".")) || 0)
        : parseDefaultValue(f.defaultValue);
    }
    return scope;
  }, [config.inputs, testValues]);

  // Run full pipeline with test values — single source of truth
  const evalResult = useMemo(() => {
    try {
      return runSimulatorConfig(config, testScope);
    } catch {
      return { scope: testScope, timeline: [], errors: [] as { step: string; message: string }[] };
    }
  }, [config, testScope]);

  // Errors indexed by step key
  const errorsByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of evalResult.errors) m[e.step] = e.message;
    return m;
  }, [evalResult.errors]);

  // Mutation helpers
  const upInputs = useCallback((fn: (prev: InputField[]) => InputField[]) =>
    onChange({ ...config, inputs: fn(config.inputs) }), [config, onChange]);

  const upIntermediates = useCallback((fn: (prev: FormulaStep[]) => FormulaStep[]) =>
    onChange({ ...config, intermediates: fn(config.intermediates) }), [config, onChange]);

  const upOutputs = useCallback((fn: (prev: OutputField[]) => OutputField[]) =>
    onChange({ ...config, outputs: fn(config.outputs) }), [config, onChange]);

  const upTimeline = useCallback((patch: Partial<NonNullable<SimulatorConfig["timeline"]>>) =>
    onChange({
      ...config,
      timeline: config.timeline
        ? { ...config.timeline, ...patch }
        : { loopVariable: "mes", lengthFormula: "prazoMeses", fields: [], accumulators: [], ...patch },
    }), [config, onChange]);

  // Available variables at each point in the pipeline
  const inputKeys = config.inputs.map((f) => f.key);
  const mathBuiltins = ["max", "min", "ceil", "floor", "pow", "sqrt", "abs", "round", "log", "exp", "if"];

  function availableAt(stepIdx: number): string[] {
    const prev = config.intermediates.slice(0, stepIdx).map((s) => s.key);
    return [...inputKeys, ...prev, ...mathBuiltins];
  }

  const allVars = [
    ...inputKeys,
    ...config.intermediates.map((s) => s.key),
    ...config.outputs.map((o) => o.key),
    ...mathBuiltins,
  ];

  const timelineVars = [
    ...allVars,
    config.timeline?.loopVariable ?? "mes",
    ...(config.timeline?.accumulators ?? []).map((a) => a.key),
  ];

  const errorCount = evalResult.errors.length;
  const allOk = errorCount === 0 && config.intermediates.length + config.outputs.length > 0;

  return (
    <div className="space-y-3">
      {/* ── Status bar ── */}
      <div className={[
        "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold min-w-0",
        allOk
          ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300"
          : errorCount > 0
            ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300"
            : "bg-muted border border-border text-muted-foreground",
      ].join(" ")}>
        <span className="shrink-0">
          {allOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : errorCount > 0 ? <AlertCircle className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </span>
        <span className="truncate">
          {allOk
            ? `Todas as ${config.intermediates.length + config.outputs.length} fórmulas computadas sem erros`
            : errorCount > 0
              ? `${errorCount} fórmula${errorCount > 1 ? "s com erro" : " com erro"} — verifique abaixo`
              : "Adicione variáveis e fórmulas para começar"
          }
        </span>
        <span className="ml-auto shrink-0 opacity-60 hidden md:block">Valores ao vivo →</span>
      </div>

      {/* ── Three-panel layout ── */}
      {/* xl: 3 colunas fixas — só ativa em telas ≥1280px onde há espaço suficiente com a sidebar */}
      <div className="grid gap-4 xl:grid-cols-[260px_1fr_240px]">

        {/* ────────────────────────────────────────────────────────── */}
        {/* PAINEL ① — VARIÁVEIS DE ENTRADA                          */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="space-y-3 min-w-0">
          <PanelHeader
            number="①"
            title="Variáveis de Entrada"
            description="Defina os inputs do simulador. Cada campo vira uma variável nas fórmulas."
          />

          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden pr-1">
            {config.inputs.length === 0 && (
              <EmptyState icon="🔢" text="Nenhuma variável definida" sub="Clique abaixo para adicionar" />
            )}
            {config.inputs.map((field, idx) => (
              <InputVarRow
                key={idx}
                field={field}
                testValue={testValues[field.key]}
                scopeValue={evalResult.scope[field.key]}
                onChange={(upd) => upInputs((prev) => prev.map((x, i) => i === idx ? upd : x))}
                onRemove={() => upInputs((prev) => prev.filter((_, i) => i !== idx))}
                onMoveUp={() => upInputs((prev) => move(prev, idx, -1))}
                onMoveDown={() => upInputs((prev) => move(prev, idx, 1))}
                onTestValueChange={(v) => setTestValues((prev) => ({ ...prev, [field.key]: v }))}
              />
            ))}
          </div>

          <AddButton
            label="Adicionar variável"
            onClick={() => upInputs((prev) => [...prev, blankInput()])}
          />
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* PAINEL ② — PIPELINE DE FÓRMULAS                          */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="space-y-3 min-w-0">
          <PanelHeader
            number="②"
            title="Pipeline de Cálculo"
            description="Fórmulas executadas em ordem. Cada passo pode referenciar os anteriores."
            badge={config.intermediates.length > 0 ? `${config.intermediates.length} passos` : undefined}
          />

          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden pr-1">
            {config.intermediates.length === 0 && (
              <EmptyState
                icon="⚗️"
                text="Nenhuma fórmula no pipeline"
                sub="Escreva os cálculos intermediários aqui"
              />
            )}
            {config.intermediates.map((step, idx) => (
              <PipelineStepRow
                key={idx}
                step={step}
                index={idx}
                scopeValue={evalResult.scope[step.key]}
                error={errorsByKey[step.key]}
                availableVars={availableAt(idx)}
                onChange={(upd) => upIntermediates((prev) => prev.map((x, i) => i === idx ? upd : x))}
                onRemove={() => upIntermediates((prev) => prev.filter((_, i) => i !== idx))}
                onMoveUp={() => upIntermediates((prev) => move(prev, idx, -1))}
                onMoveDown={() => upIntermediates((prev) => move(prev, idx, 1))}
                onDuplicate={() => upIntermediates((prev) => [
                  ...prev.slice(0, idx + 1),
                  { ...step, key: step.key + "_copia" },
                  ...prev.slice(idx + 1),
                ])}
                testScope={evalResult.scope}
              />
            ))}
          </div>

          <AddButton
            label="Adicionar passo de cálculo"
            onClick={() => upIntermediates((prev) => [...prev, blankStep()])}
          />
        </div>

        {/* ────────────────────────────────────────────────────────── */}
        {/* PAINEL ③ — RESULTADOS (KPIs + TIMELINE)                  */}
        {/* ────────────────────────────────────────────────────────── */}
        <div className="space-y-3 min-w-0">
          <PanelHeader
            number="③"
            title="Resultados"
            description="KPIs exibidos ao usuário + timeline mensal (opcional)."
          />

          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden pr-1">
            {/* KPI Outputs */}
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                KPIs exibidos ao usuário
              </p>
              {config.outputs.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum resultado definido</p>
              )}
              {[...config.outputs]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((out) => {
                  const realIdx = config.outputs.indexOf(out);
                  return (
                    <OutputRow
                      key={realIdx}
                      output={out}
                      scopeValue={evalResult.scope[out.key]}
                      error={errorsByKey[out.key]}
                      availableVars={allVars}
                      testScope={evalResult.scope}
                      onChange={(upd) => upOutputs((prev) => prev.map((x, i) => i === realIdx ? upd : x))}
                      onRemove={() => upOutputs((prev) => prev.filter((_, i) => i !== realIdx))}
                    />
                  );
                })}
              <button
                onClick={() => upOutputs((prev) => [...prev, blankOutput(prev.length + 1)])}
                className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Adicionar KPI
              </button>
            </div>

            {/* Timeline config */}
            <TimelineSection
              config={config}
              evalResult={evalResult}
              timelineVars={timelineVars}
              upTimeline={upTimeline}
              onChange={onChange}
            />
          </div>
        </div>
      </div>

      {/* ── Preview dos valores computados ── */}
      {evalResult.scope && Object.keys(evalResult.scope).length > 0 && (
        <ScopePreview scope={evalResult.scope} inputs={config.inputs} intermediates={config.intermediates} outputs={config.outputs} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL ① — Input Variable Row
// ─────────────────────────────────────────────────────────────────────────────

function InputVarRow({
  field, testValue, onChange, onRemove, onMoveUp, onMoveDown, onTestValueChange,
}: {
  field: InputField;
  testValue?: string;
  scopeValue?: number;
  onChange: (f: InputField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTestValueChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const up = <K extends keyof InputField>(k: K, v: InputField[K]) => onChange({ ...field, [k]: v });
  const displayVal = testValue !== undefined ? testValue : field.defaultValue;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-accent/50 text-left min-w-0"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${varColor(field.type)}`}>
          {field.type}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-bold text-foreground truncate">{field.key || "(sem key)"}</p>
          {!open && <p className="text-[10px] text-muted-foreground truncate">{field.label}</p>}
        </div>
        <span className="shrink-0 max-w-[80px] truncate rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
          {displayVal || "0"}
        </span>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2.5 space-y-2.5">
          {/* Key + Label */}
          <div className="grid gap-2 grid-cols-2">
            <MiniField label="Nome da variável">
              <input
                value={field.key}
                onChange={(e) => up("key", e.target.value.replace(/\s/g, "_"))}
                placeholder="cartaCredito"
                className={miniInput + " font-mono"}
              />
            </MiniField>
            <MiniField label="Rótulo exibido">
              <input value={field.label} onChange={(e) => up("label", e.target.value)} placeholder="Carta de crédito" className={miniInput} />
            </MiniField>
          </div>

          {/* Type + Default */}
          <div className="grid gap-2 grid-cols-2">
            <MiniField label="Tipo">
              <select value={field.type} onChange={(e) => up("type", e.target.value as InputField["type"])} className={miniInput}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </MiniField>
            <MiniField label="Valor padrão">
              <input value={field.defaultValue} onChange={(e) => up("defaultValue", e.target.value)} placeholder="500.000,00" className={miniInput} />
            </MiniField>
          </div>

          {/* Test value override */}
          <MiniField label="Valor de teste (sobrescreve padrão)">
            <input
              value={testValue ?? ""}
              onChange={(e) => onTestValueChange(e.target.value)}
              placeholder={field.defaultValue || "usar padrão"}
              className={miniInput + " border-primary/40 bg-primary/5"}
            />
          </MiniField>

          {/* Hint */}
          <MiniField label="Dica para o usuário">
            <input value={field.hint ?? ""} onChange={(e) => up("hint", e.target.value)} placeholder="Explicação" className={miniInput} />
          </MiniField>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={onMoveUp} className="rounded p-1 hover:bg-muted"><ChevronUp className="h-3 w-3" /></button>
            <button onClick={onMoveDown} className="rounded p-1 hover:bg-muted"><ChevronDown className="h-3 w-3" /></button>
            <button onClick={onRemove} className="ml-auto flex items-center gap-1 text-[11px] text-destructive hover:underline">
              <Trash2 className="h-3 w-3" /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL ② — Pipeline Step Row
// ─────────────────────────────────────────────────────────────────────────────

function PipelineStepRow({
  step, index, scopeValue, error, availableVars, testScope,
  onChange, onRemove, onMoveUp, onMoveDown, onDuplicate,
}: {
  step: FormulaStep;
  index: number;
  scopeValue?: number;
  error?: string;
  availableVars: string[];
  testScope: Record<string, number>;
  onChange: (s: FormulaStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const up = <K extends keyof FormulaStep>(k: K, v: FormulaStep[K]) => onChange({ ...step, [k]: v });
  const hasError = !!error;
  const hasValue = scopeValue !== undefined && isFinite(scopeValue);
  const syntaxOk = !validateFormula(step.formula) && step.formula.trim().length > 0;

  return (
    <div className={[
      "rounded-xl border overflow-hidden",
      hasError ? "border-red-300 dark:border-red-800" : syntaxOk && hasValue ? "border-green-300/60 dark:border-green-900" : "border-border",
    ].join(" ")}>
      {/* Collapsed header — the KEY row that shows value */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-accent/40 text-left bg-card min-w-0"
      >
        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-primary w-6 text-center">
          {index + 1}
        </span>
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-bold text-foreground truncate">{step.key || "(sem nome)"}</p>
          <p className="font-mono text-[10px] text-muted-foreground truncate">{step.formula || "…"}</p>
        </div>
        {/* Live value badge — max-w para não empurrar o layout */}
        <div className="shrink-0 text-right max-w-[90px]">
          {hasError ? (
            <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="h-2.5 w-2.5" /> erro
            </span>
          ) : hasValue && step.formula ? (
            <span className="block truncate rounded bg-green-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
              = {fmtScope(scopeValue!, step.type)}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">vazio</span>
          )}
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
      </button>

      {/* Error bar */}
      {hasError && !open && (
        <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="font-mono truncate">{error}</span>
        </div>
      )}

      {open && (
        <div className="border-t border-border bg-card/50 px-3 pb-3 pt-2.5 space-y-3">
          {/* Key + Label */}
          <div className="grid gap-2 grid-cols-2">
            <MiniField label="Nome da variável (resultado)">
              <input
                value={step.key}
                onChange={(e) => up("key", e.target.value.replace(/\s/g, "_"))}
                placeholder="cartaCorrigida"
                className={miniInput + " font-mono"}
              />
            </MiniField>
            <MiniField label="Tipo de resultado">
              <select value={step.type ?? "number"} onChange={(e) => up("type", e.target.value as FormulaStep["type"])} className={miniInput}>
                {RESULT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </MiniField>
          </div>

          {/* Formula — the core */}
          <MiniField label="Fórmula (expressão mathjs)">
            <FormulaInput
              value={step.formula}
              onChange={(v) => up("formula", v)}
              scope={testScope}
              availableVars={availableVars}
              type={step.type as "money" | "percent" | "number" ?? "number"}
              placeholder="ex: cartaCredito * pow(1 + inccAnual/100, mesContemplacao/12)"
            />
          </MiniField>

          {/* Label + Description */}
          <div className="grid gap-2 grid-cols-2">
            <MiniField label="Rótulo (para auditoria)">
              <input value={step.label} onChange={(e) => up("label", e.target.value)} placeholder="Carta corrigida pelo INCC" className={miniInput} />
            </MiniField>
            <MiniField label="Descrição (financeira)">
              <input
                value={step.description ?? ""}
                onChange={(e) => up("description", e.target.value)}
                placeholder="O que este cálculo representa…"
                className={miniInput}
              />
            </MiniField>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-0.5">
            <button onClick={onMoveUp} className="rounded p-1 hover:bg-muted" title="Mover acima"><ChevronUp className="h-3 w-3" /></button>
            <button onClick={onMoveDown} className="rounded p-1 hover:bg-muted" title="Mover abaixo"><ChevronDown className="h-3 w-3" /></button>
            <button onClick={onDuplicate} className="rounded p-1 hover:bg-muted" title="Duplicar"><Copy className="h-3 w-3" /></button>
            <button onClick={onRemove} className="ml-auto flex items-center gap-1 text-[11px] text-destructive hover:underline">
              <Trash2 className="h-3 w-3" /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL ③ — Output Row (KPI)
// ─────────────────────────────────────────────────────────────────────────────

function OutputRow({
  output, scopeValue, error, availableVars, testScope, onChange, onRemove,
}: {
  output: OutputField;
  scopeValue?: number;
  error?: string;
  availableVars: string[];
  testScope: Record<string, number>;
  onChange: (o: OutputField) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const up = <K extends keyof OutputField>(k: K, v: OutputField[K]) => onChange({ ...output, [k]: v });
  const hasError = !!error;
  const hasValue = scopeValue !== undefined && isFinite(scopeValue);

  const variantDot: Record<string, string> = {
    default: "bg-muted-foreground",
    success: "bg-green-500",
    primary: "bg-primary",
    warning: "bg-yellow-500",
    danger: "bg-red-500",
  };

  return (
    <div className={["rounded-lg border overflow-hidden", hasError ? "border-red-300" : "border-border"].join(" ")}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-2 hover:bg-accent/40 text-left bg-card">
        <span className={`h-2 w-2 rounded-full shrink-0 ${variantDot[output.kpiVariant ?? "default"]}`} />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] font-bold text-foreground truncate">{output.key || "(sem key)"}</p>
        </div>
        {hasError
          ? <span className="text-[10px] text-red-600 font-bold">erro</span>
          : hasValue && output.formula
            ? <span className="font-mono text-[10px] font-bold text-primary">{fmtScope(scopeValue!, output.type)}</span>
            : null
        }
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="border-t border-border px-2.5 pb-2.5 pt-2 space-y-2 bg-card/50">
          <div className="grid gap-1.5 grid-cols-2">
            <MiniField label="Key">
              <input value={output.key} onChange={(e) => up("key", e.target.value)} className={`${miniInput} font-mono`} />
            </MiniField>
            <MiniField label="Rótulo">
              <input value={output.label} onChange={(e) => up("label", e.target.value)} className={miniInput} />
            </MiniField>
          </div>
          {/* Tipo + Cor KPI em linha, Ordem separada — evita 3 cols em panel estreito */}
          <div className="grid gap-1.5 grid-cols-2">
            <MiniField label="Tipo">
              <select value={output.type ?? "money"} onChange={(e) => up("type", e.target.value as OutputField["type"])} className={miniInput}>
                {RESULT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </MiniField>
            <MiniField label="Cor KPI">
              <select value={output.kpiVariant ?? "default"} onChange={(e) => up("kpiVariant", e.target.value as OutputField["kpiVariant"])} className={miniInput}>
                {KPI_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </MiniField>
          </div>
          <MiniField label="Ordem de exibição">
            <input type="number" value={output.displayOrder} onChange={(e) => up("displayOrder", Number(e.target.value))} className={miniInput} />
          </MiniField>
          <MiniField label="Fórmula">
            <FormulaInput
              value={output.formula}
              onChange={(v) => up("formula", v)}
              scope={testScope}
              availableVars={availableVars}
              type={output.type as "money" | "percent" | "number" ?? "money"}
            />
          </MiniField>
          <button onClick={onRemove} className="flex items-center gap-1 text-[11px] text-destructive hover:underline">
            <Trash2 className="h-3 w-3" /> Remover KPI
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINEL ③ — Timeline Section
// ─────────────────────────────────────────────────────────────────────────────

function TimelineSection({
  config, evalResult, timelineVars, upTimeline, onChange,
}: {
  config: SimulatorConfig;
  evalResult: { timeline: Record<string, number>[] };
  timelineVars: string[];
  upTimeline: (patch: Partial<NonNullable<SimulatorConfig["timeline"]>>) => void;
  onChange: (c: SimulatorConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const tl = config.timeline;
  const rowCount = evalResult.timeline.length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-accent/40"
      >
        <span className="text-xs font-extrabold text-muted-foreground">TIMELINE</span>
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tl ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {tl ? `${rowCount} linhas` : "desabilitada"}
        </span>
        <ChevronDown className={`ml-auto h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {/* Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!tl}
              onChange={(e) => {
                if (e.target.checked) upTimeline({ loopVariable: "mes", lengthFormula: "prazoMeses", fields: [], accumulators: [] });
                else onChange({ ...config, timeline: undefined });
              }}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs font-bold">Habilitar loop mensal</span>
          </label>

          {tl && (
            <>
              <div className="grid gap-2 grid-cols-2">
                <MiniField label="Variável do loop">
                  <input value={tl.loopVariable} onChange={(e) => upTimeline({ loopVariable: e.target.value })} className={`${miniInput} font-mono`} placeholder="mes" />
                </MiniField>
                <MiniField label="Fórmula da duração">
                  <input value={tl.lengthFormula} onChange={(e) => upTimeline({ lengthFormula: e.target.value })} className={`${miniInput} font-mono`} placeholder="prazoMeses" />
                </MiniField>
              </div>

              {/* Fields */}
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Campos por iteração</p>
              {(tl.fields ?? []).map((f, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-background p-2 space-y-1.5">
                  <div className="grid gap-1.5 grid-cols-2">
                    <input value={f.key} onChange={(e) => upTimeline({ fields: tl.fields.map((x, i) => i === idx ? { ...x, key: e.target.value } : x) })} placeholder="key" className={`${miniInput} font-mono`} />
                    <input value={f.label} onChange={(e) => upTimeline({ fields: tl.fields.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) })} placeholder="label" className={miniInput} />
                  </div>
                  <FormulaInput
                    value={f.formula}
                    onChange={(v) => upTimeline({ fields: tl.fields.map((x, i) => i === idx ? { ...x, formula: v } : x) })}
                    scope={undefined}
                    availableVars={timelineVars}
                    placeholder="ex: saldoPlano * (1 + taxaAdmFrac)"
                  />
                  <button onClick={() => upTimeline({ fields: tl.fields.filter((_, i) => i !== idx) })} className="flex items-center gap-1 text-[10px] text-destructive hover:underline">
                    <Trash2 className="h-2.5 w-2.5" /> remover
                  </button>
                </div>
              ))}
              <button onClick={() => upTimeline({ fields: [...(tl.fields ?? []), blankTlField()] })} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                <Plus className="h-3 w-3" /> campo
              </button>

              {/* Accumulators */}
              {(tl.accumulators ?? []).length > 0 && (
                <>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Acumuladores</p>
                  {(tl.accumulators ?? []).map((acc, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-background p-2 space-y-1.5">
                      {/* key + valor inicial em linha, fórmula abaixo — evita 3 cols em panel estreito */}
                      <div className="grid gap-1.5 grid-cols-2">
                        <div>
                          <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">Key</p>
                          <input value={acc.key} onChange={(e) => upTimeline({ accumulators: (tl.accumulators ?? []).map((x, i) => i === idx ? { ...x, key: e.target.value } : x) })} placeholder="key" className={`${miniInput} font-mono`} />
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">Valor inicial</p>
                          <input value={acc.initialValue} onChange={(e) => upTimeline({ accumulators: (tl.accumulators ?? []).map((x, i) => i === idx ? { ...x, initialValue: e.target.value } : x) })} placeholder="0" className={`${miniInput} font-mono`} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">Fórmula de atualização</p>
                        <input value={acc.formula} onChange={(e) => upTimeline({ accumulators: (tl.accumulators ?? []).map((x, i) => i === idx ? { ...x, formula: e.target.value } : x) })} placeholder="acc + campo" className={`${miniInput} font-mono`} />
                      </div>
                      <button onClick={() => upTimeline({ accumulators: (tl.accumulators ?? []).filter((_, i) => i !== idx) })} className="flex items-center gap-1 text-[10px] text-destructive hover:underline">
                        <Trash2 className="h-2.5 w-2.5" /> remover acumulador
                      </button>
                    </div>
                  ))}
                </>
              )}
              <button onClick={() => upTimeline({ accumulators: [...(tl.accumulators ?? []), blankAccum()] })} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                <Plus className="h-3 w-3" /> acumulador
              </button>

              {/* Preview */}
              {rowCount > 0 && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Preview (primeiras 5 linhas)
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="text-[10px] w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {Object.keys(evalResult.timeline[0] ?? {}).map((k) => (
                            <th key={k} className="px-2 py-1 text-left font-mono font-bold text-muted-foreground">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.timeline.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-2 py-1 font-mono text-foreground">{Number(v).toFixed(2)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE PREVIEW — Tabela de todos os valores computados
// ─────────────────────────────────────────────────────────────────────────────

function ScopePreview({
  scope, inputs, intermediates, outputs,
}: {
  scope: Record<string, number>;
  inputs: InputField[];
  intermediates: FormulaStep[];
  outputs: OutputField[];
}) {
  const [show, setShow] = useState(false);

  const sections = [
    { label: "Entradas", keys: inputs.map((f) => f.key), color: "text-blue-600 dark:text-blue-400" },
    { label: "Intermediárias", keys: intermediates.map((s) => s.key), color: "text-primary" },
    { label: "Resultados", keys: outputs.map((o) => o.key), color: "text-green-600 dark:text-green-400" },
  ];

  return (
    <div className="rounded-xl border border-border bg-muted/20">
      <button
        onClick={() => setShow((s) => !s)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {show ? "Ocultar" : "Ver"} todos os valores computados ({Object.keys(scope).length} variáveis)
      </button>
      {show && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-3">
            {sections.map(({ label, keys, color }) => (
              <div key={label}>
                <p className={`mb-2 text-[10px] font-extrabold uppercase tracking-widest ${color}`}>{label}</p>
                <div className="space-y-1">
                  {keys.filter((k) => k in scope).map((k) => (
                    <div key={k} className="flex items-center justify-between rounded-lg bg-card px-2.5 py-1.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{k}</span>
                      <span className={`font-mono text-[11px] font-bold ${color}`}>{fmtScope(scope[k])}</span>
                    </div>
                  ))}
                  {keys.filter((k) => !(k in scope)).length > 0 && (
                    <p className="text-[10px] text-muted-foreground italic">
                      {keys.filter((k) => !(k in scope)).length} variáveis sem valor (chaves vazias?)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro helpers
// ─────────────────────────────────────────────────────────────────────────────

function PanelHeader({ number, title, description, badge }: {
  number: string; title: string; description: string; badge?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">{number}</span>
        <span className="text-sm font-extrabold text-foreground">{title}</span>
        {badge && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{badge}</span>}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xs font-bold text-foreground">{text}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const miniInput = "w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10";
