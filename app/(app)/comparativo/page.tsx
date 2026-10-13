'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { GitCompare, Search } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'

const statusLabels: Record<string, { label: string; color: string }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  desaparecido: { label: 'Desaparecido', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  nuevo_diff: { label: 'Nueva diferencia', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  corregido: { label: 'Corregido', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cambio: { label: 'Cambio', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
}

export default function ComparativoPage() {
  const [uploads, setUploads] = useState<any[]>([])
  const [date1, setDate1] = useState('')
  const [date2, setDate2] = useState('')
  const [comparisons, setComparisons] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/uploads').then((r) => r.json()).then((d) => setUploads(d?.uploads ?? [])).catch(() => {})
  }, [])

  const handleCompare = async () => {
    if (!date1 || !date2) return
    setLoading(true)
    setLoaded(false)
    try {
      const res = await fetch(`/api/comparativo?date1=${date1}&date2=${date2}`)
      const data = await res.json()
      setComparisons(data?.comparisons ?? [])
      setLoaded(true)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-primary" /> Comparativo entre Fechas
          </h1>
          <p className="text-sm text-muted-foreground">Selecciona dos fechas para ver qué artículos cambiaron</p>
        </div>
      </FadeIn>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha 1</label>
              <select
                value={date1}
                onChange={(e) => setDate1(e.target.value)}
                className="h-10 px-3 rounded-lg border bg-background text-sm"
              >
                <option value="">Seleccionar...</option>
                {uploads.map((u: any) => (
                  <option key={u.id} value={u.snapshotDate}>
                    {new Date(u.snapshotDate).toLocaleDateString('es-EC')} - {u.fileName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha 2</label>
              <select
                value={date2}
                onChange={(e) => setDate2(e.target.value)}
                className="h-10 px-3 rounded-lg border bg-background text-sm"
              >
                <option value="">Seleccionar...</option>
                {uploads.map((u: any) => (
                  <option key={u.id} value={u.snapshotDate}>
                    {new Date(u.snapshotDate).toLocaleDateString('es-EC')} - {u.fileName}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleCompare} loading={loading} disabled={!date1 || !date2}>
              <Search className="h-4 w-4 mr-2" /> Comparar
            </Button>
          </div>
        </CardContent>
      </Card>

      {loaded && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resultados: {comparisons.length} artículos con cambios</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Stock F1</TableHead>
                  <TableHead className="text-right">Físico F1</TableHead>
                  <TableHead className="text-right">Dif F1</TableHead>
                  <TableHead className="text-right">Stock F2</TableHead>
                  <TableHead className="text-right">Físico F2</TableHead>
                  <TableHead className="text-right">Dif F2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay cambios entre estas fechas</TableCell></TableRow>
                )}
                {comparisons.map((c: any, i: number) => {
                  const st = statusLabels[c.status] ?? { label: c.status, color: '' }
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{c.articleNumber}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{c.description}</TableCell>
                      <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{c.date1Stock ?? '-'}</TableCell>
                      <TableCell className="text-right font-mono">{c.date1Physical ?? '-'}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${
                        (c.date1Diff ?? 0) < 0 ? 'text-red-600' : (c.date1Diff ?? 0) > 0 ? 'text-teal-600' : ''
                      }`}>{c.date1Diff ?? '-'}</TableCell>
                      <TableCell className="text-right font-mono">{c.date2Stock ?? '-'}</TableCell>
                      <TableCell className="text-right font-mono">{c.date2Physical ?? '-'}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${
                        (c.date2Diff ?? 0) < 0 ? 'text-red-600' : (c.date2Diff ?? 0) > 0 ? 'text-teal-600' : ''
                      }`}>{c.date2Diff ?? '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
