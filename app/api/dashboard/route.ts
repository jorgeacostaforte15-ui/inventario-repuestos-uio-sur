export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get today's snapshot
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get latest upload (could be today or earlier)
    const latestUpload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!latestUpload) {
      return NextResponse.json({
        totalArticles: 0, counted: 0, percentCounted: 0,
        totalWithDiff: 0, totalShortage: 0, totalSurplus: 0,
        shortageValueCost: 0, shortageValuePrice: 0,
        surplusValueCost: 0, surplusValuePrice: 0,
        snapshotDate: null, previous: null,
      })
    }

    const items = await prisma.dailyItem.findMany({ where: { uploadId: latestUpload.id } })
    const totalArticles = items.length
    const counted = items.filter((i: any) => i.stockPhysical !== null).length
    const withDiff = items.filter((i: any) => i.difference !== null && i.difference !== 0)
    const shortages = withDiff.filter((i: any) => (i.difference ?? 0) < 0)
    const surpluses = withDiff.filter((i: any) => (i.difference ?? 0) > 0)

    const shortageValueCost = shortages.reduce((s: number, i: any) => s + Math.abs(i.difference ?? 0) * (i.costItem ?? 0), 0)
    const shortageValuePrice = shortages.reduce((s: number, i: any) => s + Math.abs(i.difference ?? 0) * (i.price ?? 0), 0)
    const surplusValueCost = surpluses.reduce((s: number, i: any) => s + (i.difference ?? 0) * (i.costItem ?? 0), 0)
    const surplusValuePrice = surpluses.reduce((s: number, i: any) => s + (i.difference ?? 0) * (i.price ?? 0), 0)

    // History: progress for ALL days (most recent first)
    const allUploads = await prisma.dailyUpload.findMany({
      orderBy: { snapshotDate: 'desc' },
      select: { id: true, snapshotDate: true, totalArticles: true, fileName: true },
    })
    const history = []
    for (const up of allUploads) {
      const upItems = up.id === latestUpload.id ? items : await prisma.dailyItem.findMany({ where: { uploadId: up.id }, select: { stockPhysical: true, difference: true } })
      const upCounted = upItems.filter((i: any) => i.stockPhysical !== null).length
      const upDiffs = upItems.filter((i: any) => i.difference !== null && i.difference !== 0).length
      const upShortages = upItems.filter((i: any) => (i.difference ?? 0) < 0).length
      const upSurpluses = upItems.filter((i: any) => (i.difference ?? 0) > 0).length
      history.push({
        snapshotDate: up.snapshotDate,
        fileName: up.fileName,
        totalArticles: up.totalArticles,
        counted: upCounted,
        percent: up.totalArticles > 0 ? Math.round((upCounted / up.totalArticles) * 100) : 0,
        withDiff: upDiffs,
        shortages: upShortages,
        surpluses: upSurpluses,
      })
    }

    // Previous day (for backward compat)
    const previous = history.length > 1 ? {
      snapshotDate: history[1].snapshotDate,
      totalArticles: history[1].totalArticles,
      counted: history[1].counted,
      totalWithDiff: history[1].withDiff,
    } : null

    return NextResponse.json({
      totalArticles,
      counted,
      percentCounted: totalArticles > 0 ? Math.round((counted / totalArticles) * 100) : 0,
      totalWithDiff: withDiff.length,
      totalShortage: shortages.length,
      totalSurplus: surpluses.length,
      shortageValueCost: Math.round(shortageValueCost * 100) / 100,
      shortageValuePrice: Math.round(shortageValuePrice * 100) / 100,
      surplusValueCost: Math.round(surplusValueCost * 100) / 100,
      surplusValuePrice: Math.round(surplusValuePrice * 100) / 100,
      snapshotDate: latestUpload.snapshotDate,
      previous,
      manualSurplusCount: await prisma.manualSurplus.count({ where: { uploadId: latestUpload.id } }),
      history,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
