'use client'
// ============================================================
//  PlanIA Digital — components/SidebarWrapper.tsx
//  [2 oct 2026] Un solo menú para todos los roles: Sidebar elige
//  las opciones según profile.role (educadora o directivo).
//  SidebarDirectivo queda retirado.
// ============================================================
import Sidebar from '@/components/Sidebar'

interface SidebarWrapperProps {
  profile: any
  children: React.ReactNode
}

export default function SidebarWrapper({ profile, children }: SidebarWrapperProps) {
  if (!profile) return <>{children}</>
  return <Sidebar profile={profile}>{children}</Sidebar>
}
