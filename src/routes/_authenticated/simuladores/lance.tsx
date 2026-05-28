import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import { calcLance, defaultLanceInputs, type LanceInputs, type LanceResults } from "@/lib/calc-lance";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ArrowLeft, Target, TrendingDown, Coins, CalendarCheck, BookOpen } from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { RpDoc, RpHeader, RpSection, RpMetric, RpInsight, RpPremises, RpFooter, RpMetricRow, RpKVList, C } from "@/components/RpShell";
import { View as RpView, Text as RpText } from "@react-pdf/renderer";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Route = createFileRoute("/_authenticated/simuladores/lance")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: SimuladorLancePage,
});

// ─── Input helpers ────────────────────────────────────────────────────────────
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
        inputMode={type === "money" ? "numeric" : type === "percent" ? "decimal" : "numeric"}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
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
  variant?: "default" | "success" | "primary" | "warning";
}) {
  const colors = {
    default: "bg-muted/40 text-foreground",
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning-foreground",
  };
  const iconColors = {
    default: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning-foreground",
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

// ─── Page Component ───────────────────────────────────────────────────────────
function SimuladorLancePage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
    () => results ? <PDFLanceDoc r={results} inputs={inputs} clientName={clients.find((c) => c.id === selectedClientId)?.name} /> : null,
    "Simulador_Lance_Consorcio.pdf",
  );

  // ── Raws (string state para inputs mascarados) ──────────────────────────
  const [cartaCredito, setCartaCredito] = useState(maskMoney(String(defaultLanceInputs.cartaCredito * 100)));
  const [taxaAdm, setTaxaAdm] = useState(maskPercent(String(defaultLanceInputs.taxaAdmTotal * 100)));
  const [prazo, setPrazo] = useState(String(defaultLanceInputs.prazoMeses));
  const [percEmb, setPercEmb] = useState(String(defaultLanceInputs.percLanceEmb));
  const [lanceProprioR, setLanceProprioR] = useState(maskMoney("0"));
  const [tipoLance, setTipoLance] = useState<LanceInputs["tipoLance"]>("embutido");
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultLanceInputs.mesContemplacaoLance));
  const [mesSemLance, setMesSemLance] = useState(String(defaultLanceInputs.mesSemLance));
  const [tipoAbatimento, setTipoAbatimento] = useState<LanceInputs["tipoAbatimentoLance"]>("saldoDevedor");
  const [taxaAtualiz, setTaxaAtualiz] = useState(String(defaultLanceInputs.taxaAtualizacaoAnual));

  // ── Context ────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<LanceResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ── Restore sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("lance-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.cartaCredito) setCartaCredito(s.cartaCredito);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.prazo) setPrazo(s.prazo);
      if (s.percEmb) setPercEmb(s.percEmb);
      if (s.lanceProprioR) setLanceProprioR(s.lanceProprioR);
      if (s.tipoLance) setTipoLance(s.tipoLance);
      if (s.mesContemplacao) setMesContemplacao(s.mesContemplacao);
      if (s.mesSemLance) setMesSemLance(s.mesSemLance);
      if (s.tipoAbatimento) setTipoAbatimento(s.tipoAbatimento);
      if (s.taxaAtualiz) setTaxaAtualiz(s.taxaAtualiz);
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

  // ── Load saved simulation ───────────────────────────────────────────────
  useEffect(() => {
    if (!search.load || !user) return;
    supabase.from("simulations").select("*").eq("id", search.load).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const inp = data.inputs as Record<string, unknown>;
        if (inp.cartaCredito) setCartaCredito(maskMoney(String(Math.round((inp.cartaCredito as number) * 100))));
        if (inp.taxaAdmTotal) setTaxaAdm(maskPercent(String(Math.round((inp.taxaAdmTotal as number) * 100))));
        if (inp.prazoMeses) setPrazo(String(inp.prazoMeses));
        if (inp.percLanceEmb !== undefined) setPercEmb(String(inp.percLanceEmb));
        if (inp.lanceProprioR) setLanceProprioR(maskMoney(String(Math.round((inp.lanceProprioR as number) * 100))));
        if (inp.tipoLance) setTipoLance(inp.tipoLance as LanceInputs["tipoLance"]);
        if (inp.mesContemplacaoLance) setMesContemplacao(String(inp.mesContemplacaoLance));
        if (inp.mesSemLance) setMesSemLance(String(inp.mesSemLance));
        if (data.client_id) setSelectedClientId(data.client_id);
        toast.success("Simulação carregada.");
      });
  }, [search.load, user]);

  // ── Inputs derivados ────────────────────────────────────────────────────
  const inputs: LanceInputs = useMemo(() => ({
    cartaCredito: unmask(cartaCredito),
    taxaAdmTotal: unmask(taxaAdm),
    prazoMeses: parseInt(prazo || "0", 10) || 0,
    percLanceEmb: parseInt(percEmb || "0", 10) || 0,
    lanceProprioR: unmask(lanceProprioR),
    tipoLance,
    mesContemplacaoLance: parseInt(mesContemplacao || "0", 10) || 0,
    mesSemLance: parseInt(mesSemLance || "0", 10) || 0,
    tipoAbatimentoLance: tipoAbatimento,
    taxaAtualizacaoAnual: parseFloat(taxaAtualiz || "0") || 0,
  }), [cartaCredito, taxaAdm, prazo, percEmb, lanceProprioR, tipoLance, mesContemplacao, mesSemLance, tipoAbatimento, taxaAtualiz]);

  const calcular = () => {
    setResults(calcLance(inputs));
    setSavedId(null);
    sessionStorage.setItem("lance-inputs", JSON.stringify({
      cartaCredito, taxaAdm, prazo, percEmb, lanceProprioR,
      tipoLance, mesContemplacao, mesSemLance, tipoAbatimento, taxaAtualiz,
    }));
  };

  const applyTemplate = (p: TemplatePayload) => {
    if (p.cartaCredito) setCartaCredito(p.cartaCredito);
    if (p.taxaAdmTotal) setTaxaAdm(p.taxaAdmTotal);
    if (p.prazoMeses) setPrazo(p.prazoMeses);
    if (p.percLanceEmb) setPercEmb(p.percLanceEmb);
    if (p.lanceProprioR) setLanceProprioR(p.lanceProprioR);
    if (p.tipoLance) setTipoLance(p.tipoLance as LanceInputs["tipoLance"]);
    if (p.mesContemplacaoLance) setMesContemplacao(p.mesContemplacaoLance);
    if (p.mesSemLance) setMesSemLance(p.mesSemLance);
    setResults(null);
    setSavedId(null);
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Lance ${fmtBRL(inputs.cartaCredito)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          parcelaPadrao: results.parcelaPadrao,
          parcelaPosLance: results.parcelaPosLance,
          totalSemLance: results.totalSemLance,
          totalComLance: results.totalComLance,
          economia: results.economia,
          lanceTotalR: results.lanceTotalR,
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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header>
        <div className="flex items-center justify-between mb-3">
          <Link to="/simuladores" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Simuladores
          </Link>
          <div className="flex gap-2">
            <TemplatePicker operationSlug="simulador-lance" onApply={applyTemplate} />
            <Link to="/simuladores/estrategia/$slug" params={{ slug: "simulador-lance" }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition-colors">
              <BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Estratégia</span>
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">🎯 Simulador de Lance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Calcule o lance ideal e mostre ao cliente quanto economiza sendo contemplado antes.
        </p>
      </header>

      {/* ── Inputs ─────────────────────────────────────────────────────── */}
      <Section title="Dados do Consórcio">
        <Grid2>
          <NumInput label="Valor da Carta de Crédito (R$)" value={cartaCredito} onChange={setCartaCredito} type="money" />
          <NumInput label="Taxa de Administração Total (%)" value={taxaAdm} onChange={setTaxaAdm} type="percent" hint="Taxa total do plano, ex: 18%" />
        </Grid2>
        <NumInput label="Prazo do Grupo (meses)" value={prazo} onChange={setPrazo} type="int" />
      </Section>

      <Section title="Estratégia de Lance">
        {/* Tipo de lance */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold">Tipo de Lance</label>
          <div className="grid grid-cols-3 gap-2">
            {(["embutido", "proprio", "combinado"] as const).map((t) => (
              <button key={t} onClick={() => setTipoLance(t)}
                className={`rounded-lg border-2 px-2 py-2.5 text-xs font-bold transition ${tipoLance === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}>
                {t === "embutido" ? "Embutido" : t === "proprio" ? "Próprio" : "Combinado"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {tipoLance === "embutido" && "Lance sai da própria carta (não é desembolso extra). Abate do saldo devedor pós-contemplação."}
            {tipoLance === "proprio" && "Cliente usa recursos próprios como lance. Abate do saldo devedor."}
            {tipoLance === "combinado" && "Combina lance embutido + recursos próprios para maximizar o percentual ofertado."}
          </p>
        </div>

        <Grid2>
          {(tipoLance === "embutido" || tipoLance === "combinado") && (
            <NumInput label="Lance Embutido (% da carta)" value={percEmb} onChange={setPercEmb} type="int" hint="% da carta usada como lance embutido" />
          )}
          {(tipoLance === "proprio" || tipoLance === "combinado") && (
            <NumInput label="Lance em Recursos Próprios (R$)" value={lanceProprioR} onChange={setLanceProprioR} type="money" />
          )}
        </Grid2>
      </Section>

      <Section title="Cenário de Contemplação">
        <Grid2>
          <NumInput label="Mês-alvo de contemplação com lance" value={mesContemplacao} onChange={setMesContemplacao} type="int" hint="Mês em que o lance garante a contemplação" />
          <NumInput label="Mês médio sem lance (referência)" value={mesSemLance} onChange={setMesSemLance} type="int" hint="Contemplação aleatória média do grupo" />
        </Grid2>
        <Grid2>
          <NumInput label="Correção da carta (INCC % a.a.)" value={taxaAtualiz} onChange={setTaxaAtualiz} type="int" hint="Taxa anual de atualização da carta pelo INCC" />
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground/80">Lance abate o quê?</label>
            <div className="grid grid-cols-2 gap-2">
              {(["saldoDevedor", "credito"] as const).map((t) => (
                <button key={t} onClick={() => setTipoAbatimento(t)}
                  className={`rounded-lg border-2 px-2 py-2.5 text-xs font-bold transition ${tipoAbatimento === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}>
                  {t === "saldoDevedor" ? "Saldo devedor" : "Crédito recebido"}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tipoAbatimento === "saldoDevedor" ? "Cliente recebe a carta cheia, mas deve menos." : "Cliente recebe menos crédito (carta é reduzida)."}
            </p>
          </div>
        </Grid2>
      </Section>

      {/* ── Vincular & Salvar ──────────────────────────────────────────── */}
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
            Simular Lance
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

      {/* ── Resultados ─────────────────────────────────────────────────── */}
      {results && <ResultsLance r={results} inputs={inputs} />}

    </div>
  );
}

// ─── Results Component ────────────────────────────────────────────────────────
function ResultsLance({ r, inputs }: { r: LanceResults; inputs: LanceInputs }) {
  // Gráfico de barras: parcela por fase (sem lance vs com lance)
  const phases = ["Pré-Contempl. (ambos)", `Pós-Contempl. sem lance`, `Pós-Contempl. com lance`];
  const chartData = {
    labels: phases,
    datasets: [
      {
        label: "Parcela Mensal",
        data: [r.parcelaPadrao, r.parcelaPadrao, r.parcelaPosLance],
        backgroundColor: ["#6b7280", "#ef4444", "#22c55e"],
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => fmtBRL(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: {
          callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k`,
        },
      },
    },
  };

  // Desembolso acumulado (amostrado a cada 6 meses)
  const sampled = r.timeline.filter((_, i) => i % 6 === 0 || i === r.timeline.length - 1);
  const lineData = {
    labels: sampled.map((d) => `M${d.mes}`),
    datasets: [
      {
        label: "Sem Lance",
        data: sampled.map((d) => d.desembolsoAcumSemLance),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.3,
      },
      {
        label: "Com Lance",
        data: sampled.map((d) => d.desembolsoAcumComLance),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
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
          callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k`,
        },
      },
    },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={CalendarCheck} label="Mês de contemplação" value={`Mês ${inputs.mesContemplacaoLance}`} sub={`Sem lance: Mês ${inputs.mesSemLance}`} variant="primary" />
        <KPI icon={TrendingDown} label="Parcela pós-lance" value={fmtBRL(r.parcelaPosLance)} sub={`Era ${fmtBRL(r.parcelaPadrao)}`} variant="success" />
        <KPI icon={Target} label="Lance total" value={fmtBRL(r.lanceTotalR)} sub={`${r.percLanceTotalSobreCarta.toFixed(1)}% da carta`} variant="warning" />
        <KPI icon={Coins} label="Economia total" value={fmtBRL(r.economia)} sub="vs. contemplação sem lance" variant={r.economia >= 0 ? "success" : "default"} />
      </div>

      {/* ── Destaque ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <p className="text-sm font-bold text-primary">
          Com lance de {fmtBRL(r.lanceTotalR)}, a parcela cai de{" "}
          <span className="text-danger">{fmtBRL(r.parcelaPadrao)}</span> para{" "}
          <span className="text-success">{fmtBRL(r.parcelaPosLance)}</span>{" "}
          — uma redução de {fmtBRL(r.parcelaPadrao - r.parcelaPosLance)}/mês.
        </p>
        {r.breakEvenMes && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            O investimento do lance próprio se recupera no <strong>mês {r.breakEvenMes}</strong> pela economia de parcelas.
          </p>
        )}
      </div>

      {/* ── Gráfico: parcelas por fase ─────────────────────────────── */}
      <Section title="Parcela Mensal por Fase">
        <div className="h-48 sm:h-64 w-full">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </Section>

      {/* ── Gráfico: desembolso acumulado ─────────────────────────── */}
      <Section title="Desembolso Acumulado ao Longo do Tempo">
        <div className="h-48 sm:h-64 w-full">
          <Bar data={lineData} options={{ ...lineOptions, datasets: lineData.datasets } as never} />
        </div>
        <p className="text-xs text-muted-foreground">A curva verde (com lance) fica abaixo da vermelha (sem lance) após a contemplação, representando a economia real.</p>
      </Section>

      {/* ── Tabela comparativa ────────────────────────────────────── */}
      <Section title="Comparativo: Sem Lance vs. Com Lance">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Item</th>
                <th className="py-2 px-4 text-right text-xs font-extrabold uppercase tracking-wider text-danger">Sem Lance</th>
                <th className="py-2 px-4 text-right text-xs font-extrabold uppercase tracking-wider text-success">Com Lance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Parcela mensal (pré-contempl.)", fmtBRL(r.parcelaPadrao), fmtBRL(r.parcelaPadrao)],
                ["Parcela mensal (pós-contempl.)", fmtBRL(r.parcelaPadrao), fmtBRL(r.parcelaPosLance)],
                ["Mês de contemplação", `Mês ${inputs.mesSemLance}`, `Mês ${inputs.mesContemplacaoLance}`],
                ["Lance desembolsado", "R$ 0", fmtBRL(r.lanceProprio > 0 ? r.lanceProprio : r.lanceEmbR)],
                ["Crédito disponível ao cliente", fmtBRL(inputs.cartaCredito), fmtBRL(r.creditoLiquido)],
                ...(r.cartaAtualizada !== inputs.cartaCredito ? [["Carta corrigida pelo INCC (contempl.)", "—", fmtBRL(r.cartaAtualizada)]] : []),
                ["Saldo devedor pós-lance", fmtBRL(inputs.cartaCredito), fmtBRL(r.saldoDevedorPosLance)],
                ["Total pago no período", fmtBRL(r.totalSemLance), fmtBRL(r.totalComLance)],
              ].map(([label, sem, com]) => (
                <tr key={label} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-4 text-foreground/70">{label}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-danger">{sem}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-success">{com}</td>
                </tr>
              ))}
              <tr className="bg-success/5 font-bold">
                <td className="py-2.5 px-4 text-success font-extrabold">💰 Economia com o Lance</td>
                <td className="py-2.5 px-4" />
                <td className="py-2.5 px-4 text-right text-success font-extrabold">{fmtBRL(r.economia)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ─── PDF Document (react-pdf) ─────────────────────────────────────────────────
function PDFLanceDoc({ r, inputs, clientName }: {
  r: LanceResults; inputs: LanceInputs; clientName?: string;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const reducaoParcela = r.parcelaPadrao - r.parcelaPosLance;
  const mesesRestantes = Math.max(inputs.prazoMeses - inputs.mesContemplacaoLance, 1);
  const espera = Math.max(inputs.mesSemLance - inputs.mesContemplacaoLance, 0);
  const tipoLanceLabel = inputs.tipoLance === "embutido" ? "Embutido" : inputs.tipoLance === "proprio" ? "Próprio" : "Combinado";

  const compRows: [string, string, string][] = [
    ["Parcela antes da contemplação", fmtBRL(r.parcelaPadrao), fmtBRL(r.parcelaPadrao)],
    ["Parcela após a contemplação", fmtBRL(r.parcelaPadrao), fmtBRL(r.parcelaPosLance)],
    ["Mês de contemplação", `Mês ${inputs.mesSemLance}`, `Mês ${inputs.mesContemplacaoLance}`],
    ["Crédito disponível", fmtBRL(inputs.cartaCredito), fmtBRL(r.creditoLiquido)],
    ["Saldo devedor pós-lance", fmtBRL(inputs.cartaCredito), fmtBRL(r.saldoDevedorPosLance)],
    ["Total pago no contrato", fmtBRL(r.totalSemLance), fmtBRL(r.totalComLance)],
  ];

  return (
    <RpDoc>
      <RpHeader
        title="Simulador de Lance"
        subtitle="Estratégia de Contemplação — Relatório Personalizado"
        clientName={clientName}
        date={hoje}
      />
      <RpPremises items={[
        ["Carta de crédito", fmtBRL(inputs.cartaCredito)],
        ["Prazo do grupo", `${inputs.prazoMeses} meses`],
        ["Taxa de adm.", `${inputs.taxaAdmTotal}%`],
        ["Tipo de lance", tipoLanceLabel],
        ["Lance total", fmtBRL(r.lanceTotalR)],
        ["Contempl. com lance", `Mês ${inputs.mesContemplacaoLance}`],
        ["Contempl. sem lance", `Mês ${inputs.mesSemLance}`],
        ["Meses antecipados", `${espera} meses`],
      ]} />

      <RpSection title="Resultados do Lance Estratégico" description="O que muda na sua vida financeira ao dar o lance:">
        <RpMetricRow>
          <RpMetric label="Contemplação garantida" value={`Mês ${inputs.mesContemplacaoLance}`} description={espera > 0 ? `${espera} meses antes da media sem lance` : "Contemplação antecipada"} color={C.navy} />
          <RpMetric label="Nova parcela mensal" value={fmtBRL(r.parcelaPosLance)} description={`Queda de ${fmtBRL(r.parcelaPadrao)} — ${((reducaoParcela / (r.parcelaPadrao || 1)) * 100).toFixed(0)}% a menos por mes`} color={C.green} />
          <RpMetric label="Lance desembolsado" value={fmtBRL(r.lanceTotalR)} description={`${r.percLanceTotalSobreCarta.toFixed(1)}% da carta — abate o saldo devedor`} color={C.amber} />
          <RpMetric label="Economia total no contrato" value={fmtBRL(r.economia)} description="Valor que voce deixa de pagar vs. nao dar lance" color={C.green} />
        </RpMetricRow>
      </RpSection>

      <RpInsight
        emoji="💡"
        title="Por que o lance é um investimento, não um gasto?"
        body={`Com o lance de ${fmtBRL(r.lanceTotalR)}, a parcela cai ${fmtBRL(reducaoParcela)}/mes durante os ${mesesRestantes} meses restantes — isso sao ${fmtBRL(reducaoParcela * mesesRestantes)} em economia de parcelas. Cada real dado no lance retorna ${r.lanceTotalR > 0 ? (r.economia / r.lanceTotalR).toFixed(1) : "0"}x ao longo do contrato. Alem disso, voce elimina a incerteza da contemplacao aleatoria: ao inves de esperar ate o mes ${inputs.mesSemLance}, voce garante o credito ja no mes ${inputs.mesContemplacaoLance}.`}
        variant="primary"
      />

      <RpSection title="Comparativo: Sem Lance vs. Com Lance" description="Cada linha é um fato concreto — sem suposições:">
        {/* Header row */}
        <RpView style={{ flexDirection: "row", marginBottom: 4 }}>
          <RpText style={{ flex: 1, fontSize: 8, color: C.textSub, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>Item</RpText>
          <RpText style={{ width: 90, fontSize: 8, color: C.red, fontFamily: "Helvetica-Bold", textTransform: "uppercase", textAlign: "center" }}>Sem Lance</RpText>
          <RpText style={{ width: 90, fontSize: 8, color: C.green, fontFamily: "Helvetica-Bold", textTransform: "uppercase", textAlign: "center" }}>Com Lance</RpText>
        </RpView>
        {compRows.map(([label, sem, com], i) => (
          <RpView key={i} style={{ flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <RpText style={{ flex: 1, fontSize: 9, color: C.textSub }}>{label}</RpText>
            <RpText style={{ width: 90, fontSize: 9, color: C.red, textAlign: "center", fontFamily: "Helvetica-Bold" }}>{sem}</RpText>
            <RpText style={{ width: 90, fontSize: 9, color: C.green, textAlign: "center", fontFamily: "Helvetica-Bold" }}>{com}</RpText>
          </RpView>
        ))}
        {/* Total row */}
        <RpView style={{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 5, backgroundColor: "#f0fdf4", borderRadius: 5, marginTop: 4 }}>
          <RpText style={{ flex: 1, fontSize: 10, color: C.green, fontFamily: "Helvetica-Bold" }}>Economia total com o lance</RpText>
          <RpText style={{ width: 90, fontSize: 10, textAlign: "center" }}></RpText>
          <RpText style={{ width: 90, fontSize: 10, color: C.green, textAlign: "center", fontFamily: "Helvetica-Bold" }}>{fmtBRL(r.economia)}</RpText>
        </RpView>
      </RpSection>

      <RpKVList rows={[
        { label: "Lance próprio desembolsado", value: fmtBRL(r.lanceProprioR), color: C.amber },
        { label: "Lance embutido (do crédito)", value: fmtBRL(r.lanceEmbutidoR), color: C.navy },
        { label: "Crédito líquido disponível", value: fmtBRL(r.creditoLiquido), color: C.green },
      ]} />

      {r.breakEvenMes ? (
        <RpInsight
          emoji="📅"
          title={`Ponto de retorno: Mês ${r.breakEvenMes}`}
          body={`A partir do mes ${r.breakEvenMes}, o lance proprio ja foi completamente recuperado pela reducao de parcelas. Cada mes seguinte, voce economiza ${fmtBRL(reducaoParcela)} — puro ganho financeiro.`}
          variant="success"
        />
      ) : null}

      <RpFooter />
    </RpDoc>
  );
}
