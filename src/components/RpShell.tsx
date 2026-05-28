/**
 * RpShell — React PDF shell components using @react-pdf/renderer primitives.
 * Drop-in replacement for PdfShell.tsx but renders to a real PDF without
 * html2canvas / DOM screenshots. Zero thread blocking.
 */

import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";

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

// ─── Document wrapper ─────────────────────────────────────────────────────────
export function RpDoc({ children }: { children: React.ReactNode }) {
  return (
    <Document>
      <Page
        size="A4"
        style={{
          paddingHorizontal: 36,
          paddingVertical: 36,
          backgroundColor: C.white,
          fontFamily: "Helvetica",
          color: C.text,
        }}
      >
        {children}
      </Page>
    </Document>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function RpHeader({
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
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        borderBottomWidth: 3,
        borderBottomColor: C.navy,
        paddingBottom: 12,
        marginBottom: 18,
      }}
    >
      {/* Left: branding */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: C.navy,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <Text style={{ color: C.white, fontFamily: "Helvetica-Bold", fontSize: 14 }}>Q</Text>
        </View>
        <View>
          <Text style={{ fontSize: 15, color: C.navy, fontFamily: "Helvetica-Bold" }}>{title}</Text>
          <Text style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", marginTop: 1 }}>{subtitle}</Text>
        </View>
      </View>

      {/* Right: meta */}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: C.red, fontSize: 8, textTransform: "uppercase" }}>
          Relatório Exclusivo
        </Text>
        <Text style={{ color: C.muted, fontSize: 9, marginTop: 3 }}>{date}</Text>
        {clientName ? (
          <View
            style={{
              marginTop: 5,
              backgroundColor: C.navy,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: C.white, fontSize: 8, fontFamily: "Helvetica-Bold" }}>
              Preparado para: {clientName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function RpSection({
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
    <View style={{ marginBottom: 14 }}>
      <View
        style={{
          borderBottomWidth: 2,
          borderBottomColor: accentColor,
          paddingBottom: 4,
          marginBottom: description ? 5 : 8,
        }}
      >
        <Text style={{ fontSize: 8, color: accentColor, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
          {title}
        </Text>
      </View>
      {description ? (
        <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 7, fontFamily: "Helvetica-Oblique" }}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
export function RpMetric({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: string;
  description?: string;
  color?: string;
}) {
  const bg = color ?? C.navy;
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 6, padding: 9 }}>
      <Text style={{ fontSize: 7, color: C.white, textTransform: "uppercase", fontFamily: "Helvetica-Bold" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: C.white, fontFamily: "Helvetica-Bold", marginTop: 4 }}>
        {value}
      </Text>
      {description ? (
        <Text style={{ fontSize: 7, color: C.white, marginTop: 4 }}>{description}</Text>
      ) : null}
    </View>
  );
}

// Row wrapper for metric cards
export function RpMetricRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 7, marginBottom: 10 }}>
      {children}
    </View>
  );
}

// ─── Insight box ──────────────────────────────────────────────────────────────
export function RpInsight({
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
    primary: { bg: "#eef2ff", border: C.navy, titleColor: C.navy },
    success: { bg: "#f0fdf4", border: C.green, titleColor: C.green },
    warning: { bg: "#fffbeb", border: C.amber, titleColor: C.amber },
  };
  const { bg, border, titleColor } = colors[variant ?? "primary"];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderLeftWidth: 3,
        borderLeftColor: border,
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: titleColor, marginBottom: 4 }}>
        {emoji} {title}
      </Text>
      <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.55 }}>{body}</Text>
    </View>
  );
}

// ─── Key-value list ───────────────────────────────────────────────────────────
export function RpKVList({
  rows,
}: {
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <View>
      {rows.map(({ label, value, color }, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: 4,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}
        >
          <Text style={{ fontSize: 9, color: C.textSub, flex: 1 }}>{label}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: color ?? C.text }}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Two-column comparison table ──────────────────────────────────────────────
export function RpTable({
  rows,
}: {
  rows: {
    label: string;
    left: string;
    right: string;
    highlight?: boolean;
    leftColor?: string;
    rightColor?: string;
  }[];
}) {
  return (
    <View>
      {rows.map(({ label, left, right, highlight, leftColor, rightColor }, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            paddingVertical: 4,
            paddingHorizontal: highlight ? 5 : 0,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
            backgroundColor: highlight ? "#f0fdf4" : "transparent",
            borderRadius: highlight ? 4 : 0,
          }}
        >
          <Text style={{ fontSize: 9, color: C.textSub, flex: 1 }}>{label}</Text>
          <Text
            style={{
              fontSize: 9,
              color: leftColor ?? C.red,
              width: 90,
              textAlign: "right",
              fontFamily: "Helvetica-Bold",
            }}
          >
            {left}
          </Text>
          <Text
            style={{
              fontSize: 9,
              color: rightColor ?? C.green,
              width: 90,
              textAlign: "right",
              fontFamily: highlight ? "Helvetica-Bold" : "Helvetica-Bold",
            }}
          >
            {right}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Premises chips ───────────────────────────────────────────────────────────
export function RpPremises({ items }: { items: [string, string][] }) {
  // Split into rows of 4 chips
  const rows: [string, string][][] = [];
  for (let i = 0; i < items.length; i += 4) {
    rows.push(items.slice(i, i + 4) as [string, string][]);
  }
  return (
    <View style={{ marginBottom: 14 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 6, marginBottom: ri < rows.length - 1 ? 6 : 0 }}>
          {row.map(([label, value]) => (
            <View
              key={label}
              style={{
                flex: 1,
                backgroundColor: C.faint,
                padding: 7,
                borderRadius: 5,
                borderLeftWidth: 3,
                borderLeftColor: C.navy,
              }}
            >
              <Text style={{ fontSize: 7, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
                {label}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 2, color: C.text }}>
                {value}
              </Text>
            </View>
          ))}
          {/* Pad the last row with empty flex boxes so chips align */}
          {Array.from({ length: 4 - row.length }).map((_, k) => (
            <View key={`pad-${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
export function RpFooter({ note }: { note?: string }) {
  const defaultNote =
    "Simulação elaborada com base nos dados informados. Os resultados são estimativas e podem variar conforme as condições reais do mercado, políticas da administradora e índices vigentes. Consulte um especialista antes de tomar decisões financeiras.";
  return (
    <View
      style={{
        marginTop: 14,
        padding: 10,
        backgroundColor: C.faint,
        borderRadius: 5,
        borderLeftWidth: 3,
        borderLeftColor: C.navy,
      }}
    >
      <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.5 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: C.navy }}>Nota técnica: </Text>
        {note ?? defaultNote}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
        <Text style={{ fontSize: 7, color: C.muted }}>Gerado por Quanto Custa • Sistema de Inteligência Imobiliária</Text>
        <Text style={{ fontSize: 7, color: C.muted }}>quantocusta.pro</Text>
      </View>
    </View>
  );
}
