import { createFileRoute } from "@tanstack/react-router";
import { CanonicalFieldsTable } from "@/components/admin/CanonicalFieldsTable";

export const Route = createFileRoute("/_authenticated/admin/campos")({
  component: AdminCamposPage,
});

function AdminCamposPage() {
  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">📖 Campos Canônicos & Diretrizes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dicionário normalizado de todos os campos dos 8 simuladores. Fonte única de verdade para
          nomenclatura, fórmulas e conceitos financeiros. Use para garantir consistência entre
          engines TypeScript, editor de fórmulas e comunicação com o cliente.
        </p>
      </div>
      <CanonicalFieldsTable />
    </div>
  );
}
