export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const filter = url.searchParams.get('filter') ?? '' // faltantes, sobrantes, all
    const uploadId = url.searchParams.get('uploadId') ?? ''

    let upload
    if (uploadId) {
      upload = await prisma.dailyUpload.findUnique({ where: { id: uploadId } })
    } else {
      upload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    }
    if (!upload) return NextResponse.json({ error: 'No hay datos' }, { status: 404 })

    const where: any = { uploadId: upload.id }
    if (filter === 'faltantes') where.difference = { lt: 0 }
    else if (filter === 'sobrantes') where.difference = { gt: 0 }

    const items = await prisma.dailyItem.findMany({
      where,
      include: { article: true, countedBy: { select: { name: true, email: true } } },
      orderBy: filter === 'faltantes' ? { difference: 'asc' } : filter === 'sobrantes' ? { difference: 'desc' } : { article: { articleNumber: 'asc' } },
    })

    const data = items.map((i: any) => ({
      'Número de artículo': i.article?.articleNumber ?? '',
      'Descripción': i.article?.description ?? '',
      'Fabricante': i.article?.manufacturer ?? '',
      'Ubicación': i.article?.locationCode ?? '',
      'Stock Sistema': i.stockSystem ?? 0,
      'Stock Físico': i.stockPhysical ?? '',
      'Diferencia': i.difference ?? '',
      'Valor Dif. Costo': i.difference !== null ? Math.round(Math.abs(i.difference ?? 0) * (i.costItem ?? 0) * 100) / 100 : '',
      'Valor Dif. Precio': i.difference !== null ? Math.round(Math.abs(i.difference ?? 0) * (i.price ?? 0) * 100) / 100 : '',
      'Costo Item': i.costItem ?? 0,
      'Precio': i.price ?? 0,
      'Observación 1': i.observation1 ?? '',
      'Observación 2': i.observation2 ?? '',
      'Contado por': i.countedBy?.name || i.countedBy?.email || '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, filter === 'faltantes' ? 'Faltantes' : filter === 'sobrantes' ? 'Sobrantes' : 'Inventario')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const dateStr = upload.snapshotDate.toISOString().split('T')[0]
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${filter || 'inventario'}_${dateStr}.xlsx`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
