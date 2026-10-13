export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'El correo ya está registrado' }, { status: 400 })
    }
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || email.split('@')[0], role: 'USUARIO' },
    })
    return NextResponse.json({ id: user.id, email: user.email, name: user.name })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error al crear usuario' }, { status: 500 })
  }
}
