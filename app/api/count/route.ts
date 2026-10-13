export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { itemId, stockPhysical, observation1, observation2 } = await req.json()
    if (!itemId || stockPhysical === undefined || stockPhysical === null) {
      return NextResponse.json({ error: 'Se requiere el ID del artículo y el stock físico' }, { status: 400 })
    }

    const item = await prisma.dailyItem.findUnique({ where: { id: itemId } })
    if (!item) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    const physicalVal = parseFloat(stockPhysical)
    const difference = physicalVal - (item.stockSystem ?? 0)

    // If this item was already counted before (stockPhysical not null) and the value
    // is being changed, mark it as a recount.
    const isRecount = item.stockPhysical !== null && item.stockPhysical !== physicalVal

    const updated = await prisma.dailyItem.update({
      where: { id: itemId },
      data: {
        stockPhysical: physicalVal,
        difference,
        countedById: session.user.id,
        countedAt: new Date(),
        ...(isRecount ? { recounted: true } : {}),
        ...(observation1 !== undefined ? { observation1 } : {}),
        ...(observation2 !== undefined ? { observation2 } : {}),
      },
      include: { article: true },
    })

    return NextResponse.json({
      success: true,
      id: updated.id,
      stockPhysical: updated.stockPhysical,
      difference: updated.difference,
      articleNumber: updated.article?.articleNumber,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { itemId, observation1, observation2 } = await req.json()
    if (!itemId) return NextResponse.json({ error: 'Se requiere el ID' }, { status: 400 })

    const data: any = {}
    if (observation1 !== undefined) data.observation1 = observation1
    if (observation2 !== undefined) data.observation2 = observation2

    const updated = await prisma.dailyItem.update({ where: { id: itemId }, data })
    return NextResponse.json({ success: true, id: updated.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
