'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthLayout } from '@/components/layouts/auth-layout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Warehouse } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await signIn('credentials', { email, password, redirect: false })
      if (res?.error) {
        setError('Correo o contraseña incorrectos')
      } else {
        router.replace('/dashboard')
      }
    } catch {
      setError('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Control de Inventario" description="Ingresa tus credenciales para acceder al sistema">
      <div className="flex justify-center mb-4">
        <Warehouse className="h-10 w-10 text-primary" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</div>}
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <Button type="submit" className="w-full" loading={loading}>Iniciar sesión</Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="text-primary hover:underline">Regístrate aquí</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
