export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get latest upload
    const upload = await prisma.dailyUpload.findFirst({ orderBy: { snapshotDate: 'desc' } })
    if (!upload) return NextResponse.json({ locations: [] })

    // Get distinct location codes from articles that have items in this upload
    const result = await prisma.dailyItem.findMany({
      where: { uploadId: upload.id },
      select: { article: { select: { locationCode: true } } },
      distinct: ['articleId'],
    })

    const locationSet = new Set<string>()
    let noLocationCount = 0
    for (const r of result) {
      const loc = r.article?.locationCode?.trim() ?? ''
      if (loc === '') {
        noLocationCount++
      } else {
        locationSet.add(loc)
      }
    }

    const locations = Array.from(locationSet).sort((a, b) => a.localeCompare(b, 'es'))

    return NextResponse.json({ locations, noLocationCount })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
