import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/simuladores')({
  component: () => <Outlet />,
})
