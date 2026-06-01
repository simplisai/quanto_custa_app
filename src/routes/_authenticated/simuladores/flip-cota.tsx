import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import {
  calcFlipCota,
  defaultFlipCotaInputs,
  type FlipCotaInputs,
  type FlipCotaResults,
} from "@/lib/calc-flip-cota";
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
import { ArrowLeft, Zap, TrendingUp, Coins, BarChart2, BookOpen } from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { RpDoc, RpHeader, RpSection, RpMetric, RpInsight, RpPremises, RpKVList, RpFooter, RpMetricRow, RpChartImage, C } from "@/components/RpShell";
import { captureChart } from "@/lib/capture-charts";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Route = createFileRoute("/_authenticated/simuladores/flip-cota")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: FlipCotaPage,
});

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function NumInput({
  label, value, onChange, type, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type: "money" | "percent" | "int" | "decimal"; hint?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (type === "money") onChange(maskMoney(v));
    else if (type === "percent") onChange(maskPercent(v));
    else if (type === "decimal") onChange(v.replace(/[^0-9.,]/g, ""));
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
  variant?: "default" | "success" | "primary" | "warning" | "danger";
}) {
  const bg: Record<string, string> = {
    default: "bg-muted/40 text-foreground",
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning-foreground",
    danger: "bg-danger/10 text-danger",
  };
  const ic: Record<string, string> = {
    default: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning-foreground",
    danger: "text-danger",
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${bg[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${ic[variant]}`} />
        <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="min-w-0 overflow-hidden text-lg sm:text-xl font-extrabold break-all">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function FlipCotaPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const brand = useBrandSettings();
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
    () => results ? <PDFFlipDoc r={results} inputs={inputs} clientName={clients.find((c) => c.id === selectedClientId)?.name} chartImg={captureChart("flip-rentab")} 
      brandLogoUrl={brand.isCustomLogo ? brand.logoUrl : undefined}
      brandColor={brand.isCustomColor ? brand.color : undefined}
    /> : null,
    "Flip_Cota_Consorcio.pdf",
  );

  const [cartaCredito, setCartaCredito] = useState(maskMoney(String(defaultFlipCotaInputs.cartaCredito * 100)));
  const [prazo, setPrazo] = useState(String(defaultFlipCotaInputs.prazo));
  const [meiaParcela, setMeiaParcela] = useState(defaultFlipCotaInputs.meiaParcela);
  const [taxaAdm, setTaxaAdm] = useState(String(defaultFlipCotaInputs.taxaAdm));
  const [fundoReserva, setFundoReserva] = useState(String(defaultFlipCotaInputs.fundoReserva));
  const [lancePerc, setLancePerc] = useState(String(defaultFlipCotaInputs.lancePerc));
  const [tipoLance, setTipoLance] = useState<FlipCotaInputs["tipoLance"]>("embutido");
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultFlipCotaInputs.mesContemplacao));
  const [agioVenda, setAgioVenda] = useState(String(defaultFlipCotaInputs.agioVenda));
  const [taxaAtualiz, setTaxaAtualiz] = useState(String(defaultFlipCotaInputs.taxaAtualizacaoAnual));

  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<FlipCotaResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ── Restore sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("flip-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.cartaCredito) setCartaCredito(s.cartaCredito);
      if (s.prazo) setPrazo(s.prazo);
      if (s.meiaParcela !== undefined) setMeiaParcela(s.meiaParcela);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.fundoReserva) setFundoReserva(s.fundoReserva);
      if (s.lancePerc) setLancePerc(s.lancePerc);
      if (s.tipoLance) setTipoLance(s.tipoLance);
      if (s.mesContemplacao) setMesContemplacao(s.mesContemplacao);
      if (s.agioVenda) setAgioVenda(s.agioVenda);
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

  useEffect(() => {
    if (!search.load || !user) return;
    supabase.from("simulations").select("*").eq("id", search.load).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const inp = data.inputs as Record<string, unknown>;
        if (inp.cartaCredito) setCartaCredito(maskMoney(String(Math.round((inp.cartaCredito as number) * 100))));
        if (inp.prazo) setPrazo(String(inp.prazo));
        if (inp.meiaParcela !== undefined) setMeiaParcela(inp.meiaParcela as boolean);
        if (inp.taxaAdm !== undefined) setTaxaAdm(String(inp.taxaAdm));
        if (inp.fundoReserva !== undefined) setFundoReserva(String(inp.fundoReserva));
        if (inp.lancePerc !== undefined) setLancePerc(String(inp.lancePerc));
        if (inp.tipoLance) setTipoLance(inp.tipoLance as FlipCotaInputs["tipoLance"]);
        if (inp.mesContemplacao) setMesContemplacao(String(inp.mesContemplacao));
        if (inp.agioVenda !== undefined) setAgioVenda(String(inp.agioVenda));
        if (data.client_id) setSelectedClientId(data.client_id);
        toast.success("Simulação carregada.");
      });
  }, [search.load, user]);

  const inputs: FlipCotaInputs = useMemo(() => ({
    cartaCredito: unmask(cartaCredito),
    prazo: parseInt(prazo || "0", 10) || 1,
    meiaParcela,
    taxaAdm: parseFloat(taxaAdm.replace(",", ".")) || 0,
    fundoReserva: parseFloat(fundoReserva.replace(",", ".")) || 0,
    lancePerc: parseFloat(lancePerc.replace(",", ".")) || 0,
    tipoLance,
    mesContemplacao: parseInt(mesContemplacao || "0", 10) || 1,
    agioVenda: parseFloat(agioVenda.replace(",", ".")) || 0,
    taxaAtualizacaoAnual: parseFloat(taxaAtualiz.replace(",", ".")) || 0,
  }), [cartaCredito, prazo, meiaParcela, taxaAdm, fundoReserva, lancePerc, tipoLance, mesContemplacao, agioVenda, taxaAtualiz]);

  const calcular = () => {
    setResults(calcFlipCota(inputs));
    setSavedId(null);
    sessionStorage.setItem("flip-inputs", JSON.stringify({
      cartaCredito, prazo, meiaParcela, taxaAdm, fundoReserva,
      lancePerc, tipoLance, mesContemplacao, agioVenda, taxaAtualiz,
    }));
  };

  const applyTemplate = (p: TemplatePayload) => {
    if (p.cartaCredito) setCartaCredito(p.cartaCredito);
    if (p.prazo) setPrazo(p.prazo);
    if (p.taxaAdm) setTaxaAdm(p.taxaAdm);
    if (p.fundoReserva) setFundoReserva(p.fundoReserva);
    if (p.lancePerc) setLancePerc(p.lancePerc);
    if (p.tipoLance) setTipoLance(p.tipoLance as FlipCotaInputs["tipoLance"]);
    if (p.mesContemplacao) setMesContemplacao(p.mesContemplacao);
    if (p.agioVenda) setAgioVenda(p.agioVenda);
    setResults(null);
    setSavedId(null);
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Flip Cota ${fmtBRL(inputs.cartaCredito)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          desembolsoTotal: results.desembolsoTotal,
          lucroLiquido: results.lucroLiquido,
          tirMensal: results.tirMensal,
          tirAnual: results.tirAnual,
          roiTotal: results.roiTotal,
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
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header>
        <div className="flex items-center justify-between mb-3">
          <Link to="/simuladores" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Simuladores
          </Link>
          <div className="flex gap-2">
            <TemplatePicker operationSlug="flip-cota" onApply={applyTemplate} />
            <Link to="/simuladores/estrategia/$slug" params={{ slug: "flip-cota" }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition-colors">
              <BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Estratégia</span>
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">📈 Alavancagem / Flip de Cota</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Calcule a rentabilidade de comprar uma cota, ser contemplado e vender com ágio. Mostre o ROI real da operação.
        </p>
      </header>

      {/* ── Parâmetros ─────────────────────────────────────────────── */}
      <Section title="Parâmetros da Operação">
        <Grid2>
          <NumInput label="Valor do Crédito Original (R$)" value={cartaCredito} onChange={setCartaCredito} type="money" />
          <NumInput label="Prazo do Plano (meses)" value={prazo} onChange={setPrazo} type="int" />
        </Grid2>

        {/* Meia Parcela */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="relative">
            <input
              type="checkbox"
              checked={meiaParcela}
              onChange={(e) => setMeiaParcela(e.target.checked)}
              className="sr-only"
            />
            <div className={`h-5 w-9 rounded-full transition-colors ${meiaParcela ? "bg-primary" : "bg-muted-foreground/30"}`} />
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${meiaParcela ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div>
            <span className="text-sm font-semibold">Meia Parcela até contemplar</span>
            <span className="ml-2 text-xs text-muted-foreground">(paga 50% da parcela cheia durante a espera)</span>
          </div>
        </label>

        <Grid2>
          <NumInput label="Taxa Adm. Total (%)" value={taxaAdm} onChange={setTaxaAdm} type="decimal" hint="Ex: 23.5" />
          <NumInput label="Fundo de Reserva (%)" value={fundoReserva} onChange={setFundoReserva} type="decimal" hint="Ex: 1.5" />
        </Grid2>

        <Grid2>
          <NumInput label="Lance (%)" value={lancePerc} onChange={setLancePerc} type="decimal" hint="% do crédito ofertado como lance" />
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Tipo de Lance</label>
            <div className="grid grid-cols-2 gap-2">
              {(["embutido", "proprio"] as const).map((t) => (
                <button key={t} onClick={() => setTipoLance(t)}
                  className={`rounded-lg border-2 px-3 py-2.5 text-xs font-bold transition ${tipoLance === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}>
                  {t === "embutido" ? "Embutido" : "Recurso Próprio"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {tipoLance === "embutido" ? "Lance não sai do bolso — abate do crédito líquido." : "Lance pago do próprio bolso — aumenta desembolso total."}
            </p>
          </div>
        </Grid2>

        <Grid2>
          <NumInput label="Mês da Contemplação" value={mesContemplacao} onChange={setMesContemplacao} type="int" />
          <NumInput label="Ágio na Venda (% do Crédito Líquido)" value={agioVenda} onChange={setAgioVenda} type="decimal" hint="Prêmio cobrado na venda da cota contemplada" />
        </Grid2>
        <NumInput label="Correção da Carta (INCC % a.a.)" value={taxaAtualiz} onChange={setTaxaAtualiz} type="decimal" hint="Taxa anual de atualização — INCC corrige a carta até a contemplação (ex: 4%)" />
      </Section>

      {/* ── Vincular & Salvar ──────────────────────────────────────── */}
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
            Calcular Rentabilidade
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

      {results && <ResultsFlip r={results} inputs={inputs} />}

    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────
function ResultsFlip({ r, inputs }: { r: FlipCotaResults; inputs: FlipCotaInputs }) {
  const isProfit = r.lucroLiquido >= 0;

  const chartData = {
    labels: ["Capital Alocado", "Lucro Líquido da Operação"],
    datasets: [
      {
        label: "Evolução Financeira (R$)",
        data: [r.desembolsoTotal, Math.abs(r.lucroLiquido)],
        backgroundColor: [
          "rgba(107, 114, 128, 0.7)",
          isProfit ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)",
        ],
        borderColor: [
          "rgba(107, 114, 128, 1)",
          isProfit ? "rgba(34, 197, 94, 1)" : "rgba(239, 68, 68, 1)",
        ],
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
        beginAtZero: true,
        ticks: {
          callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k`,
        },
      },
    },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Coins} label="Desembolso total" value={fmtBRL(r.desembolsoTotal)} sub={`Parcelas + ${r.desembolsoLance > 0 ? "lance próprio" : "lance embutido"}`} variant="primary" />
        <KPI icon={TrendingUp} label="Ágio recebido na venda" value={fmtBRL(r.valorVenda)} sub={`${inputs.agioVenda}% sobre crédito corrigido (INCC)`} variant="success" />
        <KPI icon={BarChart2} label="Lucro líquido" value={fmtBRL(r.lucroLiquido)} sub={`ROI total: ${r.roiTotal.toFixed(1)}%`} variant={isProfit ? "success" : "danger"} />
        <KPI icon={Zap} label="TIR mensal" value={`${r.tirMensal.toFixed(2)}% a.m.`} sub={`${r.tirAnual.toFixed(1)}% a.a. — em ${inputs.mesContemplacao} meses`} variant={isProfit ? "success" : "danger"} />
      </div>

      {/* ── Destaque ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-4 sm:p-5 ${isProfit ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}`}>
        <p className={`text-base font-extrabold ${isProfit ? "text-success" : "text-danger"}`}>
          {isProfit
            ? `Operação lucrativa: desembolso de ${fmtBRL(r.desembolsoTotal)} gera ${fmtBRL(r.lucroLiquido)} de lucro em ${inputs.mesContemplacao} meses.`
            : `Operação deficitária no cenário atual. Ajuste o ágio ou reduza o lance para melhorar o resultado.`}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Crédito corrigido (INCC): <strong>{fmtBRL(r.creditoAtualizado)}</strong> · Preço total ao comprador: <strong>{fmtBRL(r.precoVendaTotal)}</strong> ·
          Parcela {inputs.meiaParcela ? "(meia)" : "(cheia)"}: <strong>{fmtBRL(r.parcelaEfetiva)}/mês</strong>
        </p>
      </div>

      {/* ── Gráfico ──────────────────────────────────────────────────── */}
      <Section title="Demonstrativo de Rentabilidade">
        <div className="h-56 sm:h-72" data-chart="flip-rentab">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </Section>

      {/* ── Tabela detalhada ──────────────────────────────────────────── */}
      <Section title="Detalhamento da Operação">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[400px] text-sm">
            <tbody className="divide-y divide-border">
              {[
                ["Crédito Original", fmtBRL(inputs.cartaCredito), ""],
                ["Lance Ofertado", `${inputs.lancePerc}% (${inputs.tipoLance === "embutido" ? "embutido" : "recurso próprio"})`, ""],
                ["Crédito Líquido (nominal)", fmtBRL(r.creditoLiquido), ""],
                ["Crédito Corrigido pelo INCC", fmtBRL(r.creditoAtualizado), "info"],
                ["Parcela Cheia", fmtBRL(r.parcelaCheia) + "/mês", ""],
                ["Parcela Efetiva (paga)", fmtBRL(r.parcelaEfetiva) + "/mês", inputs.meiaParcela ? "success" : ""],
                ["Valor Pago em Parcelas", fmtBRL(r.valorPagoParcelas), ""],
                ...(r.desembolsoLance > 0 ? [["Lance Próprio Desembolsado", fmtBRL(r.desembolsoLance), "danger"] as [string, string, string]] : []),
                ["Desembolso Total", fmtBRL(r.desembolsoTotal), "bold"],
                ["Ágio Recebido na Venda", fmtBRL(r.valorVenda), "success"],
                ["Preço Total ao Comprador", fmtBRL(r.precoVendaTotal), ""],
                ["Lucro Líquido", fmtBRL(r.lucroLiquido), isProfit ? "success-strong" : "danger"],
                ["ROI Total", `${r.roiTotal.toFixed(2)}%`, isProfit ? "success" : "danger"],
                ["TIR Mensal", `${r.tirMensal.toFixed(2)}% a.m.`, isProfit ? "success" : "danger"],
                ["TIR Anual", `${r.tirAnual.toFixed(1)}% a.a.`, isProfit ? "success" : "danger"],
              ].map(([label, value, color], i) => {
                const cls = color === "success" ? "text-success font-bold"
                  : color === "success-strong" ? "text-success font-extrabold text-base"
                  : color === "danger" ? "text-danger font-bold"
                  : color === "info" ? "text-primary font-bold"
                  : color === "bold" ? "font-bold"
                  : "text-foreground";
                return (
                  <tr key={i} className={`hover:bg-muted/30 ${i === 7 ? "border-t-2 border-border" : ""}`}>
                    <td className="py-2.5 px-4 text-foreground/70">{label}</td>
                    <td className={`py-2.5 px-4 text-right ${cls}`}>{value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ─── PDF Document (react-pdf) ─────────────────────────────────────────────────
function PDFFlipDoc({ r, inputs, clientName, chartImg, brandLogoUrl, brandColor }: {
  r: FlipCotaResults; inputs: FlipCotaInputs; clientName?: string;
  brandLogoUrl?: string;
  brandColor?: string; chartImg?: string | null;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <RpDoc compact>
      <RpHeader
        title="Flip de Cota"
        subtitle="Estratégia de Compra e Venda de Cota — Relatório de Retorno"
        clientName={clientName}
        date={hoje}
        brandLogoUrl={brandLogoUrl}
        brandColor={brandColor}
      />
      <RpPremises items={[
        ["Carta de crédito", fmtBRL(inputs.cartaCredito)],
        ["Prazo do grupo", `${inputs.prazo} meses`],
        ["Lance ofertado", `${inputs.lancePerc}%`],
        ["Tipo de lance", inputs.tipoLance],
        ["Contempl. prevista", `Mês ${inputs.mesContemplacao}`],
        ["Ágio de venda", `${inputs.agioVenda}%`],
        ["Taxa de atualiz.", `${inputs.taxaAtualizacaoAnual}% a.a.`],
        ["Meia parcela", inputs.meiaParcela ? "Sim" : "Não"],
      ]} />

      <RpSection title="Resultado do Flip" description="Retorno real da estrategia de compra e revenda de cota contemplada:">
        <RpMetricRow>
          <RpMetric label="Valor de venda da cota" value={fmtBRL(r.precoVendaTotal)} description={`Carta atualizada + ${inputs.agioVenda}% de ágio`} color={C.green} />
          <RpMetric label="Custo de aquisição" value={fmtBRL(r.desembolsoTotal)} description="Parcelas pagas + lance proprio" color={C.navy} />
          <RpMetric label="Lucro liquido" value={fmtBRL(r.lucroLiquido)} description="Valor de venda menos custo total" color={r.lucroLiquido >= 0 ? C.green : C.red} />
          <RpMetric label="ROI no periodo" value={`${r.roiTotal.toFixed(1)}%`} description={`Em apenas ${inputs.mesContemplacao} meses`} color={r.roiTotal >= 0 ? C.green : C.red} />
        </RpMetricRow>
      </RpSection>

      <RpChartImage src={chartImg} title="Demonstrativo de Rentabilidade" height={120} />

      <RpInsight
        emoji="🔄"
        title="A lógica do Flip de Cota"
        body={`Você entra na cota, paga ${inputs.mesContemplacao} meses de parcela (${fmtBRL(r.valorPagoParcelas)} no total) e dá um lance de ${fmtBRL(r.desembolsoLance)}. Apos a contemplacao, a carta de ${fmtBRL(inputs.cartaCredito)} — corrigida pelo INCC para ${fmtBRL(r.creditoAtualizado)} — e vendida com ${inputs.agioVenda}% de agio. Resultado: ${fmtBRL(r.lucroLiquido)} de lucro em ${inputs.mesContemplacao} meses, ROI de ${r.roiTotal.toFixed(1)}%.`}
        variant="primary"
      />

      <RpSection title="Detalhamento Financeiro" description="Cada centavo da operacao:">
        <RpKVList rows={[
          { label: "Carta de crédito contratada", value: fmtBRL(inputs.cartaCredito) },
          { label: "Carta corrigida pelo INCC na contemplação", value: fmtBRL(r.creditoAtualizado), color: C.navy },
          { label: "Lance desembolsado (próprio)", value: fmtBRL(r.desembolsoLance) },
          { label: "Parcelas pagas até a contemplação", value: fmtBRL(r.valorPagoParcelas), color: C.red },
          { label: "Custo total de aquisição", value: fmtBRL(r.desembolsoTotal), color: C.red },
          { label: "Ágio recebido na venda", value: fmtBRL(r.valorVenda), color: C.green },
          { label: "Preço total ao comprador", value: fmtBRL(r.precoVendaTotal), color: C.green },
          { label: "Lucro líquido da operação", value: fmtBRL(r.lucroLiquido), color: r.lucroLiquido >= 0 ? C.green : C.red },
          { label: "ROI da operação", value: `${r.roiTotal.toFixed(1)}%`, color: C.green },
          { label: "TIR anual", value: `${r.tirAnual.toFixed(1)}% a.a.`, color: C.green },
        ]} />
      </RpSection>

      <RpFooter note="O flip de cota e uma operacao de curto prazo. O lucro depende do agio praticado no mercado secundario de cotas e das condicoes da administradora. Consulte as regras do grupo antes de operar." />
    </RpDoc>
  );
}
