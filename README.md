# 🛒 GestorPro – Sistema de Gestão de Produtos e Estoque

Sistema completo com painel administrativo para gestão de produtos, estoque e checkout, desenvolvido com React + TypeScript e uma API serverless no Netlify.

## 🚀 Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Netlify Functions + TypeScript
- **Banco de Dados**: Netlify Database (Postgres) + Drizzle ORM
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
├── netlify/functions/ ← API serverless
├── db/                ← Esquema e cliente Drizzle
├── netlify.toml       ← Configuração de build e publicação
└── public/            ← Saída estática publicada
```

## ⚙️ Como rodar

### Frontend
```bash
cd frontend
npm install
npm run dev
# Acesse http://localhost:3000
```

### Aplicação completa
```bash
npm install
netlify dev --port 8889
```

Configure `JWT_SECRET` no ambiente do site antes de usar as rotas autenticadas.

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
