export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const latestUpload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!latestUpload) {
      return NextResponse.json({ today: null, yesterday: null })
    }

    // Today's progress
    const todayItems = await prisma.dailyItem.findMany({
      where: { uploadId: latestUpload.id },
      include: {
        article: { select: { articleNumber: true, locationCode: true } },
        countedBy: { select: { id: true, name: true, email: true } },
      },
    })
    const todayTotal = todayItems.length
    const todayCounted = todayItems.filter((i: any) => i.stockPhysical !== null).length

    // Last counted item (by location + articleNumber order)
    const countedItems = todayItems
      .filter((i: any) => i.stockPhysical !== null)
      .sort((a: any, b: any) => {
        const locCmp = (a.article?.locationCode ?? '').localeCompare(b.article?.locationCode ?? '')
        if (locCmp !== 0) return locCmp
        return (a.article?.articleNumber ?? '').localeCompare(b.article?.articleNumber ?? '')
      })
    const lastCountedItem = countedItems.length > 0 ? countedItems[countedItems.length - 1] : null

    // Per-user progress today: each user's count and their last-counted item (by countedAt)
    const byUser: Record<string, any> = {}
    todayItems
      .filter((i: any) => i.stockPhysical !== null && i.countedById)
      .forEach((i: any) => {
        const uid = i.countedById
        const uname = i.countedBy?.name || i.countedBy?.email || 'Usuario'
        if (!byUser[uid]) byUser[uid] = { userId: uid, name: uname, counted: 0, lastCounted: null as any, lastAt: null as any }
        byUser[uid].counted += 1
        const at = i.countedAt ? new Date(i.countedAt).getTime() : 0
        if (byUser[uid].lastAt === null || at >= byUser[uid].lastAt) {
          byUser[uid].lastAt = at
          byUser[uid].lastCounted = {
            articleNumber: i.article?.articleNumber ?? '',
            locationCode: i.article?.locationCode ?? '',
            countedAt: i.countedAt ?? null,
          }
        }
      })
    const perUser = Object.values(byUser).sort((a: any, b: any) => b.counted - a.counted)
    const myProgress = byUser[session.user.id] ?? null

    // Yesterday's progress
    const prevUpload = await prisma.dailyUpload.findFirst({
      where: { snapshotDate: { lt: latestUpload.snapshotDate } },
      orderBy: { snapshotDate: 'desc' },
    })
    let yesterday = null
    if (prevUpload) {
      const prevTotal = await prisma.dailyItem.count({ where: { uploadId: prevUpload.id } })
      const prevCounted = await prisma.dailyItem.count({ where: { uploadId: prevUpload.id, stockPhysical: { not: null } } })

      // Last counted item yesterday
      const prevLastCounted = await prisma.dailyItem.findFirst({
        where: { uploadId: prevUpload.id, stockPhysical: { not: null } },
        include: { article: { select: { articleNumber: true, locationCode: true } } },
        orderBy: [{ article: { locationCode: 'desc' } }, { article: { articleNumber: 'desc' } }],
      })

      yesterday = {
        snapshotDate: prevUpload.snapshotDate,
        total: prevTotal,
        counted: prevCounted,
        percent: prevTotal > 0 ? Math.round((prevCounted / prevTotal) * 100) : 0,
        lastCounted: prevLastCounted ? {
          articleNumber: prevLastCounted.article?.articleNumber ?? '',
          locationCode: prevLastCounted.article?.locationCode ?? '',
        } : null,
      }
    }

    return NextResponse.json({
      today: {
        snapshotDate: latestUpload.snapshotDate,
        total: todayTotal,
        counted: todayCounted,
        percent: todayTotal > 0 ? Math.round((todayCounted / todayTotal) * 100) : 0,
        lastCounted: lastCountedItem ? {
          articleNumber: lastCountedItem.article?.articleNumber ?? '',
          locationCode: lastCountedItem.article?.locationCode ?? '',
        } : null,
      },
      yesterday,
      perUser,
      myProgress,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
