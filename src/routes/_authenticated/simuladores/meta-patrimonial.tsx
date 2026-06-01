import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import {
  calcMetaPatrimonial,
  defaultMetaInputs,
  type MetaPatrimonialResults,
  type ModoMeta,
  type RegimeTributario,
} from "@/lib/calc-meta-patrimonial";
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
  ArrowLeft, ArrowRight, BookOpen, Trophy, Coins, TrendingUp, Building2, Percent,
} from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";
import { RpDoc, RpHeader, RpSection, RpMetric, RpInsight, RpPremises, RpKVList, RpFooter, RpMetricRow, RpChartImage, C } from "@/components/RpShell";
import { captureChart } from "@/lib/capture-charts";
import { View as RpView, Text as RpText } from "@react-pdf/renderer";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const Route = createFileRoute("/_authenticated/simuladores/meta-patrimonial")({
  validateSearch: (s: Record<string, unknown>) => ({
    load: typeof s.load === "string" ? s.load : undefined,
    client: typeof s.client === "string" ? s.client : undefined,
  }),
  component: MetaPatrimonialPage,
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
  variant?: "default" | "success" | "primary" | "warning";
}) {
  const colors: Record<string, string> = {
    default: "bg-muted/40 text-foreground",
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning-foreground",
  };
  const iconColors: Record<string, string> = {
    default: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning-foreground",
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${colors[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconColors[variant]}`} />
        <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 leading-tight">{label}</span>
      </div>
      <div className="text-base sm:text-lg font-extrabold break-words min-w-0 leading-snug">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60 break-words">{sub}</div>}
    </div>
  );
}

function MetaPatrimonialPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const brand = useBrandSettings();
  const { exportPDF, shareWhatsApp, isExporting } = usePdfExport(
    () => results ? <PDFMetaDoc
      r={results} inputs={inputs}
      clientName={clients.find((c) => c.id === selectedClientId)?.name}
      chartImg={captureChart("meta-cotas")}
      chartMeta={captureChart("meta-progresso")}
    
      brandLogoUrl={brand.isCustomLogo ? brand.logoUrl : undefined}
      brandColor={brand.isCustomColor ? brand.color : undefined}
    /> : null,
    "meta-patrimonial.pdf",
  );

  const [modo, setModo] = useState<ModoMeta>("patrimonio");
  const [patrimonioAlvo, setPatrimonioAlvo] = useState(maskMoney(String(defaultMetaInputs.patrimonioAlvoR * 100)));
  const [rendaAlvo, setRendaAlvo] = useState(maskMoney(String(defaultMetaInputs.rendaMensalAlvoR * 100)));
  const [yieldAluguel, setYieldAluguel] = useState(maskPercent(String(defaultMetaInputs.yeildAluguelPerc * 100)));
  const [horizonteAnos, setHorizonteAnos] = useState(String(defaultMetaInputs.horizonteAnos));
  const [valorizacao, setValorizacao] = useState(maskPercent(String(defaultMetaInputs.valorizacaoAnual * 100)));
  const [cdi, setCdi] = useState(maskPercent(String(defaultMetaInputs.cdiAnual * 100)));
  const [taxaAdm, setTaxaAdm] = useState(maskPercent(String(defaultMetaInputs.taxaAdmConsorcio * 100)));
  const [prazoConsorcio, setPrazoConsorcio] = useState(String(defaultMetaInputs.prazoConsorcio));
  const [percLance, setPercLance] = useState(String(defaultMetaInputs.percLance));
  const [percLanceEmb, setPercLanceEmb] = useState(String(defaultMetaInputs.percLanceEmb));
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultMetaInputs.mesContemplacaoPrimeira));
  const [intervaloCotasMeses, setIntervaloCotasMeses] = useState(String(defaultMetaInputs.intervaloCotasMeses));
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>(defaultMetaInputs.regimeTributario);
  const [aliquotaEfetiva, setAliquotaEfetiva] = useState(String(defaultMetaInputs.aliquotaEfetiva));

  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<MetaPatrimonialResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Restore inputs from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("mp-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.modo) setModo(s.modo);
      if (s.patrimonioAlvo) setPatrimonioAlvo(s.patrimonioAlvo);
      if (s.rendaAlvo) setRendaAlvo(s.rendaAlvo);
      if (s.yieldAluguel) setYieldAluguel(s.yieldAluguel);
      if (s.horizonteAnos) setHorizonteAnos(s.horizonteAnos);
      if (s.valorizacao) setValorizacao(s.valorizacao);
      if (s.cdi) setCdi(s.cdi);
      if (s.taxaAdm) setTaxaAdm(s.taxaAdm);
      if (s.prazoConsorcio) setPrazoConsorcio(s.prazoConsorcio);
      if (s.percLance) setPercLance(s.percLance);
      if (s.percLanceEmb) setPercLanceEmb(s.percLanceEmb);
      if (s.mesContemplacao) setMesContemplacao(s.mesContemplacao);
      if (s.intervaloCotasMeses) setIntervaloCotasMeses(s.intervaloCotasMeses);
      if (s.regimeTributario) setRegimeTributario(s.regimeTributario);
      if (s.aliquotaEfetiva) setAliquotaEfetiva(s.aliquotaEfetiva);
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
    modo,
    patrimonioAlvoR: unmask(patrimonioAlvo),
    rendaMensalAlvoR: unmask(rendaAlvo),
    yeildAluguelPerc: unmask(yieldAluguel),
    horizonteAnos: parseInt(horizonteAnos || "0", 10) || 0,
    valorizacaoAnual: unmask(valorizacao),
    cdiAnual: unmask(cdi),
    taxaAdmConsorcio: unmask(taxaAdm),
    prazoConsorcio: parseInt(prazoConsorcio || "0", 10) || 0,
    percLance: parseInt(percLance || "0", 10) || 0,
    percLanceEmb: parseInt(percLanceEmb || "0", 10) || 0,
    mesContemplacaoPrimeira: parseInt(mesContemplacao || "0", 10) || 0,
    intervaloCotasMeses: parseInt(intervaloCotasMeses || "0", 10) || 0,
    regimeTributario,
    aliquotaEfetiva: parseFloat(aliquotaEfetiva || "0") || 0,
  }), [modo, patrimonioAlvo, rendaAlvo, yieldAluguel, horizonteAnos, valorizacao, cdi, taxaAdm, prazoConsorcio, percLance, percLanceEmb, mesContemplacao, intervaloCotasMeses, regimeTributario, aliquotaEfetiva]);

  const calcular = () => {
    setResults(calcMetaPatrimonial(inputs));
    setSavedId(null);
    sessionStorage.setItem("mp-inputs", JSON.stringify({
      modo, patrimonioAlvo, rendaAlvo, yieldAluguel, horizonteAnos,
      valorizacao, cdi, taxaAdm, prazoConsorcio, percLance, percLanceEmb,
      mesContemplacao, intervaloCotasMeses, regimeTributario, aliquotaEfetiva,
    }));
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Meta Patrimonial ${fmtBRL(results.patrimonioTotalFinal)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id, client_id: selectedClientId || null, title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          numCotas: results.numCotas,
          patrimonioTotalFinal: results.patrimonioTotalFinal,
          investimentoMensalTotal: results.investimentoMensalTotal,
          rendaMensalFinalR: results.rendaMensalFinalR,
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
    if (p.modo) setModo(p.modo as ModoMeta);
    if (p.patrimonioAlvoR) setPatrimonioAlvo(p.patrimonioAlvoR);
    if (p.rendaMensalAlvoR) setRendaAlvo(p.rendaMensalAlvoR);
    if (p.yeildAluguelPerc) setYieldAluguel(p.yeildAluguelPerc);
    if (p.horizonteAnos) setHorizonteAnos(p.horizonteAnos);
    if (p.valorizacaoAnual) setValorizacao(p.valorizacaoAnual);
    if (p.cdiAnual) setCdi(p.cdiAnual);
    if (p.taxaAdmConsorcio) setTaxaAdm(p.taxaAdmConsorcio);
    if (p.prazoConsorcio) setPrazoConsorcio(p.prazoConsorcio);
    if (p.percLance) setPercLance(p.percLance);
    if (p.mesContemplacaoPrimeira) setMesContemplacao(p.mesContemplacaoPrimeira);
    if (p.intervaloCotasMeses) setIntervaloCotasMeses(p.intervaloCotasMeses);
    setResults(null); setSavedId(null);
  };

  const chartData = useMemo(() => {
    if (!results || results.cotas.length === 0) return null;
    return {
      labels: results.cotas.map((c) => `Cota ${c.numero}`),
      datasets: [
        {
          label: "Valor da Carta (R$)",
          data: results.cotas.map((c) => c.valorCarta),
          backgroundColor: "rgba(99,102,241,0.7)",
        },
        {
          label: "Valor Final do Imóvel (R$)",
          data: results.cotas.map((c) => c.valorImovelFinal),
          backgroundColor: "rgba(34,197,94,0.7)",
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
          <h1 className="text-xl font-extrabold tracking-tight leading-tight">🏆 Meta Patrimonial</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Cálculo reverso · quantas cotas para chegar onde quer</p>
        </div>
        <TemplatePicker operationSlug="meta-patrimonial" onApply={applyTemplate} />
        <Link to="/simuladores/estrategia/$slug" params={{ slug: "meta-patrimonial" }}
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

      {/* Modo */}
      <Section title="Tipo de Meta">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setModo("patrimonio")}
            className={`rounded-xl py-3 text-sm font-bold transition-colors ${modo === "patrimonio" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
            🏠 Patrimônio (R$)
          </button>
          <button onClick={() => setModo("renda")}
            className={`rounded-xl py-3 text-sm font-bold transition-colors ${modo === "renda" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
            💸 Renda Passiva (R$/mês)
          </button>
        </div>
      </Section>

      {/* Meta */}
      <Section title={modo === "patrimonio" ? "Meta de Patrimônio" : "Meta de Renda Passiva"}>
        <Grid2>
          {modo === "patrimonio"
            ? <NumInput label="Patrimônio imobiliário desejado (R$)" value={patrimonioAlvo} onChange={setPatrimonioAlvo} type="money" />
            : <NumInput label="Renda passiva mensal desejada (R$)" value={rendaAlvo} onChange={setRendaAlvo} type="money" />
          }
          <NumInput label="Yield de aluguel esperado (% a.m.)" value={yieldAluguel} onChange={setYieldAluguel} type="percent" hint="Renda mensal / valor do imóvel (tipicamente 0,4%–0,6%)" />
          <NumInput label="Horizonte (anos)" value={horizonteAnos} onChange={setHorizonteAnos} type="int" />
          <NumInput label="Valorização anual dos imóveis (%)" value={valorizacao} onChange={setValorizacao} type="percent" />
          <NumInput label="CDI anual (%) para comparação" value={cdi} onChange={setCdi} type="percent" />
        </Grid2>
      </Section>

      <Section title="Parâmetros do Consórcio">
        <Grid2>
          <NumInput label="Taxa de administração (%)" value={taxaAdm} onChange={setTaxaAdm} type="percent" />
          <NumInput label="Prazo do grupo (meses)" value={prazoConsorcio} onChange={setPrazoConsorcio} type="int" />
          <NumInput label="Lance próprio médio (%)" value={percLance} onChange={setPercLance} type="int" hint="% da carta pago do bolso" />
          <NumInput label="Lance embutido médio (%)" value={percLanceEmb} onChange={setPercLanceEmb} type="int" hint="% da carta como embutido — reduz crédito, não é desembolso real" />
          <NumInput label="Mês da 1ª contemplação" value={mesContemplacao} onChange={setMesContemplacao} type="int" />
          <NumInput label="Intervalo entre contemplações (meses)" value={intervaloCotasMeses} onChange={setIntervaloCotasMeses} type="int" hint="Espaço entre contemplação de cada cota" />
        </Grid2>
      </Section>

      <Section title="Benefício Fiscal (PJ — opcional)">
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground/70">Regime tributário</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { value: "nenhum", label: "Nenhum / PF" },
              { value: "simples", label: "Simples" },
              { value: "presumido", label: "Presumido" },
              { value: "real", label: "Lucro Real" },
            ] as { value: RegimeTributario; label: string }[]).map((r) => (
              <button key={r.value}
                onClick={() => {
                  setRegimeTributario(r.value);
                  const aliq = r.value === "presumido" ? "13,33" : r.value === "real" ? "34" : "0";
                  setAliquotaEfetiva(aliq);
                }}
                className={`rounded-xl py-2.5 text-xs font-bold transition-colors ${regimeTributario === r.value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {regimeTributario !== "nenhum" && (
          <NumInput label="Alíquota efetiva (%)" value={aliquotaEfetiva} onChange={setAliquotaEfetiva} type="percent"
            hint="% do imposto que incidiria sobre as parcelas — editável conforme situação real" />
        )}
      </Section>

      <button onClick={calcular}
        className="w-full rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]">
        Calcular Plano Patrimonial →
      </button>

      {results && (
        <>
          {/* KPIs principais */}
          <Section title="Resultado do Plano">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KPI icon={Building2} label="Nº de cotas necessárias" value={`${results.numCotas} cotas`} variant="primary" />
              <KPI icon={Trophy} label="Patrimônio total final" value={fmtBRL(results.patrimonioTotalFinal)}
                sub={`Meta: ${fmtBRL(modo === "renda" ? (unmask(yieldAluguel) > 0 ? unmask(rendaAlvo) / (unmask(yieldAluguel) / 100) : 0) : unmask(patrimonioAlvo))}`}
                variant={results.metaAtingida ? "success" : "warning"} />
              <KPI icon={Coins} label="Renda passiva mensal" value={fmtBRL(results.rendaMensalFinalR)} variant="success" />
              <KPI icon={TrendingUp} label="Invest. mensal total (pico)" value={fmtBRL(results.investimentoMensalTotal)} variant="default" />
            </div>
            {!results.metaAtingida && (
              <div className="rounded-xl bg-warning/10 p-3 text-xs font-semibold text-warning-foreground">
                ⚠ Meta não totalmente atingida com {results.numCotas} cotas. Déficit: {fmtBRL(results.deficitR)}. Considere aumentar o horizonte ou o valor das cartas.
              </div>
            )}
          </Section>

          {/* Benefício Fiscal PJ */}
          {inputs.regimeTributario !== "nenhum" && results.economiaFiscalTotal > 0 && (
            <Section title="Benefício Fiscal (PJ)">
              <div className="grid gap-3 sm:grid-cols-3">
                <KPI icon={Percent} label="Economia fiscal total" value={fmtBRL(results.economiaFiscalTotal)}
                  sub={`Alíquota ${inputs.aliquotaEfetiva}% sobre parcelas`} variant="success" />
                <KPI icon={Coins} label="Custo real da operação" value={fmtBRL(results.custoRealTotal)}
                  sub="Total investido − economia fiscal" variant="primary" />
                <KPI icon={TrendingUp} label="Patrimônio vs. custo real" value={fmtBRL(results.patrimonioTotalFinal - results.custoRealTotal)}
                  sub="Retorno líquido de impostos" variant="success" />
              </div>
              <div className="rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
                💡 No regime {inputs.regimeTributario === "presumido" ? "Lucro Presumido" : "Lucro Real"}, as parcelas de consórcio são dedutíveis como despesa operacional. O Estado paga {inputs.aliquotaEfetiva}% da sua cota.
              </div>
            </Section>
          )}

          {/* Cotas individuais */}
          <Section title="Plano de Cotas">
            <div className="space-y-3">
              {results.cotas.map((cota) => (
                <div key={cota.numero} className="rounded-xl border border-border p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-extrabold">Cota {cota.numero}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Contemplada mês {cota.mesContemplacaoAbsoluto}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><p className="text-muted-foreground">Carta</p><p className="font-bold">{fmtBRL(cota.valorCarta)}</p></div>
                    <div><p className="text-muted-foreground">Parcela</p><p className="font-bold">{fmtBRL(cota.parcelaMensal)}/mês</p></div>
                    <div><p className="text-muted-foreground">Lance</p><p className="font-bold">{fmtBRL(cota.lanceR)}</p></div>
                    <div><p className="text-muted-foreground">Imóvel final</p><p className="font-bold text-success">{fmtBRL(cota.valorImovelFinal)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Gráfico: cotas */}
          {chartData && (
            <Section title="Carta × Valor Final por Cota">
              <div className="h-52 sm:h-64" data-chart="meta-cotas">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </Section>
          )}

          {/* Novo: Progresso para a Meta */}
          <ChartProgressoMeta r={results} inputs={inputs} />

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

// ─── Gráfico: Progresso para a Meta ──────────────────────────────────────────
// Barra de progresso visual: patrimônio atingido vs meta. Simples e impactante.
type MetaInputsChartProps = {
  modo: ModoMeta;
  patrimonioAlvoR: number;
  rendaMensalAlvoR: number;
  yeildAluguelPerc: number;
  [key: string]: unknown;
};
function ChartProgressoMeta({ r, inputs }: { r: MetaPatrimonialResults; inputs: MetaInputsChartProps }) {
  const meta = inputs.modo === "renda" && inputs.yeildAluguelPerc > 0
    ? inputs.rendaMensalAlvoR / (inputs.yeildAluguelPerc / 100)
    : inputs.patrimonioAlvoR;
  const atingido = Math.min(r.patrimonioTotalFinal, meta * 1.5);
  const data = {
    labels: ["Meta de Patrimônio", "Patrimônio Atingido"],
    datasets: [{
      label: "Valor (R$)",
      data: [meta, atingido],
      backgroundColor: ["rgba(107,114,128,0.5)", r.metaAtingida ? "rgba(34,197,94,0.85)" : "rgba(234,179,8,0.85)"],
      borderRadius: 8,
      borderSkipped: false as const,
    }],
  };
  const opts = {
    indexAxis: "y" as const,
    responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c: { raw: unknown }) => fmtBRL(c.raw as number) } },
    },
    scales: {
      x: { ticks: { callback: (v: unknown) => { const n = Number(v); return n >= 1e6 ? `R$${(n/1e6).toFixed(1)}M` : `R$${(n/1e3).toFixed(0)}k`; } } },
      y: { grid: { display: false } },
    },
  };
  return (
    <Section title={r.metaAtingida ? "✅ Meta Atingida" : "⚠️ Progresso para a Meta"}>
      <div className="h-32 sm:h-40 w-full" data-chart="meta-progresso">
        <Bar data={data} options={opts} />
      </div>
      <div className="flex items-center gap-2 rounded-xl p-3 text-sm font-extrabold" style={{ backgroundColor: r.metaAtingida ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)", color: r.metaAtingida ? "#179a47" : "#b45309" }}>
        {r.metaAtingida
          ? `🏆 Com ${r.numCotas} cotas você atinge ${fmtBRL(r.patrimonioTotalFinal)} — meta superada!`
          : `⚠️ Faltam ${fmtBRL(r.deficitR)} para atingir a meta. Considere mais cotas ou horizonte maior.`
        }
      </div>
    </Section>
  );
}

// ─── PDF Document (react-pdf) ─────────────────────────────────────────────────
function PDFMetaDoc({ r, inputs, clientName, chartImg, chartMeta, brandLogoUrl, brandColor }: {
  r: MetaPatrimonialResults;
  inputs: {
    modo: ModoMeta;
    patrimonioAlvoR: number;
    rendaMensalAlvoR: number;
    horizonteAnos: number;
    valorizacaoAnual: number;
    cdiAnual: number;
    taxaAdmConsorcio: number;
    prazoConsorcio: number;
    percLance: number;
    regimeTributario: RegimeTributario;
    aliquotaEfetiva: number;
    [key: string]: unknown;
  };
  clientName?: string;
  brandLogoUrl?: string;
  brandColor?: string;
  chartImg?: string | null;
  chartMeta?: string | null;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const metaLabel = inputs.modo === "patrimonio" ? fmtBRL(inputs.patrimonioAlvoR) : `${fmtBRL(inputs.rendaMensalAlvoR)}/mes`;

  return (
    <RpDoc>
      <RpHeader
        title="Meta Patrimonial"
        subtitle="Plano de Aquisição de Patrimônio via Consórcio — Cálculo Reverso"
        clientName={clientName}
        date={hoje}
        brandLogoUrl={brandLogoUrl}
        brandColor={brandColor}
      />
      <RpPremises items={[
        ["Modo", inputs.modo === "patrimonio" ? "Patrimônio" : "Renda Passiva"],
        ["Meta", metaLabel],
        ["Horizonte", `${inputs.horizonteAnos} anos`],
        ["Nº de cotas", String(r.numCotas)],
        ["Taxa de adm.", `${inputs.taxaAdmConsorcio}%`],
        ["Prazo do grupo", `${inputs.prazoConsorcio} meses`],
        ["Lance próprio", `${inputs.percLance}%`],
        ["Valorização", `${inputs.valorizacaoAnual}% a.a.`],
      ]} />

      <RpSection title="Resultado do Plano Patrimonial" description="O que o consorcio entrega ao final do horizonte planejado:">
        <RpMetricRow>
          <RpMetric label="Nº de cotas necessárias" value={`${r.numCotas} cotas`} description="Quantidade de consorcios para atingir a meta" color={C.navy} />
          <RpMetric label="Patrimonio total final" value={fmtBRL(r.patrimonioTotalFinal)} description="Soma do valor de mercado de todos os imóveis" color={C.green} />
          <RpMetric label="Renda passiva mensal" value={fmtBRL(r.rendaMensalFinalR)} description="Aluguel potencial com yield aplicado sobre o patrimonio" color={C.green} />
          <RpMetric label="Investimento mensal (pico)" value={fmtBRL(r.investimentoMensalTotal)} description="Maior desembolso simultâneo de parcelas" color={C.amber} />
        </RpMetricRow>
      </RpSection>

      <RpInsight
        emoji="🏆"
        title="Por que consórcio para construir patrimônio?"
        body={`Com ${r.numCotas} cotas de consorcio ao longo de ${inputs.horizonteAnos} anos, voce constroi um patrimônio de ${fmtBRL(r.patrimonioTotalFinal)} com desembolso fracionado. O consorcio combina alavancagem imobiliária (voce controla um ativo muito maior que o desembolso mensal) com a valorização real do imóvel — sem juros e com parcelas corrigidas apenas pelo INCC.`}
        variant="primary"
      />

      <RpSection title="Resultado do Plano Patrimonial" description="O patrimonio construído e a renda passiva potencial ao final do horizonte:">
        <RpKVList rows={[
          { label: "Total investido no plano", value: fmtBRL(r.totalInvestido) },
          { label: "Patrimônio final (valor de mercado)", value: fmtBRL(r.patrimonioTotalFinal), color: C.green },
          { label: "Renda passiva mensal potencial", value: fmtBRL(r.rendaMensalFinalR), color: C.green },
        ]} />
      </RpSection>

      {inputs.regimeTributario === "real" && r.economiaFiscalTotal > 0 ? (
        <RpSection title="Beneficio Fiscal PJ (Lucro Real)" description="No Lucro Real a taxa de administracao é despesa operacional dedutível: o Estado patrocina parte do custo via reducao de IRPJ + CSLL.">
          <RpKVList rows={[
            { label: `Quanto o Estado paga da sua cota (${inputs.aliquotaEfetiva}% sobre a taxa adm.)`, value: fmtBRL(r.economiaFiscalTotal), color: C.green },
            { label: "Economia fiscal total no plano", value: fmtBRL(r.economiaFiscalTotal), color: C.green },
            { label: "Custo real da operação (pós fiscal)", value: fmtBRL(r.custoRealTotal), color: C.navy },
            { label: "Retorno líquido de impostos", value: fmtBRL(r.patrimonioTotalFinal - r.custoRealTotal), color: C.green },
          ]} />
        </RpSection>
      ) : inputs.regimeTributario === "presumido" ? (
        <RpSection title="Beneficio PJ (Lucro Presumido)" description="No Lucro Presumido o imposto incide sobre o faturamento — não há dedução direta. A vantagem é patrimonial e de caixa.">
          <RpKVList rows={[
            { label: "Preservação de caixa", value: "Compra patrimônio sem retirar capital de giro da atividade-fim", color: C.navy },
            { label: "Balanço limpo (SCR intocado)", value: "Até a contemplação entra como Investimento (Ativo), não como dívida no Banco Central", color: C.navy },
          ]} />
        </RpSection>
      ) : null}

      <RpChartImage src={chartMeta} title="Progresso para a Meta Patrimonial" height={90} />
      <RpChartImage src={chartImg} title="Carta × Valor Final por Cota" height={130} />

      <RpSection title="Plano de Cotas" description="Cada cota e seu resultado esperado:">
        {r.cotas.map((c) => (
          <RpView key={c.numero} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <RpText style={{ color: C.textSub, flex: 1, fontSize: 9 }}>Cota {c.numero} — Mes {c.mesContemplacaoAbsoluto}</RpText>
            <RpText style={{ color: C.navy, width: 100, textAlign: "right", fontSize: 9 }}>{fmtBRL(c.valorCarta)}</RpText>
            <RpText style={{ color: C.green, width: 100, textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" }}>{fmtBRL(c.valorImovelFinal)}</RpText>
          </RpView>
        ))}
      </RpSection>

      <RpFooter />
    </RpDoc>
  );
}
