import React from 'react'
import { InventoryScanner } from '../components/InventoryScanner'

export const InventoryPage: React.FC = () => (
  <div>
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
        📷 Scanner de Código de Barras
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        Use a câmera para ler códigos de barras, consultar preços e registrar entradas no estoque.
      </p>
    </div>

    <div className="card">
      <InventoryScanner />
    </div>
  </div>
)
