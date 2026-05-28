import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import {
  calcConsorcioCNPJ,
  defaultCNPJInputs,
  type ConsorcioCNPJResults,
  type RegimeTributario,
} from "@/lib/calc-consorcio-cnpj";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  ArrowLeft, ArrowRight, BookOpen, Building2, Coins, TrendingDown, TrendingUp,
} from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { RpDoc, RpHeader, RpSection, RpMetric, RpInsight, RpPremises, RpKVList, RpFooter, RpMetricRow, C } from "@/components/RpShell";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Route = createFileRoute("/_authenticated/simuladores/consorcio-cnpj")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: ConsorcioCNPJPage,
});

function NumInput({ label, value, onChange, type, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type: "money" | "percent" | "int"; hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
        {label}
        {hint && <span title={hint} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">?</span>}
      </label>
      <input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (type === "money") onChange(maskMoney(v));
          else if (type === "percent") onChange(maskPercent(v));
          else onChange(v.replace(/\D/g, ""));
        }}
        placeholder="0" inputMode="decimal"
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
        <span>{title}</span><div className="h-px flex-1 bg-border" />
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
    danger: "bg-destructive/10 text-destructive",
  };
  const iconColors: Record<string, string> = {
    default: "text-muted-foreground", success: "text-success",
    primary: "text-primary", warning: "text-warning-foreground", danger: "text-destructive",
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

function ConsorcioCNPJPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
    () => results ? <PDFCnpjDoc r={results} inputs={inputs} clientName={clients.find((c) => c.id === selectedClientId)?.name} /> : null,
    "consorcio-cnpj.pdf",
  );

  // Consórcio PJ
  const [cartaCredito, setCartaCredito] = useState(maskMoney(String(defaultCNPJInputs.cartaCredito * 100)));
  const [taxaAdm, setTaxaAdm] = useState(maskPercent(String(defaultCNPJInputs.taxaAdmConsorcio * 100)));
  const [prazoConsorcio, setPrazoConsorcio] = useState(String(defaultCNPJInputs.prazoConsorcio));
  const [percLance, setPercLance] = useState(String(defaultCNPJInputs.percLance));
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultCNPJInputs.mesContemplacaoConsorcio));

  // Financiamento PJ
  const [taxaJurosFin, setTaxaJurosFin] = useState(maskPercent(String(defaultCNPJInputs.taxaJurosMensalFin * 100)));
  const [prazoFin, setPrazoFin] = useState(String(defaultCNPJInputs.prazoFinanciamentoMeses));

  // Fiscal
  const [regime, setRegime] = useState<RegimeTributario>("presumido");
  const [aliquotaIRPJ, setAliquotaIRPJ] = useState(String(defaultCNPJInputs.aliquotaIRPJ));
  const [aliquotaCSLL, setAliquotaCSLL] = useState(String(defaultCNPJInputs.aliquotaCSLL));
  const [valorizacao, setValorizacao] = useState(maskPercent(String(defaultCNPJInputs.valorizacaoAnual * 100)));

  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<ConsorcioCNPJResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ── Restore sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("cnpj-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.cartaCredito) setCartaCredito(s.cartaCredito);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.prazoConsorcio) setPrazoConsorcio(s.prazoConsorcio);
      if (s.percLance) setPercLance(s.percLance);
      if (s.mesContemplacao) setMesContemplacao(s.mesContemplacao);
      if (s.taxaJurosFin) setTaxaJurosFin(s.taxaJurosFin);
      if (s.prazoFin) setPrazoFin(s.prazoFin);
      if (s.regime) setRegime(s.regime);
      if (s.aliquotaIRPJ) setAliquotaIRPJ(s.aliquotaIRPJ);
      if (s.aliquotaCSLL) setAliquotaCSLL(s.aliquotaCSLL);
      if (s.valorizacao) setValorizacao(s.valorizacao);
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

  const inputs = useMemo(() => ({
    cartaCredito: unmask(cartaCredito),
    taxaAdmConsorcio: unmask(taxaAdm),
    prazoConsorcio: parseInt(prazoConsorcio || "0", 10) || 0,
    percLance: parseInt(percLance || "0", 10) || 0,
    mesContemplacaoConsorcio: parseInt(mesContemplacao || "0", 10) || 0,
    taxaJurosMensalFin: unmask(taxaJurosFin),
    prazoFinanciamentoMeses: parseInt(prazoFin || "0", 10) || 0,
    regimeTributario: regime,
    aliquotaIRPJ: parseInt(aliquotaIRPJ || "0", 10) || 0,
    aliquotaCSLL: parseInt(aliquotaCSLL || "0", 10) || 0,
    lucroMensalEmpresa: 50_000,
    valorizacaoAnual: unmask(valorizacao),
  }), [cartaCredito, taxaAdm, prazoConsorcio, percLance, mesContemplacao, taxaJurosFin, prazoFin, regime, aliquotaIRPJ, aliquotaCSLL, valorizacao]);

  const calcular = () => {
    setResults(calcConsorcioCNPJ(inputs));
    setSavedId(null);
    sessionStorage.setItem("cnpj-inputs", JSON.stringify({
      cartaCredito, taxaAdm, prazoConsorcio, percLance, mesContemplacao,
      taxaJurosFin, prazoFin, regime, aliquotaIRPJ, aliquotaCSLL, valorizacao,
    }));
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Consórcio CNPJ ${fmtBRL(inputs.cartaCredito)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id, client_id: selectedClientId || null, title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          totalLiquidoConsorcio: results.totalLiquidoConsorcio,
          totalFinanciamento: results.totalFinanciamento,
          economiaTotalVsFinanciamento: results.economiaTotalVsFinanciamento,
          totalEconomiaFiscalConsorcio: results.totalEconomiaFiscalConsorcio,
        } as unknown as Record<string, unknown>,
      }).select("id").single();
      if (error) throw error;
      setSavedId(data?.id ?? null);
      toast.success("Simulação salva no histórico.");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erro ao salvar.");
    } finally { setSaving(false); }
  };


  const applyTemplate = (p: TemplatePayload) => {
    if (p.cartaCredito) setCartaCredito(p.cartaCredito);
    if (p.taxaAdmConsorcio) setTaxaAdm(p.taxaAdmConsorcio);
    if (p.prazoConsorcio) setPrazoConsorcio(p.prazoConsorcio);
    if (p.percLance) setPercLance(p.percLance);
    if (p.mesContemplacaoConsorcio) setMesContemplacao(p.mesContemplacaoConsorcio);
    if (p.taxaJurosMensalFin) setTaxaJurosFin(p.taxaJurosMensalFin);
    if (p.prazoFinanciamentoMeses) setPrazoFin(p.prazoFinanciamentoMeses);
    if (p.regimeTributario) setRegime(p.regimeTributario as RegimeTributario);
    if (p.aliquotaIRPJ) setAliquotaIRPJ(p.aliquotaIRPJ);
    if (p.aliquotaCSLL) setAliquotaCSLL(p.aliquotaCSLL);
    if (p.valorizacaoAnual) setValorizacao(p.valorizacaoAnual);
    setResults(null); setSavedId(null);
  };

  // Gráfico: parcela bruta vs. líquida vs. financiamento (primeiros 24 meses)
  const chartData = useMemo(() => {
    if (!results) return null;
    const tl = results.timeline.slice(0, 60).filter((_, i) => i % 3 === 0);
    return {
      labels: tl.map((d) => `M${d.mes}`),
      datasets: [
        {
          label: "Parcela bruta consórcio",
          data: tl.map((d) => d.parcelaBrutaConsorcio),
          backgroundColor: "rgba(99,102,241,0.5)",
        },
        {
          label: "Parcela líquida consórcio (pós fiscal)",
          data: tl.map((d) => d.parcelaLiquidaConsorcio),
          backgroundColor: "rgba(34,197,94,0.6)",
        },
        {
          label: "Parcela financiamento PJ",
          data: tl.map((d) => d.parcelaFinanciamento),
          backgroundColor: "rgba(239,68,68,0.5)",
        },
      ],
    };
  }, [results]);

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" as const }, tooltip: { callbacks: { label: (c: { dataset: { label: string }; raw: unknown }) => `${c.dataset.label}: ${fmtBRL(c.raw as number)}` } } },
    scales: { y: { ticks: { callback: (v: unknown) => fmtBRL(v as number) } } },
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/simuladores" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight leading-tight">🏢 Consórcio para CNPJ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Benefício fiscal PJ · parcelas dedutíveis · custo real pós-imposto</p>
        </div>
        <TemplatePicker operationSlug="consorcio-cnpj" onApply={applyTemplate} />
        <Link to="/simuladores/estrategia/$slug" params={{ slug: "consorcio-cnpj" }}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent">
          <BookOpen className="h-3.5 w-3.5" /> Estratégia
        </Link>
      </div>

      {/* Cliente */}
      {clients.length > 0 && (
        <Section title="Cliente">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="rounded-lg border-input bg-background text-sm">
              <SelectValue placeholder="Selecionar cliente (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Section>
      )}

      <Section title="Consórcio PJ">
        <Grid2>
          <NumInput label="Carta de crédito (R$)" value={cartaCredito} onChange={setCartaCredito} type="money" />
          <NumInput label="Taxa de administração (%)" value={taxaAdm} onChange={setTaxaAdm} type="percent" />
          <NumInput label="Prazo do grupo (meses)" value={prazoConsorcio} onChange={setPrazoConsorcio} type="int" />
          <NumInput label="Lance ofertado (%)" value={percLance} onChange={setPercLance} type="int" />
          <NumInput label="Mês de contemplação" value={mesContemplacao} onChange={setMesContemplacao} type="int" />
          <NumInput label="Valorização anual do bem (%)" value={valorizacao} onChange={setValorizacao} type="percent" />
        </Grid2>
      </Section>

      <Section title="Financiamento PJ (Comparativo)">
        <Grid2>
          <NumInput label="Taxa de juros mensal (% a.m.)" value={taxaJurosFin} onChange={setTaxaJurosFin} type="percent" hint="Crédito imobiliário PJ: ~1,0%–1,5% a.m." />
          <NumInput label="Prazo financiamento (meses)" value={prazoFin} onChange={setPrazoFin} type="int" />
        </Grid2>
      </Section>

      <Section title="Regime Tributário da Empresa">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setRegime("presumido")}
            className={`rounded-xl py-3 text-sm font-bold transition-colors ${regime === "presumido" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
            Lucro Presumido
          </button>
          <button onClick={() => setRegime("real")}
            className={`rounded-xl py-3 text-sm font-bold transition-colors ${regime === "real" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
            Lucro Real
          </button>
        </div>
        <Grid2>
          <NumInput label="Alíquota IRPJ (%)" value={aliquotaIRPJ} onChange={setAliquotaIRPJ} type="int"
            hint="Presumido: 15% + adicional de 10% sobre lucro > R$20k/mês" />
          <NumInput label="Alíquota CSLL (%)" value={aliquotaCSLL} onChange={setAliquotaCSLL} type="int"
            hint="Presumido: 9% | Real: 9%" />
        </Grid2>
        <p className="text-[11px] text-muted-foreground">
          Alíquota efetiva total: <strong>{(parseInt(aliquotaIRPJ || "0") + parseInt(aliquotaCSLL || "0"))}%</strong>
        </p>
      </Section>

      <button onClick={calcular}
        className="w-full rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]">
        Calcular Benefício Fiscal →
      </button>

      {results && (
        <>
          {/* Parcela líquida */}
          <Section title="Parcela com Benefício Fiscal">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI icon={Building2} label="Parcela bruta consórcio" value={fmtBRL(results.parcelaBrutaConsorcio)} variant="default" />
              <KPI icon={TrendingDown} label="Economia fiscal mensal" value={fmtBRL(results.economiaFiscalMensal)}
                sub={`Alíquota ${results.aliquotaEfetivaTotal}% sobre a parcela`} variant="success" />
              <KPI icon={Coins} label="Parcela líquida (custo real)" value={fmtBRL(results.parcelaLiquidaConsorcio)}
                sub="O que a empresa realmente paga" variant="primary" />
            </div>
            {results.parcelaBrutaPosLance > 0 && (
              <div className="rounded-xl border border-border p-3 mt-1">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">Após Contemplação (pós-lance)</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Bruta</p><p className="font-bold">{fmtBRL(results.parcelaBrutaPosLance)}</p></div>
                  <div><p className="text-muted-foreground">Eco. fiscal</p><p className="font-bold text-success">{fmtBRL(results.parcelaBrutaPosLance * results.aliquotaEfetivaTotal / 100)}</p></div>
                  <div><p className="text-muted-foreground">Líquida</p><p className="font-bold text-primary">{fmtBRL(results.parcelaLiquidaPosLance)}</p></div>
                </div>
              </div>
            )}
          </Section>

          {/* Total fiscal */}
          <Section title="Economia Fiscal Total">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI icon={TrendingDown} label="Total bruto consórcio" value={fmtBRL(results.totalBrutoConsorcio)} variant="default" />
              <KPI icon={Coins} label="Economia fiscal acumulada" value={fmtBRL(results.totalEconomiaFiscalConsorcio)} variant="success" />
              <KPI icon={TrendingDown} label="Custo líquido total" value={fmtBRL(results.totalLiquidoConsorcio)} variant="primary" />
            </div>
          </Section>

          {/* Comparativo com financiamento */}
          <Section title="Consórcio PJ vs. Financiamento PJ">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-destructive/8 p-4 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-destructive/70">Financiamento PJ</p>
                <p className="text-lg font-extrabold">{fmtBRL(results.parcelaFinanciamento)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                <p className="text-xs text-muted-foreground">Total: {fmtBRL(results.totalFinanciamento)}</p>
                <p className="text-xs text-muted-foreground">Juros totais: {fmtBRL(results.totalJurosFinanciamento)}</p>
              </div>
              <div className="rounded-xl bg-success/10 p-4 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-success/70">Consórcio PJ (custo líquido)</p>
                <p className="text-lg font-extrabold">{fmtBRL(results.parcelaLiquidaConsorcio)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                <p className="text-xs text-muted-foreground">Total: {fmtBRL(results.totalLiquidoConsorcio)}</p>
                <p className="text-xs text-success font-semibold">Eco. fiscal: {fmtBRL(results.totalEconomiaFiscalConsorcio)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-primary/10 p-4 text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary/70">Economia Total vs. Financiamento PJ</p>
              <p className="text-3xl font-extrabold text-primary mt-1">{fmtBRL(results.economiaTotalVsFinanciamento)}</p>
              <p className="text-xs text-muted-foreground mt-1">{results.percentualEconomia.toFixed(1)}% mais barato que o financiamento</p>
            </div>
          </Section>

          {/* Gráfico */}
          {chartData && (
            <Section title="Parcelas: Bruta × Líquida × Financiamento">
              <div className="h-52 sm:h-64">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </Section>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-3">
            <button onClick={salvar} disabled={saving || !!savedId}
              className="flex-1 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent disabled:opacity-50">
              {saving ? "Salvando…" : savedId ? "✓ Salvo" : "Salvar Simulação"}
            </button>
            <button onClick={exportPDF} disabled={isExporting}
              className="flex-1 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
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
            <Link to="/historico" className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold">
              Ver no histórico <ArrowRight className="h-3 w-3" />
            </Link>
          )}

        </>
      )}
    </div>
  );
}

// ─── PDF Document (react-pdf) ─────────────────────────────────────────────────
function PDFCnpjDoc({ r, inputs, clientName }: {
  r: ConsorcioCNPJResults;
  inputs: {
    cartaCredito: number;
    taxaAdmConsorcio: number;
    prazoConsorcio: number;
    percLance: number;
    mesContemplacaoConsorcio: number;
    taxaJurosMensalFin: number;
    prazoFinanciamentoMeses: number;
    regimeTributario: RegimeTributario;
    aliquotaIRPJ: number;
    aliquotaCSLL: number;
    valorizacaoAnual: number;
    [key: string]: unknown;
  };
  clientName?: string;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const aliquotaTotal = inputs.aliquotaIRPJ + inputs.aliquotaCSLL;
  const regimeLabel = inputs.regimeTributario === "presumido" ? "Lucro Presumido" : "Lucro Real";

  return (
    <RpDoc>
      <RpHeader
        title="Consórcio para CNPJ"
        subtitle="Beneficio Fiscal PJ — Parcelas Dedutiveis como Despesa Operacional"
        clientName={clientName}
        date={hoje}
      />
      <RpPremises items={[
        ["Carta de crédito", fmtBRL(inputs.cartaCredito)],
        ["Taxa de adm.", `${inputs.taxaAdmConsorcio}%`],
        ["Prazo do grupo", `${inputs.prazoConsorcio} meses`],
        ["Lance ofertado", `${inputs.percLance}%`],
        ["Contemplação", `Mês ${inputs.mesContemplacaoConsorcio}`],
        ["Regime tributário", regimeLabel],
        ["Alíquota efetiva total", `${aliquotaTotal}%`],
        ["Valorização do bem", `${inputs.valorizacaoAnual}% a.a.`],
      ]} />

      <RpSection title="Benefício Fiscal Mensal" description="O que o consórcio custa de verdade para a empresa, depois do abatimento fiscal:">
        <RpMetricRow>
          <RpMetric label="Parcela bruta" value={fmtBRL(r.parcelaBrutaConsorcio)} description="Valor nominal da parcela antes do benefício fiscal" color={C.navy} />
          <RpMetric label="Economia fiscal mensal" value={fmtBRL(r.economiaFiscalMensal)} description={`${aliquotaTotal}% sobre a parcela — imposto que nao e pago`} color={C.green} />
          <RpMetric label="Parcela líquida (custo real)" value={fmtBRL(r.parcelaLiquidaConsorcio)} description="O que a empresa realmente desembolsa por mes" color={C.amber} />
        </RpMetricRow>
      </RpSection>

      <RpInsight
        emoji="🏢"
        title="O Estado financia parte do seu consórcio"
        body={`No ${regimeLabel}, as parcelas de consorcio sao dedutiveis como despesa operacional. Isso significa que ${aliquotaTotal}% de cada parcela e subsidiado pelo imposto que voce deixa de pagar. Resultado: parcela bruta de ${fmtBRL(r.parcelaBrutaConsorcio)} vira custo real de ${fmtBRL(r.parcelaLiquidaConsorcio)} — economia fiscal de ${fmtBRL(r.economiaFiscalMensal)}/mes.`}
        variant="primary"
      />

      <RpSection title="Consórcio PJ vs. Financiamento PJ" description="Comparativo de custo total entre as duas alternativas:">
        <RpKVList rows={[
          { label: "Parcela bruta consórcio", value: fmtBRL(r.parcelaBrutaConsorcio) },
          { label: "Parcela líquida consórcio (pós fiscal)", value: fmtBRL(r.parcelaLiquidaConsorcio), color: C.green },
          { label: "Parcela financiamento PJ", value: fmtBRL(r.parcelaFinanciamento), color: C.red },
          { label: "Total bruto consórcio", value: fmtBRL(r.totalBrutoConsorcio) },
          { label: "Economia fiscal acumulada", value: fmtBRL(r.totalEconomiaFiscalConsorcio), color: C.green },
          { label: "Custo líquido total — consórcio", value: fmtBRL(r.totalLiquidoConsorcio), color: C.green },
          { label: "Total financiamento PJ", value: fmtBRL(r.totalFinanciamento), color: C.red },
          { label: "Juros totais do financiamento", value: fmtBRL(r.totalJurosFinanciamento), color: C.red },
          { label: "Economia total vs. financiamento", value: fmtBRL(r.economiaTotalVsFinanciamento), color: C.green },
          { label: "Percentual de economia", value: `${r.percentualEconomia.toFixed(1)}%`, color: C.green },
        ]} />
      </RpSection>

      <RpInsight
        emoji="📊"
        title={`Consórcio é ${r.percentualEconomia.toFixed(1)}% mais barato que o financiamento PJ`}
        body={`O financiamento PJ cobra juros sobre o saldo devedor — quanto mais voce deve, mais voce paga. O consorcio nao tem juros: voce paga apenas a taxa de administracao diluida nas parcelas, e ainda deduz tudo do imposto. A combinacao de ausencia de juros + beneficio fiscal resulta em ${fmtBRL(r.economiaTotalVsFinanciamento)} a mais no caixa da empresa.`}
        variant="success"
      />

      <RpFooter note="Beneficio fiscal calculado com base na dedutibildiade das parcelas como despesa operacional nos regimes de Lucro Presumido e Lucro Real. Consulte o contador da empresa para validar o enquadramento especifico." />
    </RpDoc>
  );
}
