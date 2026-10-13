import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppShell } from '@/components/layouts/app-shell'
import { SidebarNav } from '@/components/sidebar-nav'
import { AppHeader } from '@/components/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }
  return (
    <AppShell
      sidebar={<SidebarNav />}
      header={<AppHeader />}
    >
      {children}
    </AppShell>
  )
}
