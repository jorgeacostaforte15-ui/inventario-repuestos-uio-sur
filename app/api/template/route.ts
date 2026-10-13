export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const headers = [
    'Número de artículo',
    'Descripción del artículo',
    'Fabricante',
    'Stock',
    'CostoItem',
    'Precio',
    'CodigoUbicacion',
    'OBSERVACION 1',
    'OBSERVACION 2',
  ]
  const sampleRow = {
    'Número de artículo': 'REP-001',
    'Descripción del artículo': 'Filtro de aceite motor 5W30',
    'Fabricante': 'Bosch',
    'Stock': 25,
    'CostoItem': 12.50,
    'Precio': 18.99,
    'CodigoUbicacion': '07A-A01-A-A01-ES',
    'OBSERVACION 1': '',
    'OBSERVACION 2': '',
  }
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers })
  ws['!cols'] = headers.map(() => ({ wch: 22 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Stock')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=STOCK_PLANTILLA.xlsx',
    },
  })
}
