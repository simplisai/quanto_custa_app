import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, Trash2, Loader2, Check, Palette, FileText, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_BRAND_LOGO,
} from "@/hooks/useBrandSettings";

export const Route = createFileRoute("/_authenticated/settings/brand")({
  component: BrandSettingsPage,
});

const PRESET_COLORS = [
  "#22c55e", "#2563eb", "#dc2626", "#d97706",
  "#7c3aed", "#0f172a", "#0891b2", "#db2777",
];
const ALLOWED_EXT = ["png", "jpg", "jpeg", "svg"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function BrandSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [savedColor, setSavedColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load current settings ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("brand_logo_url, brand_color")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setLogoUrl(data.brand_logo_url ?? null);
        setColor(data.brand_color ?? DEFAULT_BRAND_COLOR);
        setSavedColor(data.brand_color ?? DEFAULT_BRAND_COLOR);
      }
      setLoading(false);
    })();
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    if (!userId) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error("Formato inválido. Use PNG, JPG ou SVG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
      const path = `${userId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand_assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("brand_assets").getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ brand_logo_url: publicUrl })
        .eq("id", userId);
      if (dbErr) throw dbErr;

      setLogoUrl(publicUrl);
      toast.success("Logo atualizada!");
    } catch (err) {
      toast.error("Erro ao enviar logo. Tente novamente.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!userId || !logoUrl) return;
    setUploading(true);
    try {
      // Remove os possíveis arquivos (ext desconhecida → tenta todas)
      await supabase.storage
        .from("brand_assets")
        .remove(ALLOWED_EXT.map((e) => `${userId}/logo.${e}`));
      await supabase
        .from("profiles")
        .update({ brand_logo_url: null })
        .eq("id", userId);
      setLogoUrl(null);
      toast.success("Logo removida.");
    } catch {
      toast.error("Erro ao remover logo.");
    } finally {
      setUploading(false);
    }
  }

  // ── Save color ─────────────────────────────────────────────────────────
  async function handleSaveColor() {
    if (!userId) return;
    if (!HEX_RE.test(color)) {
      toast.error("Cor inválida. Use formato #RRGGBB.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ brand_color: color })
        .eq("id", userId);
      if (error) throw error;
      setSavedColor(color);
      toast.success("Cor da marca salva!");
    } catch {
      toast.error("Erro ao salvar cor.");
    } finally {
      setSaving(false);
    }
  }

  const previewLogo = logoUrl ?? DEFAULT_BRAND_LOGO;
  const colorDirty = color !== savedColor;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Minha Marca</h1>
          <p className="text-sm text-muted-foreground">
            Personalize a logo e a cor exibidas nos seus PDFs e formulários.
          </p>
        </div>
      </header>

      {/* Logo upload */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
          Logomarca
        </h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-7 w-7 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold">
              Arraste sua logo aqui ou <span className="text-primary">clique para enviar</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG ou SVG · máx. 2MB · Use imagens com fundo transparente (PNG/SVG) para melhor contraste.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {logoUrl && (
          <button
            onClick={handleRemoveLogo}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover logo
          </button>
        )}
        <p className="text-[11px] text-amber-600 dark:text-amber-500">
          ⚠ Logos SVG não aparecem no PDF — para PDF, prefira PNG.
        </p>
      </section>

      {/* Color picker */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
          Cor da marca
        </h2>

        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Selecionar cor ${c}`}
              className="relative h-9 w-9 rounded-full border border-border transition hover:scale-110"
              style={{ backgroundColor: c }}
            >
              {color.toLowerCase() === c.toLowerCase() && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={HEX_RE.test(color) ? color : DEFAULT_BRAND_COLOR}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-1"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#22c55e"
            className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          <button
            onClick={handleSaveColor}
            disabled={saving || !colorDirty}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar cor
          </button>
        </div>
      </section>

      {/* Live preview */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
          Pré-visualização ao vivo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* PDF header mockup */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Header do PDF
              </span>
            </div>
            <div className="bg-white p-4">
              {/* logo + eyebrow */}
              <div className="flex items-center justify-between">
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin" style={{ color }} />
                  : <img src={previewLogo} alt="logo" className="h-6 object-contain" />}
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color }}>
                    Relatório Exclusivo
                  </span>
                </div>
              </div>
              {/* accent rule */}
              <div className="mt-3 flex h-[3px] gap-1">
                <div className="w-12 rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1 rounded-full bg-slate-100" />
              </div>
              {/* title */}
              <p className="mt-3 text-[13px] font-extrabold tracking-tight text-slate-900">
                Relatório de Inteligência Patrimonial
              </p>
              <p className="text-[8px] uppercase tracking-wide text-slate-400">
                Análise comparativa de crédito imobiliário
              </p>
            </div>
          </div>

          {/* Form header mockup */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Topo do Formulário
              </span>
            </div>
            <div className="flex items-center justify-center py-6" style={{ backgroundColor: color }}>
              {uploading
                ? <Loader2 className="h-6 w-6 animate-spin text-white" />
                : <img src={previewLogo} alt="logo" className="h-10 object-contain" />}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se a sua logo ficar ilegível sobre a cor escolhida, ajuste a cor ou envie uma logo com fundo transparente.
        </p>
      </section>
    </div>
  );
}
