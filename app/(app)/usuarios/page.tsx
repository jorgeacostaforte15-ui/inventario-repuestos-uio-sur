'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { SafeDate } from '@/components/safe-format'
import { Label } from '@/components/ui/label'

export default function UsuariosPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'USUARIO' })
  const [creating, setCreating] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      setUsers(data?.users ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (isAdmin) fetchUsers() }, [isAdmin])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Usuario creado exitosamente')
        setShowForm(false)
        setFormData({ name: '', email: '', password: '', role: 'USUARIO' })
        fetchUsers()
      } else {
        toast.error(data?.error ?? 'Error al crear usuario')
      }
    } catch { toast.error('Error') }
    setCreating(false)
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole }),
      })
      if (res.ok) {
        toast.success('Rol actualizado')
        fetchUsers()
      }
    } catch { toast.error('Error') }
  }

  if (!isAdmin) {
    return <p className="text-muted-foreground">Acceso restringido a administradores.</p>
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> Gestión de Usuarios
            </h1>
            <p className="text-sm text-muted-foreground">Administra los usuarios del sistema</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <UserPlus className="h-4 w-4 mr-2" /> Crear usuario
          </Button>
        </div>
      </FadeIn>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Nuevo usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Correo</Label>
                <Input type="email" value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Contraseña</Label>
                <Input type="password" value={formData.password} onChange={(e: any) => setFormData({ ...formData, password: e.target.value })} required minLength={6} />
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="h-10 w-full px-3 rounded-lg border bg-background text-sm"
                >
                  <option value="USUARIO">Usuario</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" loading={creating}>Crear</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>}
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role === 'ADMIN' ? 'Admin' : 'Usuario'}</Badge>
                  </TableCell>
                  <TableCell><SafeDate date={u.createdAt} options={{ dateStyle: 'medium' }} locale="es" /></TableCell>
                  <TableCell>
                    {u.id !== session?.user?.id && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRoleChange(u.id, u.role === 'ADMIN' ? 'USUARIO' : 'ADMIN')}
                      >
                        Cambiar a {u.role === 'ADMIN' ? 'Usuario' : 'Admin'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
