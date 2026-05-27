import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const reportRef = useRef<HTMLDivElement>(null);
  const { exportPDF, isExporting } = usePdfExport(reportRef, "Relatorio_Inteligencia_Imobiliaria.pdf");

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

      <div ref={reportRef} style={{ display: "none" }}>
        <PDFReport
          r={results}
          usoCredito={usoCredito}
          inputs={inputs}
          clientName={clients.find((c) => c.id === selectedClientId)?.name}
        />
      </div>
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
        <Card title="Custo Bruto Consórcio" value={fmtBRL(r.tCons)} className="from-primary to-primary-glow" />
      </div>
      {r.valorEmbVisual > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4 text-sm">
          <span className="text-foreground/70">Lance embutido ({fmtBRL(r.valorEmbVisual)}) sai do crédito — não do bolso. Custo real desembolsado:</span>
          <span className="font-extrabold text-primary whitespace-nowrap">{fmtBRL(r.tCons - r.valorEmbVisual)}</span>
        </div>
      )}
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
            ["Lance Embutido Utilizado", fmtBRL(r.valorEmbVisual)],
            ["Poder de Compra Líquido", fmtBRL(credito - r.valorEmbVisual)],
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

  // Saldo devedor consórcio: reverse cumulative sum of remaining installments
  // This represents "how much more you'll pay" = effective remaining debt
  const saldoDevedorCons = r.parcelasCons.map((_, idx) =>
    r.parcelasCons.slice(idx).reduce((a, b) => a + b, 0)
  );

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

function PDFReport({ r, usoCredito, inputs, clientName }: {
  r: CalcResults | null;
  usoCredito: "comprar" | "patrimonio";
  inputs: CalcInputs;
  clientName?: string;
}) {
  if (!r) return null;
  const valor = inputs.valorImovel;
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const sectionTitle: React.CSSProperties = {
    fontSize: 10, color: "#1a2a6c", fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.08em", borderBottom: "2px solid #1a2a6c", paddingBottom: 5, marginBottom: 10,
  };
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0f1f5", fontSize: 11 };
  const rowLabel: React.CSSProperties = { color: "#5d6d7e", flex: 1 };
  const rowVal: React.CSSProperties = { fontWeight: 700, textAlign: "right" as const };

  return (
    <div style={{ padding: "16mm 18mm", width: "210mm", fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: "#2f3640", background: "#fff", boxSizing: "border-box" }}>

      {/* ── CABEÇALHO ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1a2a6c", paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, color: "#1a2a6c", fontWeight: 900, letterSpacing: "-0.03em" }}>Quanto custa? Imobiliário</div>
          <div style={{ fontSize: 10, color: "#7f8c8d", fontWeight: 700, marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Relatório de Inteligência Patrimonial</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: "#7f8c8d" }}>
          <div style={{ fontWeight: 800, color: "#c0392b", fontSize: 11, letterSpacing: "0.05em" }}>CONFIDENCIAL</div>
          <div style={{ marginTop: 3 }}>{hoje}</div>
          {clientName && (
            <div style={{ marginTop: 4, background: "#1a2a6c", color: "#fff", padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
              Cliente: {clientName}
            </div>
          )}
        </div>
      </div>

      {/* ── PREMISSAS ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionTitle}>Premissas da Simulação</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
          {[
            ["Valor do Imóvel", fmtBRL(inputs.valorImovel)],
            ["Entrada Disponível", fmtBRL(inputs.entrada)],
            ["Prazo Financ.", `${inputs.prazoF} meses`],
            ["Juros Anual", `${inputs.jFinAnual}% a.a.`],
            ["Crédito Consórcio", fmtBRL(inputs.creditoCons)],
            ["Prazo Consórcio", `${inputs.prazoC} meses`],
            ["Taxa de Adm.", `${inputs.tAdm}%`],
            ["CDI Mensal", `${inputs.taxaOportunidadeMensal}% a.m.`],
          ].map(([label, value]) => (
            <div key={label} style={{ background: "#f7f8fc", padding: "6px 8px", borderRadius: 5, borderLeft: "3px solid #1a2a6c" }}>
              <div style={{ fontSize: 8.5, color: "#7f8c8d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2, color: "#2f3640" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CUSTO TOTAL (3 cards) ──────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionTitle}>Custo Global Comparado</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            ["Financiamento SAC", r.tSAC, "#b21f1f", "#fff"],
            ["Financiamento PRICE", r.tPrice, "#d35400", "#fff"],
            ["Estratégia Consórcio", r.tCons, "#1a2a6c", "#fff"],
          ].map(([title, value, bg, fg]) => (
            <div key={title as string} style={{ padding: "12px 14px", borderRadius: 8, background: bg as string, color: fg as string }}>
              <div style={{ fontSize: 8.5, opacity: 0.85, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.07em" }}>{title as string}</div>
              <div style={{ fontSize: 17, fontWeight: 900, marginTop: 5, letterSpacing: "-0.02em" }}>{fmtBRL(value as number)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PARCELA MENSAL INICIAL ────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionTitle}>Parcela Mensal Inicial Estimada</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            ["SAC — 1ª parcela", r.parcelasSAC[0] ?? 0, "#b21f1f"],
            ["PRICE — parcela fixa", r.parcelasPrice[0] ?? 0, "#d35400"],
            ["Consórcio — pré-contempl.", r.parcelasCons[0] ?? 0, "#1a2a6c"],
          ].map(([label, value, color]) => (
            <div key={label as string} style={{ border: `2px solid ${color as string}`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: color as string, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label as string}</div>
              <div style={{ fontSize: 16, fontWeight: 900, marginTop: 5, color: color as string }}>{fmtBRL(value as number)}</div>
              <div style={{ fontSize: 9, color: "#95a5a6", marginTop: 3 }}>por mês</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ANÁLISE DETALHADA (2 colunas) ────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Financiamento */}
        <div>
          <div style={{ ...sectionTitle, borderColor: "#b21f1f", color: "#b21f1f" }}>Cenário Financiamento</div>
          {[
            { label: "Valor do Imóvel", value: fmtBRL(valor), color: "" },
            { label: "Entrada Aportada", value: fmtBRL(inputs.entrada), color: "" },
            { label: "Financiado (Banco)", value: fmtBRL(valor - inputs.entrada), color: "#c0392b" },
            { label: "ITBI / Cartório", value: fmtBRL(r.custoItbiFinanciamento), color: "" },
            { label: "Imóvel no Futuro", value: fmtBRL(r.imovelNoFuturo), color: "#27ae60" },
          ].map(({ label, value, color }) => (
            <div key={label} style={row}>
              <span style={rowLabel}>{label}</span>
              <span style={{ ...rowVal, color: color || "#2f3640" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Consórcio */}
        <div>
          <div style={{ ...sectionTitle, borderColor: "#1a2a6c", color: "#1a2a6c" }}>Cenário Consórcio</div>
          {[
            { label: "Crédito da Carta", value: fmtBRL(inputs.creditoCons), color: "" },
            { label: "Lance Embutido", value: fmtBRL(r.valorEmbVisual), color: "#c0392b" },
            { label: "Poder de Compra Líquido", value: fmtBRL(inputs.creditoCons - r.valorEmbVisual), color: "" },
            { label: "Saldo Devedor Pós-Lance", value: fmtBRL(r.saldoDevedorNaContemplacao), color: "#2980b9" },
            { label: "Custo c/ Aluguel (Espera)", value: fmtBRL(r.custoAluguelTotal), color: "#c0392b" },
            {
              label: usoCredito === "patrimonio" ? "Patrimônio Total (CDI + Carta)" : "Patrimônio CDI Final",
              value: fmtBRL(r.patrimonioConsTotal),
              color: "#27ae60",
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={row}>
              <span style={rowLabel}>{label}</span>
              <span style={{ ...rowVal, color: color || "#2f3640" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RODAPÉ ───────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, fontSize: 9.5, color: "#7f8c8d", background: "#f7f8fc", padding: "10px 12px", borderRadius: 6, borderLeft: "3px solid #1a2a6c" }}>
        <strong style={{ color: "#1a2a6c" }}>Nota Técnica:</strong> O custo global inclui entrada + parcelas + ITBI/cartório + custo de aluguel durante a espera (consórcio). O patrimônio do consórcio representa a entrada aplicada em CDI até a contemplação. Simulação elaborada com base nas premissas declaradas — resultados reais podem variar conforme condições de mercado.
      </div>
    </div>
  );
}
