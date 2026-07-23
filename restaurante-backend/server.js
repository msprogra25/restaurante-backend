require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';
const PORT = process.env.PORT || 3000;
const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET não definido no .env — usando um valor padrão inseguro. Configure um valor próprio antes de ir para produção.');
}

app.use(compression()); // comprime as respostas (o JSON do cardápio com imagens fica bem mais leve)
app.use(cors());
app.use(express.json({ limit: '15mb' })); // imagens em base64 podem ser grandes
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

function uid(prefix) { return prefix + '_' + crypto.randomBytes(6).toString('hex'); }
function sign(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' }); }

function authVendedor(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    const payload = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    if (payload.role !== 'vendedor') throw new Error();
    next();
  } catch (e) { return res.status(401).json({ erro: 'Sessão inválida, faça login novamente' }); }
}
function authMoto(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    const payload = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    if (payload.role !== 'moto') throw new Error();
    req.motoId = payload.id;
    next();
  } catch (e) { return res.status(401).json({ erro: 'Sessão inválida, faça login novamente' }); }
}
function authVendedorOuMoto(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.authPayload = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch (e) { return res.status(401).json({ erro: 'Sessão inválida, faça login novamente' }); }
}

/* ===================== MENU ===================== */
app.get('/api/menu', (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias').all();
  const produtos = db.prepare('SELECT * FROM produtos').all();
  res.json({ categorias, produtos });
});
app.post('/api/menu/categorias', authVendedor, (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
  const id = uid('cat');
  db.prepare('INSERT INTO categorias (id,nome) VALUES (?,?)').run(id, nome.trim());
  io.emit('cardapio:mudou');
  res.json({ id, nome: nome.trim() });
});
app.put('/api/menu/categorias/:id', authVendedor, (req, res) => {
  const { nome } = req.body;
  const cat = db.prepare('SELECT * FROM categorias WHERE id=?').get(req.params.id);
  if (!cat) return res.status(404).json({ erro: 'Categoria não encontrada' });
  const novoNome = (nome || '').trim() || cat.nome;
  db.prepare('UPDATE categorias SET nome=? WHERE id=?').run(novoNome, req.params.id);
  db.prepare('UPDATE produtos SET categoria=? WHERE categoria=?').run(novoNome, cat.nome);
  db.prepare('UPDATE addon_groups SET categoria=? WHERE categoria=?').run(novoNome, cat.nome);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});
app.delete('/api/menu/categorias/:id', authVendedor, (req, res) => {
  db.prepare('DELETE FROM categorias WHERE id=?').run(req.params.id);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});
app.post('/api/menu/produtos', authVendedor, (req, res) => {
  const { nome, categoria, preco, imagem } = req.body;
  if (!nome || !categoria || preco === undefined || isNaN(Number(preco))) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const id = uid('p');
  db.prepare('INSERT INTO produtos (id,nome,categoria,preco,imagem) VALUES (?,?,?,?,?)')
    .run(id, nome.trim(), categoria, Number(preco), imagem || '');
  io.emit('cardapio:mudou');
  res.json({ id });
});
app.put('/api/menu/produtos/:id', authVendedor, (req, res) => {
  const { nome, categoria, preco, imagem } = req.body;
  if (!nome || !categoria || preco === undefined || isNaN(Number(preco))) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  db.prepare('UPDATE produtos SET nome=?, categoria=?, preco=?, imagem=? WHERE id=?')
    .run(nome.trim(), categoria, Number(preco), imagem || '', req.params.id);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});
app.delete('/api/menu/produtos/:id', authVendedor, (req, res) => {
  db.prepare('DELETE FROM produtos WHERE id=?').run(req.params.id);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});

/* ===================== ADICIONAIS ===================== */
app.get('/api/addongroups', (req, res) => {
  const groups = db.prepare('SELECT * FROM addon_groups').all();
  const itens = db.prepare('SELECT * FROM addon_itens').all();
  res.json(groups.map(g => ({
    ...g,
    itens: itens.filter(i => i.group_id === g.id).map(i => ({ id: i.id, nome: i.nome, preco: i.preco }))
  })));
});
app.post('/api/addongroups', authVendedor, (req, res) => {
  const { nome, categoria } = req.body;
  if (!nome || !categoria) return res.status(400).json({ erro: 'Dados incompletos' });
  const id = uid('grp');
  db.prepare('INSERT INTO addon_groups (id,nome,categoria) VALUES (?,?,?)').run(id, nome.trim(), categoria);
  io.emit('cardapio:mudou');
  res.json({ id });
});
app.put('/api/addongroups/:id', authVendedor, (req, res) => {
  const { nome, categoria } = req.body;
  db.prepare('UPDATE addon_groups SET nome=?, categoria=? WHERE id=?').run(nome.trim(), categoria, req.params.id);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});
app.delete('/api/addongroups/:id', authVendedor, (req, res) => {
  db.prepare('DELETE FROM addon_itens WHERE group_id=?').run(req.params.id);
  db.prepare('DELETE FROM addon_groups WHERE id=?').run(req.params.id);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});
app.post('/api/addongroups/:id/itens', authVendedor, (req, res) => {
  const { nome, preco } = req.body;
  if (!nome || preco === undefined || isNaN(Number(preco))) return res.status(400).json({ erro: 'Dados incompletos' });
  const id = uid('ad');
  db.prepare('INSERT INTO addon_itens (id,group_id,nome,preco) VALUES (?,?,?,?)').run(id, req.params.id, nome.trim(), Number(preco));
  io.emit('cardapio:mudou');
  res.json({ id });
});
app.put('/api/addongroups/:gid/itens/:iid', authVendedor, (req, res) => {
  const { nome, preco } = req.body;
  db.prepare('UPDATE addon_itens SET nome=?, preco=? WHERE id=?').run(nome.trim(), Number(preco), req.params.iid);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});
app.delete('/api/addongroups/:gid/itens/:iid', authVendedor, (req, res) => {
  db.prepare('DELETE FROM addon_itens WHERE id=?').run(req.params.iid);
  io.emit('cardapio:mudou');
  res.json({ ok: true });
});

/* ===================== PAGAMENTO ===================== */
app.get('/api/pagamento', (req, res) => {
  const row = db.prepare('SELECT * FROM pagamento_config WHERE id=1').get();
  res.json({ pixChave: row.pix_chave, pixNome: row.pix_nome, cartaoMensagem: row.cartao_mensagem });
});
app.put('/api/pagamento', authVendedor, (req, res) => {
  const { pixChave, pixNome, cartaoMensagem } = req.body;
  db.prepare('UPDATE pagamento_config SET pix_chave=?, pix_nome=?, cartao_mensagem=? WHERE id=1')
    .run(pixChave || '', pixNome || '', cartaoMensagem || '');
  io.emit('config:mudou');
  res.json({ ok: true });
});

/* ===================== VENDEDOR ===================== */
app.post('/api/vendedor/login', (req, res) => {
  const { senha } = req.body;
  const row = db.prepare('SELECT * FROM vendedor WHERE id=1').get();
  if (!bcrypt.compareSync(senha || '', row.senha_hash)) return res.status(401).json({ erro: 'Senha incorreta' });
  res.json({ token: sign({ role: 'vendedor' }) });
});
app.put('/api/vendedor/senha', authVendedor, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const row = db.prepare('SELECT * FROM vendedor WHERE id=1').get();
  if (!bcrypt.compareSync(senhaAtual || '', row.senha_hash)) return res.status(401).json({ erro: 'Senha atual incorreta' });
  if (!novaSenha || novaSenha.length < 4) return res.status(400).json({ erro: 'A nova senha deve ter ao menos 4 caracteres' });
  db.prepare('UPDATE vendedor SET senha_hash=? WHERE id=1').run(bcrypt.hashSync(novaSenha, 10));
  res.json({ ok: true });
});
app.post('/api/vendedor/excluir-conta', authVendedor, (req, res) => {
  db.prepare('UPDATE vendedor SET senha_hash=? WHERE id=1').run(bcrypt.hashSync('admin123', 10));
  res.json({ ok: true });
});

/* ===================== MOTOQUEIROS ===================== */
app.post('/api/motoqueiros/register', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ erro: 'E-mail inválido' });
  if (!senha || senha.length < 4) return res.status(400).json({ erro: 'A senha deve ter ao menos 4 caracteres' });
  const e = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM motoqueiros WHERE email=?').get(e)) return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail' });
  const id = uid('moto');
  db.prepare('INSERT INTO motoqueiros (id,email,senha_hash) VALUES (?,?,?)').run(id, e, bcrypt.hashSync(senha, 10));
  res.json({ token: sign({ role: 'moto', id }), motoqueiro: { id, email: e } });
});
app.post('/api/motoqueiros/login', (req, res) => {
  const { email, senha } = req.body;
  const row = db.prepare('SELECT * FROM motoqueiros WHERE email=?').get((email || '').trim().toLowerCase());
  if (!row || !bcrypt.compareSync(senha || '', row.senha_hash)) return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  res.json({ token: sign({ role: 'moto', id: row.id }), motoqueiro: { id: row.id, email: row.email } });
});
app.get('/api/motoqueiros', authVendedor, (req, res) => {
  res.json(db.prepare('SELECT id,email FROM motoqueiros').all());
});
app.post('/api/motoqueiros', authVendedor, (req, res) => {
  const { email, senha } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ erro: 'E-mail inválido' });
  if (!senha || senha.length < 4) return res.status(400).json({ erro: 'A senha deve ter ao menos 4 caracteres' });
  const e = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM motoqueiros WHERE email=?').get(e)) return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail' });
  const id = uid('moto');
  db.prepare('INSERT INTO motoqueiros (id,email,senha_hash) VALUES (?,?,?)').run(id, e, bcrypt.hashSync(senha, 10));
  res.json({ id, email: e });
});
app.put('/api/motoqueiros/:id/senha', authVendedor, (req, res) => {
  const { novaSenha } = req.body;
  if (!novaSenha || novaSenha.length < 4) return res.status(400).json({ erro: 'A senha deve ter ao menos 4 caracteres' });
  db.prepare('UPDATE motoqueiros SET senha_hash=? WHERE id=?').run(bcrypt.hashSync(novaSenha, 10), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/motoqueiros/:id', authVendedorOuMoto, (req, res) => {
  const p = req.authPayload;
  if (p.role === 'vendedor' || (p.role === 'moto' && p.id === req.params.id)) {
    db.prepare('DELETE FROM motoqueiros WHERE id=?').run(req.params.id);
    return res.json({ ok: true });
  }
  res.status(403).json({ erro: 'Sem permissão' });
});

/* ===================== PEDIDOS ===================== */
function rowToOrder(r) {
  return {
    id: r.id, numero: r.numero,
    cliente: { nome: r.cliente_nome, telefone: r.cliente_telefone, endereco: r.cliente_endereco },
    itens: JSON.parse(r.itens), total: r.total, pagamento: JSON.parse(r.pagamento || '{}'),
    status: r.status, motoqueiroId: r.motoqueiro_id, criadoEm: r.criado_em
  };
}
function purgeOldOrders() {
  db.prepare('DELETE FROM orders WHERE criado_em < ?').run(Date.now() - DOIS_DIAS_MS);
}

app.post('/api/orders', (req, res) => {
  const { cliente, itens, total, pagamento } = req.body;
  if (!cliente || !cliente.nome || !cliente.telefone || !cliente.endereco || !itens || !itens.length) {
    return res.status(400).json({ erro: 'Dados do pedido incompletos' });
  }
  const id = uid('ped');
  const numero = Math.floor(1000 + Math.random() * 9000);
  const criadoEm = Date.now();
  db.prepare(`INSERT INTO orders (id,numero,cliente_nome,cliente_telefone,cliente_endereco,itens,total,pagamento,status,motoqueiro_id,criado_em)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, numero, cliente.nome, cliente.telefone, cliente.endereco,
    JSON.stringify(itens), total, JSON.stringify(pagamento || {}), 'pendente', null, criadoEm
  );
  const order = rowToOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(id));
  io.emit('pedidos:mudou');
  res.json(order);
});
app.get('/api/orders', authVendedor, (req, res) => {
  purgeOldOrders();
  const status = req.query.status;
  let rows;
  if (status === 'ativos') {
    rows = db.prepare(`SELECT * FROM orders WHERE status IN ('pendente','preparando','pronto','em_entrega') ORDER BY criado_em DESC`).all();
  } else if (status === 'historico') {
    rows = db.prepare(`SELECT * FROM orders WHERE status IN ('entregue','cancelado') ORDER BY criado_em DESC LIMIT 60`).all();
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY criado_em DESC LIMIT 200').all();
  }
  res.json(rows.map(rowToOrder));
});
app.get('/api/orders/mine', authMoto, (req, res) => {
  const rows = db.prepare(`SELECT * FROM orders WHERE motoqueiro_id=? AND status IN ('em_entrega','entregue') ORDER BY criado_em DESC`).all(req.motoId);
  res.json(rows.map(rowToOrder));
});
app.put('/api/orders/:id/status', authVendedor, (req, res) => {
  const { status } = req.body;
  const validos = ['pendente', 'preparando', 'pronto', 'em_entrega', 'entregue', 'cancelado'];
  if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  io.emit('pedidos:mudou');
  res.json({ ok: true });
});
app.put('/api/orders/:id/enviar-entrega', authVendedor, (req, res) => {
  const { motoqueiroId } = req.body;
  if (!motoqueiroId) return res.status(400).json({ erro: 'Selecione um motoqueiro' });
  db.prepare(`UPDATE orders SET status='em_entrega', motoqueiro_id=? WHERE id=?`).run(motoqueiroId, req.params.id);
  io.emit('pedidos:mudou');
  res.json({ ok: true });
});
app.put('/api/orders/:id/entregar', authMoto, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!row || row.motoqueiro_id !== req.motoId) return res.status(403).json({ erro: 'Este pedido não é seu' });
  db.prepare(`UPDATE orders SET status='entregue' WHERE id=?`).run(req.params.id);
  io.emit('pedidos:mudou');
  res.json({ ok: true });
});

/* ===================== PLANILHA DE VENDAS ===================== */
app.get('/api/relatorio', authVendedor, (req, res) => {
  purgeOldOrders();
  const rows = db.prepare(`SELECT criado_em, total FROM orders WHERE status != 'cancelado'`).all();
  const map = {};
  rows.forEach(r => {
    const d = new Date(r.criado_em);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map[key]) map[key] = { count: 0, total: 0 };
    map[key].count++; map[key].total += r.total;
  });
  res.json(map);
});
app.get('/api/relatorio/:date', authVendedor, (req, res) => {
  const rows = db.prepare(`SELECT * FROM orders WHERE status != 'cancelado' ORDER BY criado_em ASC`).all();
  const filtered = rows.filter(r => {
    const d = new Date(r.criado_em);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === req.params.date;
  });
  res.json(filtered.map(rowToOrder));
});

purgeOldOrders();
setInterval(purgeOldOrders, 60 * 60 * 1000); // expurga pedidos com mais de 2 dias, a cada 1h

io.on('connection', () => {});

server.listen(PORT, () => {
  console.log(`✅ Servidor Comanda rodando em http://localhost:${PORT}`);
  console.log(`   Acesse pelo celular usando o IP da rede local ou o endereço público, se hospedado.`);
});
