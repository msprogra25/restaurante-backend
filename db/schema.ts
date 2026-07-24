import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

export const categorias = pgTable("categorias", {
  id: text().primaryKey(),
  nome: text().notNull(),
});

export const produtos = pgTable(
  "produtos",
  {
    id: text().primaryKey(),
    nome: text().notNull(),
    categoria: text().notNull(),
    preco: doublePrecision().notNull(),
    imagem: text().notNull().default(""),
  },
  (table) => [index("idx_produtos_categoria").on(table.categoria)],
);

export const addonGroups = pgTable(
  "addon_groups",
  {
    id: text().primaryKey(),
    nome: text().notNull(),
    categoria: text().notNull(),
  },
  (table) => [index("idx_addon_groups_categoria").on(table.categoria)],
);

export const addonItens = pgTable(
  "addon_itens",
  {
    id: text().primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => addonGroups.id, { onDelete: "cascade" }),
    nome: text().notNull(),
    preco: doublePrecision().notNull(),
  },
  (table) => [index("idx_addon_itens_group").on(table.groupId)],
);

export const vendedor = pgTable("vendedor", {
  id: integer().primaryKey(),
  senhaHash: text("senha_hash").notNull(),
});

export const motoqueiros = pgTable("motoqueiros", {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
});

export const pagamentoConfig = pgTable("pagamento_config", {
  id: integer().primaryKey(),
  pixChave: text("pix_chave").notNull().default(""),
  pixNome: text("pix_nome").notNull().default(""),
  cartaoMensagem: text("cartao_mensagem")
    .notNull()
    .default("Levamos maquininha na entrega. Aceitamos débito e crédito."),
});

export const orders = pgTable(
  "orders",
  {
    id: text().primaryKey(),
    numero: integer().notNull(),
    clienteNome: text("cliente_nome").notNull(),
    clienteTelefone: text("cliente_telefone").notNull(),
    clienteEndereco: text("cliente_endereco").notNull(),
    itens: jsonb().notNull(),
    total: doublePrecision().notNull(),
    pagamento: jsonb().notNull().default({}),
    status: text().notNull(),
    motoqueiroId: text("motoqueiro_id").references(() => motoqueiros.id, {
      onDelete: "set null",
    }),
    criadoEm: bigint("criado_em", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_orders_status").on(table.status),
    index("idx_orders_criado_em").on(table.criadoEm),
    index("idx_orders_moto").on(table.motoqueiroId),
  ],
);
