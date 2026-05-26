import { useEffect, useState } from "react";
import { validateFormula, evaluateWithDiagnostic } from "@/lib/formula-engine";
import { fmtBRL } from "@/lib/format";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface FormulaInputProps {
  value: string;
  onChange: (v: string) => void;
  scope?: Record<string, number>; // current test scope for live preview
  availableVars?: string[];
  type?: "money" | "percent" | "number";
  placeholder?: string;
  readOnly?: boolean;
}

export function FormulaInput({
  value,
  onChange,
  scope,
  availableVars = [],
  type = "number",
  placeholder = "ex: cartaCredito * taxaAdmFrac",
  readOnly = false,
}: FormulaInputProps) {
  const [focused, setFocused] = useState(false);
  const syntaxError = validateFormula(value);
  const isValid = !syntaxError && value.trim().length > 0;

  const preview = scope && isValid
    ? evaluateWithDiagnostic(value, scope)
    : null;

  const formatPreview = (v: number) => {
    if (type === "money") return fmtBRL(v);
    if (type === "percent") return `${v.toFixed(4)}%`;
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          readOnly={readOnly}
          placeholder={placeholder}
          rows={2}
          className={[
            "w-full resize-none rounded-lg border bg-background px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-4",
            readOnly ? "cursor-default opacity-60" : "",
            value.trim() === ""
              ? "border-input focus:border-primary focus:ring-primary/10"
              : isValid
              ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/10"
              : "border-red-400/60 focus:border-red-400 focus:ring-red-400/10",
          ].join(" ")}
        />
        {value.trim() !== "" && (
          <span className="absolute right-2 top-2">
            {isValid
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            }
          </span>
        )}
      </div>

      {/* Live preview */}
      {preview && preview.value !== null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono text-foreground font-semibold">
            = {formatPreview(preview.value)}
          </span>
          <span className="opacity-50">(com valores de teste)</span>
        </div>
      )}

      {/* Error message */}
      {!isValid && value.trim() !== "" && syntaxError && (
        <p className="text-[11px] text-red-400 font-mono">{syntaxError}</p>
      )}

      {/* Available vars hint — shown when focused */}
      {focused && availableVars.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">
            Variáveis disponíveis
          </p>
          <div className="flex flex-wrap gap-1">
            {availableVars.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange(value + (value.endsWith(" ") || value === "" ? "" : " ") + v)}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-primary hover:text-primary-foreground"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
