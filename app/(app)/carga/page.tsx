'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'

export default function CargaPage() {
  const { data: session } = useSession()
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Solo se aceptan archivos .xlsx')
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data?.success) {
        setResult(data)
        const parts = [`${data.processed} artículos procesados`]
        if (data.carried > 0) parts.push(`${data.carried} conteos mantenidos`)
        if (data.newItems > 0) parts.push(`${data.newItems} nuevos`)
        if (data.regularized > 0) parts.push(`${data.regularized} regularizados`)
        toast.success(parts.join(' · '))
      } else {
        toast.error(data?.error ?? 'Error al procesar el archivo')
        setResult({ error: data?.error })
      }
    } catch {
      toast.error('Error al subir el archivo')
    }
    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleUpload(file)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Carga de Excel Diario</h1>
        <p className="text-sm text-muted-foreground">Sube el archivo STOCK_DD-MM-AAAA.xlsx con el inventario del sistema</p>
      </div>

      {!isAdmin && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">Solo los administradores pueden subir archivos Excel.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card
          className={`border-2 border-dashed transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragOver={(e: any) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">Arrastra y suelta el archivo aquí, o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mb-4">Formato: STOCK_DD-MM-AAAA.xlsx</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e: any) => {
                const f = e.target?.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            <Button onClick={() => fileRef.current?.click()} loading={uploading}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Seleccionar archivo
            </Button>
          </CardContent>
        </Card>
      )}

      {result && !result.error && (
        <Card className="border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" /> Carga exitosa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Artículos procesados: <strong>{result.processed}</strong> de {result.total}</p>
            {result.carried > 0 && (
              <p className="text-teal-600">Conteos mantenidos: <strong>{result.carried}</strong> (stock del sistema actualizado sin perder conteo físico)</p>
            )}
            {result.newItems > 0 && (
              <p className="text-blue-600">Artículos nuevos (pendientes de conteo): <strong>{result.newItems}</strong></p>
            )}
            {result.regularized > 0 && (
              <p className="text-orange-600">Artículos regularizados (salieron del sistema): <strong>{result.regularized}</strong></p>
            )}
            <p>Fecha del snapshot: <strong>{new Date(result.date).toLocaleDateString('es-EC')}</strong></p>
            {(result.errors?.length ?? 0) > 0 && (
              <div className="mt-2">
                <p className="text-orange-600 font-medium">Advertencias:</p>
                {(result.errors ?? []).map((err: string, i: number) => <p key={i} className="text-xs text-muted-foreground">{err}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result?.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{result.error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download template */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Plantilla de ejemplo</p>
              <p className="text-xs text-muted-foreground">Descarga la plantilla con el formato esperado</p>
            </div>
            <a href="/api/template" download>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" /> Descargar plantilla
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
