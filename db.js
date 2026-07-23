const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'restaurante.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  preco REAL NOT NULL,
  imagem TEXT
);
CREATE TABLE IF NOT EXISTS addon_groups (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS addon_itens (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  preco REAL NOT NULL,
  FOREIGN KEY(group_id) REFERENCES addon_groups(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS vendedor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  senha_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS motoqueiros (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pagamento_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pix_chave TEXT DEFAULT '',
  pix_nome TEXT DEFAULT '',
  cartao_mensagem TEXT DEFAULT 'Levamos maquininha na entrega. Aceitamos débito e crédito.'
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  numero INTEGER,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  cliente_endereco TEXT,
  itens TEXT,
  total REAL,
  pagamento TEXT,
  status TEXT,
  motoqueiro_id TEXT,
  criado_em INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_criado_em ON orders(criado_em);
CREATE INDEX IF NOT EXISTS idx_orders_moto ON orders(motoqueiro_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_addon_groups_categoria ON addon_groups(categoria);
CREATE INDEX IF NOT EXISTS idx_addon_itens_group ON addon_itens(group_id);
`);

// seed inicial (só roda na primeira vez, se o banco estiver vazio)
const catCount = db.prepare('SELECT COUNT(*) c FROM categorias').get().c;
if (catCount === 0) {
  const insCat = db.prepare('INSERT INTO categorias (id,nome) VALUES (?,?)');
  const insProd = db.prepare('INSERT INTO produtos (id,nome,categoria,preco,imagem) VALUES (?,?,?,?,?)');
  insCat.run('c1', 'Lanches');
  insCat.run('c2', 'Pizzas');
  insCat.run('c3', 'Bebidas');
  insProd.run('p1', 'X-Burger Artesanal', 'Lanches', 24.9, '');
  insProd.run('p2', 'Pizza Margherita', 'Pizzas', 42.0, '');
  insProd.run('p3', 'Refrigerante Lata', 'Bebidas', 7.0, '');
}

const vendRow = db.prepare('SELECT * FROM vendedor WHERE id=1').get();
if (!vendRow) {
  db.prepare('INSERT INTO vendedor (id, senha_hash) VALUES (1, ?)').run(bcrypt.hashSync('admin123', 10));
  console.log('Conta de vendedor criada com a senha padrão: admin123 (troque assim que possível)');
}

const pagRow = db.prepare('SELECT * FROM pagamento_config WHERE id=1').get();
if (!pagRow) {
  db.prepare('INSERT INTO pagamento_config (id) VALUES (1)').run();
}

module.exports = db;
