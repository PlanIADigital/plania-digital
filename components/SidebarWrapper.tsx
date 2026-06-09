'use client'
import Sidebar from '@/components/Sidebar'
import SidebarDirectivo from '@/components/SidebarDirectivo'

interface SidebarWrapperProps {
  profile: any
  children: React.ReactNode
}

export default function SidebarWrapper({ profile, children }: SidebarWrapperProps) {
  if (!profile) return <>{children}</>
  
  if (profile.role === 'directivo') {
    return <SidebarDirectivo profile={profile}>{children}</SidebarDirectivo>
  }

  // educadora, educador, maestra_musica, maestro_musica — sidebar estándar
  return <Sidebar profile={profile}>{children}</Sidebar>
}
