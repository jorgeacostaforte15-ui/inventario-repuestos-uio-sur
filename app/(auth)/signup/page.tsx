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

export default function SignupPage() {
  const [name, setName] = useState('')
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
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Error al registrar')
        return
      }
      const signInRes = await signIn('credentials', { email, password, redirect: false })
      if (signInRes?.error) {
        setError('Cuenta creada, pero no se pudo iniciar sesión automáticamente')
      } else {
        router.replace('/dashboard')
      }
    } catch {
      setError('Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Crear cuenta" description="Regístrate para acceder al sistema de inventario">
      <div className="flex justify-center mb-4">
        <Warehouse className="h-10 w-10 text-primary" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</div>}
        <div className="space-y-2">
          <Label htmlFor="name">Nombre completo</Label>
          <Input id="name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Juan Pérez" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
        </div>
        <Button type="submit" className="w-full" loading={loading}>Crear cuenta</Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary hover:underline">Inicia sesión</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
