'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, Search, Download } from 'lucide-react'
import { FadeIn } from '@/components/ui/animate'
import { SafeDate } from '@/components/safe-format'

export default function HistorialPage() {
  const [uploads, setUploads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [articleSearch, setArticleSearch] = useState('')
  const [searchedArticle, setSearchedArticle] = useState('')

  const fetchData = async (artNum?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (artNum) params.set('articleNumber', artNum)
      const res = await fetch(`/api/historial?${params}`)
      const data = await res.json()
      setUploads(data?.uploads ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSearch = () => {
    setSearchedArticle(articleSearch)
    fetchData(articleSearch)
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-6 w-6 text-primary" /> Historial de Conteos
            </h1>
            <p className="text-sm text-muted-foreground">Registro de cada carga diaria y seguimiento por artículo</p>
          </div>
          <a href="/api/export?filter=all" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
          </a>
        </div>
      </FadeIn>

      {/* Article tracker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Seguimiento de artículo específico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Número de artículo (ej. REP-001)..."
                value={articleSearch}
                onChange={(e: any) => setArticleSearch(e.target.value)}
                className="pl-10"
                onKeyDown={(e: any) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} size="sm">Buscar</Button>
            {searchedArticle && (
              <Button variant="ghost" size="sm" onClick={() => { setArticleSearch(''); setSearchedArticle(''); fetchData() }}>Limpiar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Subido por</TableHead>
                <TableHead className="text-right">Artículos</TableHead>
                <TableHead className="text-right">Contados</TableHead>
                <TableHead className="text-right">Con Diferencia</TableHead>
                {searchedArticle && (
                  <>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Físico</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={searchedArticle ? 9 : 6} className="text-center py-8">Cargando...</TableCell></TableRow>}
              {!loading && uploads.length === 0 && <TableRow><TableCell colSpan={searchedArticle ? 9 : 6} className="text-center py-8 text-muted-foreground">No hay historial</TableCell></TableRow>}
              {uploads.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell><SafeDate date={u.snapshotDate} options={{ dateStyle: 'medium' }} locale="es" /></TableCell>
                  <TableCell className="text-xs">{u.fileName}</TableCell>
                  <TableCell className="text-sm">{u.uploadedBy}</TableCell>
                  <TableCell className="text-right font-mono">{u.totalArticles}</TableCell>
                  <TableCell className="text-right font-mono">{u.counted}</TableCell>
                  <TableCell className="text-right font-mono">{u.withDifferences}</TableCell>
                  {searchedArticle && u.articleDetail && (
                    <>
                      <TableCell className="text-right font-mono">{u.articleDetail.stockSystem}</TableCell>
                      <TableCell className="text-right font-mono">{u.articleDetail.stockPhysical ?? '-'}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${
                        (u.articleDetail.difference ?? 0) < 0 ? 'text-red-600' : (u.articleDetail.difference ?? 0) > 0 ? 'text-teal-600' : ''
                      }`}>
                        {u.articleDetail.difference ?? '-'}
                      </TableCell>
                    </>
                  )}
                  {searchedArticle && !u.articleDetail && (
                    <>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
