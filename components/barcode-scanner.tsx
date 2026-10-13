'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, XCircle, AlertTriangle, ZoomIn, ZoomOut, Flashlight, Focus, Loader2 } from 'lucide-react'
import { Slider } from '@/components/ui/slider'

interface BarcodeScannerProps {
  onScan: (code: string) => void
}

export default function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const html5QrCodeRef = useRef<any>(null)
  const isRunningRef = useRef(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [maxZoom, setMaxZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [supportsZoom, setSupportsZoom] = useState(false)
  const [supportsTorch, setSupportsTorch] = useState(false)
  const [supportsFocus, setSupportsFocus] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [focusing, setFocusing] = useState(false)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const focusModesRef = useRef<string[]>([])

  const applyAdvancedConstraints = async (track: MediaStreamTrack) => {
    trackRef.current = track
    try {
      const capabilities = track.getCapabilities?.() as any
      // Store available focus modes
      const focusModes: string[] = capabilities?.focusMode ?? []
      focusModesRef.current = focusModes

      // Enable continuous autofocus if available
      if (focusModes.includes('continuous')) {
        await (track as any).applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        })
      }

      // Show focus button if device supports manual or single-shot focus
      setSupportsFocus(
        focusModes.includes('manual') ||
        focusModes.includes('single-shot') ||
        focusModes.includes('continuous')
      )

      // Setup zoom
      if (capabilities?.zoom) {
        const min = capabilities.zoom.min ?? 1
        const max = capabilities.zoom.max ?? 1
        setMinZoom(min)
        setMaxZoom(max)
        setSupportsZoom(max > min)
        const initialZoom = Math.min(Math.max(min, 2), max)
        setZoomLevel(initialZoom)
        await (track as any).applyConstraints({
          advanced: [{ zoom: initialZoom } as any],
        })
      }

      // Check torch support
      if (capabilities?.torch) {
        setSupportsTorch(true)
      }
    } catch (_) {}
  }

  const handleZoom = async (value: number[]) => {
    const z = value[0]
    setZoomLevel(z)
    if (trackRef.current) {
      try {
        await (trackRef.current as any).applyConstraints({
          advanced: [{ zoom: z } as any],
        })
      } catch (_) {}
    }
  }

  const toggleTorch = async () => {
    if (!trackRef.current) return
    const next = !torchOn
    try {
      await (trackRef.current as any).applyConstraints({
        advanced: [{ torch: next } as any],
      })
      setTorchOn(next)
    } catch (_) {}
  }

  const triggerFocus = async () => {
    if (!trackRef.current) return
    setFocusing(true)
    try {
      const modes = focusModesRef.current
      if (modes.includes('single-shot')) {
        // Single-shot: camera focuses once and locks
        await (trackRef.current as any).applyConstraints({
          advanced: [{ focusMode: 'single-shot' } as any],
        })
      } else if (modes.includes('manual')) {
        // Manual: toggle to continuous to re-trigger autofocus, then back
        await (trackRef.current as any).applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        })
      } else if (modes.includes('continuous')) {
        // Trick: switch to manual briefly then back to continuous to force re-focus
        try {
          await (trackRef.current as any).applyConstraints({
            advanced: [{ focusMode: 'manual' } as any],
          })
          await new Promise(r => setTimeout(r, 150))
        } catch (_) {}
        await (trackRef.current as any).applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        })
      }
      // Visual feedback
      setTimeout(() => setFocusing(false), 800)
    } catch (_) {
      setFocusing(false)
    }
  }

  const safeStop = async () => {
    if (!html5QrCodeRef.current || !isRunningRef.current) return
    try {
      const state = html5QrCodeRef.current.getState?.()
      if (state === 2 || state === 3) {
        await html5QrCodeRef.current.stop()
      }
    } catch (_) {}
    isRunningRef.current = false
    trackRef.current = null
    setSupportsZoom(false)
    setSupportsTorch(false)
    setSupportsFocus(false)
    setTorchOn(false)
    setFocusing(false)
  }

  const startScanner = async () => {
    try {
      setError('')
      await safeStop()

      const scannerId = 'barcode-reader'
      const container = document.getElementById(scannerId)
      if (!container) {
        setError('Contenedor del escáner no encontrado')
        return
      }
      container.innerHTML = ''

      const { Html5Qrcode } = await import('html5-qrcode')
      const html5QrCode = new Html5Qrcode(scannerId, { verbose: false })
      html5QrCodeRef.current = html5QrCode

      setScanning(true)

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText: string) => {
          onScan?.(decodedText)
          safeStop().then(() => setScanning(false))
        },
        () => {}
      )
      isRunningRef.current = true

      // Access the video track for advanced features
      try {
        const videoElement = container.querySelector('video')
        if (videoElement?.srcObject) {
          const stream = videoElement.srcObject as MediaStream
          const track = stream.getVideoTracks()[0]
          if (track) {
            await applyAdvancedConstraints(track)
          }
        }
      } catch (_) {}
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Permiso de cámara denegado. Habilítelo en la configuración del navegador e intente de nuevo.')
      } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
        setError('No se encontró una cámara en este dispositivo.')
      } else if (msg.includes('NotReadable') || msg.includes('Could not start')) {
        setError('La cámara está en uso por otra aplicación. Cierre otras apps que usen la cámara e intente de nuevo.')
      } else {
        setError(msg || 'No se pudo acceder a la cámara')
      }
      setScanning(false)
      isRunningRef.current = false
    }
  }

  const stopScanner = async () => {
    await safeStop()
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      const ref = html5QrCodeRef.current
      if (ref && isRunningRef.current) {
        try {
          const state = ref.getState?.()
          if (state === 2 || state === 3) {
            ref.stop().catch(() => {})
          }
        } catch (_) {}
      }
      isRunningRef.current = false
    }
  }, [])

  return (
    <div className="space-y-3">
      <div
        id="barcode-reader"
        ref={scannerRef}
        className="w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-muted min-h-[200px] relative"
      >
        {/* Focus indicator overlay */}
        {focusing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 border-2 border-primary rounded-lg animate-ping opacity-60" />
          </div>
        )}
      </div>

      {/* Camera controls — only shown when camera is active */}
      {scanning && (supportsZoom || supportsTorch || supportsFocus) && (
        <div className="space-y-2 px-2 max-w-sm mx-auto">
          {supportsZoom && (
            <div className="flex items-center gap-2">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                min={minZoom}
                max={maxZoom}
                step={0.1}
                value={[zoomLevel]}
                onValueChange={handleZoom}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-mono w-8 text-right">{zoomLevel.toFixed(1)}x</span>
            </div>
          )}
          <div className="flex items-center gap-2 justify-center">
            {supportsFocus && (
              <Button
                variant={focusing ? 'default' : 'outline'}
                size="sm"
                onClick={triggerFocus}
                disabled={focusing}
                className="gap-1.5"
              >
                {focusing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Focus className="h-4 w-4" />}
                {focusing ? 'Enfocando...' : 'Enfocar'}
              </Button>
            )}
            {supportsTorch && (
              <Button
                variant={torchOn ? 'default' : 'outline'}
                size="sm"
                onClick={toggleTorch}
                className="gap-1.5"
              >
                <Flashlight className="h-4 w-4" />
                {torchOn ? 'Apagar luz' : 'Linterna'}
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        {!scanning ? (
          <Button onClick={startScanner} size="sm">
            <Camera className="h-4 w-4 mr-2" /> Iniciar Cámara
          </Button>
        ) : (
          <Button variant="destructive" onClick={stopScanner} size="sm">
            <XCircle className="h-4 w-4 mr-2" /> Detener
          </Button>
        )}
      </div>
    </div>
  )
}
