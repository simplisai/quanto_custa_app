import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import { calcular, defaultInputs, type CalcInputs, type CalcResults } from "@/lib/calculator";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { RpDoc, RpHeader, RpSection, RpMetric, RpPremises, RpKVList, RpFooter, RpMetricRow, C } from "@/components/RpShell";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: (search: Record<string, unknown>) => ({
    load: typeof search.load === "string" ? search.load : undefined,
    template: typeof search.template === "string" ? search.template : undefined,
    client: typeof search.client === "string" ? search.client : undefined,
  }),
  component: CalculatorPage,
});

type Field = { key: keyof CalcInputs; label: string; type: "money" | "percent" | "int"; hint?: string };

const G1: Field[] = [
  { key: "valorImovel", label: "Valor do Imóvel Alvo (R$)", type: "money" },
  { key: "entrada", label: "Entrada Própria Disponível (R$)", type: "money" },
];
const FIN: Field[] = [
  { key: "prazoF", label: "Prazo do Financiamento (meses)", type: "int" },
  { key: "jFinAnual", label: "Taxa de Juros Anual (%)", type: "percent" },
  { key: "trAnual", label: "Estimativa de TR / Ajuste (%)", type: "percent", hint: "A TR reajusta o Saldo Devedor do banco." },
];
const CONS: Field[] = [
  { key: "creditoCons", label: "Valor de Crédito da Carta (R$)", type: "money" },
  { key: "percLanceEmb", label: "Lance Embutido Utilizado (%)", type: "int" },
  { key: "lanceProprio", label: "Lance Recurso Próprio (R$)", type: "money" },
  { key: "tAdm", label: "Taxa de Administração (%)", type: "percent" },
  { key: "prazoC", label: "Prazo do Plano (meses)", type: "int" },
  { key: "inccAnual", label: "Estimativa INCC / Reajuste (%)", type: "percent" },
  { key: "percReducao", label: "Redução Parcela Inicial (%)", type: "int" },
  { key: "mesContemplacao", label: "Contemplação (mês)", type: "int" },
];
const ADV: Field[] = [
  { key: "aluguel", label: "Custo Atual de Aluguel (R$/mês)", type: "money", hint: "Soma o aluguel como custo de espera." },
  { key: "taxaOportunidadeMensal", label: "Rentabilidade do CDI (% ao mês)", type: "percent" },
  { key: "valorizacaoAnual", label: "Valorização do Imóvel (% a.a.)", type: "percent" },
  { key: "percItbi", label: "Despesas ITBI/Cartório (%)", type: "percent" },
];

const ALL_FIELDS = [...G1, ...FIN, ...CONS, ...ADV];

function numToRaw(v: number, type: "money" | "percent" | "int"): string {
  if (!v) return "";
  if (type === "money") return maskMoney(String(Math.round(v * 100)));
  if (type === "percent") return maskPercent(String(Math.round(v * 100)));
  return String(Math.round(v));
}

function inputsToRaws(inputs: Record<string, unknown>): Record<string, string> {
  const raws: Record<string, string> = {};
  for (const f of ALL_FIELDS) {
    const v = (inputs[f.key as string] as number) ?? 0;
    raws[f.key as string] = numToRaw(v, f.type);
  }
  return raws;
}

type ClientOpt = { id: string; name: string };
type TemplateOpt = { id: string; name: string; payload: Record<string, unknown> };

function NumInput({ field, raw, setRaw }: { field: Field; raw: string; setRaw: (v: string) => void }) {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (field.type === "money") setRaw(maskMoney(v));
    else if (field.type === "percent") setRaw(maskPercent(v));
    else setRaw(v.replace(/\D/g, ""));
  };
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
        {field.label}
        {field.hint && (
          <span title={field.hint} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">?</span>
        )}
      </label>
      <input
        value={raw}
        onChange={onChange}
        placeholder="0"
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}

function CalculatorPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [raws, setRaws] = useState<Record<string, string>>({});
  const [baseLance, setBaseLance] = useState<"credito" | "plano">("credito");
  const [usoCredito, setUsoCredito] = useState<"comprar" | "patrimonio">("comprar");
  const [amortTipo, setAmortTipo] = useState<"prazo" | "parcela">("prazo");
  const [results, setResults] = useState<CalcResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { exportPDF, isExporting } = usePdfExport(
    () => results ? <PDFReportDoc r={results} usoCredito={usoCredito} inputs={inputs} clientName={clients.find((c) => c.id === selectedClientId)?.name} /> : null,
    "Relatorio_Inteligencia_Imobiliaria.pdf",
  );

  // Context state
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [templates, setTemplates] = useState<TemplateOpt[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loadingContext, setLoadingContext] = useState(true);

  // ── Restore sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("calc-inputs");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (s.raws && typeof s.raws === "object") setRaws(s.raws);
      if (s.baseLance) setBaseLance(s.baseLance);
      if (s.usoCredito) setUsoCredito(s.usoCredito);
      if (s.amortTipo) setAmortTipo(s.amortTipo);
    } catch {}
  }, []);

  // Load clients and templates
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("clients").select("id, name").eq("user_id", user.id).order("name"),
      supabase.from("templates").select("id, name, payload").eq("user_id", user.id)
        .eq("operation_slug", "calculadora-patrimonial").order("name"),
    ]).then(([clientsRes, templatesRes]) => {
      setClients(clientsRes.data ?? []);
      setTemplates((templatesRes.data ?? []) as unknown as TemplateOpt[]);
      setLoadingContext(false);
    });
  }, [user]);

  // Load simulation from URL (?load=<id>)
  useEffect(() => {
    if (!search.load || !user) return;
    supabase.from("simulations").select("*").eq("id", search.load).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const inputs = data.inputs as Record<string, unknown>;
        setRaws(inputsToRaws(inputs));
        if (inputs.baseLance) setBaseLance(inputs.baseLance as "credito" | "plano");
        if (inputs.usoCredito) setUsoCredito(inputs.usoCredito as "comprar" | "patrimonio");
        if (inputs.amortTipo) setAmortTipo(inputs.amortTipo as "prazo" | "parcela");
        if (data.client_id) setSelectedClientId(data.client_id);
        toast.success("Simulação carregada.");
      });
  }, [search.load, user]);

  // Apply template from URL (?template=<id>)
  useEffect(() => {
    if (!search.template || !user) return;
    supabase.from("templates").select("*").eq("id", search.template).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        applyTemplate(data as unknown as TemplateOpt);
        toast.success(`Template "${data.name}" aplicado.`);
      });
  }, [search.template, user]);

  // Pre-select client from URL (?client=<id>)
  useEffect(() => {
    if (search.client) setSelectedClientId(search.client);
  }, [search.client]);

  function applyTemplate(tpl: TemplateOpt) {
    const payload = tpl.payload as Record<string, unknown>;
    setRaws((prev) => {
      const next = { ...prev };
      for (const f of ALL_FIELDS) {
        const v = payload[f.key as string];
        if (typeof v === "string" && v) next[f.key as string] = v;
      }
      return next;
    });
    if (payload.baseLance) setBaseLance(payload.baseLance as "credito" | "plano");
    if (payload.usoCredito) setUsoCredito(payload.usoCredito as "comprar" | "patrimonio");
    if (payload.amortTipo) setAmortTipo(payload.amortTipo as "prazo" | "parcela");
  }

  const inputs: CalcInputs = useMemo(() => {
    const obj: Record<string, unknown> = { ...defaultInputs, baseLance, usoCredito, amortTipo };
    for (const f of ALL_FIELDS) {
      const r = raws[f.key as string] ?? "";
      obj[f.key] = f.type === "int" ? parseInt(r || "0", 10) || 0 : unmask(r);
    }
    if (!obj.mesContemplacao) obj.mesContemplacao = 1;
    return obj as unknown as CalcInputs;
  }, [raws, baseLance, usoCredito, amortTipo]);

  const lanceBadges = useMemo(() => {
    const credito = inputs.creditoCons;
    const percEmb = inputs.percLanceEmb / 100;
    const tA = inputs.tAdm / 100;
    const base = baseLance === "plano" ? credito * (1 + tA) : credito;
    const embR = base * percEmb;
    const sug = percEmb > 0 && percEmb < 1
      ? baseLance === "plano" ? inputs.valorImovel / (1 - percEmb * (1 + tA)) : inputs.valorImovel / (1 - percEmb)
      : inputs.valorImovel;
    const percProprio = base > 0 ? (inputs.lanceProprio / base) * 100 : 0;
    const percTotal = percEmb * 100 + percProprio;
    return { sug: sug > 0 ? sug : inputs.valorImovel, embR, percTotal, lanceTotalR: embR + inputs.lanceProprio };
  }, [inputs, baseLance]);

  const calcular_ = () => {
    setResults(calcular(inputs));
    setSavedId(null);
    sessionStorage.setItem("calc-inputs", JSON.stringify({ raws, baseLance, usoCredito, amortTipo }));
  };

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    try {
      const title = `Imóvel ${fmtBRL(inputs.valorImovel)} — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data, error } = await supabase.from("simulations").insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        title,
        inputs: inputs as unknown as Record<string, unknown>,
        results: {
          tSAC: results.tSAC, tPrice: results.tPrice, tCons: results.tCons,
          patrimonioConsTotal: results.patrimonioConsTotal, imovelNoFuturo: results.imovelNoFuturo,
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


  const set = (k: string, v: string) => setRaws((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Calculadora Patrimonial</h1>
          <p className="text-sm text-muted-foreground">Compare SAC, PRICE e consórcio com inteligência.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              <Select onValueChange={(id) => {
                const t = templates.find((t) => t.id === id);
                if (t) { applyTemplate(t); toast.success(`Template "${t.name}" aplicado.`); }
              }}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Carregar template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      <Section title="Dados Iniciais do Planejamento">
        <Grid2>
          {G1.map((f) => <NumInput key={f.key as string} field={f} raw={raws[f.key as string] ?? ""} setRaw={(v) => set(f.key as string, v)} />)}
        </Grid2>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Financiamento Bancário">
          <NumInput field={FIN[0]} raw={raws.prazoF ?? ""} setRaw={(v) => set("prazoF", v)} />
          <Grid2>
            <NumInput field={FIN[1]} raw={raws.jFinAnual ?? ""} setRaw={(v) => set("jFinAnual", v)} />
            <NumInput field={FIN[2]} raw={raws.trAnual ?? ""} setRaw={(v) => set("trAnual", v)} />
          </Grid2>
        </Section>

        <Section title="Estratégia com Consórcio">
          <Grid2>
            <div>
              <NumInput field={CONS[0]} raw={raws.creditoCons ?? ""} setRaw={(v) => set("creditoCons", v)} />
              <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-center text-[11px] font-semibold text-warning-foreground">
                Sugestão de Carta: {fmtBRL(lanceBadges.sug)}
              </div>
            </div>
            <div>
              <NumInput field={CONS[1]} raw={raws.percLanceEmb ?? ""} setRaw={(v) => set("percLanceEmb", v)} />
              <div className="mt-2 rounded-md bg-accent px-2 py-1.5 text-center text-[11px] font-semibold text-accent-foreground">
                Abatido: {fmtBRL(lanceBadges.embR)}
              </div>
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Base de Cálculo do Lance</label>
              <Toggle value={baseLance} onChange={setBaseLance as never} opts={[["credito", "Sobre Crédito"], ["plano", "Sobre Plano"]]} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Utilização do Crédito Líquido</label>
              <select value={usoCredito} onChange={(e) => setUsoCredito(e.target.value as "comprar" | "patrimonio")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:border-primary focus:outline-none">
                <option value="comprar">Comprar Imóvel</option>
                <option value="patrimonio">Render como Patrimônio</option>
              </select>
            </div>
          </Grid2>
          <Grid2>
            <NumInput field={CONS[2]} raw={raws.lanceProprio ?? ""} setRaw={(v) => set("lanceProprio", v)} />
            <NumInput field={CONS[3]} raw={raws.tAdm ?? ""} setRaw={(v) => set("tAdm", v)} />
          </Grid2>
          <div className="rounded-lg bg-primary px-3 py-2.5 text-center text-xs font-bold text-primary-foreground shadow-elegant">
            LANCE TOTAL OFERTADO: {lanceBadges.percTotal.toFixed(2)}% ({fmtBRL(lanceBadges.lanceTotalR)})
          </div>
          <Grid2>
            <NumInput field={CONS[4]} raw={raws.prazoC ?? ""} setRaw={(v) => set("prazoC", v)} />
            <NumInput field={CONS[5]} raw={raws.inccAnual ?? ""} setRaw={(v) => set("inccAnual", v)} />
          </Grid2>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <Grid2>
              <NumInput field={CONS[6]} raw={raws.percReducao ?? ""} setRaw={(v) => set("percReducao", v)} />
              <NumInput field={CONS[7]} raw={raws.mesContemplacao ?? ""} setRaw={(v) => set("mesContemplacao", v)} />
            </Grid2>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Destinação do Lance Contemplado</label>
            <Toggle value={amortTipo} onChange={setAmortTipo as never} opts={[["prazo", "Reduzir Prazo"], ["parcela", "Reduzir Parcela"]]} />
          </div>
        </Section>
      </div>

      <Section title="Premissas Avançadas & Consultoria" accent>
        <div className="grid gap-4 sm:grid-cols-2">
          {ADV.map((f) => <NumInput key={f.key as string} field={f} raw={raws[f.key as string] ?? ""} setRaw={(v) => set(f.key as string, v)} />)}
        </div>
      </Section>

      {/* Cliente + Ações */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
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
          {clients.length === 0 && !loadingContext && (
            <p className="text-xs text-muted-foreground">
              <Link to="/clientes" className="underline">Cadastre clientes</Link> para vincular à simulação.
            </p>
          )}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <button onClick={calcular_}
            className="rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant active:scale-[0.98] hover:opacity-95 transition-all">
            Calcular Cenários
          </button>
          <button onClick={salvar} disabled={!results || saving}
            className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide active:scale-[0.98] hover:bg-accent disabled:opacity-40 transition-all">
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button onClick={exportPDF} disabled={!results || isExporting}
            className="rounded-xl bg-success px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-success-foreground active:scale-[0.98] hover:opacity-95 disabled:opacity-40 transition-all">
            {isExporting ? "Exportando…" : "Exportar PDF"}
          </button>
        </div>
        {savedId && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm">
            <span className="text-green-700">Simulação salva com sucesso.</span>
            <Link to="/historico" className="ml-auto text-xs font-semibold underline text-green-700">
              Ver no histórico →
            </Link>
          </div>
        )}
      </div>

      {results && (
        <ResultsView r={results} usoCredito={usoCredito} valorImovel={inputs.valorImovel}
          entrada={inputs.entrada} credito={inputs.creditoCons} />
      )}

    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border p-5 ${accent ? "border-warning/30 bg-warning/5" : "border-border bg-card"} space-y-4`}>
      <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}
function Grid2({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function Toggle<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="flex gap-2">
      {opts.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-xs font-bold transition ${value === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ResultsView({ r, usoCredito, valorImovel, entrada, credito }: {
  r: CalcResults; usoCredito: "comprar" | "patrimonio"; valorImovel: number; entrada: number; credito: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Financiamento SAC" value={fmtBRL(r.tSAC)} className="from-danger to-destructive" />
        <Card title="Financiamento PRICE" value={fmtBRL(r.tPrice)} className="from-warning to-[oklch(0.55_0.18_45)]" />
        <ConsorcioCard tCons={r.tCons} />
      </div>
      <ChartParcelas r={r} />
      <ChartAlavancagem r={r} />
      <Section title="Quadro Analítico de Patrimônio">
        <div className="grid gap-6 sm:grid-cols-2">
          <Analytic title="Cenário Financiamento" rows={[
            ["Preço Inicial do Imóvel", fmtBRL(valorImovel)],
            ["Entrada Aportada", fmtBRL(entrada)],
            ["Dívida Inicial (Financiado)", fmtBRL(valorImovel - entrada), "danger"],
            ["Custos de Cartório/ITBI", fmtBRL(r.custoItbiFinanciamento)],
            ["1ª Parcela Estimada (SAC)", fmtBRL(r.parcelasSAC[0] ?? 0)],
            ["Valor do Imóvel no Futuro", fmtBRL(r.imovelNoFuturo), "success"],
          ]} />
          <Analytic title="Cenário Consórcio Estratégico" rows={[
            ["Crédito da Carta Nominal", fmtBRL(credito)],
            ["Crédito Atualizado (INCC)", fmtBRL(r.creditoAtualizadoContemplacao), "info"],
            ["Lance Embutido Utilizado", fmtBRL(r.valorEmbVisual)],
            ["Poder de Compra Líquido", fmtBRL(r.poderCompraLiquido), "success"],
            ["Saldo Devedor Pós-Lance", fmtBRL(r.saldoDevedorNaContemplacao), "info"],
            ["Custo C/ Aluguel (Espera)", fmtBRL(r.custoAluguelTotal), "danger"],
            [usoCredito === "patrimonio" ? "Imóvel Adquirido" : "Valor do Imóvel (Corrigido)",
              usoCredito === "patrimonio" ? "Não aplicável" : fmtBRL(r.imovelNoFuturo),
              usoCredito === "patrimonio" ? "muted" : "success"],
            [usoCredito === "patrimonio" ? "Patrimônio Total (CDI + Carta)" : "Patrimônio Líquido Final (CDI)",
              fmtBRL(r.patrimonioConsTotal), "success-strong"],
          ]} />
        </div>
      </Section>
    </div>
  );
}

function Card({ title, value, className }: { title: string; value: string; className: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br p-5 text-white shadow-elegant ${className}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">{title}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function ConsorcioCard({ tCons }: { tCons: number }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-glow p-5 text-white shadow-elegant flex flex-col justify-between">
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">Custo Real Líquido</div>
        <div className="mt-2 text-2xl font-extrabold">{fmtBRL(tCons)}</div>
      </div>
    </div>
  );
}

function Analytic({ title, rows }: { title: string; rows: [string, string, string?][] }) {
  const color = (s?: string) =>
    s === "danger" ? "text-danger" : s === "success" ? "text-success font-bold"
    : s === "success-strong" ? "text-success font-extrabold" : s === "info" ? "text-primary font-bold"
    : s === "muted" ? "text-muted-foreground" : s === "bold" ? "font-bold" : "";
  return (
    <div className="rounded-xl bg-muted/40 p-5">
      <h4 className="border-b-2 border-border pb-2 text-xs font-extrabold uppercase tracking-wider text-primary">{title}</h4>
      <div className="mt-3 space-y-2">
        {rows.map(([k, v, c], i) => (
          <div key={i} className={`flex justify-between text-sm ${i === rows.length - 1 ? "border-t border-dashed border-border pt-2 font-bold" : ""}`}>
            <span className="text-foreground/70">{k}</span>
            <span className={color(c)}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartParcelas({ r }: { r: CalcResults }) {
  const maxLen = Math.max(r.parcelasSAC.length, r.parcelasPrice.length, r.parcelasCons.length, 1);
  const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

  // Saldo devedor consórcio: real balance tracked mês a mês (inclui queda do lance)
  const saldoDevedorCons = r.saldoConsMes;

  const data = {
    labels,
    datasets: [
      { label: "Financiamento SAC", data: r.parcelasSAC, borderColor: "#b21f1f", borderWidth: 2, fill: false, pointRadius: 0 },
      { label: "Financiamento PRICE", data: r.parcelasPrice, borderColor: "#f39c12", borderWidth: 2, fill: false, pointRadius: 0 },
      { label: "Parcela — Consórcio", data: r.parcelasCons, borderColor: "#1a2a6c", borderWidth: 3, fill: false, pointRadius: 2 },
      {
        label: "Saldo Devedor — Consórcio",
        data: saldoDevedorCons,
        borderColor: "#6366f1",
        borderWidth: 2,
        borderDash: [6, 4],
        fill: false,
        pointRadius: 0,
        yAxisID: "y1",
      },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      x: { grid: { display: false } },
      y: { ticks: { callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k` } },
      y1: { position: "right" as const, grid: { drawOnChartArea: false }, ticks: { callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k` } },
    },
    plugins: { tooltip: { callbacks: { label: (ctx: unknown) => { const c = ctx as { dataset: { label: string }; parsed: { y: number } }; return c.dataset.label + ": " + fmtBRL(c.parsed.y); } } } },
  };
  return (
    <Section title="Parcelas + Saldo Devedor do Consórcio ao Longo do Tempo">
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="h-48 sm:h-72 w-full"><Line data={data} options={options} /></div>
      </div>
    </Section>
  );
}

function ChartAlavancagem({ r }: { r: CalcResults }) {
  const maxLen = Math.max(r.desembolsoCons.length, r.patrimonioCons.length, 1);
  const labels = Array.from({ length: maxLen }, (_, i) => i + 1);
  const data = {
    labels,
    datasets: [
      { label: "Custo Global (Desembolso Acumulado)", data: r.desembolsoCons, borderColor: "#e74c3c", backgroundColor: "rgba(231,76,60,0.1)", borderWidth: 3, fill: true, pointRadius: 0 },
      { label: "Patrimônio Total Acumulado (Ativos)", data: r.patrimonioCons, borderColor: "#27ae60", backgroundColor: "rgba(39,174,96,0.1)", borderWidth: 3, fill: true, pointRadius: 0 },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: "index" as const, intersect: false },
    scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v: unknown) => `R$ ${(Number(v) / 1000).toFixed(0)}k` } } },
    plugins: { tooltip: { callbacks: { label: (ctx: unknown) => { const c = ctx as { dataset: { label: string }; parsed: { y: number } }; return c.dataset.label + ": " + fmtBRL(c.parsed.y); } } } },
  };
  return (
    <Section title="Evolução Patrimonial vs Custo Global (Consórcio)" accent>
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="h-48 sm:h-72 w-full"><Line data={data} options={options} /></div>
      </div>
    </Section>
  );
}

// ─── PDF Document (react-pdf) ─────────────────────────────────────────────────
function PDFReportDoc({ r, usoCredito, inputs, clientName }: {
  r: CalcResults;
  usoCredito: "comprar" | "patrimonio";
  inputs: CalcInputs;
  clientName?: string;
}) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <RpDoc>
      <RpHeader
        title="Quanto custa? Imobiliário"
        subtitle="Relatório de Inteligência Patrimonial"
        clientName={clientName}
        date={hoje}
      />

      <RpPremises items={[
        ["Valor do Imóvel", fmtBRL(inputs.valorImovel)],
        ["Entrada Disponível", fmtBRL(inputs.entrada)],
        ["Prazo Financ.", `${inputs.prazoF} meses`],
        ["Juros Anual", `${inputs.jFinAnual}% a.a.`],
        ["Crédito Consórcio", fmtBRL(inputs.creditoCons)],
        ["Prazo Consórcio", `${inputs.prazoC} meses`],
        ["Taxa de Adm.", `${inputs.tAdm}%`],
        ["CDI Mensal", `${inputs.taxaOportunidadeMensal}% a.m.`],
      ]} />

      <RpSection title="Custo Global Comparado" description="Total desembolsado em cada cenário ao longo de todo o contrato:">
        <RpMetricRow>
          <RpMetric label="Financiamento SAC" value={fmtBRL(r.tSAC)} color="#b21f1f" />
          <RpMetric label="Financiamento PRICE" value={fmtBRL(r.tPrice)} color="#d35400" />
          <RpMetric label="Estrategia Consorcio" value={fmtBRL(r.tCons)} color={C.navy} />
        </RpMetricRow>
      </RpSection>

      <RpSection title="Parcela Mensal Inicial Estimada">
        <RpMetricRow>
          <RpMetric label="SAC — 1ª parcela" value={fmtBRL(r.parcelasSAC[0] ?? 0)} description="por mes" color="#b21f1f" />
          <RpMetric label="PRICE — parcela fixa" value={fmtBRL(r.parcelasPrice[0] ?? 0)} description="por mes" color="#d35400" />
          <RpMetric label="Consorcio — pre-contempl." value={fmtBRL(r.parcelasCons[0] ?? 0)} description="por mes" color={C.navy} />
        </RpMetricRow>
      </RpSection>

      <RpSection title="Cenario Financiamento" accent="navy">
        <RpKVList rows={[
          { label: "Valor do Imóvel", value: fmtBRL(inputs.valorImovel) },
          { label: "Entrada Aportada", value: fmtBRL(inputs.entrada) },
          { label: "Financiado (Banco)", value: fmtBRL(inputs.valorImovel - inputs.entrada), color: C.red },
          { label: "ITBI / Cartório", value: fmtBRL(r.custoItbiFinanciamento) },
          { label: "Imóvel no Futuro", value: fmtBRL(r.imovelNoFuturo), color: C.green },
        ]} />
      </RpSection>

      <RpSection title="Cenario Consorcio" accent="navy">
        <RpKVList rows={[
          { label: "Crédito da Carta", value: fmtBRL(inputs.creditoCons) },
          { label: "Crédito Atualizado (INCC)", value: fmtBRL(r.creditoAtualizadoContemplacao), color: C.navy },
          { label: "Lance Embutido", value: fmtBRL(r.valorEmbVisual), color: C.red },
          { label: "Poder de Compra Líquido", value: fmtBRL(r.poderCompraLiquido), color: C.green },
          { label: "Saldo Devedor Pós-Lance", value: fmtBRL(r.saldoDevedorNaContemplacao), color: C.navy },
          { label: "Custo c/ Aluguel (Espera)", value: fmtBRL(r.custoAluguelTotal), color: C.red },
          { label: usoCredito === "patrimonio" ? "Patrimônio Total (CDI + Carta)" : "Patrimônio CDI Final", value: fmtBRL(r.patrimonioConsTotal), color: C.green },
        ]} />
      </RpSection>

      <RpFooter note="O custo global inclui entrada + parcelas + ITBI/cartório + custo de aluguel durante a espera (consorcio). O patrimonio do consorcio representa a entrada aplicada em CDI ate a contemplacao. Simulacao elaborada com base nas premissas declaradas — resultados reais podem variar conforme condições de mercado." />
    </RpDoc>
  );
}
