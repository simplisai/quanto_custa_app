// ─── Simulator Config Schema ─────────────────────────────────────────────────
// This schema describes a simulator's formula definition stored in JSONB.
// Each simulator version is one row in `simulator_configs` table.

export type FieldType = "money" | "percent" | "int" | "enum" | "bool";

/** A user-facing input field for the simulator form */
export interface InputField {
  key: string;           // e.g. "cartaCredito"
  label: string;         // e.g. "Carta de crédito (R$)"
  type: FieldType;
  defaultValue: string;  // masked string, e.g. "500.000,00" or "18,00" or "120"
  options?: { value: string; label: string }[]; // for enum type
  hint?: string;
  min?: number;
  max?: number;
}

/** An intermediate computed variable — evaluated in order, each adds to scope */
export interface FormulaStep {
  key: string;           // e.g. "taxaAdmFrac"
  label: string;         // e.g. "Taxa de adm. em fração decimal"
  formula: string;       // mathjs expression: "taxaAdmTotal / 100"
  description?: string;  // plain-language explanation for financial experts
  type?: "money" | "percent" | "number";
}

/** A final result field displayed to the user */
export interface OutputField extends FormulaStep {
  displayOrder: number;
  kpiVariant?: "default" | "success" | "primary" | "warning" | "danger";
}

/** An accumulator that carries state between timeline loop iterations */
export interface AccumulatorDef {
  key: string;            // e.g. "acumSemLance"
  initialValue: string;   // mathjs expression evaluated once before loop: "0"
  formula: string;        // updated after each iteration: "acumSemLance + parcelaSemLance"
  label?: string;
}

/** A computed field inside the timeline loop */
export interface TimelineField {
  key: string;
  label: string;
  formula: string;        // can reference loopVariable ("mes") + all scope vars
  type?: "money" | "number";
}

/** Configuration for the month-by-month timeline loop */
export interface TimelineConfig {
  loopVariable: string;   // "mes"
  lengthFormula: string;  // mathjs expression that evaluates to number of iterations: "prazoMeses"
  fields: TimelineField[];
  accumulators?: AccumulatorDef[];
}

/** Root config object stored as JSONB in simulator_configs.config */
export interface SimulatorConfig {
  schemaVersion: number;        // 1 (for future migrations)
  inputs: InputField[];
  intermediates: FormulaStep[]; // evaluated in order; each adds key to scope
  outputs: OutputField[];
  timeline?: TimelineConfig;
}

/** A row from the simulator_configs table */
export interface SimulatorConfigRow {
  id: string;
  slug: string;
  version_number: number;
  version_label: string;
  notes: string | null;
  config: SimulatorConfig;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}
