import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { calcular, defaultInputs, type CalcInputs, type CalcResults } from "@/lib/calculator";
import { fmtBRL, maskMoney, maskPercent, unmask } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export const Route = createFileRoute("/_authenticated/app")({ component: CalculatorPage });

type Field = {
  key: keyof CalcInputs;
  label: string;
  type: "money" | "percent" | "int";
  hint?: string;
};

const G1: Field[] = [
  { key: "valorImovel", label: "Valor do Imóvel Alvo (R$)", type: "money" },
  { key: "entrada", label: "Entrada Própria Disponível (R$)", type: "money" },
];
const FIN: Field[] = [
  { key: "prazoF", label: "Prazo do Financiamento (meses)", type: "int" },
  { key: "jFinAnual", label: "Taxa de Juros Anual (%)", type: "percent" },
  {
    key: "trAnual",
    label: "Estimativa de TR / Ajuste (%)",
    type: "percent",
    hint: "A TR reajusta o Saldo Devedor do banco.",
  },
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
  {
    key: "aluguel",
    label: "Custo Atual de Aluguel (R$/mês)",
    type: "money",
    hint: "Soma o aluguel como custo de espera.",
  },
  { key: "taxaOportunidadeMensal", label: "Rentabilidade do CDI (% ao mês)", type: "percent" },
  { key: "valorizacaoAnual", label: "Valorização do Imóvel (% a.a.)", type: "percent" },
  { key: "percItbi", label: "Despesas ITBI/Cartório (%)", type: "percent" },
];

function NumInput({
  field,
  raw,
  setRaw,
}: {
  field: Field;
  raw: string;
  setRaw: (v: string) => void;
}) {
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
          <span
            title={field.hint}
            className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
          >
            ?
          </span>
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
  const [raws, setRaws] = useState<Record<string, string>>({});
  const [baseLance, setBaseLance] = useState<"credito" | "plano">("credito");
  const [usoCredito, setUsoCredito] = useState<"comprar" | "patrimonio">("comprar");
  const [amortTipo, setAmortTipo] = useState<"prazo" | "parcela">("prazo");
  const [results, setResults] = useState<CalcResults | null>(null);
  const [saving, setSaving] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const inputs: CalcInputs = useMemo(() => {
    const obj: Record<string, unknown> = { ...defaultInputs, baseLance, usoCredito, amortTipo };
    for (const f of [...G1, ...FIN, ...CONS, ...ADV]) {
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
    const sug =
      percEmb > 0 && percEmb < 1
        ? baseLance === "plano"
          ? inputs.valorImovel / (1 - percEmb * (1 + tA))
          : inputs.valorImovel / (1 - percEmb)
        : inputs.valorImovel;
    const percProprio = base > 0 ? (inputs.lanceProprio / base) * 100 : 0;
    const percTotal = percEmb * 100 + percProprio;
    return {
      sug: sug > 0 ? sug : inputs.valorImovel,
      embR,
      percTotal,
      lanceTotalR: embR + inputs.lanceProprio,
    };
  }, [inputs, baseLance]);

  const calcular_ = () => setResults(calcular(inputs));

  const salvar = async () => {
    if (!results || !user) return;
    setSaving(true);
    const title = `Imóvel ${fmtBRL(inputs.valorImovel)} — ${new Date().toLocaleDateString("pt-BR")}`;
    const { error } = await supabase.from("simulations").insert({
      user_id: user.id,
      title,
      inputs: inputs as unknown as Record<string, unknown>,
      results: {
        tSAC: results.tSAC,
        tPrice: results.tPrice,
        tCons: results.tCons,
        patrimonioConsTotal: results.patrimonioConsTotal,
        imovelNoFuturo: results.imovelNoFuturo,
      } as unknown as Record<string, unknown>,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Simulação salva no histórico.");
  };

  const exportPDF = async () => {
    if (!results) {
      toast.error("Calcule primeiro.");
      return;
    }
    const html2pdf = (await import("html2pdf.js")).default;
    if (!reportRef.current) return;
    reportRef.current.style.display = "block";
    await html2pdf()
      .set({
        margin: 10,
        filename: "Relatorio_Inteligencia_Imobiliaria.pdf",
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(reportRef.current)
      .save();
    reportRef.current.style.display = "none";
  };

  useEffect(() => {
    // Pré-carrega simulação da URL hash (?load=<id>) — opcional
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Calculadora Patrimonial</h1>
          <p className="text-sm text-muted-foreground">
            Compare SAC, PRICE e consórcio com inteligência.
          </p>
        </div>
      </header>

      <Section title="Dados Iniciais do Planejamento">
        <Grid2>
          {G1.map((f) => (
            <NumInput
              key={f.key}
              field={f}
              raw={raws[f.key] ?? ""}
              setRaw={(v) => setRaws({ ...raws, [f.key]: v })}
            />
          ))}
        </Grid2>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Financiamento Bancário">
          <NumInput
            field={FIN[0]}
            raw={raws.prazoF ?? ""}
            setRaw={(v) => setRaws({ ...raws, prazoF: v })}
          />
          <Grid2>
            <NumInput
              field={FIN[1]}
              raw={raws.jFinAnual ?? ""}
              setRaw={(v) => setRaws({ ...raws, jFinAnual: v })}
            />
            <NumInput
              field={FIN[2]}
              raw={raws.trAnual ?? ""}
              setRaw={(v) => setRaws({ ...raws, trAnual: v })}
            />
          </Grid2>
        </Section>

        <Section title="Estratégia com Consórcio">
          <Grid2>
            <div>
              <NumInput
                field={CONS[0]}
                raw={raws.creditoCons ?? ""}
                setRaw={(v) => setRaws({ ...raws, creditoCons: v })}
              />
              <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-center text-[11px] font-semibold text-warning-foreground">
                Sugestão de Carta: {fmtBRL(lanceBadges.sug)}
              </div>
            </div>
            <div>
              <NumInput
                field={CONS[1]}
                raw={raws.percLanceEmb ?? ""}
                setRaw={(v) => setRaws({ ...raws, percLanceEmb: v })}
              />
              <div className="mt-2 rounded-md bg-accent px-2 py-1.5 text-center text-[11px] font-semibold text-accent-foreground">
                Abatido: {fmtBRL(lanceBadges.embR)}
              </div>
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Base de Cálculo do Lance</label>
              <Toggle
                value={baseLance}
                onChange={setBaseLance as never}
                opts={[
                  ["credito", "Sobre Crédito"],
                  ["plano", "Sobre Plano"],
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">
                Utilização do Crédito Líquido
              </label>
              <select
                value={usoCredito}
                onChange={(e) => setUsoCredito(e.target.value as "comprar" | "patrimonio")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:border-primary focus:outline-none"
              >
                <option value="comprar">Comprar Imóvel</option>
                <option value="patrimonio">Render como Patrimônio</option>
              </select>
            </div>
          </Grid2>
          <Grid2>
            <NumInput
              field={CONS[2]}
              raw={raws.lanceProprio ?? ""}
              setRaw={(v) => setRaws({ ...raws, lanceProprio: v })}
            />
            <NumInput
              field={CONS[3]}
              raw={raws.tAdm ?? ""}
              setRaw={(v) => setRaws({ ...raws, tAdm: v })}
            />
          </Grid2>
          <div className="rounded-lg bg-primary px-3 py-2.5 text-center text-xs font-bold text-primary-foreground shadow-elegant">
            LANCE TOTAL OFERTADO: {lanceBadges.percTotal.toFixed(2)}% (
            {fmtBRL(lanceBadges.lanceTotalR)})
          </div>
          <Grid2>
            <NumInput
              field={CONS[4]}
              raw={raws.prazoC ?? ""}
              setRaw={(v) => setRaws({ ...raws, prazoC: v })}
            />
            <NumInput
              field={CONS[5]}
              raw={raws.inccAnual ?? ""}
              setRaw={(v) => setRaws({ ...raws, inccAnual: v })}
            />
          </Grid2>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <Grid2>
              <NumInput
                field={CONS[6]}
                raw={raws.percReducao ?? ""}
                setRaw={(v) => setRaws({ ...raws, percReducao: v })}
              />
              <NumInput
                field={CONS[7]}
                raw={raws.mesContemplacao ?? ""}
                setRaw={(v) => setRaws({ ...raws, mesContemplacao: v })}
              />
            </Grid2>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">
              Destinação do Lance Contemplado
            </label>
            <Toggle
              value={amortTipo}
              onChange={setAmortTipo as never}
              opts={[
                ["prazo", "Reduzir Prazo"],
                ["parcela", "Reduzir Parcela"],
              ]}
            />
          </div>
        </Section>
      </div>

      <Section title="Premissas Avançadas & Consultoria" accent>
        <div className="grid gap-4 md:grid-cols-2">
          {ADV.map((f) => (
            <NumInput
              key={f.key}
              field={f}
              raw={raws[f.key] ?? ""}
              setRaw={(v) => setRaws({ ...raws, [f.key]: v })}
            />
          ))}
        </div>
      </Section>

      <div className="grid gap-3 md:grid-cols-3">
        <button
          onClick={calcular_}
          className="rounded-xl bg-primary px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-primary-foreground shadow-elegant hover:opacity-95 md:col-span-1"
        >
          Calcular Cenários
        </button>
        <button
          onClick={salvar}
          disabled={!results || saving}
          className="rounded-xl border border-border bg-card px-6 py-4 text-sm font-extrabold uppercase tracking-wide hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar no Histórico"}
        </button>
        <button
          onClick={exportPDF}
          disabled={!results}
          className="rounded-xl bg-success px-6 py-4 text-sm font-extrabold uppercase tracking-wide text-success-foreground hover:opacity-95 disabled:opacity-50"
        >
          Exportar PDF
        </button>
      </div>

      {results && (
        <ResultsView
          r={results}
          usoCredito={usoCredito}
          valorImovel={inputs.valorImovel}
          entrada={inputs.entrada}
          credito={inputs.creditoCons}
        />
      )}

      <div ref={reportRef} style={{ display: "none" }}>
        <PDFReport r={results} usoCredito={usoCredito} inputs={inputs} />
      </div>
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${accent ? "border-warning/30 bg-warning/5" : "border-border bg-card"} space-y-4`}
    >
      <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
function Toggle<T extends string>({
  value,
  onChange,
  opts,
}: {
  value: T;
  onChange: (v: T) => void;
  opts: [T, string][];
}) {
  return (
    <div className="flex gap-2">
      {opts.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-xs font-bold transition ${value === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ResultsView({
  r,
  usoCredito,
  valorImovel,
  entrada,
  credito,
}: {
  r: CalcResults;
  usoCredito: "comprar" | "patrimonio";
  valorImovel: number;
  entrada: number;
  credito: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Financiamento SAC"
          value={fmtBRL(r.tSAC)}
          className="from-danger to-destructive"
        />
        <Card
          title="Financiamento PRICE"
          value={fmtBRL(r.tPrice)}
          className="from-warning to-[oklch(0.55_0.18_45)]"
        />
        <Card
          title="Estratégia Consórcio"
          value={fmtBRL(r.tCons)}
          className="from-primary to-primary-glow"
        />
      </div>
      <ChartParcelas r={r} />
      <ChartAlavancagem r={r} />
      <Section title="Quadro Analítico de Patrimônio">
        <div className="grid gap-6 md:grid-cols-2">
          <Analytic
            title="Cenário Financiamento"
            rows={[
              ["Preço Inicial do Imóvel", fmtBRL(valorImovel)],
              ["Dívida Inicial (Financiado)", fmtBRL(valorImovel - entrada), "danger"],
              ["Custos de Cartório/ITBI", fmtBRL(r.custoItbiFinanciamento)],
              ["Capital Livre para Aplicação", fmtBRL(0)],
              ["Valor do Imóvel (Corrigido)", fmtBRL(r.imovelNoFuturo), "success"],
              ["Patrimônio Acumulado (CDI)", fmtBRL(r.cdiFin), "bold"],
            ]}
          />
          <Analytic
            title="Cenário Consórcio Estratégico"
            rows={[
              ["Crédito da Carta Nominal", fmtBRL(credito)],
              ["Lance Embutido Utilizado", fmtBRL(r.valorEmbVisual)],
              ["Poder de Compra Líquido", fmtBRL(credito - r.valorEmbVisual)],
              ["Saldo Devedor Pós-Lance", fmtBRL(r.saldoDevedorNaContemplacao), "info"],
              ["Custo C/ Aluguel (Espera)", fmtBRL(r.custoAluguelTotal), "danger"],
              [
                usoCredito === "patrimonio" ? "Imóvel Adquirido" : "Valor do Imóvel (Corrigido)",
                usoCredito === "patrimonio" ? "Não aplicável" : fmtBRL(r.imovelNoFuturo),
                usoCredito === "patrimonio" ? "muted" : "success",
              ],
              [
                usoCredito === "patrimonio"
                  ? "Patrimônio Total (CDI + Carta)"
                  : "Patrimônio Líquido Final (CDI)",
                fmtBRL(r.patrimonioConsTotal),
                "success-strong",
              ],
            ]}
          />
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
    s === "danger"
      ? "text-danger"
      : s === "success"
        ? "text-success font-bold"
        : s === "success-strong"
          ? "text-success font-extrabold"
          : s === "info"
            ? "text-primary font-bold"
            : s === "muted"
              ? "text-muted-foreground"
              : s === "bold"
                ? "font-bold"
                : "";
  return (
    <div className="rounded-xl bg-muted/40 p-5">
      <h4 className="border-b-2 border-border pb-2 text-xs font-extrabold uppercase tracking-wider text-primary">
        {title}
      </h4>
      <div className="mt-3 space-y-2">
        {rows.map(([k, v, c], i) => (
          <div
            key={i}
            className={`flex justify-between text-sm ${i === rows.length - 1 ? "border-t border-dashed border-border pt-2 font-bold" : ""}`}
          >
            <span className="text-foreground/70">{k}</span>
            <span className={color(c)}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartParcelas({ r }: { r: CalcResults }) {
  if (!r) return null;
  const maxLen = Math.max(r.parcelasSAC.length, r.parcelasPrice.length, r.parcelasCons.length, 1);
  const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

  const data = {
    labels,
    datasets: [
      {
        label: "Financiamento SAC",
        data: r.parcelasSAC,
        borderColor: "#b21f1f",
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
      },
      {
        label: "Financiamento PRICE",
        data: r.parcelasPrice,
        borderColor: "#f39c12",
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
      },
      {
        label: "Estratégia Consórcio",
        data: r.parcelasCons,
        borderColor: "#1a2a6c",
        borderWidth: 3,
        fill: false,
        pointRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        ticks: {
          callback: function (value: unknown) {
            return `R$ ${(Number(value) / 1000).toFixed(0)}k`;
          },
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context: unknown) {
            const ctx = context as { dataset: { label: string }; parsed: { y: number } };
            return ctx.dataset.label + ": " + fmtBRL(ctx.parsed.y);
          },
        },
      },
    },
  };

  return (
    <Section title="Evolução das Parcelas ao Longo do Tempo">
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
        <div className="h-72 w-full min-w-[600px]">
          <Line data={data} options={options} />
        </div>
      </div>
    </Section>
  );
}

function ChartAlavancagem({ r }: { r: CalcResults }) {
  if (!r) return null;
  const maxLen = Math.max(r.desembolsoCons.length, r.patrimonioCons.length, 1);
  const labels = Array.from({ length: maxLen }, (_, i) => i + 1);

  const data = {
    labels,
    datasets: [
      {
        label: "Custo Global (Desembolso Acumulado)",
        data: r.desembolsoCons,
        borderColor: "#e74c3c",
        backgroundColor: "rgba(231, 76, 60, 0.1)",
        borderWidth: 3,
        fill: true,
        pointRadius: 0,
      },
      {
        label: "Patrimônio Total Acumulado (Ativos)",
        data: r.patrimonioCons,
        borderColor: "#27ae60",
        backgroundColor: "rgba(39, 174, 96, 0.1)",
        borderWidth: 3,
        fill: true,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        ticks: {
          callback: function (value: unknown) {
            return `R$ ${(Number(value) / 1000).toFixed(0)}k`;
          },
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context: unknown) {
            const ctx = context as { dataset: { label: string }; parsed: { y: number } };
            return ctx.dataset.label + ": " + fmtBRL(ctx.parsed.y);
          },
        },
      },
    },
  };

  return (
    <Section title="Evolução Patrimonial vs Custo Global (Consórcio)" accent>
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
        <div className="h-72 w-full min-w-[600px]">
          <Line data={data} options={options} />
        </div>
      </div>
    </Section>
  );
}

function PDFReport({
  r,
  usoCredito,
  inputs,
}: {
  r: CalcResults | null;
  usoCredito: "comprar" | "patrimonio";
  inputs: CalcInputs;
}) {
  if (!r) return null;
  const valor = inputs.valorImovel;
  const cell: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid #f1f2f6",
    fontSize: 12,
  };
  const th: React.CSSProperties = {
    background: "#f1f2f6",
    color: "#1a2a6c",
    padding: "8px 12px",
    fontSize: 11,
    textAlign: "left",
    textTransform: "uppercase",
    fontWeight: 800,
  };
  return (
    <div
      style={{
        padding: "20mm",
        width: "210mm",
        fontFamily: "Inter, sans-serif",
        color: "#2f3640",
        background: "#fff",
      }}
    >
      <div
        style={{
          borderBottom: "3px solid #1a2a6c",
          paddingBottom: 15,
          marginBottom: 25,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <div
            style={{ fontSize: 22, color: "#1a2a6c", fontWeight: 800, textTransform: "uppercase" }}
          >
            Quanto custa? Imobiliário
          </div>
          <div
            style={{ fontSize: 11, color: "#7f8c8d", fontWeight: 700, textTransform: "uppercase" }}
          >
            Relatório de Inteligência Patrimonial
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#7f8c8d", fontWeight: 800 }}>CONFIDENCIAL</div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 25,
        }}
      >
        {[
          ["Custo Global SAC", r.tSAC, "#b21f1f"],
          ["Custo Global PRICE", r.tPrice, "#f39c12"],
          ["Custo Global Consórcio", r.tCons, "#1a2a6c"],
        ].map(([t, v, c]) => (
          <div
            key={t as string}
            style={{ padding: 12, borderRadius: 8, background: c as string, color: "#fff" }}
          >
            <div style={{ fontSize: 9, opacity: 0.9, textTransform: "uppercase", fontWeight: 700 }}>
              {t as string}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>{fmtBRL(v as number)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 25 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#1a2a6c",
              fontWeight: 800,
              borderBottom: "1px solid #dcdde1",
              paddingBottom: 4,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Estrutura de Financiamento
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Variável</th>
                <th style={th}>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>Preço do Imóvel</td>
                <td style={cell}>{fmtBRL(valor)}</td>
              </tr>
              <tr>
                <td style={cell}>ITBI/Cartório</td>
                <td style={cell}>{fmtBRL(r.custoItbiFinanciamento)}</td>
              </tr>
              <tr>
                <td style={{ ...cell, color: "#c0392b", fontWeight: 700 }}>Saldo Inicial Banco</td>
                <td style={{ ...cell, color: "#c0392b", fontWeight: 700 }}>
                  {fmtBRL(valor - inputs.entrada)}
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, color: "#27ae60", fontWeight: 700 }}>Valor Futuro Imóvel</td>
                <td style={{ ...cell, color: "#27ae60", fontWeight: 700 }}>
                  {fmtBRL(r.imovelNoFuturo)}
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, fontWeight: 700 }}>Patrimônio CDI</td>
                <td style={{ ...cell, fontWeight: 700 }}>{fmtBRL(r.cdiFin)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#1a2a6c",
              fontWeight: 800,
              borderBottom: "1px solid #dcdde1",
              paddingBottom: 4,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Estrutura Alavancada (Consórcio)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Variável</th>
                <th style={th}>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>Poder de Compra Líquido</td>
                <td style={cell}>{fmtBRL(inputs.creditoCons - r.valorEmbVisual)}</td>
              </tr>
              <tr>
                <td style={cell}>Lance Embutido</td>
                <td style={cell}>{fmtBRL(r.valorEmbVisual)}</td>
              </tr>
              <tr>
                <td style={{ ...cell, color: "#2980b9", fontWeight: 700 }}>Saldo Pós-Lance</td>
                <td style={{ ...cell, color: "#2980b9", fontWeight: 700 }}>
                  {fmtBRL(r.saldoDevedorNaContemplacao)}
                </td>
              </tr>
              <tr>
                <td style={{ ...cell, color: "#c0392b" }}>Aluguel (Espera)</td>
                <td style={{ ...cell, color: "#c0392b" }}>{fmtBRL(r.custoAluguelTotal)}</td>
              </tr>
              <tr>
                <td
                  style={{
                    ...cell,
                    color: usoCredito === "patrimonio" ? "#7f8c8d" : "#27ae60",
                    fontWeight: 700,
                  }}
                >
                  {usoCredito === "patrimonio" ? "Imóvel Adquirido" : "Valor Futuro Imóvel"}
                </td>
                <td
                  style={{
                    ...cell,
                    color: usoCredito === "patrimonio" ? "#7f8c8d" : "#27ae60",
                    fontWeight: 700,
                  }}
                >
                  {usoCredito === "patrimonio" ? "Não aplicável" : fmtBRL(r.imovelNoFuturo)}
                </td>
              </tr>
              <tr style={{ background: "#f4f9f4" }}>
                <td style={{ ...cell, color: "#27ae60", fontWeight: 800 }}>
                  {usoCredito === "patrimonio"
                    ? "Patrimônio Total (CDI + Carta)"
                    : "Patrimônio CDI"}
                </td>
                <td style={{ ...cell, color: "#27ae60", fontWeight: 800 }}>
                  {fmtBRL(r.patrimonioConsTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div
        style={{
          marginTop: 25,
          fontSize: 11,
          color: "#7f8c8d",
          background: "#f8f9fa",
          padding: 12,
          borderRadius: 6,
        }}
      >
        <strong>Nota Técnica:</strong> Os custos globais somam aquisição e custo transicional
        (aluguel). Na estratégia alavancada o poder de compra líquido compõe o patrimônio rendendo
        juros compostos após a contemplação.
      </div>
    </div>
  );
}
