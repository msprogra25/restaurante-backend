import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { InventoryPage } from './pages/InventoryPage'
import { ProductsPage } from './pages/ProductsPage'

const Sidebar: React.FC<{ mobileOpen: boolean; onClose: () => void }> = ({ mobileOpen, onClose }) => (
  <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
    <div className="sidebar-logo">
      <div className="sidebar-logo-icon">📦</div>
      <span className="sidebar-logo-text">GestorPro</span>
    </div>

    <div className="sidebar-nav">
      <span className="sidebar-section-label">Principal</span>

      <NavLink
        to="/admin/produtos"
        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
        onClick={onClose}
      >
        <span className="icon">🛒</span>
        Produtos
      </NavLink>

      <NavLink
        to="/admin/estoque"
        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
        onClick={onClose}
      >
        <span className="icon">📷</span>
        Scanner / Estoque
      </NavLink>
    </div>
  </nav>
)

const App: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <main className="main-content">
          {/* Botão mobile para abrir sidebar */}
          <button
            className="btn btn-secondary"
            style={{ marginBottom: 20, display: 'none' }}
            onClick={() => setMobileOpen(true)}
          >
            ☰ Menu
          </button>

          <Routes>
            <Route path="/" element={<InventoryPage />} />
            <Route path="/admin/produtos" element={<ProductsPage />} />
            <Route path="/admin/estoque" element={<InventoryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
