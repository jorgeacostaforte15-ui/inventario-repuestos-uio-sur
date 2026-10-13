'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlusCircle, Search, Trash2, Edit, Save, X, PackagePlus, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import React from 'react'

const BarcodeScanner = dynamic(() => import('@/components/barcode-scanner'), { ssr: false })

class ScannerErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-sm text-destructive">
          <p>Error al cargar el escáner.</p>
          <button className="mt-2 underline text-primary" onClick={() => this.setState({ hasError: false })}>Reintentar</button>
        </div>
      )
    }
    return this.props.children
  }
}

interface ManualItem {
  id: string
  articleNumber: string
  description: string
  manufacturer: string
  locationCode: string
  stockPhysical: number
  observation: string
  addedBy: { name: string | null; email: string }
  createdAt: string
}

export default function SobrantesManualesPage() {
  const [items, setItems] = useState<ManualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const limit = 30

  // Form state
  const [form, setForm] = useState({
    articleNumber: '',
    description: '',
    manufacturer: '',
    locationCode: '',
    stockPhysical: '',
    observation: '',
  })

  // Edit state
  const [editForm, setEditForm] = useState({
    stockPhysical: '',
    observation: '',
    description: '',
    manufacturer: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/manual-surplus?${params}`)
      const data = await res.json()
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
      setSnapshotDate(data?.snapshotDate ?? null)
    } catch {
      toast.error('Error al cargar datos')
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setForm({ articleNumber: '', description: '', manufacturer: '', locationCode: '', stockPhysical: '', observation: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.articleNumber.trim()) { toast.error('Código de artículo obligatorio'); return }
    if (!form.stockPhysical || parseFloat(form.stockPhysical) <= 0) { toast.error('La cantidad debe ser mayor a 0'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/manual-surplus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          stockPhysical: parseFloat(form.stockPhysical),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al guardar')
      } else {
        toast.success('Ítem sobrante registrado')
        resetForm()
        setShowForm(false)
        fetchData()
      }
    } catch {
      toast.error('Error de conexión')
    }
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/manual-surplus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm, stockPhysical: parseFloat(editForm.stockPhysical) }),
      })
      if (res.ok) {
        toast.success('Actualizado')
        setEditingId(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error')
      }
    } catch { toast.error('Error de conexión') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ítem sobrante?')) return
    try {
      const res = await fetch(`/api/manual-surplus?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Eliminado')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error')
      }
    } catch { toast.error('Error de conexión') }
  }

  const handleBarcode = (code: string) => {
    setForm(prev => ({ ...prev, articleNumber: code }))
    setShowScanner(false)
    toast.success(`Código escaneado: ${code}`)
  }

  const startEdit = (item: ManualItem) => {
    setEditingId(item.id)
    setEditForm({
      stockPhysical: String(item.stockPhysical),
      observation: item.observation,
      description: item.description,
      manufacturer: item.manufacturer,
    })
  }

  const totalPages = Math.ceil(total / limit)
  const dateStr = snapshotDate ? new Date(snapshotDate).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : 'Sin carga'

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <PackagePlus className="h-6 w-6 text-amber-600" /> Sobrantes No Registrados
            </h1>
            <p className="text-sm text-muted-foreground">
              Artículos encontrados físicamente que no están en el sistema
              {snapshotDate && <span className="ml-1">— Carga: {dateStr}</span>}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-amber-600 hover:bg-amber-700">
            <PlusCircle className="h-4 w-4 mr-2" /> Agregar Sobrante
          </Button>
        </div>
      </FadeIn>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total ítems sobrantes manuales</p>
            <p className="font-mono font-bold text-amber-600 text-lg">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Cantidad total unidades</p>
            <p className="font-mono font-bold text-amber-600 text-lg">
              {items.reduce((s, i) => s + i.stockPhysical, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* New item form */}
      {showForm && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> Registrar nuevo ítem sobrante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Código de artículo *</label>
                  <div className="flex gap-1">
                    <Input
                      value={form.articleNumber}
                      onChange={(e: any) => setForm(f => ({ ...f, articleNumber: e.target.value }))}
                      placeholder="Ej: ABC-12345"
                      className="flex-1"
                      autoFocus
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowScanner(!showScanner)}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Descripción</label>
                  <Input
                    value={form.description}
                    onChange={(e: any) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descripción del artículo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Fabricante</label>
                  <Input
                    value={form.manufacturer}
                    onChange={(e: any) => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                    placeholder="Fabricante"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Ubicación</label>
                  <Input
                    value={form.locationCode}
                    onChange={(e: any) => setForm(f => ({ ...f, locationCode: e.target.value }))}
                    placeholder="Código de ubicación"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Cantidad física *</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={form.stockPhysical}
                    onChange={(e: any) => setForm(f => ({ ...f, stockPhysical: e.target.value }))}
                    placeholder="Cantidad encontrada"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Observación</label>
                  <Input
                    value={form.observation}
                    onChange={(e: any) => setForm(f => ({ ...f, observation: e.target.value }))}
                    placeholder="Nota u observación"
                  />
                </div>
              </div>

              {showScanner && (
                <div className="max-w-sm mx-auto">
                  <ScannerErrorBoundary>
                    <BarcodeScanner onScan={handleBarcode} />
                  </ScannerErrorBoundary>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setShowScanner(false) }}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Guardando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código o descripción..."
          value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1) }}
          className="pl-10"
        />
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
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Observación</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Cargando...</TableCell></TableRow>
              )}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No hay ítems sobrantes registrados manualmente.
                    <br />
                    <button onClick={() => { resetForm(); setShowForm(true) }} className="text-amber-600 underline mt-2">
                      Agregar el primero
                    </button>
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <TableRow key={item.id} className="bg-amber-50/30 dark:bg-amber-900/5">
                  <TableCell className="font-mono text-xs font-medium">{item.articleNumber}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {editingId === item.id ? (
                      <Input
                        value={editForm.description}
                        onChange={(e: any) => setEditForm(f => ({ ...f, description: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    ) : item.description || <span className="text-muted-foreground italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {editingId === item.id ? (
                      <Input
                        value={editForm.manufacturer}
                        onChange={(e: any) => setEditForm(f => ({ ...f, manufacturer: e.target.value }))}
                        className="h-7 text-xs w-28"
                      />
                    ) : item.manufacturer || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.locationCode || '—'}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-amber-600">
                    {editingId === item.id ? (
                      <Input
                        type="number"
                        value={editForm.stockPhysical}
                        onChange={(e: any) => setEditForm(f => ({ ...f, stockPhysical: e.target.value }))}
                        className="h-7 text-xs w-20 ml-auto"
                      />
                    ) : item.stockPhysical}
                  </TableCell>
                  <TableCell>
                    {editingId === item.id ? (
                      <Input
                        value={editForm.observation}
                        onChange={(e: any) => setEditForm(f => ({ ...f, observation: e.target.value }))}
                        className="h-7 text-xs w-32"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{item.observation || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.addedBy?.name || item.addedBy?.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {editingId === item.id ? (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleUpdate(item.id)} disabled={saving}>
                            <Save className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => startEdit(item)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Página {page} de {totalPages} ({total} ítems)</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
