'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, Download, Search, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export default function InventarioPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const limit = 50
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/items?${params}`)
      const data = await res.json()
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
    } catch {}
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveInline = async (itemId: string) => {
    if (editValue === '') return
    try {
      const res = await fetch('/api/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, stockPhysical: parseFloat(editValue) }),
      })
      const data = await res.json()
      if (data?.success) {
        toast.success('Conteo actualizado')
        setEditingId(null)
        fetchData()
      } else {
        toast.error(data?.error ?? 'Error')
      }
    } catch { toast.error('Error al guardar') }
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" /> Inventario Completo
            </h1>
            <p className="text-sm text-muted-foreground">Vista de todos los artículos con edición inline del stock físico</p>
          </div>
          <a href="/api/export?filter=all" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar Excel</Button>
          </a>
        </div>
      </FadeIn>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por código o descripción..." value={search} onChange={(e: any) => { setSearch(e.target.value); setPage(1) }} className="pl-10" />
      </div>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin artículos</TableCell></TableRow>}
              {items.map((item: any) => {
                const diffColor = (item.difference ?? 0) < 0 ? 'text-red-600' : (item.difference ?? 0) > 0 ? 'text-teal-600' : ''
                const rowBg = (item.difference ?? 0) < 0 ? 'bg-red-50/30 dark:bg-red-900/5' : (item.difference ?? 0) > 0 ? 'bg-teal-50/30 dark:bg-teal-900/5' : ''
                return (
                  <TableRow key={item.id} className={rowBg}>
                    <TableCell className="font-mono text-xs">{item.articleNumber}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{item.description}</TableCell>
                    <TableCell className="text-sm">{item.manufacturer}</TableCell>
                    <TableCell className="font-mono text-xs">{item.locationCode}</TableCell>
                    <TableCell className="text-right font-mono">{item.stockSystem}</TableCell>
                    <TableCell className="text-right">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e: any) => setEditValue(e.target.value)}
                            className="w-20 h-7 text-xs font-mono text-right"
                            onKeyDown={(e: any) => e.key === 'Enter' && handleSaveInline(item.id)}
                            autoFocus
                          />
                          <Button size="icon-sm" variant="ghost" onClick={() => handleSaveInline(item.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="font-mono cursor-pointer hover:underline"
                          onClick={() => { setEditingId(item.id); setEditValue(item.stockPhysical !== null ? String(item.stockPhysical) : '') }}
                        >
                          {item.stockPhysical !== null ? item.stockPhysical : <span className="text-muted-foreground">-</span>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${diffColor}`}>
                      {item.difference !== null ? item.difference : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(item.valueStockCost)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(item.valueStockPrice)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

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
