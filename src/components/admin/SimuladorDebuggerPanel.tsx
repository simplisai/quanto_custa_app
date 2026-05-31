// ─── Calculadora de Auditoria ────────────────────────────────────────────────
//
// Roda a função TypeScript REAL do simulador (não mathjs).
// Layout: inputs → resultados principais → passos (collapsível) → timeline.
//
// Os badges de verificação ✅/❌ existem internamente mas não poluem o visual
// principal — ficam disponíveis no export JSON para auditoria técnica.

import { useMemo, useState, useCallback } from "react";
import { Copy, Check, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { DEBUGGER_REGISTRY, type InputFieldDef, type FieldUnit } from "@/lib/simulator-debugger-registry";

// ── Formatação ────────────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmt(value: number | null | undefined, unidade: FieldUnit): string {
  if (value == null || !isFinite(value)) return "—";
  switch (unidade) {
    case "R$":    return brl.format(value);
    case "%":     return `${pct.format(value)}%`;
    case "meses": return `${Math.round(value)} meses`;
    case "anos":  return `${num.format(value)} anos`;
    default:      return num.format(value);
  }
}

const DIRETRIZ_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-blue-50 dark:bg-blue-950",   text: "text-blue-700 dark:text-blue-300" },
  B: { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300" },
  C: { bg: "bg-indigo-50 dark:bg-indigo-950", text: "text-indigo-700 dark:text-indigo-300" },
  D: { bg: "bg-orange-50 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300" },
  E: { bg: "bg-green-50 dark:bg-green-950",  text: "text-green-700 dark:text-green-300" },
  F: { bg: "bg-teal-50 dark:bg-teal-950",   text: "text-teal-700 dark:text-teal-300" },
};

// ── Input field ───────────────────────────────────────────────────────────────

function DebugInput({
  field, value, onChange,
}: {
  field: InputFieldDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
    const cleaned = e.target.value.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    if (!isNaN(n)) onChange(n);
  };

  const suffix = field.type === "percent" ? "%" : field.type === "meses" ? "m" : "";

  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        {field.label}
        {field.hint && (
          <span title={field.hint} className="cursor-help text-muted-foreground/60">
            <Info className="h-3 w-3" />
          </span>
        )}
      </label>
      <div className="flex items-center">
        {field.type === "money" && (
          <span className="shrink-0 rounded-l-lg border border-r-0 border-input bg-muted px-2 py-2 text-xs font-bold text-muted-foreground">R$</span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={handleChange}
          onFocus={() => setRaw(String(value).replace(".", ","))}
          onBlur={() => setRaw(String(value).replace(".", ","))}
          className={[
            "w-full border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10",
            field.type === "money" ? "rounded-r-lg" : suffix ? "rounded-l-lg" : "rounded-lg",
          ].join(" ")}
        />
        {suffix && (
          <span className="shrink-0 rounded-r-lg border border-l-0 border-input bg-muted px-2 py-2 text-xs font-bold text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ── Resultado card ────────────────────────────────────────────────────────────

function ResultCard({ label, formula, valor, unidade, diretriz }: {
  label: string;
  formula: string;
  valor: number | null | undefined;
  unidade: FieldUnit;
  diretriz?: string;
}) {
  const colors = diretriz ? DIRETRIZ_COLORS[diretriz] : null;
  return (
    <div className={`rounded-xl border border-border p-4 ${colors ? colors.bg : "bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold ${colors ? colors.text : "text-muted-foreground"}`}>{label}</p>
        {diretriz && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${colors ? colors.text : ""} bg-black/5 dark:bg-white/10`}>
            {diretriz}
          </span>
        )}
      </div>
      <p className="mt-1.5 font-mono text-lg font-extrabold text-foreground">
        {fmt(valor, unidade)}
      </p>
      <code className="mt-0.5 block text-[10px] text-muted-foreground/70">{formula}</code>
    </div>
  );
}

// ── Timeline preview ──────────────────────────────────────────────────────────

function TimelinePreview({ timeline, columns }: {
  timeline: unknown[];
  columns: { key: string; label: string; unidade: FieldUnit; getValue: (r: unknown) => number | null | undefined }[];
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_ROWS = 12;
  const rows = showAll ? timeline : timeline.slice(0, INITIAL_ROWS);
  if (!rows.length) return null;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left font-extrabold text-muted-foreground">
                  {c.label} <span className="font-normal opacity-60">({c.unidade})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const contemplado = (row as Record<string, unknown>).contemplado === true;
              return (
                <tr
                  key={i}
                  className={[
                    "border-b border-border last:border-0",
                    contemplado ? "bg-primary/5 font-semibold" : "hover:bg-accent/30",
                  ].join(" ")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2 font-mono text-foreground">
                      {fmt(c.getValue(row), c.unidade)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {timeline.length > INITIAL_ROWS && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:bg-accent"
        >
          {showAll ? `▲ Recolher` : `▼ Ver todos os ${timeline.length} meses`}
        </button>
      )}
    </div>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────

export function SimuladorDebuggerPanel({ slug }: { slug: string }) {
  const spec = DEBUGGER_REGISTRY[slug];
  const [inputs, setInputs] = useState<Record<string, number>>(() => {
    if (!spec) return {};
    const def: Record<string, number> = {};
    for (const f of spec.inputFields) def[f.key] = f.defaultValue;
    return def;
  });
  const [stepsOpen, setStepsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const setField = useCallback((key: string, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fullInputs = useMemo(() => {
    if (!spec) return {};
    return { ...spec.defaultInputs, ...inputs };
  }, [spec, inputs]);

  const calcResult = useMemo(() => {
    if (!spec) return { data: null, error: null };
    try {
      return { data: spec.calcFn(fullInputs), error: null };
    } catch (e: unknown) {
      return { data: null, error: String(e) };
    }
  }, [spec, fullInputs]);

  const trace = useMemo(() => {
    if (!spec || !calcResult.data) return [];
    return spec.traceSteps.map((step) => {
      const valor = step.getValue(calcResult.data);
      let verificacao: { ok: boolean; esperado: number } | null = null;
      if (step.verificar) {
        try { verificacao = step.verificar(fullInputs, calcResult.data); }
        catch { verificacao = null; }
      }
      return { ...step, valor, verificacao };
    });
  }, [spec, calcResult.data, fullInputs]);

  // KPI cards: steps with diretriz (A–F) — the canonical results
  const kpiSteps = trace.filter((s) => s.diretriz);
  // All steps for the collapsible table
  const allSteps = trace;

  const exportTrace = useCallback(() => {
    const payload = {
      simulador: spec?.label,
      inputs: fullInputs,
      trace: trace.map((t) => ({
        campo: t.campo,
        label: t.label,
        formula: t.formula,
        diretriz: t.diretriz,
        valorCalculado: t.valor,
        status: t.verificacao ? (t.verificacao.ok ? "OK" : "DIVERGENCIA") : "SEM_VERIFICACAO",
        esperado: t.verificacao?.esperado,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [spec, fullInputs, trace]);

  if (!spec) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        <p className="text-2xl">🔍</p>
        <p className="mt-2 font-bold">Nenhum spec de debugger para <code className="font-mono">{slug}</code></p>
        <p className="mt-1 text-xs">Adicione uma entrada em <code className="font-mono">simulator-debugger-registry.ts</code></p>
      </div>
    );
  }

  const hasTimeline = calcResult.data &&
    spec.timelineColumns &&
    (calcResult.data as Record<string, unknown>).timeline;

  return (
    <div className="space-y-6">

      {/* ── Erro de execução ── */}
      {calcResult.error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">Erro na execução do cálculo</p>
            <p className="mt-0.5 font-mono text-xs">{calcResult.error}</p>
          </div>
        </div>
      )}

      {/* ── SEÇÃO 1: Entradas ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          Entradas — {spec.label}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {spec.inputFields.map((field) => (
            <DebugInput
              key={field.key}
              field={field}
              value={inputs[field.key] ?? field.defaultValue}
              onChange={(v) => setField(field.key, v)}
            />
          ))}
        </div>
      </div>

      {/* ── SEÇÃO 2: Resultados Principais (campos com diretriz) ── */}
      {calcResult.data && kpiSteps.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Resultados Principais
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kpiSteps.map((step) => (
              <ResultCard
                key={step.id}
                label={step.label}
                formula={step.formula}
                valor={step.valor}
                unidade={step.unidade}
                diretriz={step.diretriz}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── SEÇÃO 3: Todos os Passos de Cálculo (collapsível) ── */}
      {calcResult.data && allSteps.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setStepsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-extrabold hover:bg-accent/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              {stepsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Passos de Cálculo
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {allSteps.length} passos
              </span>
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {stepsOpen ? "recolher" : "expandir para ver todos os campos calculados"}
            </span>
          </button>

          {stepsOpen && (
            <div className="border-t border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2.5 text-left font-extrabold uppercase tracking-wide text-muted-foreground">Campo</th>
                      <th className="px-3 py-2.5 text-left font-extrabold uppercase tracking-wide text-muted-foreground">Fórmula</th>
                      <th className="w-12 px-2 py-2.5 text-center font-extrabold uppercase tracking-wide text-muted-foreground">Dir.</th>
                      <th className="px-3 py-2.5 text-right font-extrabold uppercase tracking-wide text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSteps.map((step) => {
                      const colors = step.diretriz ? DIRETRIZ_COLORS[step.diretriz] : null;
                      return (
                        <tr key={step.id} className="border-b border-border last:border-0 hover:bg-accent/20">
                          <td className="px-3 py-2.5">
                            <p className="font-mono text-xs font-bold text-foreground">{step.campo}</p>
                            <p className="text-[11px] text-muted-foreground">{step.label}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                              {step.formula}
                            </code>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            {step.diretriz ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${colors ? `${colors.bg} ${colors.text}` : "bg-muted text-muted-foreground"}`}>
                                {step.diretriz}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-foreground">
                            {fmt(step.valor, step.unidade)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Export JSON — ação técnica, fica no footer da seção técnica */}
              <div className="border-t border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Os valores acima derivam do motor TypeScript real — os mesmos dados dos cards e gráficos.
                </p>
                <button
                  onClick={exportTrace}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-accent"
                >
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copiado!" : "Exportar trace JSON"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEÇÃO 4: Timeline (collapsível) ── */}
      {hasTimeline && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setTimelineOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-extrabold hover:bg-accent/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              {timelineOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              📅 Timeline
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {((calcResult.data as Record<string, unknown>).timeline as unknown[]).length} meses
              </span>
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {timelineOpen ? "recolher" : "expandir para ver mês a mês"}
            </span>
          </button>
          {timelineOpen && (
            <div className="border-t border-border p-4">
              <TimelinePreview
                timeline={(calcResult.data as Record<string, unknown>).timeline as unknown[]}
                columns={spec.timelineColumns!}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
