export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const date1Str = url.searchParams.get('date1') ?? ''
    const date2Str = url.searchParams.get('date2') ?? ''
    if (!date1Str || !date2Str) return NextResponse.json({ error: 'Se requieren dos fechas' }, { status: 400 })

    const date1 = new Date(date1Str)
    date1.setHours(0, 0, 0, 0)
    const date2 = new Date(date2Str)
    date2.setHours(0, 0, 0, 0)

    const upload1 = await prisma.dailyUpload.findUnique({ where: { snapshotDate: date1 } })
    const upload2 = await prisma.dailyUpload.findUnique({ where: { snapshotDate: date2 } })
    if (!upload1 || !upload2) {
      return NextResponse.json({ error: 'No se encontraron datos para una o ambas fechas' }, { status: 404 })
    }

    const [items1, items2] = await Promise.all([
      prisma.dailyItem.findMany({ where: { uploadId: upload1.id }, include: { article: true } }),
      prisma.dailyItem.findMany({ where: { uploadId: upload2.id }, include: { article: true } }),
    ])

    const map1 = new Map(items1.map((i: any) => [i.articleId, i]))
    const map2 = new Map(items2.map((i: any) => [i.articleId, i]))
    const allArticleIds = new Set([...map1.keys(), ...map2.keys()])

    const comparisons: any[] = []
    for (const artId of allArticleIds) {
      const i1 = map1.get(artId)
      const i2 = map2.get(artId)
      const article = i1?.article ?? i2?.article
      const diff1 = i1?.difference ?? null
      const diff2 = i2?.difference ?? null

      let status = 'sin_cambio'
      if (i1 && !i2) status = 'desaparecido'
      else if (!i1 && i2) status = 'nuevo'
      else if (diff1 === null && diff2 !== null && diff2 !== 0) status = 'nuevo_diff'
      else if (diff1 !== null && diff1 !== 0 && (diff2 === null || diff2 === 0)) status = 'corregido'
      else if (diff1 !== diff2) status = 'cambio'

      if (status !== 'sin_cambio') {
        comparisons.push({
          articleNumber: article?.articleNumber ?? '',
          description: article?.description ?? '',
          manufacturer: article?.manufacturer ?? '',
          locationCode: article?.locationCode ?? '',
          date1Stock: i1?.stockSystem ?? null,
          date1Physical: i1?.stockPhysical ?? null,
          date1Diff: diff1,
          date2Stock: i2?.stockSystem ?? null,
          date2Physical: i2?.stockPhysical ?? null,
          date2Diff: diff2,
          status,
        })
      }
    }

    return NextResponse.json({
      date1: date1.toISOString(),
      date2: date2.toISOString(),
      comparisons: comparisons.sort((a: any, b: any) => {
        const order: any = { desaparecido: 0, nuevo: 1, nuevo_diff: 2, cambio: 3, corregido: 4 }
        return (order[a.status] ?? 5) - (order[b.status] ?? 5)
      }),
      total: comparisons.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
