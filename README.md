# Comanda — Backend real do sistema de restaurante

Backend em **Node.js + Express**, com banco de dados real em **SQLite** (arquivo `restaurante.db`, criado automaticamente), autenticação com senha criptografada (bcrypt) + token de sessão (JWT), e atualizações em tempo real via **Socket.io** (o vendedor e o motoqueiro recebem os pedidos na hora, sem precisar recarregar a página).

O front-end (pasta `public/`) já está pronto e é servido automaticamente pelo próprio servidor — não precisa de nada separado.

## 1. Rodar no seu computador (teste local)

Pré-requisitos: [Node.js](https://nodejs.org) versão 18 ou mais recente instalado.

```bash
cd restaurante-backend
npm install
cp .env.example .env
npm start
```

Abra `http://localhost:3000` no navegador. Pronto, o sistema está rodando com banco de dados real.

**Senha inicial do vendedor:** `admin123` (troque assim que entrar, na aba "Minha conta").

### Acessar pelo celular na mesma rede Wi-Fi (sem hospedar ainda)
1. Descubra o IP do seu computador na rede local (Windows: `ipconfig`, Mac/Linux: `ifconfig` ou `ip a` — procure algo como `192.168.0.x`).
2. No celular (conectado na mesma Wi-Fi), abra o navegador e acesse `http://192.168.0.x:3000`.
3. Para instalar como app: no navegador do celular, abra o menu e toque em **"Adicionar à tela inicial"**. Um ícone do Comanda aparecerá junto com os outros apps.

Isso funciona apenas na mesma rede Wi-Fi. Para acessar de qualquer lugar (dados móveis, fora de casa), você precisa hospedar o servidor — veja o próximo passo.

## 2. Colocar no ar com um link fixo (para acesso de qualquer lugar)

Para o sistema ficar disponível 24 horas por dia, com um endereço público, você precisa hospedar esse código em um serviço de hospedagem. Sugestões gratuitas/baratas e simples para começar:

### Opção recomendada: Render.com
1. Crie uma conta em [render.com](https://render.com) e um repositório no GitHub com esta pasta.
2. No Render, clique em **New → Web Service**, conecte o repositório.
3. Configurações:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variable:** adicione `JWT_SECRET` com um valor forte e aleatório.
4. Depois do deploy, o Render te dá um link do tipo `https://seu-app.onrender.com` — esse é o link que você abre no celular, de qualquer lugar, e pode até divulgar para os clientes.

### Outras opções
- **Railway.app** — processo bem parecido com o Render.
- **Fly.io** — bom para quem já tem alguma experiência com deploy.

Em qualquer uma dessas opções, o SQLite funciona, mas é importante confirmar que o serviço escolhido oferece **disco persistente** (para o arquivo `restaurante.db` não ser apagado a cada reinício). Se o plano gratuito não tiver disco persistente, veja a seção "Escalando para produção" abaixo.

## 3. Estrutura do projeto

```
restaurante-backend/
├── server.js       → servidor Express, todas as rotas da API e Socket.io
├── db.js           → conexão e schema do banco SQLite (criado automaticamente)
├── package.json    → dependências
├── .env.example    → modelo de variáveis de ambiente (copie para .env)
└── public/
    └── index.html  → todo o front-end (cliente, vendedor, motoqueiro)
```

## 4. O que já vem pronto

- **Cardápio** com categorias, produtos e imagem (PNG/JPG)
- **Adicionais** por categoria de produto
- **Formas de pagamento**: Pix (com botão de copiar chave), Cartão (mensagem configurável) e Dinheiro (com opção de troco)
- **Pedidos em tempo real**: assim que o cliente finaliza, o vendedor recebe instantaneamente (Socket.io), sem precisar de F5
- **Conta do vendedor** (senha única da loja, protegida por hash bcrypt)
- **Contas de motoqueiro**, cadastráveis tanto pelo próprio motoqueiro quanto pelo vendedor, com botão do Google Maps para navegação até o cliente
- **Planilha de vendas** exportável em Excel (.xlsx), por dia, com o nome `venda (DD-MM-AAAA)`
- **Expurgo automático**: pedidos com mais de 2 dias são apagados automaticamente do banco (mantém o sistema rápido e define até quando dá pra exportar a planilha de um dia)
- **Modo escuro**

## 5. Segurança — troque isso antes de usar de verdade

- Troque a variável `JWT_SECRET` no `.env` para um valor longo e aleatório (ex: gere um com `openssl rand -hex 32`).
- Troque a senha padrão do vendedor (`admin123`) assim que possível.
- As senhas de vendedor e motoqueiro são armazenadas com hash bcrypt (nunca em texto puro).

## 6. Escalando para mais de 300 pessoas ao mesmo tempo

O SQLite já aguenta bem esse volume para um restaurante (é um banco rápido para leitura e gravações moderadas). Se no futuro o movimento crescer muito mais, o caminho natural é trocar o SQLite por **PostgreSQL** (ex: usando um banco gerenciado como Supabase, Neon ou o Postgres do próprio Render/Railway) — a estrutura de rotas em `server.js` muda pouco, principalmente a camada de `db.js`. Posso ajudar nessa migração quando for a hora.
