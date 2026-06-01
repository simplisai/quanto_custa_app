/**
 * RpShell — React PDF shell components using @react-pdf/renderer primitives.
 * Renderiza um PDF real (sem html2canvas), com layout moderno e sofisticado.
 *
 * White-label: por padrão o header usa a logo oficial do Quanto Custa. Quando o
 * corretor configura a marca, apenas o header muda (logo + cor de destaque) —
 * o restante do documento mantém o mesmo padrão visual.
 */

import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";

// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  // Marca / acento padrão (financeiro, sóbrio)
  navy:    "#1a2a6c",
  navyLt:  "#2d4499",
  // Semânticos
  red:     "#c0392b",
  green:   "#179a47",
  amber:   "#d47c00",
  // Neutros (escala slate refinada)
  ink:     "#0f172a", // títulos
  text:    "#1e293b",
  textSub: "#475569",
  muted:   "#64748b",
  faint:   "#f8fafc", // fundo de card
  soft:    "#f1f5f9",
  border:  "#e2e8f0",
  borderLt:"#eef2f6", // hairline
  white:   "#ffffff",
} as const;

// Logo oficial (absoluta para o react-pdf conseguir buscar no browser)
const QC_LOGO_DEFAULT =
  typeof window !== "undefined" ? `${window.location.origin}/logo-dark.png` : "/logo-dark.png";

// ─── Document wrapper ─────────────────────────────────────────────────────────
export function RpDoc({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <Document>
      <Page
        size="A4"
        style={{
          paddingHorizontal: compact ? 4 : 38,
          paddingVertical: compact ? 4 : 38,
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

// ─── Header (letterhead moderno) ────────────────────────────────────────────────
export function RpHeader({
  title: _title,
  subtitle,
  clientName,
  date,
  brandLogoUrl,
  brandColor,
}: {
  /** Mantido por compatibilidade de API — a identidade vem da logo. */
  title?: string;
  subtitle: string;
  clientName?: string;
  date: string;
  /** Logo white-label do corretor (raster: png/jpg). SVG é ignorado — react-pdf não suporta. */
  brandLogoUrl?: string;
  /** Cor white-label do corretor. Default: navy. */
  brandColor?: string;
}) {
  const accent = brandColor || C.navy;
  // react-pdf <Image> só renderiza raster — ignora SVG e cai na logo oficial
  const raster = brandLogoUrl && /\.(png|jpe?g)(\?|$)/i.test(brandLogoUrl) ? brandLogoUrl : null;
  const logoSrc = raster || QC_LOGO_DEFAULT;

  return (
    <View style={{ marginBottom: 20 }}>
      {/* Linha superior: logo + meta */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Image src={logoSrc} style={{ height: 26 }} />
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: accent, marginRight: 5 }} />
            <Text style={{ fontSize: 7.5, letterSpacing: 1.2, color: accent, fontFamily: "Helvetica-Bold", textTransform: "uppercase" }}>
              Relatório Exclusivo
            </Text>
          </View>
          <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>{date}</Text>
        </View>
      </View>

      {/* Régua de destaque (cor da marca) */}
      <View style={{ flexDirection: "row", marginTop: 12, height: 3 }}>
        <View style={{ width: 48, backgroundColor: accent, borderRadius: 2 }} />
        <View style={{ flex: 1, backgroundColor: C.borderLt, borderRadius: 2, marginLeft: 4 }} />
      </View>

      {/* Título do documento + cliente */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ fontSize: 17, color: C.ink, fontFamily: "Helvetica-Bold", letterSpacing: -0.4 }}>
            {subtitle}
          </Text>
          <Text style={{ fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 3 }}>
            Análise comparativa de crédito imobiliário
          </Text>
        </View>
        {clientName ? (
          <View
            style={{
              backgroundColor: accent,
              paddingHorizontal: 11,
              paddingVertical: 4,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: C.white, fontSize: 8, fontFamily: "Helvetica-Bold" }}>
              Preparado para {clientName}
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
    <View style={{ marginBottom: 15 }}>
      {/* Cabeçalho da seção: marcador + label + hairline */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: description ? 5 : 8 }}>
        <View style={{ width: 3, height: 11, borderRadius: 2, backgroundColor: accentColor, marginRight: 6 }} />
        <Text style={{ fontSize: 8.5, color: C.ink, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6 }}>
          {title}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: C.borderLt, marginLeft: 8 }} />
      </View>
      {description ? (
        <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 8, fontFamily: "Helvetica-Oblique", lineHeight: 1.5 }}>
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
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 8,
        paddingVertical: 11,
        paddingHorizontal: 11,
      }}
    >
      <Text style={{ fontSize: 6.5, color: C.white, opacity: 0.8, textTransform: "uppercase", fontFamily: "Helvetica-Bold", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: C.white, fontFamily: "Helvetica-Bold", marginTop: 6, letterSpacing: -0.3 }}>
        {value}
      </Text>
      {description ? (
        <Text style={{ fontSize: 6.5, color: C.white, opacity: 0.75, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

// Row wrapper for metric cards
export function RpMetricRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
      {children}
    </View>
  );
}

// ─── Insight box ──────────────────────────────────────────────────────────────
export function RpInsight({
  // `emoji` mantido por compat — não renderizado (Helvetica não tem glifos emoji).
  emoji: _emoji,
  title,
  body,
  variant,
}: {
  emoji?: string;
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
        borderRadius: 8,
        padding: 11,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: titleColor, marginBottom: 4 }}>
        {title}
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
    <View style={{ borderWidth: 1, borderColor: C.borderLt, borderRadius: 8, overflow: "hidden" }}>
      {rows.map(({ label, value, color }, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: 5.5,
            paddingHorizontal: 10,
            backgroundColor: i % 2 === 0 ? C.white : C.faint,
          }}
        >
          <Text style={{ fontSize: 9, color: C.textSub, flex: 1 }}>{label}</Text>
          <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: color ?? C.ink }}>
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
    <View style={{ borderWidth: 1, borderColor: C.borderLt, borderRadius: 8, overflow: "hidden" }}>
      {rows.map(({ label, left, right, highlight, leftColor, rightColor }, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 5.5,
            paddingHorizontal: 10,
            backgroundColor: highlight ? "#f0fdf4" : i % 2 === 0 ? C.white : C.faint,
          }}
        >
          <Text style={{ fontSize: 9, color: C.textSub, flex: 1 }}>{label}</Text>
          <Text style={{ fontSize: 9, color: leftColor ?? C.red, width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" }}>
            {left}
          </Text>
          <Text style={{ fontSize: 9, color: rightColor ?? C.green, width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" }}>
            {right}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Premises chips ───────────────────────────────────────────────────────────
export function RpPremises({ items }: { items: [string, string][] }) {
  const rows: [string, string][][] = [];
  for (let i = 0; i < items.length; i += 4) {
    rows.push(items.slice(i, i + 4) as [string, string][]);
  }
  return (
    <View style={{ marginBottom: 16 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 7, marginBottom: ri < rows.length - 1 ? 7 : 0 }}>
          {row.map(([label, value]) => (
            <View
              key={label}
              style={{
                flex: 1,
                backgroundColor: C.faint,
                paddingVertical: 8,
                paddingHorizontal: 9,
                borderRadius: 7,
                borderWidth: 1,
                borderColor: C.borderLt,
              }}
            >
              <Text style={{ fontSize: 6.5, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {label}
              </Text>
              <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 3, color: C.ink, letterSpacing: -0.2 }}>
                {value}
              </Text>
            </View>
          ))}
          {Array.from({ length: 4 - row.length }).map((_, k) => (
            <View key={`pad-${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Gráfico (imagem capturada do chart.js) ─────────────────────────────────
export function RpChartImage({
  src,
  title,
  height = 150,
}: {
  src?: string | null;
  title?: string;
  height?: number;
}) {
  if (!src) return null;
  return (
    <View
      style={{
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.borderLt,
        borderRadius: 8,
        padding: 10,
        backgroundColor: C.white,
      }}
    >
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <View style={{ width: 3, height: 9, borderRadius: 2, backgroundColor: C.navy, marginRight: 5 }} />
          <Text style={{ fontSize: 7.5, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {title}
          </Text>
        </View>
      ) : null}
      <Image src={src} style={{ width: "100%", height, objectFit: "contain" }} />
    </View>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
export function RpFooter({ note }: { note?: string }) {
  const defaultNote =
    "Simulação elaborada com base nos dados informados. Os resultados são estimativas e podem variar conforme as condições reais do mercado, políticas da administradora e índices vigentes. Consulte um especialista antes de tomar decisões financeiras.";
  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          padding: 11,
          backgroundColor: C.faint,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: C.borderLt,
        }}
      >
        <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.55 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>Nota técnica: </Text>
          {note ?? defaultNote}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <Text style={{ fontSize: 7, color: C.muted }}>
          Gerado por Quanto Custa • Sistema de Inteligência Imobiliária
        </Text>
        <Text style={{ fontSize: 7, color: C.muted, fontFamily: "Helvetica-Bold" }}>quantocusta.pro</Text>
      </View>
    </View>
  );
}
