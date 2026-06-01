/**
 * QuizBrandHeader — faixa de marca no topo do formulário público.
 * Usa a cor + logo white-label do dono do formulário (com fallback oficial).
 */
import type { BrandSettings } from "@/hooks/useBrandSettings";

export function QuizBrandHeader({
  brand,
  title,
}: {
  brand: BrandSettings;
  title?: string;
}) {
  if (brand.loading) return null;

  return (
    <header
      className="flex items-center justify-center px-4 py-3"
      style={{ backgroundColor: brand.color }}
    >
      <img
        src={brand.logoUrl}
        alt={title ?? "Logo"}
        className="h-8 max-w-[180px] object-contain"
      />
    </header>
  );
}
