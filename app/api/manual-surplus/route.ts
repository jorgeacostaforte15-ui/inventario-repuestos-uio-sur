export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const search = searchParams.get('search') || ''

    // Get latest upload
    const latestUpload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!latestUpload) {
      return NextResponse.json({ items: [], total: 0, uploadId: null })
    }

    const where: any = { uploadId: latestUpload.id }
    if (search) {
      where.OR = [
        { articleNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.manualSurplus.findMany({
        where,
        include: { addedBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.manualSurplus.count({ where }),
    ])

    return NextResponse.json({
      items,
      total,
      uploadId: latestUpload.id,
      snapshotDate: latestUpload.snapshotDate,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { articleNumber, description, manufacturer, locationCode, stockPhysical, observation } = body

    if (!articleNumber || articleNumber.trim() === '') {
      return NextResponse.json({ error: 'El código de artículo es obligatorio' }, { status: 400 })
    }
    if (!stockPhysical || stockPhysical <= 0) {
      return NextResponse.json({ error: 'La cantidad física debe ser mayor a 0' }, { status: 400 })
    }

    // Get latest upload
    const latestUpload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!latestUpload) {
      return NextResponse.json({ error: 'No hay carga de inventario activa. Suba un Excel primero.' }, { status: 400 })
    }

    // Check if the article already exists in the system for this upload
    const cleanNumber = articleNumber.replace(/-/g, '')
    const existingCatalog = await prisma.articleCatalog.findFirst({
      where: {
        OR: [
          { articleNumber: { equals: articleNumber.trim(), mode: 'insensitive' } },
          { articleNumber: { equals: cleanNumber, mode: 'insensitive' } },
        ],
      },
    })

    if (existingCatalog) {
      // Check if it's in the current upload
      const existingItem = await prisma.dailyItem.findFirst({
        where: { uploadId: latestUpload.id, articleId: existingCatalog.id },
      })
      if (existingItem) {
        return NextResponse.json({
          error: `Este artículo ya existe en el sistema (${existingCatalog.articleNumber}). Use la sección de Conteo Físico para registrar la cantidad.`,
        }, { status: 400 })
      }
    }

    const item = await prisma.manualSurplus.create({
      data: {
        uploadId: latestUpload.id,
        articleNumber: articleNumber.trim(),
        description: description?.trim() || '',
        manufacturer: manufacturer?.trim() || '',
        locationCode: locationCode?.trim() || '',
        stockPhysical: parseFloat(stockPhysical),
        observation: observation?.trim() || '',
        addedById: session.user.id,
      },
      include: { addedBy: { select: { name: true, email: true } } },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error al crear' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const updateData: any = {}
    if (data.articleNumber !== undefined) updateData.articleNumber = data.articleNumber.trim()
    if (data.description !== undefined) updateData.description = data.description.trim()
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer.trim()
    if (data.locationCode !== undefined) updateData.locationCode = data.locationCode.trim()
    if (data.stockPhysical !== undefined) updateData.stockPhysical = parseFloat(data.stockPhysical)
    if (data.observation !== undefined) updateData.observation = data.observation.trim()

    const item = await prisma.manualSurplus.update({
      where: { id },
      data: updateData,
      include: { addedBy: { select: { name: true, email: true } } },
    })

    return NextResponse.json(item)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Only admin can delete
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    await prisma.manualSurplus.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error al eliminar' }, { status: 500 })
  }
}
