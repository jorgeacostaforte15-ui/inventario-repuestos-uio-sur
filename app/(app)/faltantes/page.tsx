'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, Download, Search, ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export default function FaltantesPage() {
  const [items, setItems] = useState<any[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [location, setLocation] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [savingCount, setSavingCount] = useState(false)
  const limit = 30

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ filter: 'faltantes', page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      if (manufacturer) params.set('manufacturer', manufacturer)
      if (location) params.set('location', location)
      const [itemsRes, totalsRes] = await Promise.all([
        fetch(`/api/items?${params}`),
        fetch('/api/faltantes/totals'),
      ])
      const itemsData = await itemsRes.json()
      const totalsData = await totalsRes.json()
      setItems(itemsData?.items ?? [])
      setTotal(itemsData?.total ?? 0)
      setTotals(totalsData)
    } catch {}
    setLoading(false)
  }, [page, search, manufacturer, location])

  useEffect(() => { fetchData() }, [fetchData])

  const updateObs = async (itemId: string, field: string, value: string) => {
    try {
      await fetch('/api/count', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, [field]: value }),
      })
      toast.success('Observación guardada')
    } catch { toast.error('Error al guardar') }
  }

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setEditVal(item.stockPhysical != null ? String(item.stockPhysical) : '')
  }

  const saveCount = async (itemId: string) => {
    if (editVal === '' || isNaN(parseFloat(editVal))) { toast.error('Ingrese una cantidad válida'); return }
    setSavingCount(true)
    try {
      const res = await fetch('/api/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, stockPhysical: parseFloat(editVal) }),
      })
      if (res.ok) {
        toast.success('Conteo actualizado')
        setEditingId(null)
        fetchData()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Error al guardar')
      }
    } catch { toast.error('Error de conexión') }
    setSavingCount(false)
  }

  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  const fmt = (n: number) => new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" /> Faltantes
            </h1>
            <p className="text-sm text-muted-foreground">Artículos donde el stock físico es menor al del sistema</p>
          </div>
          <a href="/api/export?filter=faltantes" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar Excel</Button>
          </a>
        </div>
      </FadeIn>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total faltantes</p>
              <p className="font-mono font-bold text-red-600">{totals.count} artículos ({totals.totalDiff})</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Valor (Costo)</p>
              <p className="font-mono font-bold text-red-600">$ {fmt(totals.totalValueCost)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Valor (Precio)</p>
              <p className="font-mono font-bold text-red-600">$ {fmt(totals.totalValuePrice)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e: any) => { setSearch(e.target.value); setPage(1) }} className="pl-10" />
        </div>
        <Input placeholder="Fabricante" value={manufacturer} onChange={(e: any) => { setManufacturer(e.target.value); setPage(1) }} className="w-36" />
        <Input placeholder="Ubicación" value={location} onChange={(e: any) => { setLocation(e.target.value); setPage(1) }} className="w-36" />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Físico</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Val. Costo</TableHead>
                <TableHead className="text-right">Val. Precio</TableHead>
                <TableHead>Contado por</TableHead>
                <TableHead>Obs 1</TableHead>
                <TableHead>Obs 2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={12} className="text-center py-8">Cargando...</TableCell></TableRow>}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No hay faltantes</TableCell></TableRow>}
              {items.map((item: any) => (
                <TableRow key={item.id} className="bg-red-50/50 dark:bg-red-900/10">
                  <TableCell className="font-mono text-xs">{item.articleNumber}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{item.description}</TableCell>
                  <TableCell className="text-sm">{item.manufacturer}</TableCell>
                  <TableCell className="font-mono text-xs">{item.locationCode}</TableCell>
                  <TableCell className="text-right font-mono">{item.stockSystem}</TableCell>
                  <TableCell className="text-right font-mono">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input type="number" value={editVal} autoFocus onChange={(e: any) => setEditVal(e.target.value)} className="w-20 h-7 text-xs text-right" />
                        <Button size="icon-sm" variant="ghost" disabled={savingCount} onClick={() => saveCount(item.id)}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <span>{item.stockPhysical ?? '-'}</span>
                        <Button size="icon-sm" variant="ghost" onClick={() => startEdit(item)} title="Editar conteo"><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-red-600">{item.difference}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">$ {fmt(Math.abs(item.valueDiffCost ?? 0))}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">$ {fmt(Math.abs(item.valueDiffPrice ?? 0))}</TableCell>
                  <TableCell className="text-xs">
                    {item.countedBy ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1">
                          {item.countedBy}
                          {item.recounted && <Badge variant="outline" className="border-amber-300 text-amber-600 text-[10px] px-1 py-0">Reconteo</Badge>}
                        </span>
                        {item.countedAt && <span className="text-[10px] text-muted-foreground">{fmtDateTime(item.countedAt)}</span>}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={item.observation1 ?? ''}
                      className="w-24 text-xs h-7"
                      onBlur={(e: any) => updateObs(item.id, 'observation1', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={item.observation2 ?? ''}
                      className="w-24 text-xs h-7"
                      onBlur={(e: any) => updateObs(item.id, 'observation2', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {page} de {totalPages} ({total} artículos)</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
