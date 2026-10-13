export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '50')
    const search = url.searchParams.get('search') ?? ''
    const manufacturer = url.searchParams.get('manufacturer') ?? ''
    const location = url.searchParams.get('location') ?? ''
    const uploadId = url.searchParams.get('uploadId') ?? ''
    const filter = url.searchParams.get('filter') ?? '' // 'faltantes' | 'sobrantes' | 'pending' | ''

    // Get latest upload or specific one
    let upload
    if (uploadId) {
      upload = await prisma.dailyUpload.findUnique({ where: { id: uploadId } })
    } else {
      upload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    }
    if (!upload) {
      return NextResponse.json({ items: [], total: 0, page, limit })
    }

    const where: any = { uploadId: upload.id }

    if (search) {
      // Build search variants to handle barcode scanners that omit hyphens
      // e.g. scanner reads S137151733 but DB has S1371-51733
      const searchClean = search.replace(/[-\s]/g, '')
      const searchVariants = new Set([search, searchClean])
      // If no hyphen in search and long enough, try inserting hyphen at common positions (4,5,6)
      if (!search.includes('-') && search.length > 4) {
        for (const pos of [4, 5, 6]) {
          if (pos < search.length) {
            searchVariants.add(search.slice(0, pos) + '-' + search.slice(pos))
          }
        }
      }
      const articleConditions = Array.from(searchVariants).map(v => ({
        article: { articleNumber: { contains: v, mode: 'insensitive' as const } },
      }))
      where.OR = [
        ...articleConditions,
        { article: { description: { contains: search, mode: 'insensitive' } } },
        { article: { locationCode: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (manufacturer) {
      where.article = { ...(where.article ?? {}), manufacturer: { contains: manufacturer, mode: 'insensitive' } }
    }
    if (location) {
      where.article = { ...(where.article ?? {}), locationCode: { contains: location, mode: 'insensitive' } }
    }
    if (filter === 'faltantes') {
      where.difference = { lt: 0 }
    } else if (filter === 'sobrantes') {
      where.difference = { gt: 0 }
    } else if (filter === 'pending') {
      where.stockPhysical = null
    } else if (filter === 'counted') {
      where.stockPhysical = { not: null }
    } else if (filter === 'noLocation') {
      where.article = { ...(where.article ?? {}), locationCode: '' }
    } else if (filter === 'continuar') {
      // "Continue where I left off" — uncounted items, sorted from the last counted position
      // Per-user: use the current user's own last counted item; fall back to global if none.
      let lastCounted = await prisma.dailyItem.findFirst({
        where: { uploadId: upload.id, stockPhysical: { not: null }, countedById: session.user.id },
        include: { article: { select: { locationCode: true, articleNumber: true } } },
        orderBy: [{ countedAt: 'desc' }],
      })
      if (!lastCounted) {
        lastCounted = await prisma.dailyItem.findFirst({
          where: { uploadId: upload.id, stockPhysical: { not: null } },
          include: { article: { select: { locationCode: true, articleNumber: true } } },
          orderBy: [{ article: { locationCode: 'desc' } }, { article: { articleNumber: 'desc' } }],
        })
      }
      where.stockPhysical = null
      // We'll handle the "starting from" via orderBy in the query (same default order)
      // Store lastCounted info to send to client
      ;(where as any).__lastCounted = lastCounted ? {
        articleNumber: lastCounted.article?.articleNumber ?? '',
        locationCode: lastCounted.article?.locationCode ?? '',
      } : null
    } else if (filter === 'porContar') {
      // Items that need counting: uncounted today OR had a difference in the previous day
      // Find previous upload to check for differences
      const prevUpload = await prisma.dailyUpload.findFirst({
        where: { snapshotDate: { lt: upload.snapshotDate } },
        orderBy: { snapshotDate: 'desc' },
      })
      if (prevUpload) {
        // Get article IDs that had differences in previous day
        const prevDiffItems = await prisma.dailyItem.findMany({
          where: { uploadId: prevUpload.id, difference: { not: 0 } },
          select: { articleId: true },
        })
        const prevDiffArticleIds = prevDiffItems.map((i: any) => i.articleId)
        // Show: uncounted today OR had difference yesterday
        where.OR = [
          ...(where.OR ?? []),
          { stockPhysical: null },
          { articleId: { in: prevDiffArticleIds } },
        ]
      } else {
        // No previous upload — just show uncounted
        where.stockPhysical = null
      }
    }

    // Extract metadata before querying
    const lastCounted = (where as any).__lastCounted ?? null
    delete (where as any).__lastCounted

    const [total, items] = await Promise.all([
      prisma.dailyItem.count({ where }),
      prisma.dailyItem.findMany({
        where,
        include: { article: true, countedBy: { select: { name: true, email: true } } },
        orderBy: filter === 'faltantes' ? { difference: 'asc' } : filter === 'sobrantes' ? { difference: 'desc' } : [{ article: { locationCode: 'asc' } }, { article: { articleNumber: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // Fetch previous day differences for these articles to show context
    let prevDiffMap: Record<string, number> = {}
    if (items.length > 0) {
      const prevUploadForContext = await prisma.dailyUpload.findFirst({
        where: { snapshotDate: { lt: upload.snapshotDate } },
        orderBy: { snapshotDate: 'desc' },
      })
      if (prevUploadForContext) {
        const articleIds = items.map((i: any) => i.articleId)
        const prevItems = await prisma.dailyItem.findMany({
          where: { uploadId: prevUploadForContext.id, articleId: { in: articleIds } },
          select: { articleId: true, difference: true },
        })
        for (const pi of prevItems) {
          if (pi.difference !== null && pi.difference !== 0) {
            prevDiffMap[pi.articleId] = pi.difference
          }
        }
      }
    }

    return NextResponse.json({
      items: items.map((i: any) => ({
        id: i.id,
        articleNumber: i.article?.articleNumber ?? '',
        description: i.article?.description ?? '',
        manufacturer: i.article?.manufacturer ?? '',
        locationCode: i.article?.locationCode ?? '',
        stockSystem: i.stockSystem,
        costItem: i.costItem,
        price: i.price,
        stockPhysical: i.stockPhysical,
        difference: i.difference,
        prevDifference: prevDiffMap[i.articleId] ?? null,
        observation1: i.observation1 ?? '',
        observation2: i.observation2 ?? '',
        countedBy: i.countedBy?.name ?? i.countedBy?.email ?? null,
        countedAt: i.countedAt,
        recounted: i.recounted ?? false,
        lastSaleDate: i.lastSaleDate ?? null,
        valueDiffCost: i.difference !== null ? Math.round((i.difference ?? 0) * (i.costItem ?? 0) * 100) / 100 : null,
        valueDiffPrice: i.difference !== null ? Math.round((i.difference ?? 0) * (i.price ?? 0) * 100) / 100 : null,
        valueStockCost: Math.round((i.stockSystem ?? 0) * (i.costItem ?? 0) * 100) / 100,
        valueStockPrice: Math.round((i.stockSystem ?? 0) * (i.price ?? 0) * 100) / 100,
      })),
      total,
      page,
      limit,
      uploadId: upload.id,
      snapshotDate: upload.snapshotDate,
      ...(lastCounted !== undefined ? { lastCounted } : {}),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
