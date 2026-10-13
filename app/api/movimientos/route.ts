export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// Only movements whose FechaUltimaVenta is within this many days of the snapshot
// date are considered "recent" movements. Older sale dates are ignored.
const MOVEMENT_WINDOW_DAYS = 2

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const search = url.searchParams.get('search') ?? ''
    const typeFilter = url.searchParams.get('type') ?? '' // 'llegaron' | 'salieron' | ''

    // Get two latest uploads
    const latestUpload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!latestUpload) {
      return NextResponse.json({ llegaron: [], salieron: [], today: null, yesterday: null })
    }

    // Two-day window relative to snapshot date
    const snapshotDate = new Date(latestUpload.snapshotDate)
    snapshotDate.setHours(0, 0, 0, 0)
    const windowStart = new Date(snapshotDate)
    windowStart.setDate(windowStart.getDate() - MOVEMENT_WINDOW_DAYS)

    // Returns true if the movement should be shown given its last sale date.
    // When lastSaleDate is null (unknown), we fall back to showing it.
    const withinWindow = (lastSaleDate: Date | null | undefined) => {
      if (!lastSaleDate) return true // graceful fallback: no data => show
      const d = new Date(lastSaleDate)
      d.setHours(0, 0, 0, 0)
      return d >= windowStart && d <= snapshotDate
    }

    const prevUpload = await prisma.dailyUpload.findFirst({
      where: { snapshotDate: { lt: latestUpload.snapshotDate } },
      orderBy: { snapshotDate: 'desc' },
    })

    if (!prevUpload) {
      const todayItems = await prisma.dailyItem.findMany({
        where: { uploadId: latestUpload.id },
        include: { article: true, countedBy: { select: { name: true, email: true } } },
        orderBy: { article: { articleNumber: 'asc' } },
      })
      return NextResponse.json({
        llegaron: todayItems.map((i: any) => ({
          articleId: i.articleId,
          dailyItemId: i.id,
          articleNumber: i.article?.articleNumber ?? '',
          description: i.article?.description ?? '',
          manufacturer: i.article?.manufacturer ?? '',
          locationCode: i.article?.locationCode ?? '',
          stockSystem: i.stockSystem,
          prevStockSystem: 0,
          arrivedQty: i.stockSystem,
          isNew: true,
          costItem: i.costItem,
          price: i.price,
          lastSaleDate: i.lastSaleDate ?? null,
          countedBy: i.countedBy?.name ?? i.countedBy?.email ?? null,
          recounted: i.recounted ?? false,
          confirmed: i.stockPhysical !== null,
        })),
        salieron: [],
        today: latestUpload.snapshotDate,
        yesterday: null,
        totalLlegaron: todayItems.length,
        totalSalieron: 0,
      })
    }

    // Fetch both days
    const [todayItems, yesterdayItems] = await Promise.all([
      prisma.dailyItem.findMany({
        where: { uploadId: latestUpload.id },
        include: { article: true, countedBy: { select: { name: true, email: true } } },
      }),
      prisma.dailyItem.findMany({
        where: { uploadId: prevUpload.id },
        include: { article: true },
      }),
    ])

    const todayByArticle = new Map(todayItems.map((i: any) => [i.articleId, i]))
    const yesterdayByArticle = new Map(yesterdayItems.map((i: any) => [i.articleId, i]))

    // Arrived: NEW articles (not in yesterday) OR articles whose system stock INCREASED
    // vs yesterday (units that arrived from another agency).
    let llegaron = todayItems
      .filter((i: any) => {
        const prev: any = yesterdayByArticle.get(i.articleId)
        if (!prev) return true // brand new article
        return i.stockSystem > prev.stockSystem // stock increased => arrivals
      })
      .map((i: any) => {
        const prev: any = yesterdayByArticle.get(i.articleId)
        const isNew = !prev
        const prevStockSystem = prev ? prev.stockSystem : 0
        return {
          articleId: i.articleId,
          dailyItemId: i.id,
          articleNumber: i.article?.articleNumber ?? '',
          description: i.article?.description ?? '',
          manufacturer: i.article?.manufacturer ?? '',
          locationCode: i.article?.locationCode ?? '',
          stockSystem: i.stockSystem,
          prevStockSystem,
          arrivedQty: isNew ? i.stockSystem : (i.stockSystem - prevStockSystem),
          isNew,
          costItem: i.costItem,
          price: i.price,
          lastSaleDate: i.lastSaleDate ?? null,
          countedBy: i.countedBy?.name ?? i.countedBy?.email ?? null,
          recounted: i.recounted ?? false,
          // New items: confirmed once counted. Reingreso items: confirmed only when
          // the physical count already matches the new (increased) system stock.
          confirmed: isNew ? i.stockPhysical !== null : (i.stockPhysical !== null && i.stockPhysical === i.stockSystem),
        }
      })
      .sort((a: any, b: any) => a.articleNumber.localeCompare(b.articleNumber))

    // Left: articles whose system stock DECREASED vs yesterday (units left to another
    // agency) OR articles that fully left the system (not in today).
    // Apply the 2-day FechaUltimaVenta window: only recent movements are shown.
    const salieron: any[] = []

    // 1) Fully departed: in yesterday but not in today
    for (const y of yesterdayItems as any[]) {
      if (todayByArticle.has(y.articleId)) continue
      // No "today" record => no fresh sale date; fall back to showing it.
      salieron.push({
        articleId: y.articleId,
        articleNumber: y.article?.articleNumber ?? '',
        description: y.article?.description ?? '',
        manufacturer: y.article?.manufacturer ?? '',
        locationCode: y.article?.locationCode ?? '',
        stockSystem: 0,
        prevStockSystem: y.stockSystem,
        departedQty: y.stockSystem,
        costItem: y.costItem,
        price: y.price,
        prevPhysical: y.stockPhysical,
        prevDifference: y.difference,
        wasFaltante: (y.difference ?? 0) < 0,
        wasSobrante: (y.difference ?? 0) > 0,
        lastSaleDate: y.lastSaleDate ?? null,
        fullyGone: true,
      })
    }

    // 2) Partial departure: still in today but system stock decreased vs yesterday
    for (const t of todayItems as any[]) {
      const prev: any = yesterdayByArticle.get(t.articleId)
      if (!prev) continue
      if (t.stockSystem >= prev.stockSystem) continue // no decrease
      if (!withinWindow(t.lastSaleDate)) continue // older than 2 days => ignore
      salieron.push({
        articleId: t.articleId,
        articleNumber: t.article?.articleNumber ?? '',
        description: t.article?.description ?? '',
        manufacturer: t.article?.manufacturer ?? '',
        locationCode: t.article?.locationCode ?? '',
        stockSystem: t.stockSystem,
        prevStockSystem: prev.stockSystem,
        departedQty: prev.stockSystem - t.stockSystem,
        costItem: t.costItem,
        price: t.price,
        prevPhysical: prev.stockPhysical,
        prevDifference: prev.difference,
        wasFaltante: (prev.difference ?? 0) < 0,
        wasSobrante: (prev.difference ?? 0) > 0,
        lastSaleDate: t.lastSaleDate ?? null,
        fullyGone: false,
      })
    }

    salieron.sort((a: any, b: any) => a.articleNumber.localeCompare(b.articleNumber))

    // Apply search filter
    let salieronFiltered = salieron
    if (search) {
      const s = search.toLowerCase()
      const filterFn = (item: any) =>
        item.articleNumber.toLowerCase().includes(s) ||
        item.description.toLowerCase().includes(s) ||
        item.manufacturer.toLowerCase().includes(s)
      llegaron = llegaron.filter(filterFn)
      salieronFiltered = salieron.filter(filterFn)
    }

    return NextResponse.json({
      llegaron: typeFilter === 'salieron' ? [] : llegaron,
      salieron: typeFilter === 'llegaron' ? [] : salieronFiltered,
      today: latestUpload.snapshotDate,
      yesterday: prevUpload.snapshotDate,
      totalLlegaron: typeFilter === 'salieron' ? 0 : llegaron.length,
      totalSalieron: typeFilter === 'llegaron' ? 0 : salieronFiltered.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { action, articleId, dailyItemId } = body

    const latestUpload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!latestUpload) return NextResponse.json({ error: 'No hay carga activa' }, { status: 400 })

    if (action === 'confirm-arrival') {
      // Confirm arrival: ADD the arrived quantity on top of the already-counted
      // physical stock (do not overwrite). If the item was not counted yet, set the
      // physical count to the full system stock (arrival received into empty count).
      const item = dailyItemId
        ? await prisma.dailyItem.findUnique({ where: { id: dailyItemId } })
        : await prisma.dailyItem.findFirst({ where: { uploadId: latestUpload.id, articleId } })
      if (!item) return NextResponse.json({ error: 'Artículo no encontrado en carga actual' }, { status: 404 })

      const arrivedQty = Number(body.arrivedQty ?? 0)
      let newPhysical: number
      if (item.stockPhysical === null) {
        // Not counted yet: receive full system stock as physical count
        newPhysical = item.stockSystem
      } else {
        // Already counted: add the arrived units on top of what was counted
        newPhysical = item.stockPhysical + arrivedQty
      }
      const difference = newPhysical - item.stockSystem

      await prisma.dailyItem.update({
        where: { id: item.id },
        data: {
          stockPhysical: newPhysical,
          difference,
          countedById: session.user.id,
          countedAt: new Date(),
        },
      })
      return NextResponse.json({
        success: true,
        message: 'Llegada confirmada, unidades sumadas al conteo',
        stockPhysical: newPhysical,
        difference,
      })
    }

    if (action === 'confirm-departure') {
      // Departure already auto-adjusted at upload time (physical count reduced).
      // This is just an acknowledgment.
      return NextResponse.json({ success: true, message: 'Salida confirmada, artículo regularizado' })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
