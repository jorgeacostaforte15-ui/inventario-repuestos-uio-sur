export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const uploadId = url.searchParams.get('uploadId') ?? ''

    let upload
    if (uploadId) {
      upload = await prisma.dailyUpload.findUnique({ where: { id: uploadId } })
    } else {
      upload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    }
    if (!upload) return NextResponse.json({ totalDiff: 0, totalValueCost: 0, totalValuePrice: 0, count: 0 })

    const items = await prisma.dailyItem.findMany({
      where: { uploadId: upload.id, difference: { gt: 0 } },
    })

    const totalDiff = items.reduce((s: number, i: any) => s + (i.difference ?? 0), 0)
    const totalValueCost = items.reduce((s: number, i: any) => s + (i.difference ?? 0) * (i.costItem ?? 0), 0)
    const totalValuePrice = items.reduce((s: number, i: any) => s + (i.difference ?? 0) * (i.price ?? 0), 0)

    return NextResponse.json({
      totalDiff: Math.round(totalDiff * 100) / 100,
      totalValueCost: Math.round(totalValueCost * 100) / 100,
      totalValuePrice: Math.round(totalValuePrice * 100) / 100,
      count: items.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
