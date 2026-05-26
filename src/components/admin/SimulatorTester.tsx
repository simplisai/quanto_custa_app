import { useState, useMemo } from "react";
import { runSimulatorConfig } from "@/lib/formula-engine";
import type { SimulatorConfig } from "@/lib/simulator-config.types";
import { fmtBRL } from "@/lib/format";
import { maskMoney, maskPercent, unmask } from "@/lib/format";
import { Play, AlertTriangle } from "lucide-react";

interface SimulatorTesterProps {
  config: SimulatorConfig;
}

const BADGE: Record<string, string> = {
  default: "bg-muted/40 text-foreground",
  success: "bg-green-500/10 text-green-600",
  primary: "bg-primary/10 text-primary",
  warning: "bg-amber-500/10 text-amber-700",
  danger:  "bg-red-500/10 text-red-600",
};

export function SimulatorTester({ config }: SimulatorTesterProps) {
  // Build local state from config default values
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of config.inputs) init[f.key] = f.defaultValue ?? "0";
    return init;
  });

  const numericInputs = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of config.inputs) {
      out[f.key] = unmask(values[f.key] ?? "0");
    }
    return out;
  }, [values, config.inputs]);

  const result = useMemo(() => {
    try {
      return runSimulatorConfig(config, numericInputs);
    } catch {
      return null;
    }
  }, [config, numericInputs]);

  const fmtVal = (key: string, val: number) => {
    const step = [
      ...config.intermediates,
      ...config.outputs,
    ].find((s) => s.key === key);
    if (!step) return val.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    if (step.type === "money") return fmtBRL(val);
    if (step.type === "percent") return `${val.toFixed(4)}%`;
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  };

  const handleChange = (key: string, raw: string, type: string) => {
    let masked = raw;
    if (type === "money") masked = maskMoney(raw);
    else if (type === "percent") masked = maskPercent(raw);
    else masked = raw.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, [key]: masked }));
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <Play className="h-4 w-4 text-primary" />
        <span className="text-xs font-extrabold uppercase tracking-widest text-foreground">
          Testador em tempo real
        </span>
      </div>

      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Inputs */}
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Valores de teste
          </p>
          {config.inputs.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <label className="w-40 shrink-0 text-xs text-muted-foreground truncate" title={f.label}>
                {f.label}
              </label>
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value, f.type)}
                className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>
          ))}
        </div>

        {/* Errors */}
        {result && result.errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-red-500">
              <AlertTriangle className="h-3 w-3" />
              Erros de fórmula
            </div>
            {result.errors.map((e) => (
              <p key={e.step} className="text-[11px] text-red-600 font-mono">
                <strong>{e.step}:</strong> {e.message}
              </p>
            ))}
          </div>
        )}

        {/* Intermediates */}
        {result && config.intermediates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Variáveis intermediárias
            </p>
            {config.intermediates.map((step) => (
              <div key={step.key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
                <span className="font-mono text-[11px] text-muted-foreground">{step.key}</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {fmtVal(step.key, result.scope[step.key] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Outputs */}
        {result && config.outputs.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Resultados
            </p>
            {[...config.outputs]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((out) => (
                <div
                  key={out.key}
                  className={`rounded-xl p-3 ${BADGE[out.kpiVariant ?? "default"]}`}
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">{out.label}</p>
                  <p className="mt-0.5 font-mono text-base font-extrabold">
                    {fmtVal(out.key, result.scope[out.key] ?? 0)}
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Timeline preview */}
        {result && result.timeline.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Timeline (primeiras 6 iterações)
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {Object.keys(result.timeline[0]).map((k) => (
                      <th key={k} className="px-2 py-1.5 text-left font-extrabold text-muted-foreground">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.timeline.slice(0, 6).map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0">
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} className="px-2 py-1.5 font-mono text-foreground">
                          {typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
