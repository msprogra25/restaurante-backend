import React, { useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/browser'

// ─── Tipos ───────────────────────────────────────────
type ScannedProduct = {
  barcode: string
  name: string
  unitPriceCents: number
  quantity: number
  image?: string // data-url capturada da câmera
}

// ─── Utilitários ─────────────────────────────────────
const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Componente principal ─────────────────────────────
export const InventoryScanner: React.FC = () => {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const readerRef  = useRef<BrowserMultiFormatReader | null>(null)

  const [scanning, setScanning]           = useState(false)
  const [currentBarcode, setCurrentBarcode] = useState<string | null>(null)
  const [capturedImage, setCapturedImage]  = useState<string | null>(null)
  const [quantity, setQuantity]            = useState(1)
  const [scannedItems, setScannedItems]    = useState<ScannedProduct[]>([])
  const [error, setError]                  = useState<string | null>(null)
  const [loading, setLoading]              = useState(false)
  const [mode, setMode]                    = useState<'view' | 'stock'>('view')

  // ─── Câmera: iniciar ───────────────────────────────
  const startCamera = useCallback(async () => {
    setError(null)
    setCurrentBarcode(null)
    setCapturedImage(null)
    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      // Prefere câmera traseira; fallback para a primeira disponível
      const device = devices.find(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('traseira') ||
        d.label.toLowerCase().includes('environment')
      ) ?? devices[0]

      if (!device) throw new Error('Nenhuma câmera encontrada no dispositivo.')

      setScanning(true)

      await reader.decodeFromVideoDevice(
        device.deviceId,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const code = result.getText()
            setCurrentBarcode(code)
            stopCamera()  // para após primeira leitura
          } else if (err && !(err instanceof NotFoundException)) {
            // NotFoundException é lançada a cada frame sem código; ignoramos
            console.warn('Erro de leitura:', err)
          }
        }
      )
    } catch (e: any) {
      setError(e.message ?? 'Falha ao acessar a câmera.')
      setScanning(false)
    }
  }, [])

  // ─── Câmera: parar ─────────────────────────────────
  const stopCamera = useCallback(() => {
    const video = videoRef.current
    if (video?.srcObject) {
      ;(video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
    setScanning(false)
  }, [])

  // ─── Capturar foto do produto ──────────────────────
  const capturePhoto = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setCapturedImage(canvas.toDataURL('image/png'))
  }, [])

  // ─── Consultar produto (modo Visualização) ─────────
  const lookupProduct = useCallback(async () => {
    if (!currentBarcode) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/products/barcode/${currentBarcode}`)
      if (!res.ok) throw new Error('Produto não encontrado no sistema.')
      const data: { name: string; unitPriceCents: number } = await res.json()

      setScannedItems(prev => {
        const existing = prev.findIndex(i => i.barcode === currentBarcode)
        if (existing >= 0) {
          const copy = [...prev]
          copy[existing] = { ...copy[existing], quantity: copy[existing].quantity + quantity }
          return copy
        }
        return [...prev, {
          barcode: currentBarcode,
          name: data.name,
          unitPriceCents: data.unitPriceCents,
          quantity,
          image: capturedImage ?? undefined,
        }]
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentBarcode, quantity, capturedImage])

  // ─── Registrar no estoque (modo Estoque) ───────────
  const registerStock = useCallback(async () => {
    if (!currentBarcode) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/stock/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: currentBarcode, quantity }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status} ao registrar estoque.`)
      const data: { name: string; newQuantity: number; unitPriceCents: number } = await res.json()

      setScannedItems(prev => {
        const existing = prev.findIndex(i => i.barcode === currentBarcode)
        if (existing >= 0) {
          const copy = [...prev]
          copy[existing] = { ...copy[existing], quantity: copy[existing].quantity + quantity }
          return copy
        }
        return [...prev, {
          barcode: currentBarcode,
          name: data.name,
          unitPriceCents: data.unitPriceCents,
          quantity,
          image: capturedImage ?? undefined,
        }]
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentBarcode, quantity, capturedImage])

  // ─── Somatória total ────────────────────────────────
  const totalCents = scannedItems.reduce(
    (acc, item) => acc + item.unitPriceCents * item.quantity,
    0
  )

  // ─── Limpar lista ───────────────────────────────────
  const clearList = () => {
    setScannedItems([])
    setCurrentBarcode(null)
    setCapturedImage(null)
    setError(null)
  }

  return (
    <div className="scanner-wrapper">
      {/* ── Seletor de modo ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          id="btn-mode-view"
          className={`btn ${mode === 'view' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('view')}
        >
          🔍 Consultar Produto
        </button>
        <button
          id="btn-mode-stock"
          className={`btn ${mode === 'stock' ? 'btn-success' : 'btn-secondary'}`}
          onClick={() => setMode('stock')}
        >
          📦 Registrar no Estoque
        </button>
      </div>

      {/* ── Área da câmera ── */}
      <div className="scanner-video-container">
        {scanning ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* Moldura animada */}
            <div className="scanner-overlay">
              <div className="scanner-corner tl" />
              <div className="scanner-corner tr" />
              <div className="scanner-corner bl" />
              <div className="scanner-corner br" />
              <div className="scan-line" />
            </div>
          </>
        ) : (
          <div className="scanner-placeholder">
            <span className="camera-icon">📷</span>
            <span>{currentBarcode ? `✅ Código: ${currentBarcode}` : 'Clique em "Iniciar Câmera"'}</span>
          </div>
        )}
        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* ── Botões da câmera ── */}
      <div className="scanner-buttons">
        {!scanning ? (
          <button id="btn-start-camera" className="btn btn-primary" onClick={startCamera}>
            📷 Iniciar Câmera
          </button>
        ) : (
          <>
            <button id="btn-stop-camera" className="btn btn-danger" onClick={stopCamera}>
              ⏹ Parar Câmera
            </button>
            <button id="btn-capture-photo" className="btn btn-secondary" onClick={capturePhoto}>
              🖼 Capturar Foto
            </button>
          </>
        )}
      </div>

      {/* ── Resultado da leitura ── */}
      {currentBarcode && (
        <div className="scanner-result-card">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Código lido:</div>
            <div className="result-barcode">{currentBarcode}</div>
          </div>

          {/* Imagem capturada */}
          {capturedImage && (
            <img src={capturedImage} alt="Produto capturado" className="result-image" />
          )}

          {/* Quantidade + Ação */}
          <div className="quantity-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Quantidade</label>
              <input
                id="input-quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                className="form-input qty-input"
              />
            </div>

            {mode === 'view' ? (
              <button
                id="btn-lookup"
                className="btn btn-primary"
                onClick={lookupProduct}
                disabled={loading}
                style={{ marginTop: 20 }}
              >
                {loading ? '⏳ Buscando…' : '🔍 Ver Produto + Valor'}
              </button>
            ) : (
              <button
                id="btn-register-stock"
                className="btn btn-success"
                onClick={registerStock}
                disabled={loading}
                style={{ marginTop: 20 }}
              >
                {loading ? '⏳ Registrando…' : '✅ Adicionar ao Estoque'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mensagem de erro ── */}
      {error && (
        <div className="toast-error">
          ⚠️ {error}
        </div>
      )}

      {/* ── Lista de itens escaneados ── */}
      {scannedItems.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              {mode === 'stock' ? '📦 Itens Registrados' : '🛒 Itens Consultados'}
            </h3>
            <button id="btn-clear-list" className="btn btn-secondary" onClick={clearList} style={{ padding: '6px 14px', fontSize: 13 }}>
              🗑 Limpar lista
            </button>
          </div>

          <div className="scanned-list">
            {scannedItems.map((item, idx) => (
              <div key={idx} className="scanned-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.image && (
                    <img src={item.image} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                  )}
                  <div>
                    <div className="scanned-item-name">{item.name || item.barcode}</div>
                    <div className="scanned-item-qty">
                      {item.quantity}x · {formatBRL(item.unitPriceCents)} un.
                    </div>
                  </div>
                </div>
                <div className="scanned-item-price">
                  {formatBRL(item.unitPriceCents * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {/* Somatória total */}
          <div className="summary-bar">
            <span className="summary-label">
              {mode === 'stock'
                ? `Total registrado (${scannedItems.reduce((a, i) => a + i.quantity, 0)} itens)`
                : `Somatória (${scannedItems.reduce((a, i) => a + i.quantity, 0)} itens)`
              }
            </span>
            <span className="summary-value">{formatBRL(totalCents)}</span>
          </div>
        </>
      )}
    </div>
  )
}
