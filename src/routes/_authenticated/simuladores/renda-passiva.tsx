import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import {
  calcRendaPassiva,
  defaultRendaPassivaInputs,
  type RendaPassivaInputs,
  type RendaPassivaResults,
  type UsoCreditoContemplado,
} from "@/lib/calc-renda-passiva";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { ArrowLeft, Banknote, TrendingUp, BarChart2, Zap, BookOpen } from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { PdfPage, PdfHeader, PdfSection, PdfMetric, PdfInsight, PdfPremises, PdfKVList, PdfFooter, C } from "@/components/PdfShell";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Route = createFileRoute("/_authenticated/simuladores/renda-passiva")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: RendaPassivaPage,
});

function NumInput({
  label, value, onChange, type, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type: "money" | "percent" | "int"; hint?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (type === "money") onChange(maskMoney(v));
    else if (type === "percent") onChange(maskPercent(v));
    else onChange(v.replace(/\D/g, ""));
  };
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
        {label}
        {hint && (
          <span title={hint} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">?</span>
        )}
      </label>
      <input
        value={value}
        onChange={handleChange}
        placeholder="0"
        inputMode="numeric"
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${accent ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function KPI({ icon: Icon, label, value, sub, variant = "default" }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  variant?: "default" | "success" | "primary" | "warning" | "danger";
}) {
  const colors: Record<string, string> = {
    default: "bg-muted/40 text-foreground",
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning-foreground",
    danger: "bg-danger/10 text-danger",
  };
  const iconColors: Record<string, string> = {
    default: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning-foreground",
    danger: "text-danger",
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${colors[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function RendaPassivaPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const reportRef = useRef<HTMLDivElement>(null);
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(reportRef, "Renda_Passiva_Consorcio.pdf");

  const [carta, setCarta] = useState(maskMoney(String(defaultRendaPassivaInputs.cartaCredito * 100)));
  const [taxaAdm, setTaxaAdm] = useState(maskPercent(String(defaultRendaPassivaInputs.taxaAdmTotal * 100)));
  const [prazo, setPrazo] = useState(String(defaultRendaPassivaInputs.prazoMeses));
  const [percLance, setPercLance] = useState(String(defaultRendaPassivaInputs.percLance));
  const [lanceProprioR, setLanceProprioR] = useState(maskMoney("0"));
  const [mesContemp, setMesContemp] = useState(String(defaultRendaPassivaInputs.mesContemplacao));
  const [rendaAluguel, setRendaAluguel] = useState(maskMoney(String(defaultRendaPassivaInputs.rendaAluguelMensal * 100)));
  const [reajuste, setReajuste] = useState(maskPercent(String(defaultRendaPassivaInputs.reajusteAluguelAnual * 100)));
  const [valorizacao, setValorizacao] = useState(maskPercent(String(defaultRendaPassivaInputs.valorizacaoAnual * 100)));
  const [cdi, setCdi] = useState(maskPercent(String(defaultRendaPassivaInputs.taxaCDIAnual * 100)));
  const [taxaAtualiz, setTaxaAtualiz] = useState(String(defaultRendaPassivaInputs.taxaAtualizacaoAnual));
  const [usoCredito, setUsoCredito] = useState<UsoCreditoContemplado>(defaultRendaPassivaInputs.usoCreditoContemplado);

  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<RendaPassivaResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ── Restore sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("rp-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.carta) setCarta(s.carta);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.prazo) setPrazo(s.prazo);
      if (s.percLance) setPercLance(s.percLance);
      if (s.lanceProprioR) setLanceProprioR(s.lanceProprioR);
      if (s.mesContemp) setMesContemp(s.mesContemp);
      if (s.rendaAluguel) setRendaAluguel(s.rendaAluguel);
      if (s.reajuste) setReajuste(s.reajuste);
      if (s.valorizacao) setValorizacao(s.valorizacao);
      if (s.cdi) setCdi(s.cdi);
      if (s.taxaAtualiz) setTaxaAtualiz(s.taxaAtualiz);
      if (s.usoCredito) setUsoCredito(s.usoCredito);
    } catch {}
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const clientPhone = selectedClient?.phone ?? "";

  useEffect(() => {
    if (!user) return;
    supabase.from("clients").select("id, name, phone").eq("user_id", user.id).order("name")
      .then(({ data }) => setClients(data ?? []));
  }, [user]);

  useEffect(() => {
    if (search.client) setSelectedClientId(search.client);
  }, [search.client]);

  useEffect(() => {
    if (!search.load || !user) return;
    supabase.from("simulations").select("*").eq("id", search.load).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const inp = data.inputs as Record<string, unknown>;
        if (inp.cartaCredito) setCarta(maskMoney(String(Math.round((inp.cartaCredito as number) * 100))));
        if (inp.taxaAdmTotal) setTaxaAdm(maskPercent(String(Math.round((inp.taxaAdmTotal as number) * 100))));
        if (inp.prazoMeses) setPrazo(String(inp.prazoMeses));
        if (inp.percLance !== undefined) setPercLance(String(inp.percLance));
        if (inp.lanceProprioR) setLanceProprioR(maskMoney(String(Math.round((inp.lanceProprioR as number) * 100))));
        if (inp.mesContemplacao) setMesContemp(String(inp.mesContemplacao));
        if (inp.rendaAluguelMensal) setRendaAluguel(maskMoney(String(Math.round((inp.rendaAluguelMensal as number) * 100))));
        if (inp.reajusteAluguelAnual) setReajuste(maskPercent(String(Math.round((inp.reajusteAluguelAnual as number) * 100))));
        if (inp.valorizacaoAnual) setValorizacao(maskPercent(String(Math.round((inp.valorizacaoAnual as number) * 100))));
        if (inp.taxaCDIAnual) setCdi(maskPercent(String(Math.round((inp.taxaCDIAnual as number) * 100))));
        if (data.client_id) setSelectedClientId(data.client_id);
        toast.success("Simulação carregada.");
      });
  }, [search.load, user]);

  const inputs: RendaPassivaInputs = useMemo(() => ({
    cartaCredito: unmask(carta),
    taxaAdmTotal: unmask(taxaAdm),
    prazoMeses: parseInt(prazo || "0", 10) || 1,
    percLance: parseInt(percLance || "0", 10) || 0,
    lanceProprioR: unmask(lanceProprioR),
    mesContemplacao: parseInt(mesContemp || "0", 10) || 1,
    rendaAluguelMensal: unmask(rendaAluguel),
    reajusteAluguelAnual: unmask(reajuste),
    valorizacaoAnual: unmask(valorizacao),
    taxaCDIAnual: unmask(cdi),
    taxaAtualizacaoAnual: parseFloat(taxaAtualiz || "0") || 0,
    usoCreditoContemplado: usoCredito,
  }), [carta, taxaAdm, prazo, percLance, lanceProprioR, mesContemp, rendaAluguel, reajuste, valorizacao, cdi, taxaAtualiz, usoCredito]);

  const calcular = () => {
    setResults(calcRendaPassiva(inputs));
    setSavedId(null);
    sessionStorage.setItem("rp-inputs", JSON.stringify({
      carta, taxaAdm, prazo, percLance, lanceProprioR,
      mesContemp, rendaAluguel, reajuste, valorizacao, cdi, taxaAtualiz, usoCredito,
    }));
  };

  const applyTemplate = (p: TemplatePayload) => {
    if (p.cartaCredito) setCarta(p.cartaCredito);
    if (p.taxaAdmTotal) setTaxaAdm(p.taxaAdmTotal);
    if (p.prazoMeses) setPrazo(p.prazoMeses);
    if (p.percLance) setPercLance(p.percLance);
    if (p.lanceProprioR) setLanceProprioR(p.lanceProprioR);
    if (p.mesContemplacao) setMesContemp(p.mesContemplacao);
    if (p.rendaAluguelMensal) setRendaAluguel(p.rendaAluguelMensal);
    if (p.reajusteAluguelAnual) setReajuste(p.reajusteAluguelAnual);
    if (p.valorizacaoAnual) setValorizacao(p.valorizacaoAnual);
    if (p.taxaCDIAnual) setCdi(p.taxaCDIAnual);
    setResults(null);
    setSavedId(null);
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Renda Passiva ${fmtBRL(inputs.cartaCredito)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          totalInvestido: results.totalInvestido,
          totalRendaGerada: results.totalRendaGerada,
          valorImovelFinal: results.valorImovelFinal,
          patrimonioFinal: results.patrimonioFinal,
          roiAnual: results.roiAnual,
        } as unknown as Record<string, unknown>,
      }).select("id").single();
      if (error) throw error;
      setSavedId(data?.id ?? null);
      toast.success("Simulação salva no histórico.");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <div className="flex items-center justify-between mb-3">
          <Link to="/simuladores" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Simuladores
          </Link>
          <div className="flex gap-2">
            <TemplatePicker operationSlug="renda-passiva-consorcio" onApply={applyTemplate} />
            <Link to="/simuladores/estrategia/$slug" params={{ slug: "renda-passiva-consorcio" }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition-colors">
              <BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Estratégia</span>
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">💰 Renda Passiva com Consórcio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simule o consórcio como veículo de investimento — o aluguel paga a parcela, o imóvel se valoriza.
        </p>
      </header>

      <Section title="Consórcio">
        <Grid2>
          <NumInput label="Carta de Crédito (R$)" value={carta} onChange={setCarta} type="money" />
          <NumInput label="Taxa de Administração Total (%)" value={taxaAdm} onChange={setTaxaAdm} type="percent" />
        </Grid2>
        <Grid2>
          <NumInput label="Prazo do Grupo (meses)" value={prazo} onChange={setPrazo} type="int" />
          <NumInput label="Mês de Contemplação (com lance)" value={mesContemp} onChange={setMesContemp} type="int" />
        </Grid2>
        <Grid2>
          <NumInput label="Lance (% da carta)" value={percLance} onChange={setPercLance} type="int" />
          <NumInput label="Lance em Recursos Próprios (R$)" value={lanceProprioR} onChange={setLanceProprioR} type="money" />
        </Grid2>
      </Section>

      <Section title="Renda com Aluguel">
        <Grid2>
          <NumInput label="Renda de Aluguel Esperada (R$/mês)" value={rendaAluguel} onChange={setRendaAluguel} type="money" hint="Após ser contemplado e adquirir o imóvel" />
          <NumInput label="Reajuste Anual do Aluguel (%)" value={reajuste} onChange={setReajuste} type="percent" hint="IGPM ou IPCA estimado" />
        </Grid2>
      </Section>

      <Section title="Premissas de Mercado" accent>
        <Grid2>
          <NumInput label="Valorização Anual do Imóvel (%)" value={valorizacao} onChange={setValorizacao} type="percent" />
          <NumInput label="Taxa CDI Anual (% — comparativo)" value={cdi} onChange={setCdi} type="percent" hint="Para comparar com investimento em renda fixa" />
        </Grid2>
        <NumInput label="Correção da Carta (INCC % a.a.)" value={taxaAtualiz} onChange={setTaxaAtualiz} type="int" hint="Taxa anual de atualização da carta pelo INCC — padrão 4%" />
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground/70">Estratégia pós-contemplação:</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setUsoCredito("compra_imovel")}
              className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${usoCredito === "compra_imovel" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
              🏠 Comprar imóvel
            </button>
            <button onClick={() => setUsoCredito("credito_rende_cdi")}
              className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${usoCredito === "credito_rende_cdi" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
              💰 Crédito rende CDI
            </button>
          </div>
          {usoCredito === "credito_rende_cdi" && (
            <p className="mt-2 text-xs text-muted-foreground">O crédito é aplicado no CDI enquanto as parcelas continuam com reajuste INCC. Mostra o spread da operação.</p>
          )}
        </div>
      </Section>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
          <span>Vincular & Salvar</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-52 flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-foreground/80">Cliente (opcional)</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem cliente vinculado" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-4">
          <button onClick={calcular}
            className="rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant active:scale-[0.98] hover:opacity-95 transition-all">
            Calcular ROI
          </button>
          <button onClick={salvar} disabled={!results || saving}
            className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide active:scale-[0.98] hover:bg-accent disabled:opacity-40 transition-all">
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button onClick={exportPDF} disabled={!results || isExporting}
            className="rounded-xl bg-success px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground active:scale-[0.98] hover:opacity-95 disabled:opacity-40 transition-all">
            {isExporting ? "Exportando…" : "Exportar PDF"}
          </button>
          <WhatsAppShareButton
            onShare={(phone) => shareWhatsApp(phone)}
            prefilledPhone={clientPhone}
            disabled={!results}
            isLoading={isExporting}
          />
        </div>
        {savedId && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm">
            <span className="text-green-700">Simulação salva.</span>
            <Link to="/historico" className="ml-auto text-xs font-semibold underline text-green-700">Ver no histórico →</Link>
          </div>
        )}
      </div>

      {results && <ResultsRenda r={results} inputs={inputs} />}

      <div ref={reportRef} style={{ display: "none" }}>
        <PDFRenda r={results} inputs={inputs} clientName={clients.find((c) => c.id === selectedClientId)?.name} />
      </div>
    </div>
  );
}

function ResultsRenda({ r, inputs }: { r: RendaPassivaResults; inputs: RendaPassivaInputs }) {
  const step = Math.max(1, Math.floor(r.prazoMeses / 20));
  const sampled = r.timeline.filter((_, i) => i % step === 0 || i === r.timeline.length - 1);

  // Gráfico de barras: parcela vs renda por mês amostrado
  const barData = {
    labels: sampled.map((d) => `M${d.mes}`),
    datasets: [
      {
        label: "Parcela Consórcio",
        data: sampled.map((d) => d.parcelaCons),
        backgroundColor: "rgba(239,68,68,0.8)",
        borderRadius: 3,
        borderSkipped: false,
      },
      {
        label: "Renda de Aluguel",
        data: sampled.map((d) => d.rendaAluguel),
        backgroundColor: "rgba(34,197,94,0.8)",
        borderRadius: 3,
        borderSkipped: false,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k` },
      },
    },
  };

  // Gráfico de linha: evolução do patrimônio
  const lineData = {
    labels: sampled.map((d) => `M${d.mes}`),
    datasets: [
      {
        label: "Total Investido",
        data: sampled.map((d) => d.totalInvestido),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.05)",
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Patrimônio Total",
        data: sampled.map((d) => d.patrimonioTotal),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        fill: true,
        pointRadius: 0,
        borderWidth: 2.5,
        tension: 0.3,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: {
          callback: (v: unknown) => {
            const n = Number(v);
            return n >= 1_000_000 ? `R$ ${(n / 1_000_000).toFixed(1)}M` : `R$ ${(n / 1000).toFixed(0)}k`;
          },
        },
      },
    },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Headline ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-4 sm:p-5">
        <p className="text-base sm:text-lg font-extrabold text-success">
          Seu consórcio pode se pagar sozinho.
        </p>
        {r.mesFluxoNeutro && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            A partir do <strong>mês {r.mesFluxoNeutro}</strong>, o aluguel recebido cobre a parcela do consórcio — fluxo de caixa neutro ou positivo.
          </p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          ROI anual estimado: <strong className="text-success">{r.roiAnual.toFixed(2)}% a.a.</strong> vs. CDI: <strong>{inputs.taxaCDIAnual}% a.a.</strong>
        </p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Banknote} label="Total investido" value={fmtBRL(r.totalInvestido)} sub="Parcelas + lance próprio" variant="primary" />
        <KPI icon={TrendingUp} label="Renda gerada" value={fmtBRL(r.totalRendaGerada)} sub="Aluguis recebidos no período" variant="success" />
        <KPI icon={BarChart2} label="Patrimônio final" value={fmtBRL(r.patrimonioFinal)} sub={`Imóvel + caixa extra`} variant="success" />
        <KPI icon={Zap} label="ROI anual" value={`${r.roiAnual.toFixed(2)}% a.a.`} sub={`vs. CDB: ${inputs.taxaCDIAnual}% a.a.`} variant={r.roiAnual > inputs.taxaCDIAnual ? "success" : "warning"} />
      </div>

      {/* ── Gráfico: parcela vs renda ─────────────────────────────── */}
      <Section title="Parcela do Consórcio vs. Renda de Aluguel por Mês">
        <div className="h-52 sm:h-64 w-full">
          <Bar data={barData} options={barOptions} />
        </div>
        <p className="text-xs text-muted-foreground">
          As barras verdes (renda) crescem com o reajuste anual. A partir do mês {r.mesFluxoNeutro ?? "—"}, superam a parcela (barra vermelha).
        </p>
      </Section>

      {/* ── Gráfico: patrimônio ───────────────────────────────────── */}
      <Section title="Evolução do Patrimônio vs. Total Investido">
        <div className="h-52 sm:h-64 w-full">
          <Line data={lineData} options={lineOptions} />
        </div>
      </Section>

      {/* ── Tabela comparativa: Consórcio vs CDB ──────────────────── */}
      <Section title="Comparativo: Consórcio + Aluguel vs. CDB" accent>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Item</th>
                <th className="py-2 px-4 text-right text-xs font-extrabold uppercase tracking-wider text-primary">Consórcio + Aluguel</th>
                <th className="py-2 px-4 text-right text-xs font-extrabold uppercase tracking-wider text-muted-foreground">CDB ({inputs.taxaCDIAnual}% a.a.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Total investido", fmtBRL(r.totalInvestido), fmtBRL(r.totalInvestido)],
                ["Renda gerada no período", fmtBRL(r.totalRendaGerada), "—"],
                ["Valor do imóvel ao final", fmtBRL(r.valorImovelFinal), "—"],
                ["Patrimônio final", fmtBRL(r.patrimonioFinal), fmtBRL(r.cdbFuturo)],
                ["ROI total", `${r.roiPercentual.toFixed(1)}%`, `${((r.cdbFuturo / r.totalInvestido - 1) * 100).toFixed(1)}%`],
                ["ROI anual", `${r.roiAnual.toFixed(2)}% a.a.`, `${inputs.taxaCDIAnual}% a.a.`],
              ].map(([label, cons, cdb]) => (
                <tr key={label} className="hover:bg-muted/30">
                  <td className="py-2.5 px-4 text-foreground/70">{label}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-primary">{cons}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-muted-foreground">{cdb}</td>
                </tr>
              ))}
              <tr className={`font-bold ${r.vantagemVsCDB >= 0 ? "bg-success/5" : "bg-danger/5"}`}>
                <td className={`py-2.5 px-4 font-extrabold ${r.vantagemVsCDB >= 0 ? "text-success" : "text-danger"}`}>
                  {r.vantagemVsCDB >= 0 ? "🏆 Vantagem vs. CDB" : "⚠️ Desvantagem vs. CDB"}
                </td>
                <td className="py-2.5 px-4" />
                <td className={`py-2.5 px-4 text-right font-extrabold ${r.vantagemVsCDB >= 0 ? "text-success" : "text-danger"}`}>
                  {r.vantagemVsCDB >= 0 ? "+" : ""}{fmtBRL(r.vantagemVsCDB)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Cenário CDI ────────────────────────────────────────────── */}
      {inputs.usoCreditoContemplado === "credito_rende_cdi" && r.creditoFinalComCDI > 0 && (
        <Section title="Estratégia: Crédito Rende CDI vs. Parcelas INCC" accent>
          <div className="grid gap-3 sm:grid-cols-3">
            <KPI icon={Zap} label="Crédito acumulado (CDI)" value={fmtBRL(r.creditoFinalComCDI)}
              sub={`Carta de R${fmtBRL(inputs.cartaCredito)} rendendo ${inputs.taxaCDIAnual}% a.a.`} variant="success" />
            <KPI icon={Banknote} label="Total pago em parcelas (INCC)" value={fmtBRL(r.totalParcelasComINCC)}
              sub={`Parcelas corrigidas por ${inputs.taxaAtualizacaoAnual}% a.a.`} variant="primary" />
            <KPI icon={TrendingUp} label="Lucro da estratégia" value={fmtBRL(r.lucroEstrategiaCDI)}
              sub="CDI acumulado − parcelas − lance" variant={r.lucroEstrategiaCDI > 0 ? "success" : "warning"} />
          </div>
          <div className={`rounded-xl p-3 text-sm font-semibold ${r.lucroEstrategiaCDI > 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
            {r.lucroEstrategiaCDI > 0
              ? `✅ Spread CDI−INCC positivo: ${fmtBRL(r.spreadCDIvsINCC)} — O crédito rende mais do que as parcelas custam.`
              : `⚠️ Spread CDI−INCC negativo: as parcelas crescem mais rápido que o CDI rende. Avalie aumentar o lance.`
            }
          </div>
        </Section>
      )}
    </div>
  );
}

function PDFRenda({ r, inputs, clientName }: {
  r: RendaPassivaResults | null; inputs: RendaPassivaInputs; clientName?: string;
}) {
  if (!r) return null;
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const anos = inputs.prazoMeses / 12;

  return (
    <PdfPage>
      <PdfHeader
        title="Renda Passiva com Consórcio"
        subtitle="Consórcio como Investimento — Relatório de Viabilidade"
        clientName={clientName}
        date={hoje}
      />
      <PdfPremises items={[
        ["Carta de crédito", fmtBRL(inputs.cartaCredito)],
        ["Prazo do grupo", `${inputs.prazoMeses} meses`],
        ["Taxa de adm.", `${inputs.taxaAdmTotal}%`],
        ["Lance ofertado", `${inputs.percLance}%`],
        ["Contempl. prevista", `Mês ${inputs.mesContemplacao}`],
        ["Aluguel inicial", fmtBRL(inputs.rendaAluguelMensal)],
        ["Valorização do imóvel", `${inputs.valorizacaoAnual}% a.a.`],
        ["CDI comparativo", `${inputs.taxaCDIAnual}% a.a.`],
      ]} />

      <PdfSection title="Resultados da Estratégia de Renda Passiva" description="Quanto rende o consórcio como veículo de investimento imobiliário:">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          <PdfMetric label="Total investido" value={fmtBRL(r.totalInvestido)} description="Parcelas + lance próprio desembolsado" color={C.navy} />
          <PdfMetric label="Renda gerada no período" value={fmtBRL(r.totalRendaGerada)} description={`Aluguéis recebidos em ${anos.toFixed(0)} anos`} color={C.green} />
          <PdfMetric label="Valor do imóvel no final" value={fmtBRL(r.valorImovelFinal)} description={`Valorização de ${inputs.valorizacaoAnual}% a.a. sobre ${fmtBRL(inputs.cartaCredito)}`} color={C.navy} />
          <PdfMetric label="ROI anual" value={`${r.roiAnual.toFixed(1)}% a.a.`} description={`vs. CDI de ${inputs.taxaCDIAnual}% a.a.`} color={r.roiAnual >= inputs.taxaCDIAnual ? C.green : C.amber} />
        </div>
      </PdfSection>

      <PdfInsight
        emoji="🏦"
        title="O consórcio pode se pagar sozinho"
        body={`Após a contemplação no mês ${inputs.mesContemplacao}, o imóvel gera ${fmtBRL(inputs.rendaAluguelMensal)}/mês de aluguel${r.mesFluxoNeutro ? ` — e a partir do mês ${r.mesFluxoNeutro}, o aluguel já supera a parcela do consórcio. Isso significa que o próprio inquilino paga sua cota` : ""}. Ao final de ${anos.toFixed(0)} anos, você tem um imóvel avaliado em ${fmtBRL(r.valorImovelFinal)} + ${fmtBRL(r.totalRendaGerada)} em renda acumulada — com um ROI anual de ${r.roiAnual.toFixed(1)}%.`}
        variant="primary"
      />

      <PdfSection title="Comparativo: Consórcio vs. CDB/Selic" description="Se você investisse o mesmo valor em renda fixa em vez de usar no consórcio:">
        <PdfKVList rows={[
          { label: "Total investido (parcelas + lance)", value: fmtBRL(r.totalInvestido) },
          { label: "Patrimônio final (imóvel + fluxo)", value: fmtBRL(r.patrimonioFinal), color: C.green },
          { label: `Projeção CDB/Selic (${inputs.taxaCDIAnual}% a.a.)`, value: fmtBRL(r.cdbFuturo), color: C.red },
          { label: "Vantagem do consórcio vs. CDB", value: fmtBRL(r.vantagemVsCDB), color: r.vantagemVsCDB >= 0 ? C.green : C.red },
          { label: "ROI total no período", value: `${r.roiPercentual.toFixed(1)}%`, color: C.green },
          { label: "ROI anual equivalente", value: `${r.roiAnual.toFixed(1)}% a.a.`, color: C.green },
          ...(r.mesFluxoNeutro ? [{ label: "Mês em que aluguel paga a parcela", value: `Mês ${r.mesFluxoNeutro}`, color: C.navy }] : []),
        ]} />
      </PdfSection>

      {inputs.usoCreditoContemplado === "credito_rende_cdi" && r.creditoFinalComCDI > 0 && (
        <PdfSection title="Estratégia Alternativa: Crédito Rende CDI" description="E se, em vez de comprar um imóvel, você deixar o crédito render CDI enquanto paga as parcelas com INCC?">
          <PdfKVList rows={[
            { label: "Crédito acumulado com CDI", value: fmtBRL(r.creditoFinalComCDI), color: C.green },
            { label: "Total pago em parcelas (INCC)", value: fmtBRL(r.totalParcelasComINCC), color: C.red },
            { label: "Lucro líquido da estratégia CDI", value: fmtBRL(r.lucroEstrategiaCDI), color: r.lucroEstrategiaCDI >= 0 ? C.green : C.red },
          ]} />
        </PdfSection>
      )}

      <PdfInsight
        emoji="📈"
        title="Por que consórcio bate a renda fixa neste cenário?"
        body={`O consórcio combina alavancagem (você controla um imóvel de ${fmtBRL(inputs.cartaCredito)} com desembolso fracionado), renda (aluguel mensal crescente), e valorização (imóvel sobe ${inputs.valorizacaoAnual}% a.a. sobre o valor total, não sobre o que você pagou). Renda fixa só rende sobre o que você investiu — sem alavancagem, sem valorização de ativo real.`}
        variant="success"
      />

      <PdfFooter />
    </PdfPage>
  );
}
