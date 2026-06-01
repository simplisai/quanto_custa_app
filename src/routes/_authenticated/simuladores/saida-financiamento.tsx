import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import {
  calcSaidaFinanciamento,
  defaultSaidaInputs,
  type SaidaFinanciamentoResults,
  type TipoAbatimento,
} from "@/lib/calc-saida-financiamento";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  ArrowLeft, TrendingUp, TrendingDown, Home, Wallet, ArrowRight,
  BookOpen,
} from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { RpDoc, RpHeader, RpSection, RpMetric, RpInsight, RpPremises, RpKVList, RpFooter, RpMetricRow, RpChartImage, C } from "@/components/RpShell";
import { captureChart } from "@/lib/capture-charts";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Route = createFileRoute("/_authenticated/simuladores/saida-financiamento")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: SaidaFinanciamentoPage,
});

// ─── Helpers UI ───────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, type, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type: "money" | "percent" | "int"; hint?: string;
}) {
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
        onChange={(e) => {
          const v = e.target.value;
          if (type === "money") onChange(maskMoney(v));
          else if (type === "percent") onChange(maskPercent(v));
          else onChange(v.replace(/\D/g, ""));
        }}
        placeholder="0"
        inputMode={type === "int" ? "numeric" : "decimal"}
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
    default: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning-foreground",
    danger: "text-destructive",
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${colors[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="min-w-0 overflow-hidden text-lg sm:text-xl font-extrabold break-all">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function SaidaFinanciamentoPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const brand = useBrandSettings();
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
    () => results ? <PDFSaidaDoc
      r={results} inputs={inputs}
      clientName={clients.find((c) => c.id === selectedClientId)?.name}
      chartImg={captureChart("saida-evolucao")}
      chartCustos={captureChart("saida-custos")}
    
      brandLogoUrl={brand.isCustomLogo ? brand.logoUrl : undefined}
      brandColor={brand.isCustomColor ? brand.color : undefined}
    /> : null,
    "saida-financiamento.pdf",
  );

  // Financiamento atual
  const [valorImovel, setValorImovel] = useState(maskMoney(String(defaultSaidaInputs.valorImovelAtual * 100)));
  const [saldoDevedor, setSaldoDevedor] = useState(maskMoney(String(defaultSaidaInputs.saldoDevedor * 100)));
  const [parcelaAtual, setParcelaAtual] = useState(maskMoney(String(defaultSaidaInputs.parcelaAtual * 100)));
  const [prazoRestante, setPrazoRestante] = useState(String(defaultSaidaInputs.prazoRestanteMeses));
  const [taxaJuros, setTaxaJuros] = useState(maskPercent(String(Math.round(defaultSaidaInputs.taxaJurosMensal * 100))));

  // Consórcio destino
  const [cartaConsorcio, setCartaConsorcio] = useState(maskMoney(String(defaultSaidaInputs.cartaConsorcio * 100)));
  const [taxaAdm, setTaxaAdm] = useState(maskPercent(String(defaultSaidaInputs.taxaAdmConsorcio * 100)));
  const [prazoConsorcio, setPrazoConsorcio] = useState(String(defaultSaidaInputs.prazoConsorcio));
  const [percLance, setPercLance] = useState(String(defaultSaidaInputs.percLance));
  const [percLanceEmb, setPercLanceEmb] = useState(String(defaultSaidaInputs.percLanceEmb));
  const [tipoAbatimento, setTipoAbatimento] = useState<TipoAbatimento>(defaultSaidaInputs.tipoAbatimento);
  const [tipoAbatimentoEmbutido, setTipoAbatimentoEmbutido] = useState<"credito" | "saldoDevedor">(defaultSaidaInputs.tipoAbatimentoEmbutido || "credito");
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultSaidaInputs.mesContemplacaoConsorcio));

  // Premissas
  const [valorizacao, setValorizacao] = useState(maskPercent(String(defaultSaidaInputs.valorizacaoAnual * 100)));
  const [custosVenda, setCustosVenda] = useState(maskPercent(String(defaultSaidaInputs.custosVenda * 100)));
  const [taxaAtualiz, setTaxaAtualiz] = useState(String(defaultSaidaInputs.taxaAtualizacaoAnual));

  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<SaidaFinanciamentoResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Restore inputs from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("sf-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.valorImovel) setValorImovel(s.valorImovel);
      if (s.saldoDevedor) setSaldoDevedor(s.saldoDevedor);
      if (s.parcelaAtual) setParcelaAtual(s.parcelaAtual);
      if (s.prazoRestante) setPrazoRestante(s.prazoRestante);
      if (s.taxaJuros) setTaxaJuros(s.taxaJuros);
      if (s.cartaConsorcio) setCartaConsorcio(s.cartaConsorcio);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.prazoConsorcio) setPrazoConsorcio(s.prazoConsorcio);
      if (s.percLance) setPercLance(s.percLance);
      if (s.percLanceEmb) setPercLanceEmb(s.percLanceEmb);
      if (s.tipoAbatimento) setTipoAbatimento(s.tipoAbatimento);
      if (s.tipoAbatimentoEmbutido) setTipoAbatimentoEmbutido(s.tipoAbatimentoEmbutido);
      if (s.mesContemplacao) setMesContemplacao(s.mesContemplacao);
      if (s.valorizacao) setValorizacao(s.valorizacao);
      if (s.custosVenda) setCustosVenda(s.custosVenda);
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
        if (inp.valorImovelAtual) setValorImovel(maskMoney(String(Math.round((inp.valorImovelAtual as number) * 100))));
        if (inp.saldoDevedor) setSaldoDevedor(maskMoney(String(Math.round((inp.saldoDevedor as number) * 100))));
        if (inp.parcelaAtual) setParcelaAtual(maskMoney(String(Math.round((inp.parcelaAtual as number) * 100))));
        if (inp.prazoRestanteMeses) setPrazoRestante(String(inp.prazoRestanteMeses));
        if (inp.taxaJurosMensal) setTaxaJuros(maskPercent(String(Math.round((inp.taxaJurosMensal as number) * 100))));
        if (inp.cartaConsorcio) setCartaConsorcio(maskMoney(String(Math.round((inp.cartaConsorcio as number) * 100))));
        if (inp.taxaAdmConsorcio) setTaxaAdm(maskPercent(String(Math.round((inp.taxaAdmConsorcio as number) * 100))));
        if (inp.prazoConsorcio) setPrazoConsorcio(String(inp.prazoConsorcio));
        if (inp.percLance) setPercLance(String(inp.percLance));
        if (inp.mesContemplacaoConsorcio) setMesContemplacao(String(inp.mesContemplacaoConsorcio));
        if (inp.valorizacaoAnual) setValorizacao(maskPercent(String(Math.round((inp.valorizacaoAnual as number) * 100))));
        if (inp.custosVenda) setCustosVenda(maskPercent(String(Math.round((inp.custosVenda as number) * 100))));
        if (data.client_id) setSelectedClientId(data.client_id);
        toast.success("Simulação carregada.");
      });
  }, [search.load, user]);

  const inputs = useMemo(() => ({
    valorImovelAtual: unmask(valorImovel),
    saldoDevedor: unmask(saldoDevedor),
    parcelaAtual: unmask(parcelaAtual),
    prazoRestanteMeses: parseInt(prazoRestante || "0", 10) || 0,
    taxaJurosMensal: unmask(taxaJuros),
    cartaConsorcio: unmask(cartaConsorcio),
    taxaAdmConsorcio: unmask(taxaAdm),
    prazoConsorcio: parseInt(prazoConsorcio || "0", 10) || 0,
    percLance: parseInt(percLance || "0", 10) || 0,
    percLanceEmb: parseInt(percLanceEmb || "0", 10) || 0,
    mesContemplacaoConsorcio: parseInt(mesContemplacao || "0", 10) || 0,
    tipoAbatimento,
    tipoAbatimentoEmbutido,
    valorizacaoAnual: unmask(valorizacao),
    custosVenda: unmask(custosVenda),
    taxaAtualizacaoAnual: parseFloat(taxaAtualiz || "4") || 4,
  }), [valorImovel, saldoDevedor, parcelaAtual, prazoRestante, taxaJuros, cartaConsorcio, taxaAdm, prazoConsorcio, percLance, percLanceEmb, mesContemplacao, tipoAbatimento, tipoAbatimentoEmbutido, valorizacao, custosVenda]);

  const calcular = () => {
    setResults(calcSaidaFinanciamento(inputs));
    setSavedId(null);
    sessionStorage.setItem("sf-inputs", JSON.stringify({
      valorImovel, saldoDevedor, parcelaAtual, prazoRestante, taxaJuros,
      cartaConsorcio, taxaAdm, prazoConsorcio, percLance, percLanceEmb,
      tipoAbatimento, tipoAbatimentoEmbutido, mesContemplacao, valorizacao, custosVenda,
    }));
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Saída Financiamento — ${fmtBRL(inputs.saldoDevedor)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id, client_id: selectedClientId || null, title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          capitalLiquidoVenda: results.capitalLiquidoVenda,
          parcelaPosLance: results.parcelaPosLance,
          economiaParcelaMensal: results.economiaParcelaMensal,
          economiaTotalCusto: results.economiaTotalCusto,
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
    if (p.valorImovelAtual) setValorImovel(p.valorImovelAtual);
    if (p.saldoDevedor) setSaldoDevedor(p.saldoDevedor);
    if (p.parcelaAtual) setParcelaAtual(p.parcelaAtual);
    if (p.prazoRestanteMeses) setPrazoRestante(p.prazoRestanteMeses);
    if (p.taxaJurosMensal) setTaxaJuros(p.taxaJurosMensal);
    if (p.cartaConsorcio) setCartaConsorcio(p.cartaConsorcio);
    if (p.taxaAdmConsorcio) setTaxaAdm(p.taxaAdmConsorcio);
    if (p.prazoConsorcio) setPrazoConsorcio(p.prazoConsorcio);
    if (p.percLance) setPercLance(p.percLance);
    if (p.mesContemplacaoConsorcio) setMesContemplacao(p.mesContemplacaoConsorcio);
    if (p.valorizacaoAnual) setValorizacao(p.valorizacaoAnual);
    if (p.custosVenda) setCustosVenda(p.custosVenda);
    setResults(null); setSavedId(null);
  };

  // Dados do gráfico
  const chartData = useMemo(() => {
    if (!results) return null;
    const tl = results.timeline.filter((_, i) => i % 6 === 0);
    return {
      labels: tl.map((d) => `M${d.mes}`),
      datasets: [
        {
          label: "Patrimônio — Financiamento",
          data: tl.map((d) => d.patrimonioLiquidoFin),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.08)",
          fill: true, tension: 0.4, pointRadius: 2,
        },
        {
          label: "Patrimônio — Consórcio",
          data: tl.map((d) => d.patrimonioLiquidoCons),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.08)",
          fill: true, tension: 0.4, pointRadius: 2,
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
          <h1 className="text-xl font-extrabold tracking-tight leading-tight">🔴 Saída do Financiamento</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Venda o imóvel financiado · migre para consórcio · libere caixa</p>
        </div>
        <TemplatePicker operationSlug="saida-financiamento" onApply={applyTemplate} />
        <Link to="/simuladores/estrategia/$slug" params={{ slug: "saida-financiamento" }}
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

      {/* Inputs */}
      <Section title="Financiamento Atual">
        <Grid2>
          <NumInput label="Valor atual do imóvel" value={valorImovel} onChange={setValorImovel} type="money" hint="Valor de mercado atual do imóvel financiado" />
          <NumInput label="Saldo devedor (R$)" value={saldoDevedor} onChange={setSaldoDevedor} type="money" hint="Quanto ainda deve ao banco" />
          <NumInput label="Parcela atual (R$)" value={parcelaAtual} onChange={setParcelaAtual} type="money" />
          <NumInput label="Prazo restante (meses)" value={prazoRestante} onChange={setPrazoRestante} type="int" />
          <NumInput label="Taxa de juros (% a.m.)" value={taxaJuros} onChange={setTaxaJuros} type="percent" hint="Taxa mensal do financiamento" />
          <NumInput label="Custos de venda do imóvel (%)" value={custosVenda} onChange={setCustosVenda} type="percent" hint="Corretagem + ITBI + despesas (tipicamente 6%)" />
        </Grid2>
      </Section>

      <Section title="Consórcio Destino">
        <Grid2>
          <NumInput label="Carta de crédito (R$)" value={cartaConsorcio} onChange={setCartaConsorcio} type="money" />
          <NumInput label="Taxa de administração (%)" value={taxaAdm} onChange={setTaxaAdm} type="percent" />
          <NumInput label="Prazo do grupo (meses)" value={prazoConsorcio} onChange={setPrazoConsorcio} type="int" />
          <NumInput label="Lance próprio — % da carta" value={percLance} onChange={setPercLance} type="int" hint="Capital da venda usado como lance (% da carta)" />
          <NumInput label="Lance embutido — % da carta" value={percLanceEmb} onChange={setPercLanceEmb} type="int" hint="Sai do crédito recebido — não do bolso" />
          <NumInput label="Mês de contemplação" value={mesContemplacao} onChange={setMesContemplacao} type="int" />
          <NumInput label="Valorização anual (%)" value={valorizacao} onChange={setValorizacao} type="percent" />
          <NumInput label="Correção da carta — INCC (% a.a.)" value={taxaAtualiz} onChange={setTaxaAtualiz} type="int" hint="Taxa anual de atualização das parcelas do consórcio pelo INCC" />
        </Grid2>
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground/70">Lance próprio abate:</p>
          <div className="grid grid-cols-2 gap-2">
            {(["parcela", "prazo"] as TipoAbatimento[]).map((t) => (
              <button key={t} onClick={() => setTipoAbatimento(t)}
                className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${tipoAbatimento === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
                {t === "parcela" ? "💸 Parcela (mantém prazo)" : "⏱ Prazo (mantém parcela)"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground/70">Lance embutido abate:</p>
          <div className="grid grid-cols-2 gap-2">
            {(["credito", "saldoDevedor"] as ("credito" | "saldoDevedor")[]).map((t) => (
              <button key={t} onClick={() => setTipoAbatimentoEmbutido(t)}
                className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${tipoAbatimentoEmbutido === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
                {t === "credito" ? "Poder de compra" : "Saldo devedor"}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <button onClick={calcular}
        className="w-full rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]">
        Calcular Saída do Financiamento →
      </button>

      {/* Resultados */}
      {results && (
        <>
          {/* Capital da venda */}
          <Section title="Capital da Venda do Imóvel">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI icon={Home} label="Capital líquido da venda" value={fmtBRL(results.capitalLiquidoVenda)}
                sub="Após pagar banco e custos" variant="primary" />
              <KPI icon={Wallet} label="Lance próprio (da venda)" value={fmtBRL(results.lanceProprioR)}
                sub={`${inputs.percLance}% da carta`} variant="primary" />
              <KPI icon={TrendingUp} label="Capital que sobra" value={fmtBRL(results.sobra)}
                sub="Reserva de caixa após o lance" variant="success" />
            </div>
          </Section>

          {/* Resumo pós-contemplação */}
          <Section title="Resumo Pós-Contemplação">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI icon={Home} label="Crédito disponível" value={fmtBRL(results.creditoLiquido)}
                sub={results.lanceEmbR > 0 ? `Carta − lance embutido ${fmtBRL(results.lanceEmbR)}` : "Carta cheia disponível"}
                variant="success" />
              <KPI icon={Wallet} label="Saldo devedor residual" value={fmtBRL(results.saldoDevedorPosLance)}
                sub="Parcelas restantes a pagar" variant="default" />
              <KPI icon={ArrowRight} label="Prazo restante" value={`${results.prazoPosFinal} meses`}
                sub={inputs.tipoAbatimento === "prazo" ? "Prazo reduzido pelo lance" : "Prazo original mantido"} variant="default" />
            </div>
          </Section>

          {/* Comparativo parcelas */}
          <Section title="Comparativo de Parcelas">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI icon={TrendingDown} label="Parcela atual (banco)" value={fmtBRL(inputs.parcelaAtual)}
                sub="Financiamento restante" variant="danger" />
              <KPI icon={TrendingDown} label="Parcela pós-lance (consórcio)" value={fmtBRL(results.parcelaPosLance)}
                sub="Após contemplação" variant="success" />
              <KPI icon={Wallet} label="Economia mensal" value={fmtBRL(results.economiaParcelaMensal)}
                sub="Por mês após contemplação" variant={results.economiaParcelaMensal > 0 ? "success" : "warning"} />
            </div>
          </Section>

          {/* Custo total */}
          <Section title="Custo Total e Patrimônio Final">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-destructive/8 p-4 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-destructive/70">Manter Financiamento</p>
                <p className="text-lg font-extrabold">{fmtBRL(results.totalRestanteFin)}</p>
                <p className="text-xs text-muted-foreground">Total ainda a pagar ao banco</p>
                <p className="text-sm font-bold mt-2">Patrimônio: {fmtBRL(results.patrimonioFinalFin)}</p>
              </div>
              <div className="rounded-xl bg-success/10 p-4 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-success/70">Migrar para Consórcio</p>
                <p className="text-lg font-extrabold">{fmtBRL(results.totalConsorcio)}</p>
                <p className="text-xs text-muted-foreground">Total desembolsado no consórcio</p>
                <p className="text-sm font-bold mt-2">Patrimônio: {fmtBRL(results.patrimonioFinalCons)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-primary/10 p-4 text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary/70">Vantagem Total ao Migrar para Consórcio</p>
              <p className="text-3xl font-extrabold text-primary mt-1">{fmtBRL(results.economiaTotalCusto)}</p>
              <p className="text-xs text-muted-foreground mt-1">Em custo total vs. manter o financiamento</p>
            </div>
          </Section>

          {/* ── Novo: Custo Total Banco vs Consórcio ─────────────── */}
          <Section title="⚖️ Custo Total: Banco vs Consórcio">
            <div className="h-44 sm:h-56" data-chart="saida-custos">
              <Bar
                data={{
                  labels: ["Manter Financiamento", "Migrar para Consórcio"],
                  datasets: [{
                    label: "Custo Total (R$)",
                    data: [results.totalRestanteFin, results.totalConsorcio],
                    backgroundColor: ["rgba(220,38,38,0.85)", "rgba(26,42,108,0.85)"],
                    borderRadius: 8,
                    borderSkipped: false as const,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c: { raw: unknown }) => fmtBRL(c.raw as number) } },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: { ticks: { callback: (v: unknown) => { const n = Number(v); return n >= 1e6 ? `R$${(n/1e6).toFixed(1)}M` : `R$${(n/1e3).toFixed(0)}k`; } } },
                  },
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-extrabold text-success">
              💰 Você economiza {fmtBRL(results.economiaTotalCusto)} migrando para o consórcio
            </div>
          </Section>

          {/* Gráfico patrimônio */}
          {chartData && (
            <Section title="Evolução Patrimonial">
              <div className="h-56 sm:h-72" data-chart="saida-evolucao">
                <Line data={chartData} options={chartOptions} />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Mês {results.prazoParaImovelCons}: contemplação no consórcio — patrimônio começa a crescer
              </p>
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
function PDFSaidaDoc({ r, inputs, clientName, chartImg, chartCustos, brandLogoUrl, brandColor }: {
  r: SaidaFinanciamentoResults;
  inputs: {
    valorImovelAtual: number;
    saldoDevedor: number;
    parcelaAtual: number;
    prazoRestanteMeses: number;
    cartaConsorcio: number;
    taxaAdmConsorcio: number;
    prazoConsorcio: number;
    percLance: number;
    percLanceEmb?: number;
    mesContemplacaoConsorcio: number;
    valorizacaoAnual: number;
    [key: string]: unknown;
  };
  clientName?: string;
  brandLogoUrl?: string;
  brandColor?: string;
  chartImg?: string | null;
  chartCustos?: string | null;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <RpDoc>
      <RpHeader
        title="Saída do Financiamento"
        subtitle="Migração do Financiamento Bancário para Consórcio — Análise de Viabilidade"
        clientName={clientName}
        date={hoje}
        brandLogoUrl={brandLogoUrl}
        brandColor={brandColor}
      />
      <RpPremises items={[
        ["Valor do imóvel", fmtBRL(inputs.valorImovelAtual)],
        ["Saldo devedor", fmtBRL(inputs.saldoDevedor)],
        ["Parcela atual", fmtBRL(inputs.parcelaAtual)],
        ["Prazo restante", `${inputs.prazoRestanteMeses} meses`],
        ["Carta de crédito", fmtBRL(inputs.cartaConsorcio)],
        ["Taxa de adm.", `${inputs.taxaAdmConsorcio}%`],
        ["Lance próprio", `${inputs.percLance}%`],
        ["Contemplação", `Mês ${inputs.mesContemplacaoConsorcio}`],
      ]} />

      <RpSection title="Resultado da Migracao" description="O que acontece quando voce vende o imovel financiado e migra para o consorcio:">
        <RpMetricRow>
          <RpMetric label="Capital liquido da venda" value={fmtBRL(r.capitalLiquidoVenda)} description="Apos pagar o banco e custos de venda" color={C.navy} />
          <RpMetric label="Parcela pos-lance (consorcio)" value={fmtBRL(r.parcelaPosLance)} description={`vs. financiamento: ${fmtBRL(inputs.parcelaAtual)}`} color={C.green} />
          <RpMetric label="Economia mensal" value={fmtBRL(r.economiaParcelaMensal)} description="Diferenca de parcela por mes apos contemplacao" color={r.economiaParcelaMensal > 0 ? C.green : C.red} />
          <RpMetric label="Vantagem total" value={fmtBRL(r.economiaTotalCusto)} description="Economia total vs. manter o financiamento" color={C.green} />
        </RpMetricRow>
      </RpSection>

      <RpSection title="Resumo Pos-Contemplacao" description="Como o lance é aplicado e o que resta do plano apos a contemplacao:">
        <RpKVList rows={[
          { label: "Lance próprio (capital da venda)", value: fmtBRL(r.lanceProprioR), color: C.navy },
          { label: "Lance embutido aplicado (sai do crédito)", value: fmtBRL(r.lanceEmbR), color: C.amber },
          { label: "Crédito líquido disponível", value: fmtBRL(r.creditoLiquido), color: C.green },
          { label: "Saldo devedor pós-lance", value: fmtBRL(r.saldoDevedorPosLance), color: C.navy },
          { label: "Prazo restante após contemplação", value: `${r.prazoPosFinal} meses` },
          { label: "Parcela pós-lance", value: fmtBRL(r.parcelaPosLance), color: C.green },
        ]} />
      </RpSection>

      <RpChartImage src={chartCustos} title="Custo Total: Banco vs Consórcio" height={100} />
      <RpChartImage src={chartImg} title="Evolucao Patrimonial" height={120} />

      <RpInsight
        emoji="🔄"
        title="Por que sair do financiamento?"
        body={`Voce vende o imovel financiado, quita o banco (${fmtBRL(inputs.saldoDevedor)}), e usa o capital liquido de ${fmtBRL(r.capitalLiquidoVenda)} como lance no consorcio. A partir da contemplacao no mes ${inputs.mesContemplacaoConsorcio}, sua parcela cai de ${fmtBRL(inputs.parcelaAtual)} para ${fmtBRL(r.parcelaPosLance)} — economizando ${fmtBRL(r.economiaParcelaMensal)}/mes. No total, a operacao economiza ${fmtBRL(r.economiaTotalCusto)} comparado a manter o financiamento.`}
        variant="primary"
      />

      <RpSection title="Comparativo: Financiamento vs. Consorcio" description="Dois caminhos, resultados completamente diferentes:">
        <RpKVList rows={[
          { label: "Parcela atual — financiamento", value: fmtBRL(inputs.parcelaAtual), color: C.red },
          { label: "Parcela pós-lance — consórcio", value: fmtBRL(r.parcelaPosLance), color: C.green },
          { label: "Economia mensal de parcela", value: fmtBRL(r.economiaParcelaMensal), color: C.green },
          { label: "Total a pagar — financiamento", value: fmtBRL(r.totalRestanteFin), color: C.red },
          { label: "Total — consórcio", value: fmtBRL(r.totalConsorcio), color: C.navy },
          { label: "Vantagem total do consórcio", value: fmtBRL(r.economiaTotalCusto), color: C.green },
          { label: "Patrimônio final — financiamento", value: fmtBRL(r.patrimonioFinalFin), color: C.navy },
          { label: "Patrimônio final — consórcio", value: fmtBRL(r.patrimonioFinalCons), color: C.green },
          { label: "Capital que sobra após o lance", value: fmtBRL(r.sobra), color: C.navy },
          { label: "Crédito disponível após contemplação", value: fmtBRL(r.creditoLiquido), color: C.green },
        ]} />
      </RpSection>

      <RpFooter />
    </RpDoc>
  );
}
