import { useState } from "react";
import { Loader2, ChevronRight, LayoutTemplate, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export type TemplatePayload = Record<string, string>;

interface TemplateRow {
  id: string;
  name: string;
  operation_slug: string;
  payload: TemplatePayload;
  is_default: boolean;
}

interface TemplatePickerProps {
  operationSlug: string;
  onApply: (payload: TemplatePayload) => void;
}

export function TemplatePicker({ operationSlug, onApply }: TemplatePickerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTemplates = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("templates")
      .select("id, name, operation_slug, payload, is_default")
      .eq("user_id", user.id)
      .eq("operation_slug", operationSlug)
      .order("is_default", { ascending: false })
      .order("name");
    setTemplates((data ?? []) as unknown as TemplateRow[]);
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(true);
    loadTemplates();
  };

  const apply = (t: TemplateRow) => {
    onApply(t.payload);
    setOpen(false);
    toast.success(`Template "${t.name}" aplicado!`);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition-colors shrink-0"
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Template</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              Aplicar Template
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum template criado para este simulador.
              </p>
              <Link
                to="/templates"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Criar template
              </Link>
            </div>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => apply(t)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent hover:border-primary/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {t.is_default && (
                          <Star className="h-3 w-3 text-primary shrink-0" fill="currentColor" />
                        )}
                        <p className="text-sm font-bold truncate">{t.name}</p>
                      </div>
                      {t.is_default && (
                        <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                          Padrão
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2 border-t border-border">
            <Link
              to="/templates"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutTemplate className="h-3 w-3" />
              Gerenciar templates
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
