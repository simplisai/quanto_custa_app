import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import {
  calcSaidaFinanciamento,
  defaultSaidaInputs,
  type SaidaFinanciamentoResults,
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
      <div className="text-xl sm:text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function SaidaFinanciamentoPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const reportRef = useRef<HTMLDivElement>(null);

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
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultSaidaInputs.mesContemplacaoConsorcio));

  // Premissas
  const [valorizacao, setValorizacao] = useState(maskPercent(String(defaultSaidaInputs.valorizacaoAnual * 100)));
  const [custosVenda, setCustosVenda] = useState(maskPercent(String(defaultSaidaInputs.custosVenda * 100)));

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<SaidaFinanciamentoResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("clients").select("id, name").eq("user_id", user.id).order("name")
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
    mesContemplacaoConsorcio: parseInt(mesContemplacao || "0", 10) || 0,
    valorizacaoAnual: unmask(valorizacao),
    custosVenda: unmask(custosVenda),
  }), [valorImovel, saldoDevedor, parcelaAtual, prazoRestante, taxaJuros, cartaConsorcio, taxaAdm, prazoConsorcio, percLance, mesContemplacao, valorizacao, custosVenda]);

  const calcular = () => { setResults(calcSaidaFinanciamento(inputs)); setSavedId(null); };

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

  const exportPDF = async () => {
    if (!reportRef.current) return;
    await html2pdf().set({
      margin: 8, filename: "saida-financiamento.pdf",
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(reportRef.current).save();
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
          <NumInput label="Lance ofertado (%)" value={percLance} onChange={setPercLance} type="int" hint="% da carta usado como lance" />
          <NumInput label="Mês de contemplação" value={mesContemplacao} onChange={setMesContemplacao} type="int" />
          <NumInput label="Valorização anual (%)" value={valorizacao} onChange={setValorizacao} type="percent" />
        </Grid2>
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
              <KPI icon={Wallet} label="Lance no consórcio" value={fmtBRL(results.lanceEmReaisConsorcio)}
                sub={`${inputs.percLance}% da carta`} variant="primary" />
              <KPI icon={TrendingUp} label="Capital que sobra" value={fmtBRL(results.sobra)}
                sub="Reserva de caixa" variant="success" />
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

          {/* Gráfico patrimônio */}
          {chartData && (
            <Section title="Evolução Patrimonial">
              <div className="h-56 sm:h-72">
                <Line data={chartData} options={chartOptions} />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Mês {results.prazoParaImovelCons}: contemplação no consórcio — patrimônio começa a crescer
              </p>
            </Section>
          )}

          {/* Ações */}
          <div className="flex gap-3">
            <button onClick={salvar} disabled={saving || !!savedId}
              className="flex-1 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent disabled:opacity-50">
              {saving ? "Salvando…" : savedId ? "✓ Salvo" : "Salvar Simulação"}
            </button>
            <button onClick={exportPDF}
              className="flex-1 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90">
              Exportar PDF
            </button>
          </div>
          {savedId && (
            <Link to="/historico" className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold">
              Ver no histórico <ArrowRight className="h-3 w-3" />
            </Link>
          )}

          {/* Relatório oculto para PDF */}
          <div ref={reportRef} style={{ position: "absolute", left: "-9999px", top: 0, width: "800px", padding: "32px", background: "#fff", color: "#111", fontFamily: "sans-serif" }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🔴 Saída do Financiamento</h1>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 24 }}>Simulação de migração do financiamento bancário para consórcio</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {[
                  ["Capital líquido da venda", fmtBRL(results.capitalLiquidoVenda)],
                  ["Lance no consórcio", fmtBRL(results.lanceEmReaisConsorcio)],
                  ["Capital restante (sobra)", fmtBRL(results.sobra)],
                  ["Parcela atual — financiamento", fmtBRL(inputs.parcelaAtual)],
                  ["Parcela pós-lance — consórcio", fmtBRL(results.parcelaPosLance)],
                  ["Economia mensal", fmtBRL(results.economiaParcelaMensal)],
                  ["Total restante financiamento", fmtBRL(results.totalRestanteFin)],
                  ["Total consórcio", fmtBRL(results.totalConsorcio)],
                  ["Economia total", fmtBRL(results.economiaTotalCusto)],
                  ["Patrimônio final — financiamento", fmtBRL(results.patrimonioFinalFin)],
                  ["Patrimônio final — consórcio", fmtBRL(results.patrimonioFinalCons)],
                ].map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 8px", color: "#555" }}>{l}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
