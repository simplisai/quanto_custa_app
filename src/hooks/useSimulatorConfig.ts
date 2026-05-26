import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SimulatorConfig, SimulatorConfigRow } from "@/lib/simulator-config.types";

/**
 * Fetches the currently published simulator config for a given slug.
 * Returns null if no published config exists (simulators fall back to TypeScript).
 */
export function useSimulatorConfig(slug: string): {
  config: SimulatorConfig | null;
  row: SimulatorConfigRow | null;
  loading: boolean;
} {
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [row, setRow] = useState<SimulatorConfigRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from("simulator_configs" as "templates") // cast until types.ts is updated
      .select("*")
      .eq("slug" as "operation_slug", slug)
      .eq("is_published" as "is_default", true)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const typedRow = data as unknown as SimulatorConfigRow;
          setRow(typedRow);
          setConfig(typedRow.config);
        } else {
          setRow(null);
          setConfig(null);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  return { config, row, loading };
}
