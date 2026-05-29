// ─── Captura de gráficos para o PDF ──────────────────────────────────────────
// Os gráficos do chart.js são renderizados em <canvas> na tela. Para embuti-los
// no PDF (@react-pdf/renderer aceita data URLs em <Image>), capturamos o canvas
// como PNG no momento da exportação.
//
// Uso:
//   1. Envolva cada gráfico on-screen com data-chart="<id>".
//      <div data-chart="rentabilidade"> <Line .../> </div>
//   2. Antes de gerar o PDF, chame captureCharts(["rentabilidade", ...]).
//   3. Passe o mapa de imagens ao componente do PDF e use <RpChartImage src=... />.

/** Captura um único gráfico pelo seu data-chart id. Retorna null se ausente. */
export function captureChart(id: string): string | null {
  if (typeof document === "undefined") return null;
  const container = document.querySelector(`[data-chart="${id}"]`);
  const canvas = container?.querySelector("canvas") as HTMLCanvasElement | null;
  if (!canvas) return null;
  try {
    // Fundo branco: charts geralmente são transparentes; compomos sobre branco
    // para evitar fundo preto no PDF.
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    if (out.width === 0 || out.height === 0) return null;
    const ctx = out.getContext("2d");
    if (!ctx) return canvas.toDataURL("image/png");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    return out.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Captura vários gráficos de uma vez. Retorna um mapa id → dataURL. */
export function captureCharts(ids: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const id of ids) result[id] = captureChart(id);
  return result;
}

export type ChartImages = Record<string, string | null>;
