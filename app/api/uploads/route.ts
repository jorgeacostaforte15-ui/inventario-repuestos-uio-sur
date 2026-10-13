export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const uploads = await prisma.dailyUpload.findMany({
      orderBy: { snapshotDate: 'desc' },
      select: { id: true, snapshotDate: true, fileName: true, totalArticles: true },
    })
    return NextResponse.json({ uploads })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
