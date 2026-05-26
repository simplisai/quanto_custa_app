import type { SimulatorConfigRow } from "@/lib/simulator-config.types";
import { CheckCircle2, Clock, Copy, UploadCloud } from "lucide-react";

interface VersionCardProps {
  row: SimulatorConfigRow;
  currentUserEmail?: string;
  onPublish: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  publishing?: boolean;
  duplicating?: boolean;
}

export function VersionCard({
  row,
  onPublish,
  onDuplicate,
  publishing,
  duplicating,
}: VersionCardProps) {
  const date = new Date(row.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={[
      "rounded-2xl border p-4 transition-all",
      row.is_published
        ? "border-green-500/40 bg-green-500/5 ring-1 ring-green-500/20"
        : "border-border bg-card",
    ].join(" ")}>
      <div className="flex items-start gap-3">
        <div className={[
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold",
          row.is_published ? "bg-green-500 text-white" : "bg-muted text-muted-foreground",
        ].join(" ")}>
          v{row.version_number}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground leading-tight">
              {row.version_label || `Versão ${row.version_number}`}
            </span>
            {row.is_published && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Em produção
              </span>
            )}
          </div>

          {row.notes && (
            <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
          )}

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {date}
          </div>

          {/* Metadata pills */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-muted-foreground">
              {row.config.inputs?.length ?? 0} campos
            </span>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-muted-foreground">
              {row.config.intermediates?.length ?? 0} intermediários
            </span>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-muted-foreground">
              {row.config.outputs?.length ?? 0} resultados
            </span>
            {row.config.timeline && (
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                ✓ timeline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        {!row.is_published && (
          <button
            onClick={() => onPublish(row.id)}
            disabled={publishing}
            className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-green-600 disabled:opacity-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            {publishing ? "Publicando…" : "Publicar esta versão"}
          </button>
        )}
        <button
          onClick={() => onDuplicate(row.id)}
          disabled={duplicating}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          {duplicating ? "Duplicando…" : "Duplicar como rascunho"}
        </button>
      </div>
    </div>
  );
}
