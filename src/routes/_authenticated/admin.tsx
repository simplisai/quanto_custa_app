import { createFileRoute, Outlet } from '@tanstack/react-router'

// This file is a pure layout route — it renders <Outlet /> so that all
// child routes (admin/usuarios, admin/assinaturas, etc.) can render inside it.
// The actual dashboard content lives in admin.index.tsx (shown at /admin).
export const Route = createFileRoute('/_authenticated/admin')({
  component: () => <Outlet />,
})
