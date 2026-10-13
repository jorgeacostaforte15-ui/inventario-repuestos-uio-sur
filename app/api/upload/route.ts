export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

const REQUIRED_COLUMNS = [
  'Número de artículo',
  'Descripción del artículo',
  'Fabricante',
  'Stock',
  'CostoItem',
  'Precio',
  'CodigoUbicacion',
]

type RowData = { stock: number; cost: number; price: number; obs1: string; obs2: string; lastSaleDate: Date | null }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden subir archivos' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se encontró el archivo' }, { status: 400 })
    }

    // Parse date from filename or use today
    let snapshotDate = new Date()
    snapshotDate.setHours(0, 0, 0, 0)
    const nameMatch = file.name.match(/STOCK_(\d{2})-(\d{2})-(\d{4})/i)
    if (nameMatch) {
      const [, dd, mm, yyyy] = nameMatch
      snapshotDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
      snapshotDate.setHours(0, 0, 0, 0)
    }

    // Read Excel
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames?.[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'El archivo Excel está vacío' }, { status: 400 })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    if (!rows?.length) {
      return NextResponse.json({ error: 'El archivo no contiene filas de datos' }, { status: 400 })
    }

    // Validate columns
    const headers = Object.keys(rows[0] ?? {})
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
    if (missing.length > 0) {
      return NextResponse.json({ error: `Columnas faltantes en el Excel: ${missing.join(', ')}` }, { status: 400 })
    }

    // Helper: parse FechaUltimaVenta which can be an Excel date serial number or a date string
    const parseSaleDate = (raw: any): Date | null => {
      if (raw === null || raw === undefined || raw === '') return null
      if (typeof raw === 'number' && raw > 0) {
        const parsed = XLSX.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(raw) : null
        if (parsed && parsed.y) {
          const d = new Date(parsed.y, (parsed.m || 1) - 1, parsed.d || 1)
          d.setHours(0, 0, 0, 0)
          return isNaN(d.getTime()) ? null : d
        }
        const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
        d.setHours(0, 0, 0, 0)
        return isNaN(d.getTime()) ? null : d
      }
      const s = String(raw).trim()
      if (!s) return null
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
      if (m) {
        let [, dd, mm, yyyy] = m
        let year = parseInt(yyyy)
        if (year < 100) year += 2000
        const d = new Date(year, parseInt(mm) - 1, parseInt(dd))
        d.setHours(0, 0, 0, 0)
        return isNaN(d.getTime()) ? null : d
      }
      const d = new Date(s)
      if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d }
      return null
    }

    // Step 0: Read all rows into a map keyed by articleNumber (last wins, dedup)
    const rowDataByNum = new Map<string, RowData>()
    const metaByNum = new Map<string, { desc: string; mfr: string; loc: string }>()
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const artNum = String(row['Número de artículo'] ?? '').trim()
      if (!artNum) {
        errors.push(`Fila ${i + 2}: Número de artículo vacío`)
        continue
      }
      const stock = parseFloat(row['Stock']) || 0
      const cost = parseFloat(row['CostoItem']) || 0
      const price = parseFloat(row['Precio']) || 0
      const desc = String(row['Descripción del artículo'] ?? '').trim()
      const mfr = String(row['Fabricante'] ?? '').trim()
      const loc = String(row['CodigoUbicacion'] ?? '').trim()
      const obs1 = String(row['OBSERVACION 1'] ?? row['OBSERVACIÓN 1'] ?? '').trim()
      const obs2 = String(row['OBSERVACION 2'] ?? row['OBSEVACION 2'] ?? row['OBSERVACIÓN 2'] ?? '').trim()
      const lastSaleDate = parseSaleDate(
        row['FechaUltimaVenta'] ?? row['Fecha Ultima Venta'] ?? row['FechaÚltimaVenta'] ?? row['Fecha Última Venta'] ?? row['FECHAULTIMAVENTA'] ?? ''
      )
      rowDataByNum.set(artNum, { stock, cost, price, obs1, obs2, lastSaleDate })
      metaByNum.set(artNum, { desc, mfr, loc })
    }

    if (rowDataByNum.size === 0) {
      return NextResponse.json({ error: 'No se encontraron artículos válidos en el archivo' }, { status: 400 })
    }

    // Step 1: Bulk upsert all articles in a single query, return id <-> articleNumber
    const articlesPayload = [...metaByNum.entries()].map(([articleNumber, m]) => ({
      articleNumber,
      description: m.desc,
      manufacturer: m.mfr,
      locationCode: m.loc,
    }))

    const upsertedArticles = await prisma.$queryRaw<{ id: string; articleNumber: string }[]>`
      INSERT INTO "ArticleCatalog" (id, "articleNumber", description, manufacturer, "locationCode", "createdAt", "updatedAt")
      SELECT gen_random_uuid()::text, v."articleNumber", v.description, v.manufacturer, v."locationCode", now(), now()
      FROM jsonb_to_recordset(${JSON.stringify(articlesPayload)}::jsonb)
        AS v("articleNumber" text, description text, manufacturer text, "locationCode" text)
      ON CONFLICT ("articleNumber") DO UPDATE SET
        description = EXCLUDED.description,
        manufacturer = EXCLUDED.manufacturer,
        "locationCode" = EXCLUDED."locationCode",
        "updatedAt" = now()
      RETURNING id, "articleNumber"
    `

    // Build map articleId -> Excel data
    const excelArticleMap = new Map<string, RowData>()
    for (const a of upsertedArticles) {
      const data = rowDataByNum.get(a.articleNumber)
      if (data) excelArticleMap.set(a.id, data)
    }

    // Two-day window (relative to snapshotDate) for movement-based auto-adjust
    const twoDaysAgo = new Date(snapshotDate)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    // Step 2: Check for existing upload on same date
    const existingUpload = await prisma.dailyUpload.findUnique({ where: { snapshotDate } })

    let uploadId: string
    let carried = 0
    let regularized = 0
    let newItems = 0
    let autoAdjusted = 0

    if (existingUpload) {
      // ========== UPDATE MODE ==========
      uploadId = existingUpload.id

      const existingItems = await prisma.dailyItem.findMany({ where: { uploadId: existingUpload.id } })
      const existingItemMap = new Map<string, (typeof existingItems)[0]>()
      for (const item of existingItems) existingItemMap.set(item.articleId, item)

      // Carry-forward counts for brand-new articles entering this upload
      const newArticleIds = [...excelArticleMap.keys()].filter((id) => !existingItemMap.has(id))
      const prevCountsForNew = new Map<string, { stockPhysical: number; countedById: string | null; countedAt: Date | null }>()
      if (newArticleIds.length > 0) {
        const prevUpload = await prisma.dailyUpload.findFirst({
          where: { snapshotDate: { lt: snapshotDate } },
          orderBy: { snapshotDate: 'desc' },
        })
        if (prevUpload) {
          const prevItems = await prisma.dailyItem.findMany({
            where: { uploadId: prevUpload.id, articleId: { in: newArticleIds }, stockPhysical: { not: null } },
            select: { articleId: true, stockPhysical: true, countedById: true, countedAt: true },
          })
          for (const pi of prevItems) {
            prevCountsForNew.set(pi.articleId, {
              stockPhysical: pi.stockPhysical!,
              countedById: pi.countedById,
              countedAt: pi.countedAt,
            })
          }
        }
      }

      // Build bulk UPDATE payload for kept items, and delete list for regularized ones
      const updatesPayload: any[] = []
      const regularizedIds: string[] = []
      for (const [articleId, item] of existingItemMap) {
        const newData = excelArticleMap.get(articleId)
        if (newData) {
          let physical = item.stockPhysical
          const stockDecreased = newData.stock < item.stockSystem
          const saleRecent = !!newData.lastSaleDate && newData.lastSaleDate >= twoDaysAgo
          if (physical !== null && stockDecreased && saleRecent) {
            const departedQty = item.stockSystem - newData.stock
            physical = Math.max(0, physical - departedQty)
            autoAdjusted++
          }
          let difference: number | null = item.difference
          if (physical !== null) {
            difference = physical - newData.stock
            carried++
          }
          updatesPayload.push({
            id: item.id,
            stock: newData.stock,
            cost: newData.cost,
            price: newData.price,
            obs1: newData.obs1,
            obs2: newData.obs2,
            lsd: newData.lastSaleDate ? newData.lastSaleDate.toISOString() : null,
            phys: physical,
            diff: difference,
          })
        } else {
          regularizedIds.push(item.id)
          regularized++
        }
      }

      // Bulk update kept items (chunked single-statement updates)
      for (const part of chunk(updatesPayload, 1000)) {
        await prisma.$executeRaw`
          UPDATE "DailyItem" AS di SET
            "stockSystem" = v.stock,
            "costItem" = v.cost,
            "price" = v.price,
            observation1 = v.obs1,
            observation2 = v.obs2,
            "lastSaleDate" = v.lsd,
            "stockPhysical" = v.phys,
            difference = v.diff,
            "updatedAt" = now()
          FROM jsonb_to_recordset(${JSON.stringify(part)}::jsonb)
            AS v(id text, stock double precision, cost double precision, price double precision,
                 obs1 text, obs2 text, lsd timestamp, phys double precision, diff double precision)
          WHERE di.id = v.id
        `
      }

      // Delete regularized items
      if (regularizedIds.length > 0) {
        await prisma.dailyItem.deleteMany({ where: { id: { in: regularizedIds } } })
      }

      // Create new items with carry-forward
      const createData: any[] = newArticleIds.map((articleId) => {
        const data = excelArticleMap.get(articleId)!
        const prevCount = prevCountsForNew.get(articleId)
        const itemData: any = {
          uploadId: existingUpload.id,
          articleId,
          stockSystem: data.stock,
          costItem: data.cost,
          price: data.price,
          observation1: data.obs1,
          observation2: data.obs2,
          lastSaleDate: data.lastSaleDate,
        }
        if (prevCount) {
          itemData.stockPhysical = prevCount.stockPhysical
          itemData.difference = prevCount.stockPhysical - data.stock
          itemData.countedById = prevCount.countedById
          itemData.countedAt = prevCount.countedAt
          carried++
        } else {
          newItems++
        }
        return itemData
      })
      for (const part of chunk(createData, 500)) {
        await prisma.dailyItem.createMany({ data: part })
      }

      await prisma.dailyUpload.update({
        where: { id: existingUpload.id },
        data: { totalArticles: excelArticleMap.size, fileName: file.name },
      })
    } else {
      // ========== CREATE MODE ==========
      const prevUpload = await prisma.dailyUpload.findFirst({
        where: { snapshotDate: { lt: snapshotDate } },
        orderBy: { snapshotDate: 'desc' },
      })

      const prevCountMap = new Map<string, { stockPhysical: number; countedById: string | null; countedAt: Date | null; stockSystem: number; recounted: boolean }>()
      if (prevUpload) {
        const prevItems = await prisma.dailyItem.findMany({
          where: { uploadId: prevUpload.id, stockPhysical: { not: null } },
          select: { articleId: true, stockPhysical: true, countedById: true, countedAt: true, stockSystem: true, recounted: true },
        })
        for (const pi of prevItems) {
          prevCountMap.set(pi.articleId, {
            stockPhysical: pi.stockPhysical!,
            countedById: pi.countedById,
            countedAt: pi.countedAt,
            stockSystem: pi.stockSystem,
            recounted: pi.recounted,
          })
        }
      }

      const upload = await prisma.dailyUpload.create({
        data: {
          snapshotDate,
          fileName: file.name,
          totalArticles: excelArticleMap.size,
          uploadedById: session.user.id,
        },
      })
      uploadId = upload.id

      const createData: any[] = []
      for (const [articleId, data] of excelArticleMap) {
        const prevCount = prevCountMap.get(articleId)
        const itemData: any = {
          uploadId: upload.id,
          articleId,
          stockSystem: data.stock,
          costItem: data.cost,
          price: data.price,
          observation1: data.obs1,
          observation2: data.obs2,
          lastSaleDate: data.lastSaleDate,
        }
        if (prevCount) {
          let physical = prevCount.stockPhysical
          const stockDecreased = data.stock < prevCount.stockSystem
          const saleRecent = !!data.lastSaleDate && data.lastSaleDate >= twoDaysAgo
          if (stockDecreased && saleRecent) {
            const departedQty = prevCount.stockSystem - data.stock
            physical = Math.max(0, physical - departedQty)
            autoAdjusted++
          }
          itemData.stockPhysical = physical
          itemData.difference = physical - data.stock
          itemData.countedById = prevCount.countedById
          itemData.countedAt = prevCount.countedAt
          itemData.recounted = prevCount.recounted
          carried++
        } else {
          newItems++
        }
        createData.push(itemData)
      }
      for (const part of chunk(createData, 500)) {
        await prisma.dailyItem.createMany({ data: part })
      }

      // Transfer ManualSurplus from previous upload to new one
      if (prevUpload) {
        const prevManual = await prisma.manualSurplus.findMany({ where: { uploadId: prevUpload.id } })
        if (prevManual.length > 0) {
          await prisma.manualSurplus.createMany({
            data: prevManual.map((ms) => ({
              uploadId: upload.id,
              articleNumber: ms.articleNumber,
              description: ms.description,
              manufacturer: ms.manufacturer,
              locationCode: ms.locationCode,
              stockPhysical: ms.stockPhysical,
              observation: ms.observation,
              addedById: ms.addedById,
              createdAt: ms.createdAt,
            })),
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      uploadId,
      date: snapshotDate.toISOString(),
      processed: excelArticleMap.size,
      carried,
      regularized,
      newItems,
      autoAdjusted,
      total: rows.length,
      errors: errors.slice(0, 20),
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error?.message ?? 'Error al procesar el archivo' }, { status: 500 })
  }
}
