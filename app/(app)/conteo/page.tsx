'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Camera, Check, Package, Hash, MapPin, MapPinOff, Filter, ChevronDown, MessageSquare, AlertCircle, ClipboardList, PlayCircle, BarChart3 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
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
  componentDidCatch(error: any) {
    console.error('Error en escáner:', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-sm text-destructive">
          <p>Error al cargar el escáner. Intente recargar la página.</p>
          <button className="mt-2 underline text-primary" onClick={() => this.setState({ hasError: false })}>Reintentar</button>
        </div>
      )
    }
    return this.props.children
  }
}

interface Item {
  id: string
  articleNumber: string
  description: string
  manufacturer: string
  locationCode: string
  stockSystem: number
  stockPhysical: number | null
  difference: number | null
  costItem: number
  price: number
  observation1: string
  observation2: string
  prevDifference: number | null
}

export default function ConteoPage() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [noLocItems, setNoLocItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingNoLoc, setLoadingNoLoc] = useState(false)
  const [selected, setSelected] = useState<Item | null>(null)
  const [physicalInput, setPhysicalInput] = useState('')
  const [obs1, setObs1] = useState('')
  const [obs2, setObs2] = useState('')
  const [saving, setSaving] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [showPending, setShowPending] = useState(false)
  const [showPorContar, setShowPorContar] = useState(false)
  const [porContarCount, setPorContarCount] = useState(0)
  const [locations, setLocations] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [noLocationCount, setNoLocationCount] = useState(0)
  const [showLocationFilter, setShowLocationFilter] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [showNoLocSection, setShowNoLocSection] = useState(false)
  const [progress, setProgress] = useState<any>(null)
  const [showContinuar, setShowContinuar] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Close location filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowLocationFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/conteo-progress')
      const data = await res.json()
      setProgress(data)
    } catch {}
  }, [])

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/locations')
      const data = await res.json()
      setLocations(data?.locations ?? [])
      setNoLocationCount(data?.noLocationCount ?? 0)
    } catch {}
  }, [])

  const fetchItems = useCallback(async (q: string, pending: boolean, porContar: boolean, loc: string, continuar?: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('search', q)
      if (continuar) params.set('filter', 'continuar')
      else if (porContar) params.set('filter', 'porContar')
      else if (pending) params.set('filter', 'pending')
      if (loc) params.set('location', loc)
      params.set('limit', '50')
      const res = await fetch(`/api/items?${params}`)
      const data = await res.json()
      setItems(data?.items ?? [])
    } catch { setItems([]) }
    setLoading(false)
  }, [])

  const fetchPorContarCount = useCallback(async () => {
    try {
      const res = await fetch('/api/items?filter=porContar&limit=1')
      const data = await res.json()
      setPorContarCount(data?.total ?? 0)
    } catch {}
  }, [])

  const fetchNoLocItems = useCallback(async () => {
    setLoadingNoLoc(true)
    try {
      const params = new URLSearchParams()
      params.set('filter', 'noLocation')
      params.set('limit', '200')
      const res = await fetch(`/api/items?${params}`)
      const data = await res.json()
      setNoLocItems(data?.items ?? [])
    } catch { setNoLocItems([]) }
    setLoadingNoLoc(false)
  }, [])

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/items?filter=pending&limit=1')
      const data = await res.json()
      setPendingCount(data?.total ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchPendingCount()
    fetchPorContarCount()
    fetchLocations()
    fetchProgress()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { fetchItems(search, showPending, showPorContar, selectedLocation, showContinuar) }, 300)
    return () => clearTimeout(t)
  }, [search, showPending, showPorContar, selectedLocation, showContinuar, fetchItems])

  useEffect(() => {
    if (showNoLocSection) fetchNoLocItems()
  }, [showNoLocSection, fetchNoLocItems])

  const handleScan = (code: string) => {
    setSearch(code)
    setShowScanner(false)
  }

  const handleSelect = (item: Item) => {
    setSelected(item)
    setPhysicalInput(item.stockPhysical !== null ? String(item.stockPhysical) : '')
    setObs1(item.observation1 ?? '')
    setObs2(item.observation2 ?? '')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSave = async () => {
    if (!selected || physicalInput === '') return
    setSaving(true)
    try {
      const res = await fetch('/api/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selected.id, stockPhysical: parseFloat(physicalInput), observation1: obs1, observation2: obs2 }),
      })
      const data = await res.json()
      if (data?.success) {
        toast.success(`Conteo guardado: ${selected.articleNumber} — Diferencia: ${data.difference}`)
        setSelected(null)
        setPhysicalInput('')
        setObs1('')
        setObs2('')
        fetchItems(search, showPending, showPorContar, selectedLocation, showContinuar)
        fetchPendingCount()
        fetchPorContarCount()
        fetchProgress()
        if (showNoLocSection) fetchNoLocItems()
      } else {
        toast.error(data?.error ?? 'Error al guardar')
      }
    } catch {
      toast.error('Error al guardar el conteo')
    }
    setSaving(false)
  }

  const filteredLocations = locationSearch
    ? locations.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase()))
    : locations

  const renderItemCard = (item: Item) => (
    <Card
      key={item.id}
      className={`cursor-pointer transition-all hover:shadow-md ${
        selected?.id === item.id ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => handleSelect(item)}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-primary">{item.articleNumber}</span>
              {item.stockPhysical !== null ? (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" /> Contado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Pendiente</Badge>
              )}
              {item.prevDifference !== null && item.prevDifference !== 0 && (
                <Badge variant="destructive" className="text-xs gap-0.5">
                  <AlertCircle className="h-3 w-3" /> Dif. ant: {item.prevDifference > 0 ? '+' : ''}{item.prevDifference}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{item.description}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {item.locationCode ? (
                <><MapPin className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-xs text-muted-foreground font-mono">{item.locationCode}</span></>
              ) : (
                <><MapPinOff className="h-3 w-3 text-orange-500 shrink-0" /><span className="text-xs text-orange-500">Sin ubicación</span></>
              )}
            </div>
          </div>
          <div className="text-right ml-2 shrink-0">
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-sm">{item.stockSystem}</span>
            </div>
            {item.stockPhysical !== null && (
              <span className={`font-mono text-xs ${
                (item.difference ?? 0) < 0 ? 'text-red-600' : (item.difference ?? 0) > 0 ? 'text-teal-600' : 'text-muted-foreground'
              }`}>
                Físico: {item.stockPhysical} ({(item.difference ?? 0) > 0 ? '+' : ''}{item.difference})
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Conteo Físico</h1>
        <p className="text-sm text-muted-foreground">Busca un artículo y registra la cantidad física contada</p>
      </div>

      {/* Progress summary */}
      {progress?.today && (
        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Hoy: {progress.today.counted}/{progress.today.total}</span>
                    <Badge variant={progress.today.percent === 100 ? 'default' : 'secondary'} className="text-xs">
                      {progress.today.percent}%
                    </Badge>
                  </div>
                  {progress.myProgress?.lastCounted ? (
                    <p className="text-xs text-muted-foreground">
                      Tu último contado: <span className="font-mono font-medium">{progress.myProgress.lastCounted.articleNumber}</span>
                      {progress.myProgress.lastCounted.locationCode && (
                        <span> — Ubic. <span className="font-mono">{progress.myProgress.lastCounted.locationCode}</span></span>
                      )}
                      <span className="ml-1">({progress.myProgress.counted} contados por ti)</span>
                    </p>
                  ) : progress.today.lastCounted && (
                    <p className="text-xs text-muted-foreground">
                      Último contado: <span className="font-mono font-medium">{progress.today.lastCounted.articleNumber}</span>
                      {progress.today.lastCounted.locationCode && (
                        <span> — Ubic. <span className="font-mono">{progress.today.lastCounted.locationCode}</span></span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {progress.yesterday && (
                  <div className="text-right text-xs text-muted-foreground hidden sm:block">
                    <p>Ayer: {progress.yesterday.counted}/{progress.yesterday.total} ({progress.yesterday.percent}%)</p>
                    {progress.yesterday.lastCounted && (
                      <p>Último: <span className="font-mono">{progress.yesterday.lastCounted.articleNumber}</span></p>
                    )}
                  </div>
                )}
                <Button
                  variant={showContinuar ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setShowContinuar(!showContinuar)
                    if (!showContinuar) { setShowPending(false); setShowPorContar(false) }
                  }}
                >
                  <PlayCircle className="h-4 w-4" />
                  Continuar conteo
                </Button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress.today.percent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código, descripción o ubicación..."
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => setShowScanner(!showScanner)} title="Escanear código">
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      {showScanner && (
        <Card>
          <CardContent className="p-4">
            <ScannerErrorBoundary>
              <BarcodeScanner onScan={handleScan} />
            </ScannerErrorBoundary>
          </CardContent>
        </Card>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={showPorContar ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setShowPorContar(!showPorContar); if (!showPorContar) { setShowPending(false); setShowContinuar(false) } }}
          className="gap-1"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Por contar ({porContarCount})
        </Button>
        <Button
          variant={showPending ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setShowPending(!showPending); if (!showPending) { setShowPorContar(false); setShowContinuar(false) } }}
        >
          Sin contar ({pendingCount})
        </Button>

        {/* Location filter dropdown */}
        <div className="relative" ref={filterRef}>
          <Button
            variant={selectedLocation ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowLocationFilter(!showLocationFilter)}
            className="gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            {selectedLocation ? (
              <span className="max-w-[150px] truncate font-mono text-xs">{selectedLocation}</span>
            ) : (
              'Ubicación'
            )}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </Button>
          {showLocationFilter && (
            <div className="absolute z-50 mt-1 left-0 w-72 bg-popover border rounded-lg shadow-lg p-2 max-h-80 flex flex-col">
              <Input
                placeholder="Buscar ubicación..."
                value={locationSearch}
                onChange={(e: any) => setLocationSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
                autoFocus
              />
              <div className="overflow-y-auto flex-1 space-y-0.5">
                <button
                  className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors ${
                    selectedLocation === '' ? 'bg-accent font-semibold' : ''
                  }`}
                  onClick={() => { setSelectedLocation(''); setShowLocationFilter(false); setLocationSearch('') }}
                >
                  Todas las ubicaciones
                </button>
                {filteredLocations.map(loc => (
                  <button
                    key={loc}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm font-mono hover:bg-accent transition-colors ${
                      selectedLocation === loc ? 'bg-accent font-semibold' : ''
                    }`}
                    onClick={() => { setSelectedLocation(loc); setShowLocationFilter(false); setLocationSearch('') }}
                  >
                    <MapPin className="h-3 w-3 inline mr-1.5 text-muted-foreground" />
                    {loc}
                  </button>
                ))}
                {filteredLocations.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No se encontraron ubicaciones</p>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedLocation && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedLocation('')}>
            Limpiar filtro ×
          </Button>
        )}
      </div>

      {/* Selected item - count form */}
      {selected && (
        <Card className="border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              {selected.articleNumber}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{selected.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Stock Sistema:</span>
                <span className="ml-2 font-mono font-bold text-lg">{selected.stockSystem}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ubicación:</span>
                <span className="ml-2 font-mono text-xs">{selected.locationCode || 'Sin ubicación'}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Stock Físico (conteo real)</label>
              <Input
                ref={inputRef}
                type="number"
                value={physicalInput}
                onChange={(e: any) => setPhysicalInput(e.target.value)}
                placeholder="Ingrese cantidad"
                className="text-2xl h-14 font-mono font-bold text-center"
                onKeyDown={(e: any) => e.key === 'Enter' && handleSave()}
              />
            </div>
            {physicalInput !== '' && (
              <div className="text-center">
                <span className="text-sm text-muted-foreground">Diferencia: </span>
                <span className={`font-mono font-bold text-lg ${
                  parseFloat(physicalInput) - selected.stockSystem < 0 ? 'text-red-600' :
                  parseFloat(physicalInput) - selected.stockSystem > 0 ? 'text-teal-600' : 'text-foreground'
                }`}>
                  {(parseFloat(physicalInput) - selected.stockSystem).toFixed(0)}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> Observaciones
              </div>
              <Textarea
                placeholder="Observación 1 (opcional)"
                value={obs1}
                onChange={(e: any) => setObs1(e.target.value)}
                className="min-h-[60px] text-sm"
                rows={2}
              />
              <Textarea
                placeholder="Observación 2 (opcional)"
                value={obs2}
                onChange={(e: any) => setObs2(e.target.value)}
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1" disabled={physicalInput === '' || saving}>
                {saving ? 'Guardando...' : <><Check className="h-4 w-4 mr-2" /> Guardar Conteo</>}
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results - ordered by location */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          Artículos {selectedLocation ? `en ${selectedLocation}` : '(ordenados por ubicación)'}
          {!loading && <Badge variant="outline" className="ml-auto text-xs">{items.length} resultado{items.length !== 1 ? 's' : ''}</Badge>}
        </h2>
        <div className="space-y-2">
          {loading && <div className="text-center text-sm text-muted-foreground py-4">Buscando...</div>}
          {!loading && items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              {selectedLocation ? `No se encontraron artículos en ${selectedLocation}` : 'No se encontraron artículos'}
            </div>
          )}
          {items.map(renderItemCard)}
        </div>
      </div>

      {/* Section: Items without location */}
      <div className="border-t pt-4 mt-6">
        <button
          className="w-full flex items-center justify-between py-2 text-left"
          onClick={() => setShowNoLocSection(!showNoLocSection)}
        >
          <h2 className="text-sm font-semibold flex items-center gap-1.5 text-orange-600">
            <MapPinOff className="h-4 w-4" />
            Artículos sin ubicación
            {noLocationCount > 0 && <Badge variant="outline" className="ml-1.5 text-xs border-orange-300 text-orange-600">{noLocationCount}</Badge>}
          </h2>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showNoLocSection ? 'rotate-180' : ''}`} />
        </button>
        {showNoLocSection && (
          <div className="space-y-2 mt-2">
            {loadingNoLoc && <div className="text-center text-sm text-muted-foreground py-4">Cargando...</div>}
            {!loadingNoLoc && noLocItems.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">No hay artículos sin ubicación</div>
            )}
            {noLocItems.map(renderItemCard)}
          </div>
        )}
      </div>
    </div>
  )
}
