'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { Package, AlertTriangle, TrendingUp, ClipboardCheck, DollarSign, BarChart3, CalendarDays } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SafeDate } from '@/components/safe-format'

interface DashData {
  totalArticles: number
  counted: number
  percentCounted: number
  totalWithDiff: number
  totalShortage: number
  totalSurplus: number
  shortageValueCost: number
  shortageValuePrice: number
  surplusValueCost: number
  surplusValuePrice: number
  snapshotDate: string | null
  previous: {
    snapshotDate: string
    totalArticles: number
    counted: number
    totalWithDiff: number
  } | null
  history: {
    snapshotDate: string
    fileName: string
    totalArticles: number
    counted: number
    percent: number
    withDiff: number
    shortages: number
    surpluses: number
  }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!data) return <p className="text-muted-foreground">No hay datos disponibles. Sube un archivo Excel para comenzar.</p>

  const fmt = (n: number) => new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen del inventario{data.snapshotDate ? <> — Fecha: <SafeDate date={data.snapshotDate} options={{ dateStyle: 'long' }} locale="es" /></> : ''}
          </p>
        </div>
      </FadeIn>

      {/* Progress */}
      <SlideIn from="bottom">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Avance del Conteo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold font-mono">{data?.percentCounted ?? 0}%</span>
              <span className="text-sm text-muted-foreground">{data?.counted ?? 0} de {data?.totalArticles ?? 0} artículos</span>
            </div>
            <Progress value={data?.percentCounted ?? 0} className="h-3" />
          </CardContent>
        </Card>
      </SlideIn>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SlideIn from="left" delay={0}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Artículos</p>
                  <p className="text-2xl font-bold font-mono">{data?.totalArticles ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        <SlideIn from="left" delay={0.05}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><BarChart3 className="h-5 w-5 text-orange-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Con Diferencia</p>
                  <p className="text-2xl font-bold font-mono">{data?.totalWithDiff ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        <SlideIn from="left" delay={0.1}>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Faltantes</p>
                  <p className="text-2xl font-bold font-mono text-red-600">{data?.totalShortage ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        <SlideIn from="left" delay={0.15}>
          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30"><TrendingUp className="h-5 w-5 text-teal-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Sobrantes</p>
                  <p className="text-2xl font-bold font-mono text-teal-600">{data?.totalSurplus ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      </div>

      {/* Valorización */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FadeIn delay={0.1}>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-red-600" /> Valor Faltantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Costo</span>
                <span className="font-mono font-semibold text-red-600">$ {fmt(data?.shortageValueCost ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Precio venta</span>
                <span className="font-mono font-semibold text-red-600">$ {fmt(data?.shortageValuePrice ?? 0)}</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-teal-600" /> Valor Sobrantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Costo</span>
                <span className="font-mono font-semibold text-teal-600">$ {fmt(data?.surplusValueCost ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Precio venta</span>
                <span className="font-mono font-semibold text-teal-600">$ {fmt(data?.surplusValuePrice ?? 0)}</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Historial de conteo por día */}
      {data?.history && data.history.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Progreso de Conteo por Día
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Artículos</TableHead>
                    <TableHead className="text-right">Contados</TableHead>
                    <TableHead>Avance</TableHead>
                    <TableHead className="text-right">Faltantes</TableHead>
                    <TableHead className="text-right">Sobrantes</TableHead>
                    <TableHead className="text-right">Con Dif.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((h, idx) => (
                    <TableRow key={h.snapshotDate} className={idx === 0 ? 'bg-primary/5 font-medium' : ''}>
                      <TableCell>
                        <div>
                          <SafeDate date={h.snapshotDate} options={{ day: '2-digit', month: '2-digit', year: 'numeric' }} locale="es" />
                          {idx === 0 && <span className="ml-1.5 text-xs text-primary font-semibold">(Actual)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{h.totalArticles}</TableCell>
                      <TableCell className="text-right font-mono">{h.counted}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                h.percent === 100 ? 'bg-green-500' : h.percent > 50 ? 'bg-primary' : 'bg-orange-400'
                              }`}
                              style={{ width: `${h.percent}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs w-10 text-right">{h.percent}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">{h.shortages > 0 ? h.shortages : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-teal-600">{h.surpluses > 0 ? h.surpluses : '—'}</TableCell>
                      <TableCell className="text-right font-mono">{h.withDiff > 0 ? h.withDiff : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
