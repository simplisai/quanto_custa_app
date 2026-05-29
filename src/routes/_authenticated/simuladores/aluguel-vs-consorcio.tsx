import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import {
  calcAluguelVsConsorcio,
  defaultAluguelInputs,
  type AluguelInputs,
  type AluguelResults,
} from "@/lib/calc-aluguel-vs-consorcio";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { ArrowLeft, Home, TrendingUp, Scale, Clock, BookOpen } from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { RpDoc, RpHeader, RpSection, RpMetric, RpInsight, RpPremises, RpKVList, RpFooter, RpMetricRow, C } from "@/components/RpShell";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Route = createFileRoute("/_authenticated/simuladores/aluguel-vs-consorcio")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: AluguelVsConsorcioPage,
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

function AluguelVsConsorcioPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
    () => results ? <PDFAluguelDoc r={results} inputs={inputs} clientName={clients.find((c) => c.id === selectedClientId)?.name} /> : null,
    "Aluguel_vs_Consorcio.pdf",
  );

  const [aluguel, setAluguel] = useState(maskMoney(String(defaultAluguelInputs.aluguelAtual * 100)));
  const [reajuste, setReajuste] = useState(maskPercent(String(defaultAluguelInputs.reajusteAluguelAnual * 100)));
  const [horizonte, setHorizonte] = useState(String(defaultAluguelInputs.horizonte));
  const [carta, setCarta] = useState(maskMoney(String(defaultAluguelInputs.cartaCredito * 100)));
  const [taxaAdm, setTaxaAdm] = useState(maskPercent(String(defaultAluguelInputs.taxaAdmTotal * 100)));
  const [prazo, setPrazo] = useState(String(defaultAluguelInputs.prazoMeses));
  const [percLance, setPercLance] = useState(String(defaultAluguelInputs.percLance));
  const [lanceProprioR, setLanceProprioR] = useState(maskMoney("0"));
  const [mesContemp, setMesContemp] = useState(String(defaultAluguelInputs.mesContemplacao));
  const [valorizacao, setValorizacao] = useState(maskPercent(String(defaultAluguelInputs.valorizacaoAnual * 100)));
  const [taxaAtualiz, setTaxaAtualiz] = useState(String(defaultAluguelInputs.taxaAtualizacaoAnual));

  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<AluguelResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ── Restore sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("avc-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.aluguel) setAluguel(s.aluguel);
      if (s.reajuste) setReajuste(s.reajuste);
      if (s.horizonte) setHorizonte(s.horizonte);
      if (s.carta) setCarta(s.carta);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.prazo) setPrazo(s.prazo);
      if (s.percLance) setPercLance(s.percLance);
      if (s.lanceProprioR) setLanceProprioR(s.lanceProprioR);
      if (s.mesContemp) setMesContemp(s.mesContemp);
      if (s.valorizacao) setValorizacao(s.valorizacao);
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
        if (inp.aluguelAtual) setAluguel(maskMoney(String(Math.round((inp.aluguelAtual as number) * 100))));
        if (inp.reajusteAluguelAnual) setReajuste(maskPercent(String(Math.round((inp.reajusteAluguelAnual as number) * 100))));
        if (inp.horizonte) setHorizonte(String(inp.horizonte));
        if (inp.cartaCredito) setCarta(maskMoney(String(Math.round((inp.cartaCredito as number) * 100))));
        if (inp.taxaAdmTotal) setTaxaAdm(maskPercent(String(Math.round((inp.taxaAdmTotal as number) * 100))));
        if (inp.prazoMeses) setPrazo(String(inp.prazoMeses));
        if (inp.percLance !== undefined) setPercLance(String(inp.percLance));
        if (inp.lanceProprioR) setLanceProprioR(maskMoney(String(Math.round((inp.lanceProprioR as number) * 100))));
        if (inp.mesContemplacao) setMesContemp(String(inp.mesContemplacao));
        if (inp.valorizacaoAnual) setValorizacao(maskPercent(String(Math.round((inp.valorizacaoAnual as number) * 100))));
        if (data.client_id) setSelectedClientId(data.client_id);
        toast.success("Simulação carregada.");
      });
  }, [search.load, user]);

  const inputs: AluguelInputs = useMemo(() => ({
    aluguelAtual: unmask(aluguel),
    reajusteAluguelAnual: unmask(reajuste),
    horizonte: parseInt(horizonte || "0", 10) || 1,
    cartaCredito: unmask(carta),
    taxaAdmTotal: unmask(taxaAdm),
    prazoMeses: parseInt(prazo || "0", 10) || 1,
    percLance: parseInt(percLance || "0", 10) || 0,
    lanceProprioR: unmask(lanceProprioR),
    mesContemplacao: parseInt(mesContemp || "0", 10) || 1,
    valorizacaoAnual: unmask(valorizacao),
    taxaAtualizacaoAnual: parseFloat(taxaAtualiz || "0") || 0,
  }), [aluguel, reajuste, horizonte, carta, taxaAdm, prazo, percLance, lanceProprioR, mesContemp, valorizacao, taxaAtualiz]);

  const calcular = () => {
    setResults(calcAluguelVsConsorcio(inputs));
    setSavedId(null);
    sessionStorage.setItem("avc-inputs", JSON.stringify({
      aluguel, reajuste, horizonte, carta, taxaAdm, prazo,
      percLance, lanceProprioR, mesContemp, valorizacao, taxaAtualiz,
    }));
  };

  const applyTemplate = (p: TemplatePayload) => {
    if (p.aluguelAtual) setAluguel(p.aluguelAtual);
    if (p.reajusteAluguelAnual) setReajuste(p.reajusteAluguelAnual);
    if (p.horizonte) setHorizonte(p.horizonte);
    if (p.cartaCredito) setCarta(p.cartaCredito);
    if (p.taxaAdmTotal) setTaxaAdm(p.taxaAdmTotal);
    if (p.prazoMeses) setPrazo(p.prazoMeses);
    if (p.percLance) setPercLance(p.percLance);
    if (p.lanceProprioR) setLanceProprioR(p.lanceProprioR);
    if (p.mesContemplacao) setMesContemp(p.mesContemplacao);
    if (p.valorizacaoAnual) setValorizacao(p.valorizacaoAnual);
    setResults(null);
    setSavedId(null);
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Aluguel vs Consórcio ${fmtBRL(inputs.cartaCredito)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          totalAluguel: results.totalAluguel,
          totalConsorcio: results.totalConsorcio,
          valorImovelFinal: results.valorImovelFinal,
          vantagemPatrimonial: results.vantagemPatrimonial,
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
            <TemplatePicker operationSlug="aluguel-vs-consorcio" onApply={applyTemplate} />
            <Link to="/simuladores/estrategia/$slug" params={{ slug: "aluguel-vs-consorcio" }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition-colors">
              <BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Estratégia</span>
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">⚖️ Aluguel vs Consórcio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mostre ao cliente quanto dinheiro está indo embora no aluguel — e o patrimônio que poderia estar construindo.
        </p>
      </header>

      <Section title="Cenário do Aluguel">
        <Grid2>
          <NumInput label="Aluguel Atual (R$/mês)" value={aluguel} onChange={setAluguel} type="money" />
          <NumInput label="Reajuste Anual do Aluguel (%)" value={reajuste} onChange={setReajuste} type="percent" hint="IGPM ou IPCA estimado" />
        </Grid2>
        <NumInput label="Horizonte de Análise (anos)" value={horizonte} onChange={setHorizonte} type="int" hint="Padrão: 20 anos" />
      </Section>

      <Section title="Estratégia com Consórcio">
        <Grid2>
          <NumInput label="Carta de Crédito (R$)" value={carta} onChange={setCarta} type="money" />
          <NumInput label="Taxa de Administração Total (%)" value={taxaAdm} onChange={setTaxaAdm} type="percent" />
        </Grid2>
        <Grid2>
          <NumInput label="Prazo do Grupo (meses)" value={prazo} onChange={setPrazo} type="int" />
          <NumInput label="Mês de Contemplação estimado" value={mesContemp} onChange={setMesContemp} type="int" hint="Com lance" />
        </Grid2>
        <Grid2>
          <NumInput label="Lance (% da carta)" value={percLance} onChange={setPercLance} type="int" />
          <NumInput label="Lance em Recursos Próprios (R$)" value={lanceProprioR} onChange={setLanceProprioR} type="money" />
        </Grid2>
      </Section>

      <Section title="Premissas de Valorização" accent>
        <Grid2>
          <NumInput label="Valorização Anual do Imóvel (%)" value={valorizacao} onChange={setValorizacao} type="percent" hint="Média histórica: 5-8% a.a." />
          <NumInput label="Correção da Carta (INCC % a.a.)" value={taxaAtualiz} onChange={setTaxaAtualiz} type="int" hint="Atualização anual da carta pelo INCC — padrão 4%" />
        </Grid2>
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
            Comparar Cenários
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

      {results && <ResultsAluguel r={results} inputs={inputs} />}

    </div>
  );
}

function ResultsAluguel({ r, inputs }: { r: AluguelResults; inputs: AluguelInputs }) {
  // Amostrar timeline (a cada 6 meses ou a cada 12 meses se longo)
  const step = inputs.horizonte > 10 ? 12 : 6;
  const sampled = r.timeline.filter((d, i) => i % step === 0 || i === r.timeline.length - 1);

  const lineData = {
    labels: sampled.map((d) => `M${d.mes}`),
    datasets: [
      {
        label: "Total Aluguel Pago",
        data: sampled.map((d) => d.aluguelAcum),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.1)",
        fill: true,
        pointRadius: 0,
        borderWidth: 2.5,
        tension: 0.3,
      },
      {
        label: "Patrimônio Consórcio",
        data: sampled.map((d) => d.patrimonioConsorcio),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.1)",
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
    animation: { duration: 500 },
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
      {/* ── Headline impactante ──────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-danger/30 bg-danger/5 p-4 sm:p-5">
        <p className="text-base sm:text-lg font-extrabold text-danger">
          Em {inputs.horizonte} anos pagando aluguel: <span className="underline">{fmtBRL(r.totalAluguel)}</span> pagos. Patrimônio: <span className="underline">R$ 0,00</span>.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          No consórcio: imóvel valorizado em {fmtBRL(r.valorImovelFinal)} + custo total de {fmtBRL(r.totalConsorcio)}.
        </p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Scale} label={`Total no aluguel (${inputs.horizonte} anos)`} value={fmtBRL(r.totalAluguel)} sub="Patrimônio gerado: R$ 0" variant="danger" />
        <KPI icon={Home} label="Total no consórcio" value={fmtBRL(r.totalConsorcio)} sub="Inclui parcelas + lance" variant="primary" />
        <KPI icon={TrendingUp} label="Imóvel no futuro" value={fmtBRL(r.valorImovelFinal)} sub={`+${inputs.valorizacaoAnual}% ao ano`} variant="success" />
        <KPI icon={Clock} label="Ponto de virada" value={r.breakEvenMes ? `Mês ${r.breakEvenMes}` : "N/A"} sub="Patrimônio supera custo aluguel" variant="warning" />
      </div>

      {/* ── Gráfico de área ──────────────────────────────────────────── */}
      <Section title="Evolução: Aluguel Acumulado vs. Patrimônio no Consórcio">
        <div className="h-52 sm:h-72 w-full">
          <Line data={lineData} options={lineOptions} />
        </div>
        {r.breakEvenMes && (
          <p className="text-xs text-muted-foreground">
            📍 No mês <strong>{r.breakEvenMes}</strong> o patrimônio do consórcio supera o total pago de aluguel — é o ponto de virada.
          </p>
        )}
      </Section>

      {/* ── Tabela comparativa ───────────────────────────────────────── */}
      <Section title="Comparativo Financeiro Detalhado">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Item</th>
                <th className="py-2 px-4 text-right text-xs font-extrabold uppercase tracking-wider text-danger">Aluguel</th>
                <th className="py-2 px-4 text-right text-xs font-extrabold uppercase tracking-wider text-primary">Consórcio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Desembolso mensal inicial", fmtBRL(inputs.aluguelAtual), fmtBRL(r.parcelaPadrao)],
                ["Parcela após contemplação", "Reajusta todo ano", fmtBRL(r.parcelaPosLance)],
                [`Total em ${inputs.horizonte} anos`, fmtBRL(r.totalAluguel), fmtBRL(r.totalConsorcio)],
                ["Patrimônio gerado", fmtBRL(0), fmtBRL(r.valorImovelFinal)],
                ["Imóvel ao final", "Não tem", fmtBRL(r.valorImovelFinal)],
              ].map(([label, aluguelVal, consVal]) => (
                <tr key={label} className="hover:bg-muted/30">
                  <td className="py-2.5 px-4 text-foreground/70">{label}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-danger">{aluguelVal}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-primary">{consVal}</td>
                </tr>
              ))}
              <tr className="bg-success/5">
                <td className="py-2.5 px-4 font-extrabold text-success">🏆 Vantagem Patrimonial</td>
                <td className="py-2.5 px-4" />
                <td className="py-2.5 px-4 text-right font-extrabold text-success">{fmtBRL(r.vantagemPatrimonial)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function PDFAluguelDoc({ r, inputs, clientName }: {
  r: AluguelResults; inputs: AluguelInputs; clientName?: string;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const anosHorizonte = inputs.horizonte;

  return (
    <RpDoc>
      <RpHeader
        title="Aluguel vs. Consórcio"
        subtitle="Analise Patrimonial — O Custo Real de Continuar Alugando"
        clientName={clientName}
        date={hoje}
      />
      <RpPremises items={[
        ["Aluguel atual", fmtBRL(inputs.aluguelAtual)],
        ["Reajuste anual", `${inputs.reajusteAluguelAnual}%`],
        ["Horizonte de análise", `${anosHorizonte} anos`],
        ["Carta de crédito", fmtBRL(inputs.cartaCredito)],
        ["Taxa de adm.", `${inputs.taxaAdmTotal}%`],
        ["Prazo do grupo", `${inputs.prazoMeses} meses`],
        ["Lance ofertado", `${inputs.percLance}%`],
        ["Contempl. prevista", `Mês ${inputs.mesContemplacao}`],
      ]} />

      <RpSection title="O Veredicto em Números" description="Em exatamente o mesmo periodo de tempo — pagando aluguel ou construindo patrimonio:">
        <RpMetricRow>
          <RpMetric label={`Total gasto no aluguel (${anosHorizonte} anos)`} value={fmtBRL(r.totalAluguel)} description="Valor desembolsado sem gerar nenhum ativo. Patrimonio final: R$ 0,00." color={C.red} />
          <RpMetric label="Total pago no consorcio" value={fmtBRL(r.totalConsorcio)} description={`Incluindo parcelas e lance. Patrimonio final: ${fmtBRL(r.valorImovelFinal)}`} color={C.navy} />
          <RpMetric label="Diferenca patrimonial" value={fmtBRL(r.vantagemPatrimonial)} description="Vantagem real de escolher o consorcio em vez de continuar alugando" color={C.green} />
        </RpMetricRow>
      </RpSection>

      <RpInsight
        emoji="🏠"
        title={`Em ${anosHorizonte} anos de aluguel: ${fmtBRL(r.totalAluguel)} pagos. Patrimônio: R$ 0,00.`}
        body={`Cada mes de aluguel pago e dinheiro que vai embora — sem construir ativo, sem valorizacao, sem heranca. No mesmo periodo, com o consorcio, voce paga ${fmtBRL(r.totalConsorcio)} e tem um imovel avaliado em ${fmtBRL(r.valorImovelFinal)}. A diferenca patrimonial e de ${fmtBRL(r.vantagemPatrimonial)}. Nao e uma questao de opiniao — e matematica.`}
        variant="primary"
      />

      <RpSection title="Analise Mes a Mes" description="Como a decisao impacta seu patrimonio ao longo do tempo:">
        <RpKVList rows={[
          { label: "Aluguel atual (mês 1)", value: fmtBRL(inputs.aluguelAtual) },
          { label: `Aluguel projetado (mês ${anosHorizonte * 12})`, value: fmtBRL(inputs.aluguelAtual * Math.pow(1 + inputs.reajusteAluguelAnual / 100, anosHorizonte)), color: C.red },
          { label: "Parcela do consórcio (pré-contempl.)", value: fmtBRL(r.parcelaPadrao) },
          { label: "Contemplação prevista", value: `Mês ${inputs.mesContemplacao}`, color: C.navy },
          { label: "Parcela após contemplação (pós-lance)", value: fmtBRL(r.parcelaPosLance) },
          { label: "Valor do imóvel hoje", value: fmtBRL(inputs.cartaCredito), color: C.navy },
          { label: `Valor do imóvel em ${anosHorizonte} anos (valoriz. ${inputs.valorizacaoAnual}% a.a.)`, value: fmtBRL(r.valorImovelFinal), color: C.green },
          { label: "Riqueza acumulada com aluguel", value: "R$ 0,00", color: C.red },
          { label: "Patrimônio acumulado com consórcio", value: fmtBRL(r.vantagemPatrimonial), color: C.green },
        ]} />
      </RpSection>

      <RpInsight
        emoji="📊"
        title="O aluguel certo vs. o imóvel certo"
        body={`Voce paga aluguel porque parece mais seguro — mas a certeza do aluguel e a certeza de nao ter patrimônio. O consorcio tem uma incerteza de timing, mas a certeza do resultado: ao final de ${anosHorizonte} anos, voce tem um imovel. Com aluguel, voce tem o recibo do ultimo mes.`}
        variant="warning"
      />

      <RpFooter note="Valores do aluguel projetados com reajuste composto anual. Valor do imovel projetado com valorizacao anual. Resultados reais podem variar conforme condições de mercado." />
    </RpDoc>
  );
}
