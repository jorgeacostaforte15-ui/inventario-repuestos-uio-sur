export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const articleNumber = url.searchParams.get('articleNumber') ?? ''

    const uploads = await prisma.dailyUpload.findMany({
      orderBy: { snapshotDate: 'desc' },
      include: {
        uploadedBy: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    })

    const result = []
    for (const u of uploads) {
      const items = await prisma.dailyItem.findMany({ where: { uploadId: u.id } })
      const counted = items.filter((i: any) => i.stockPhysical !== null).length
      const withDiff = items.filter((i: any) => i.difference !== null && i.difference !== 0).length

      let articleDetail = null
      if (articleNumber) {
        const art = await prisma.articleCatalog.findUnique({ where: { articleNumber } })
        if (art) {
          const item = items.find((i: any) => i.articleId === art.id)
          if (item) {
            articleDetail = {
              stockSystem: item.stockSystem,
              stockPhysical: item.stockPhysical,
              difference: item.difference,
              costItem: item.costItem,
              price: item.price,
            }
          }
        }
      }

      result.push({
        id: u.id,
        snapshotDate: u.snapshotDate,
        fileName: u.fileName,
        uploadedBy: u.uploadedBy?.name ?? u.uploadedBy?.email ?? 'Desconocido',
        totalArticles: u._count?.items ?? 0,
        counted,
        withDifferences: withDiff,
        articleDetail,
      })
    }

    return NextResponse.json({ uploads: result })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
