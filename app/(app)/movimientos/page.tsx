'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowDownToLine, ArrowUpFromLine, Search, RefreshCw, Download, ArrowLeftRight, CheckCircle2, Check } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface MovItemLlegada {
  articleId: string
  dailyItemId: string
  articleNumber: string
  description: string
  manufacturer: string
  locationCode: string
  stockSystem: number
  prevStockSystem: number
  arrivedQty: number
  isNew: boolean
  costItem: number
  price: number
  lastSaleDate: string | null
  countedBy: string | null
  recounted: boolean
  confirmed: boolean
}

interface MovItemSalida {
  articleId: string
  articleNumber: string
  description: string
  manufacturer: string
  locationCode: string
  stockSystem: number
  prevStockSystem: number
  departedQty: number
  costItem: number
  price: number
  prevPhysical: number | null
  prevDifference: number | null
  wasFaltante: boolean
  wasSobrante: boolean
  lastSaleDate: string | null
  fullyGone: boolean
}

export default function MovimientosPage() {
  const [llegaron, setLlegaron] = useState<MovItemLlegada[]>([])
  const [salieron, setSalieron] = useState<MovItemSalida[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [today, setToday] = useState<string | null>(null)
  const [yesterday, setYesterday] = useState<string | null>(null)
  const [totalLlegaron, setTotalLlegaron] = useState(0)
  const [totalSalieron, setTotalSalieron] = useState(0)
  const [tab, setTab] = useState<'todos' | 'llegaron' | 'salieron'>('todos')
  const [confirming, setConfirming] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (tab !== 'todos') params.set('type', tab)
      const res = await fetch(`/api/movimientos?${params}`)
      const data = await res.json()
      setLlegaron(data?.llegaron ?? [])
      setSalieron(data?.salieron ?? [])
      setToday(data?.today ?? null)
      setYesterday(data?.yesterday ?? null)
      setTotalLlegaron(data?.totalLlegaron ?? 0)
      setTotalSalieron(data?.totalSalieron ?? 0)
    } catch {
      toast.error('Error al cargar movimientos')
    }
    setLoading(false)
  }, [search, tab])

  useEffect(() => { fetchData() }, [fetchData])

  const confirmArrival = async (item: MovItemLlegada) => {
    setConfirming(item.dailyItemId)
    try {
      const res = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm-arrival', articleId: item.articleId, dailyItemId: item.dailyItemId, arrivedQty: item.arrivedQty }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`✓ Llegada confirmada: ${item.articleNumber} (+${item.arrivedQty})`)
        setLlegaron(prev => prev.map(i => i.dailyItemId === item.dailyItemId ? { ...i, confirmed: true } : i))
      } else {
        toast.error(data.error || 'Error al confirmar')
      }
    } catch {
      toast.error('Error al confirmar llegada')
    }
    setConfirming(null)
  }

  const confirmAllArrivals = async () => {
    const unconfirmed = llegaron.filter(i => !i.confirmed)
    if (unconfirmed.length === 0) { toast.info('Todas las llegadas ya están confirmadas'); return }
    setConfirming('all')
    let ok = 0
    for (const item of unconfirmed) {
      try {
        const res = await fetch('/api/movimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm-arrival', articleId: item.articleId, dailyItemId: item.dailyItemId, arrivedQty: item.arrivedQty }),
        })
        const data = await res.json()
        if (data.success) ok++
      } catch {}
    }
    toast.success(`${ok} llegadas confirmadas`)
    setLlegaron(prev => prev.map(i => ({ ...i, confirmed: true })))
    setConfirming(null)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-EC', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  const exportExcel = () => {
    const rows: any[] = []
    if (tab !== 'salieron') {
      llegaron.forEach(i => rows.push({ Tipo: i.isNew ? 'NUEVO' : 'REINGRESO', Código: i.articleNumber, Descripción: i.description, Fabricante: i.manufacturer, Ubicación: i.locationCode, 'Stock ant.': i.prevStockSystem, 'Stock actual': i.stockSystem, 'Cant. llegó': i.arrivedQty, Costo: i.costItem, Precio: i.price, 'Últ. venta': i.lastSaleDate ? fmtDate(i.lastSaleDate) : '', 'Contado por': i.countedBy ?? '', Reconteo: i.recounted ? 'Sí' : '', Confirmado: i.confirmed ? 'Sí' : 'No' }))
    }
    if (tab !== 'llegaron') {
      salieron.forEach(i => rows.push({ Tipo: i.fullyGone ? 'SALIÓ' : 'VENTA/BAJA', Código: i.articleNumber, Descripción: i.description, Fabricante: i.manufacturer, Ubicación: i.locationCode, 'Stock ant.': i.prevStockSystem, 'Stock actual': i.fullyGone ? 0 : i.stockSystem, 'Cant. salió': i.departedQty, Costo: i.costItem, Precio: i.price, 'Físico ant.': i.prevPhysical ?? '', 'Dif. ant.': i.prevDifference ?? '', 'Últ. venta': i.lastSaleDate ? fmtDate(i.lastSaleDate) : '' }))
    }
    if (rows.length === 0) { toast.error('No hay datos para exportar'); return }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
    XLSX.writeFile(wb, `movimientos_${fmtDate(today)}.xlsx`)
    toast.success('Excel descargado')
  }

  const confirmedCount = llegaron.filter(i => i.confirmed).length

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-indigo-600" /> Movimientos del Día
            </h1>
            <p className="text-sm text-muted-foreground">
              Artículos que llegaron o salieron comparando con el día anterior
              {today && yesterday && (
                <span className="ml-1">— {fmtDate(yesterday)} → {fmtDate(today)}</span>
              )}
              {today && !yesterday && (
                <span className="ml-1">— Primera carga: {fmtDate(today)}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTab(tab === 'llegaron' ? 'todos' : 'llegaron')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownToLine className="h-3.5 w-3.5 text-green-600" /> Llegaron (nuevos + reingresos)
                </p>
                <p className="font-mono font-bold text-green-600 text-xl">{totalLlegaron}</p>
                {totalLlegaron > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {confirmedCount}/{totalLlegaron} confirmados
                  </p>
                )}
              </div>
              {tab === 'llegaron' && <Badge className="bg-green-600">Filtrado</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTab(tab === 'salieron' ? 'todos' : 'salieron')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-red-600" /> Salieron (bajas y ventas)
                </p>
                <p className="font-mono font-bold text-red-600 text-xl">{totalSalieron}</p>
              </div>
              {tab === 'salieron' && <Badge variant="destructive">Filtrado</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, descripción o fabricante..."
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading && <div className="text-center text-sm text-muted-foreground py-8">Cargando movimientos...</div>}

      {!loading && (
        <>
          {/* Llegaron */}
          {tab !== 'salieron' && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownToLine className="h-4 w-4 text-green-600" />
                    Llegaron
                    <Badge variant="outline" className="ml-1 border-green-300 text-green-600">{totalLlegaron}</Badge>
                  </CardTitle>
                  {llegaron.some(i => !i.confirmed) && (
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={confirmAllArrivals}
                      disabled={confirming === 'all'}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {confirming === 'all' ? 'Confirmando...' : 'Confirmar todas'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Stock ant.</TableHead>
                      <TableHead className="text-right">Stock actual</TableHead>
                      <TableHead className="text-right">Cant. llegó</TableHead>
                      <TableHead className="text-right">Valor Costo</TableHead>
                      <TableHead>Últ. venta</TableHead>
                      <TableHead>Contado por</TableHead>
                      <TableHead className="text-center">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {llegaron.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-6 text-muted-foreground">
                          No hay artículos que llegaron
                        </TableCell>
                      </TableRow>
                    )}
                    {llegaron.map((item) => (
                      <TableRow key={item.dailyItemId} className={item.confirmed ? 'bg-green-50/30 dark:bg-green-900/5' : 'bg-green-50/50 dark:bg-green-900/10'}>
                        <TableCell className="font-mono text-xs font-medium">{item.articleNumber}</TableCell>
                        <TableCell className="text-sm max-w-[220px] truncate">{item.description}</TableCell>
                        <TableCell className="text-sm">{item.manufacturer || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{item.locationCode || '—'}</TableCell>
                        <TableCell>
                          {item.isNew ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Nuevo</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">Reingreso</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{item.isNew ? '—' : item.prevStockSystem}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{item.stockSystem}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">+{item.arrivedQty}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">$ {fmt(item.stockSystem * item.costItem)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(item.lastSaleDate)}</TableCell>
                        <TableCell className="text-xs">
                          {item.countedBy ? (
                            <span className="inline-flex items-center gap-1">
                              {item.countedBy}
                              {item.recounted && <Badge variant="outline" className="border-amber-300 text-amber-600 text-[10px] px-1 py-0">Reconteo</Badge>}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.confirmed ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Check className="h-3 w-3 mr-1" /> Confirmado
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => confirmArrival(item)}
                              disabled={confirming === item.dailyItemId}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              {confirming === item.dailyItemId ? 'Confirmando...' : 'Confirmar'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Salieron */}
          {tab !== 'llegaron' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-red-600" />
                  Salieron (bajas y ventas)
                  <Badge variant="outline" className="ml-1 border-red-300 text-red-600">{totalSalieron}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Artículos que salieron del sistema o cuyo stock disminuyó (ventas de los últimos 2 días). El conteo físico se ajusta automáticamente al cargar el archivo.
                </p>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Stock ant.</TableHead>
                      <TableHead className="text-right">Stock actual</TableHead>
                      <TableHead className="text-right">Cant. salió</TableHead>
                      <TableHead className="text-right">Físico ant.</TableHead>
                      <TableHead className="text-right">Dif. ant.</TableHead>
                      <TableHead>Últ. venta</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salieron.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-6 text-muted-foreground">
                          No hay artículos que salieron
                        </TableCell>
                      </TableRow>
                    )}
                    {salieron.map((item, idx) => (
                      <TableRow key={`sal-${idx}`} className="bg-red-50/50 dark:bg-red-900/5">
                        <TableCell className="font-mono text-xs font-medium">{item.articleNumber}</TableCell>
                        <TableCell className="text-sm max-w-[220px] truncate">{item.description}</TableCell>
                        <TableCell className="text-sm">{item.manufacturer || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{item.locationCode || '—'}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{item.prevStockSystem}</TableCell>
                        <TableCell className="text-right font-mono">{item.fullyGone ? '—' : item.stockSystem}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">-{item.departedQty}</TableCell>
                        <TableCell className="text-right font-mono">{item.prevPhysical ?? '—'}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${(item.prevDifference ?? 0) < 0 ? 'text-red-600' : (item.prevDifference ?? 0) > 0 ? 'text-teal-600' : ''}`}>
                          {item.prevDifference ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(item.lastSaleDate)}</TableCell>
                        <TableCell>
                          {item.fullyGone ? (
                            <>
                              {item.wasFaltante && <Badge variant="destructive" className="text-xs">Era faltante → Regularizado</Badge>}
                              {item.wasSobrante && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs">Era sobrante → Regularizado</Badge>}
                              {!item.wasFaltante && !item.wasSobrante && <Badge variant="outline" className="text-xs">Salió del sistema</Badge>}
                            </>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">Venta / baja parcial</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
