import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
import {
  calcMetaPatrimonial,
  defaultMetaInputs,
  type MetaPatrimonialResults,
  type ModoMeta,
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
  ArrowLeft, ArrowRight, BookOpen, Trophy, Coins, TrendingUp, Building2,
} from "lucide-react";
import { TemplatePicker, type TemplatePayload } from "@/components/TemplatePicker";

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
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
        <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function MetaPatrimonialPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const reportRef = useRef<HTMLDivElement>(null);

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
  const [mesContemplacao, setMesContemplacao] = useState(String(defaultMetaInputs.mesContemplacaoPrimeira));
  const [intervaloCotasMeses, setIntervaloCotasMeses] = useState(String(defaultMetaInputs.intervaloCotasMeses));

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [results, setResults] = useState<MetaPatrimonialResults | null>(null);
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
    mesContemplacaoPrimeira: parseInt(mesContemplacao || "0", 10) || 0,
    intervaloCotasMeses: parseInt(intervaloCotasMeses || "0", 10) || 0,
  }), [modo, patrimonioAlvo, rendaAlvo, yieldAluguel, horizonteAnos, valorizacao, cdi, taxaAdm, prazoConsorcio, percLance, mesContemplacao, intervaloCotasMeses]);

  const calcular = () => { setResults(calcMetaPatrimonial(inputs)); setSavedId(null); };

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

  const exportPDF = async () => {
    if (!reportRef.current) return;
    await html2pdf().set({
      margin: 8, filename: "meta-patrimonial.pdf",
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(reportRef.current).save();
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
          <NumInput label="Lance médio ofertado (%)" value={percLance} onChange={setPercLance} type="int" />
          <NumInput label="Mês da 1ª contemplação" value={mesContemplacao} onChange={setMesContemplacao} type="int" />
          <NumInput label="Intervalo entre contemplações (meses)" value={intervaloCotasMeses} onChange={setIntervaloCotasMeses} type="int" hint="Espaço entre contemplação de cada cota" />
        </Grid2>
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

          {/* Comparativo CDB */}
          <Section title="Consórcio vs. CDB">
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI icon={Trophy} label="Patrimônio — consórcio" value={fmtBRL(results.patrimonioTotalFinal)} variant="success" />
              <KPI icon={Coins} label="Retorno — CDB" value={fmtBRL(results.cdbFinal)} variant="default" />
              <KPI icon={TrendingUp} label="Vantagem patrimonial" value={fmtBRL(results.vantageVsCDB)}
                variant={results.vantageVsCDB > 0 ? "success" : "warning"} />
            </div>
          </Section>

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

          {/* Gráfico */}
          {chartData && (
            <Section title="Carta × Valor Final por Cota">
              <div className="h-52 sm:h-64">
                <Bar data={chartData} options={chartOptions} />
              </div>
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

          {/* Relatório PDF */}
          <div ref={reportRef} style={{ position: "absolute", left: "-9999px", top: 0, width: "800px", padding: "32px", background: "#fff", color: "#111", fontFamily: "sans-serif" }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🏆 Meta Patrimonial</h1>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Plano patrimonial reverso via consórcio imobiliário</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {[
                  ["Nº de cotas", String(results.numCotas)],
                  ["Patrimônio total final", fmtBRL(results.patrimonioTotalFinal)],
                  ["Renda passiva mensal", fmtBRL(results.rendaMensalFinalR)],
                  ["Investimento mensal total (pico)", fmtBRL(results.investimentoMensalTotal)],
                  ["Total investido", fmtBRL(results.totalInvestido)],
                  ["CDB (mesmo aporte)", fmtBRL(results.cdbFinal)],
                  ["Vantagem vs. CDB", fmtBRL(results.vantageVsCDB)],
                ].map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 8px", color: "#555" }}>{l}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.cotas.map((c) => (
              <div key={c.numero} style={{ marginTop: 16, padding: "12px", background: "#f9f9f9", borderRadius: 8 }}>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Cota {c.numero} — contemplada mês {c.mesContemplacaoAbsoluto}</p>
                <p style={{ fontSize: 11 }}>Carta: {fmtBRL(c.valorCarta)} | Parcela: {fmtBRL(c.parcelaMensal)}/mês | Lance: {fmtBRL(c.lanceR)} | Imóvel final: {fmtBRL(c.valorImovelFinal)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
