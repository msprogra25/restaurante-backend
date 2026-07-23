import React from 'react'

export const ProductsPage: React.FC = () => (
  <div>
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
        🛒 Produtos
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        Cadastre e gerencie os produtos do seu catálogo.
      </p>
    </div>
    <div className="card">
      <p style={{ color: 'var(--text-muted)' }}>Em breve: listagem e cadastro de produtos.</p>
    </div>
  </div>
)
