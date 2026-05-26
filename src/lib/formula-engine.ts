// ─── Formula Engine ───────────────────────────────────────────────────────────
// Safely evaluates SimulatorConfig formulas using mathjs.
// mathjs is sandboxed — no access to DOM, network, or filesystem.
// Supports: arithmetic, max/min/ceil/floor/pow/sqrt/abs/round, ternary.

import { evaluate, parse } from "mathjs";
import type { SimulatorConfig } from "./simulator-config.types";

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates a mathjs formula string.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateFormula(formula: string): string | null {
  if (!formula.trim()) return "Fórmula não pode estar vazia";
  try {
    parse(formula);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/**
 * Safely evaluates a single formula in a given scope.
 * Returns the numeric result, or 0 on error.
 */
export function evaluateFormula(
  formula: string,
  scope: Record<string, unknown>
): number {
  try {
    const result = evaluate(formula, { ...scope });
    if (typeof result === "number" && isFinite(result)) return result;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Evaluates a single formula and returns { value, error }.
 * Used in the admin UI to show live values + inline errors.
 */
export function evaluateWithDiagnostic(
  formula: string,
  scope: Record<string, unknown>
): { value: number | null; error: string | null } {
  if (!formula.trim()) return { value: null, error: "Fórmula vazia" };
  try {
    const result = evaluate(formula, { ...scope });
    if (typeof result === "number" && isFinite(result)) {
      return { value: result, error: null };
    }
    return { value: null, error: "Resultado não é um número" };
  } catch (e) {
    return { value: null, error: (e as Error).message };
  }
}

// ─── Full Config Execution ────────────────────────────────────────────────────

export interface EngineResult {
  scope: Record<string, number>;
  timeline: Record<string, number>[];
  errors: { step: string; message: string }[];
}

/**
 * Runs a full SimulatorConfig given numeric inputs.
 * Returns scope (all computed values), timeline (array of row objects), and errors.
 *
 * Execution order:
 * 1. inputs → scope
 * 2. intermediates (in order) → scope
 * 3. outputs → scope
 * 4. timeline loop (if present) → timeline[]
 */
export function runSimulatorConfig(
  config: SimulatorConfig,
  inputs: Record<string, number | string>
): EngineResult {
  const errors: { step: string; message: string }[] = [];

  // Convert all inputs to numbers where possible
  const scope: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(inputs)) {
    scope[key] = typeof val === "string" ? (parseFloat(val.replace(",", ".")) || 0) : val;
  }

  // 1. Evaluate intermediates in declared order
  for (const step of config.intermediates) {
    try {
      const result = evaluate(step.formula, { ...scope });
      scope[step.key] = typeof result === "number" && isFinite(result) ? result : 0;
    } catch (e) {
      scope[step.key] = 0;
      errors.push({ step: step.key, message: (e as Error).message });
    }
  }

  // 2. Evaluate outputs
  for (const out of config.outputs) {
    try {
      const result = evaluate(out.formula, { ...scope });
      scope[out.key] = typeof result === "number" && isFinite(result) ? result : 0;
    } catch (e) {
      scope[out.key] = 0;
      errors.push({ step: out.key, message: (e as Error).message });
    }
  }

  const finalScope = scope as Record<string, number>;

  // 3. Timeline loop
  const timeline: Record<string, number>[] = [];
  if (config.timeline) {
    const tl = config.timeline;

    let length = 0;
    try {
      const lenResult = evaluate(tl.lengthFormula, { ...scope });
      length = Math.min(Math.max(Math.round(Number(lenResult) || 0), 0), 600);
    } catch {
      length = 0;
    }

    // Initialize accumulators
    const accState: Record<string, number> = {};
    for (const acc of tl.accumulators ?? []) {
      try {
        const init = evaluate(acc.initialValue, { ...scope });
        accState[acc.key] = typeof init === "number" ? init : 0;
      } catch {
        accState[acc.key] = 0;
      }
    }

    for (let i = 1; i <= length; i++) {
      const rowScope: Record<string, unknown> = {
        ...scope,
        ...accState,
        [tl.loopVariable]: i,
      };

      const row: Record<string, number> = { [tl.loopVariable]: i };

      // Evaluate timeline fields
      for (const field of tl.fields) {
        try {
          const result = evaluate(field.formula, { ...rowScope });
          row[field.key] = typeof result === "number" && isFinite(result) ? result : 0;
        } catch {
          row[field.key] = 0;
        }
      }

      // Update accumulators using the completed row
      const rowScopeWithRow = { ...rowScope, ...row };
      for (const acc of tl.accumulators ?? []) {
        try {
          const updated = evaluate(acc.formula, { ...rowScopeWithRow });
          accState[acc.key] = typeof updated === "number" && isFinite(updated) ? updated : accState[acc.key];
        } catch { /* keep previous value */ }
      }

      // Include accumulators in row for display
      for (const [k, v] of Object.entries(accState)) {
        row[k] = v;
      }

      timeline.push(row);
    }
  }

  return { scope: finalScope, timeline, errors };
}

/**
 * Returns a list of variable names available at each step,
 * used for autocomplete in the formula editor.
 */
export function getAvailableVarsAt(
  config: SimulatorConfig,
  currentKey: string
): string[] {
  const vars: string[] = config.inputs.map((f) => f.key);

  for (const step of config.intermediates) {
    if (step.key === currentKey) break;
    vars.push(step.key);
  }

  // mathjs built-ins useful for financial formulas
  const builtins = ["max", "min", "ceil", "floor", "pow", "sqrt", "abs", "round", "log", "exp", "pi", "e"];
  return [...vars, ...builtins];
}
