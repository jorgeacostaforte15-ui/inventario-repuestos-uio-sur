'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  Package,
  History,
  GitCompare,
  Upload,
  Users,
  LogOut,
  Warehouse,
  PackagePlus,
  ArrowLeftRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conteo', label: 'Conteo Físico', icon: ClipboardList },
  { href: '/carga', label: 'Carga Excel', icon: Upload },
  { href: '/faltantes', label: 'Faltantes', icon: AlertTriangle },
  { href: '/sobrantes', label: 'Sobrantes', icon: TrendingUp },
  { href: '/sobrantes-manuales', label: 'Sobrantes Manuales', icon: PackagePlus },
  { href: '/inventario', label: 'Inventario', icon: Package },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/comparativo', label: 'Comparativo', icon: GitCompare },
]

const adminItems = [
  { href: '/usuarios', label: 'Usuarios', icon: Users },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-4 mb-4">
        <Warehouse className="h-7 w-7 text-primary" />
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Inventario</h2>
          <p className="text-xs text-muted-foreground">Sucursal Repuestos</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="my-3 border-t" />
            <p className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">Admin</p>
            {adminItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      <div className="mt-auto border-t pt-4">
        <div className="px-3 mb-2">
          <p className="text-sm font-medium truncate">{session?.user?.name ?? 'Usuario'}</p>
          <p className="text-xs text-muted-foreground truncate">{session?.user?.email ?? ''}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => signOut({ redirectTo: '/login' })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
