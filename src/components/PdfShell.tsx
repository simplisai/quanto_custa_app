/**
 * Shared PDF shell components — used by all simulator PDF reports.
 * Pure inline-style React (no Tailwind) so html2canvas renders correctly.
 */

import React from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  navy:    "#1a2a6c",
  navyLt:  "#2d4499",
  red:     "#c0392b",
  green:   "#179a47",
  amber:   "#d47c00",
  muted:   "#64748b",
  faint:   "#f1f5f9",
  border:  "#e2e8f0",
  white:   "#ffffff",
  text:    "#1e293b",
  textSub: "#475569",
} as const;

export const T = {
  /* Section title bar */
  sectionTitle: {
    fontSize: 9,
    color: C.navy,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.10em",
    borderBottom: `2px solid ${C.navy}`,
    paddingBottom: 5,
    marginBottom: 10,
  },
  /* Key-value row */
  row: { display: "flex" as const, justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11 },
  rowLabel: { color: C.textSub, flex: 1 },
  rowVal:   { fontWeight: 700, textAlign: "right" as const, color: C.text },
} as const;

// ─── Header ───────────────────────────────────────────────────────────────────
export function PdfHeader({
  title,
  subtitle,
  clientName,
  date,
}: {
  title: string;
  subtitle: string;
  clientName?: string;
  date: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${C.navy}`, paddingBottom: 12, marginBottom: 18 }}>
      {/* Left: branding */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: C.white, fontWeight: 900, fontSize: 16 }}>Q</span>
          </div>
          <div>
            <div style={{ fontSize: 16, color: C.navy, fontWeight: 900, letterSpacing: "-0.02em" }}>{title}</div>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", marginTop: 1 }}>{subtitle}</div>
          </div>
        </div>
      </div>

      {/* Right: meta */}
      <div style={{ textAlign: "right", fontSize: 10 }}>
        <div style={{ fontWeight: 800, color: C.red, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}>Relatório Exclusivo</div>
        <div style={{ color: C.muted, marginTop: 3 }}>{date}</div>
        {clientName && (
          <div style={{ marginTop: 5, background: C.navy, color: C.white, padding: "3px 10px", borderRadius: 20, fontSize: 9.5, fontWeight: 700, display: "inline-block" }}>
            Preparado para: {clientName}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function PdfSection({
  title,
  description,
  children,
  accent,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  accent?: "green" | "amber" | "navy";
}) {
  const accentColor = accent === "green" ? C.green : accent === "amber" ? C.amber : C.navy;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, color: accentColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.10em", borderBottom: `2px solid ${accentColor}`, paddingBottom: 5, marginBottom: description ? 6 : 10 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 10, fontStyle: "italic", lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
export function PdfMetric({
  label,
  value,
  description,
  color,
  size,
}: {
  label: string;
  value: string;
  description?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const fontSize = size === "lg" ? 20 : size === "sm" ? 14 : 17;
  const bg = color || C.navy;
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "12px 14px", color: C.white }}>
      <div style={{ fontSize: 8.5, opacity: 0.82, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize, fontWeight: 900, marginTop: 5, letterSpacing: "-0.02em" }}>{value}</div>
      {description && (
        <div style={{ fontSize: 8.5, opacity: 0.80, marginTop: 5, lineHeight: 1.4 }}>{description}</div>
      )}
    </div>
  );
}

// ─── Insight box (the persuasive section) ─────────────────────────────────────
export function PdfInsight({
  emoji,
  title,
  body,
  variant,
}: {
  emoji: string;
  title: string;
  body: string;
  variant?: "primary" | "success" | "warning";
}) {
  const colors = {
    primary: { bg: "#eef2ff", border: C.navy, title: C.navy },
    success: { bg: "#f0fdf4", border: C.green, title: C.green },
    warning: { bg: "#fffbeb", border: C.amber, title: C.amber },
  };
  const { bg, border, title: titleColor } = colors[variant ?? "primary"];
  return (
    <div style={{ background: bg, border: `2px solid ${border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: titleColor, marginBottom: 5 }}>
        {emoji} {title}
      </div>
      <div style={{ fontSize: 10.5, color: C.text, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

// ─── Two-column key-value table ────────────────────────────────────────────────
export function PdfTable({
  rows,
}: {
  rows: { label: string; left: string; right: string; highlight?: boolean; leftColor?: string; rightColor?: string }[];
}) {
  return (
    <div>
      {rows.map(({ label, left, right, highlight, leftColor, rightColor }, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "5px 0",
            borderBottom: `1px solid ${C.border}`,
            fontSize: highlight ? 12 : 11,
            fontWeight: highlight ? 800 : 400,
            background: highlight ? "#f0fdf4" : "transparent",
            paddingLeft: highlight ? 6 : 0,
            paddingRight: highlight ? 6 : 0,
            borderRadius: highlight ? 4 : 0,
          }}
        >
          <span style={{ color: C.textSub, flex: 1 }}>{label}</span>
          <span style={{ color: leftColor ?? C.red, width: 130, textAlign: "right", fontWeight: 600 }}>{left}</span>
          <span style={{ color: rightColor ?? C.green, width: 130, textAlign: "right", fontWeight: highlight ? 800 : 700 }}>{right}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Simple single-column key-value list ─────────────────────────────────────
export function PdfKVList({
  rows,
}: {
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div>
      {rows.map(({ label, value, color }, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
          <span style={{ color: C.textSub, flex: 1 }}>{label}</span>
          <span style={{ fontWeight: 700, color: color ?? C.text, textAlign: "right" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Premise chips ─────────────────────────────────────────────────────────────
export function PdfPremises({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`, gap: 7, marginBottom: 16 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: C.faint, padding: "7px 9px", borderRadius: 6, borderLeft: `3px solid ${C.navy}` }}>
          <div style={{ fontSize: 8, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
          <div style={{ fontSize: 11, fontWeight: 800, marginTop: 3, color: C.text }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
export function PdfFooter({ note }: { note?: string }) {
  return (
    <div style={{ marginTop: 20, padding: "10px 12px", background: C.faint, borderRadius: 6, borderLeft: `3px solid ${C.navy}` }}>
      <div style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: C.navy }}>Nota técnica: </strong>
        {note ?? "Simulação elaborada com base nos dados informados. Os resultados são estimativas e podem variar conforme as condições reais do mercado, políticas da administradora e índices vigentes. Consulte um especialista antes de tomar decisões financeiras."}
      </div>
      <div style={{ marginTop: 6, fontSize: 8, color: C.muted, display: "flex", justifyContent: "space-between" }}>
        <span>Gerado por Quanto Custa • Sistema de Inteligência Imobiliária</span>
        <span>quantocusta.pro</span>
      </div>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export function PdfPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "14mm 16mm",
      width: "794px",
      fontFamily: "'Helvetica Neue', 'Arial', sans-serif",
      color: C.text,
      background: C.white,
      boxSizing: "border-box",
      lineHeight: 1.4,
    }}>
      {children}
    </div>
  );
}
