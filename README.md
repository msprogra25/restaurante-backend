# 🛒 GestorPro – Sistema de Gestão de Produtos e Estoque

Sistema completo com painel administrativo para gestão de produtos, estoque e checkout, desenvolvido com React + TypeScript (frontend) e Node.js + Express (backend).

## 🚀 Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + TypeScript + Express
- **Banco de Dados**: PostgreSQL
- **Scanner**: @zxing/browser (leitura de código de barras via câmera)

## 📁 Estrutura do Projeto

```
restaurante-backend/
├── frontend/          ← Interface React + Vite
│   └── src/
│       ├── components/
│       │   └── InventoryScanner.tsx  ← Scanner de câmera
│       ├── pages/
│       │   ├── InventoryPage.tsx
│       │   └── ProductsPage.tsx
│       ├── App.tsx
│       └── index.css
├── backend/           ← API Node.js + Express (em construção)
│   └── src/
│       ├── server.ts
│       ├── db.ts
│       └── routes/
│           └── stock.ts
└── db/
    └── schema.sql     ← Esquema PostgreSQL
```

## ⚙️ Como rodar

### Frontend
```bash
cd frontend
npm install
npm run dev
# Acesse http://localhost:3000
```

### Backend
```bash
cd backend
npm install
npm run dev
# API em http://localhost:4000
```

## 📷 Funcionalidades

- Scanner de código de barras via câmera (suporte a câmera traseira no mobile)
- Captura de foto do produto (PNG)
- Consulta de produto por código de barras
- Registro de entrada de estoque via scanner
- Somatória automática dos valores escaneados
- Painel administrativo com barra lateral
- Módulo fiscal (NCM, CEST, PIS, COFINS, ICMS)
- Checkout com taxa de entrega
- Rastreio por WhatsApp e site

## 📄 Licença

MIT
