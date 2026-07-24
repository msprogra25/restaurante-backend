import type { Config } from "@netlify/functions";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, asc, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  addonGroups,
  addonItens,
  categorias,
  motoqueiros,
  orders,
  pagamentoConfig,
  produtos,
  vendedor,
} from "../../db/schema.js";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ["pendente", "preparando", "pronto", "em_entrega"];
const HISTORY_STATUSES = ["entregue", "cancelado"];
const VALID_STATUSES = [...ACTIVE_STATUSES, ...HISTORY_STATUSES];
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};

type AuthPayload = { role: "vendedor" | "moto"; id?: string };

type OrderRow = typeof orders.$inferSelect;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function routeMatch(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}

function getJwtSecret() {
  const secret = Netlify.env.get("JWT_SECRET");
  if (!secret) throw new Error("JWT_SECRET_NOT_CONFIGURED");
  return secret;
}

function sign(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

function authenticate(req: Request, roles: AuthPayload["role"][]) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  try {
    const payload = jwt.verify(authorization.slice(7), getJwtSecret()) as AuthPayload;
    return roles.includes(payload.role) ? payload : null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, roles: AuthPayload["role"][]) {
  const payload = authenticate(req, roles);
  return payload ? { payload } : { response: json({ erro: "Sessão inválida, faça login novamente" }, 401) };
}

async function body(req: Request) {
  return (await req.json()) as Record<string, any>;
}

function toOrder(row: OrderRow) {
  return {
    id: row.id,
    numero: row.numero,
    cliente: {
      nome: row.clienteNome,
      telefone: row.clienteTelefone,
      endereco: row.clienteEndereco,
    },
    itens: row.itens,
    total: row.total,
    pagamento: row.pagamento,
    status: row.status,
    motoqueiroId: row.motoqueiroId,
    criadoEm: row.criadoEm,
  };
}

async function ensureSeedData() {
  const [[category], [seller]] = await Promise.all([
    db.select({ id: categorias.id }).from(categorias).limit(1),
    db.select({ id: vendedor.id }).from(vendedor).where(eq(vendedor.id, 1)),
  ]);

  if (!category) {
    await db.insert(categorias).values([
      { id: "c1", nome: "Lanches" },
      { id: "c2", nome: "Pizzas" },
      { id: "c3", nome: "Bebidas" },
    ]).onConflictDoNothing();

    await db.insert(produtos).values([
      { id: "p1", nome: "X-Burger Artesanal", categoria: "Lanches", preco: 24.9, imagem: "" },
      { id: "p2", nome: "Pizza Margherita", categoria: "Pizzas", preco: 42, imagem: "" },
      { id: "p3", nome: "Refrigerante Lata", categoria: "Bebidas", preco: 7, imagem: "" },
    ]).onConflictDoNothing();
  }

  if (!seller) {
    await db.insert(vendedor).values({ id: 1, senhaHash: bcrypt.hashSync("admin123", 10) }).onConflictDoNothing();
  }
  await db.insert(pagamentoConfig).values({ id: 1 }).onConflictDoNothing();
}

async function purgeOldOrders() {
  await db.delete(orders).where(lt(orders.criadoEm, Date.now() - TWO_DAYS_MS));
}

async function handleMenu(req: Request, pathname: string) {
  if (req.method === "GET" && pathname === "/api/menu") {
    await ensureSeedData();
    const [categoryRows, productRows] = await Promise.all([
      db.select().from(categorias),
      db.select().from(produtos),
    ]);
    return json({ categorias: categoryRows, produtos: productRows });
  }

  if (pathname === "/api/menu/categorias" && req.method === "POST") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { nome } = await body(req);
    if (!nome?.trim()) return json({ erro: "Nome obrigatório" }, 400);
    const category = { id: uid("cat"), nome: nome.trim() };
    await db.insert(categorias).values(category);
    return json(category);
  }

  const categoryMatch = routeMatch(pathname, /^\/api\/menu\/categorias\/([^/]+)$/);
  if (categoryMatch) {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const id = decodeURIComponent(categoryMatch[1]);

    if (req.method === "PUT") {
      const { nome } = await body(req);
      const [current] = await db.select().from(categorias).where(eq(categorias.id, id));
      if (!current) return json({ erro: "Categoria não encontrada" }, 404);
      const newName = nome?.trim() || current.nome;
      await Promise.all([
        db.update(categorias).set({ nome: newName }).where(eq(categorias.id, id)),
        db.update(produtos).set({ categoria: newName }).where(eq(produtos.categoria, current.nome)),
        db.update(addonGroups).set({ categoria: newName }).where(eq(addonGroups.categoria, current.nome)),
      ]);
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      await db.delete(categorias).where(eq(categorias.id, id));
      return json({ ok: true });
    }
  }

  if (pathname === "/api/menu/produtos" && req.method === "POST") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { nome, categoria, preco, imagem } = await body(req);
    if (!nome || !categoria || preco === undefined || Number.isNaN(Number(preco))) {
      return json({ erro: "Dados incompletos" }, 400);
    }
    const id = uid("p");
    await db.insert(produtos).values({ id, nome: nome.trim(), categoria, preco: Number(preco), imagem: imagem || "" });
    return json({ id });
  }

  const productMatch = routeMatch(pathname, /^\/api\/menu\/produtos\/([^/]+)$/);
  if (productMatch) {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const id = decodeURIComponent(productMatch[1]);

    if (req.method === "PUT") {
      const { nome, categoria, preco, imagem } = await body(req);
      if (!nome || !categoria || preco === undefined || Number.isNaN(Number(preco))) {
        return json({ erro: "Dados incompletos" }, 400);
      }
      await db.update(produtos).set({ nome: nome.trim(), categoria, preco: Number(preco), imagem: imagem || "" }).where(eq(produtos.id, id));
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      await db.delete(produtos).where(eq(produtos.id, id));
      return json({ ok: true });
    }
  }
}

async function handleAddons(req: Request, pathname: string) {
  if (req.method === "GET" && pathname === "/api/addongroups") {
    const [groups, items] = await Promise.all([
      db.select().from(addonGroups),
      db.select().from(addonItens),
    ]);
    return json(groups.map((group) => ({
      id: group.id,
      nome: group.nome,
      categoria: group.categoria,
      itens: items.filter((item) => item.groupId === group.id).map((item) => ({ id: item.id, nome: item.nome, preco: item.preco })),
    })));
  }

  if (pathname === "/api/addongroups" && req.method === "POST") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { nome, categoria } = await body(req);
    if (!nome || !categoria) return json({ erro: "Dados incompletos" }, 400);
    const id = uid("grp");
    await db.insert(addonGroups).values({ id, nome: nome.trim(), categoria });
    return json({ id });
  }

  const groupMatch = routeMatch(pathname, /^\/api\/addongroups\/([^/]+)$/);
  if (groupMatch) {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const id = decodeURIComponent(groupMatch[1]);

    if (req.method === "PUT") {
      const { nome, categoria } = await body(req);
      await db.update(addonGroups).set({ nome: nome?.trim(), categoria }).where(eq(addonGroups.id, id));
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      await db.delete(addonGroups).where(eq(addonGroups.id, id));
      return json({ ok: true });
    }
  }

  const createItemMatch = routeMatch(pathname, /^\/api\/addongroups\/([^/]+)\/itens$/);
  if (createItemMatch && req.method === "POST") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { nome, preco } = await body(req);
    if (!nome || preco === undefined || Number.isNaN(Number(preco))) return json({ erro: "Dados incompletos" }, 400);
    const id = uid("ad");
    await db.insert(addonItens).values({ id, groupId: decodeURIComponent(createItemMatch[1]), nome: nome.trim(), preco: Number(preco) });
    return json({ id });
  }

  const itemMatch = routeMatch(pathname, /^\/api\/addongroups\/([^/]+)\/itens\/([^/]+)$/);
  if (itemMatch) {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const itemId = decodeURIComponent(itemMatch[2]);

    if (req.method === "PUT") {
      const { nome, preco } = await body(req);
      await db.update(addonItens).set({ nome: nome?.trim(), preco: Number(preco) }).where(eq(addonItens.id, itemId));
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      await db.delete(addonItens).where(eq(addonItens.id, itemId));
      return json({ ok: true });
    }
  }
}

async function handlePayment(req: Request, pathname: string) {
  if (pathname !== "/api/pagamento") return;
  await ensureSeedData();

  if (req.method === "GET") {
    const [row] = await db.select().from(pagamentoConfig).where(eq(pagamentoConfig.id, 1));
    return json({ pixChave: row.pixChave, pixNome: row.pixNome, cartaoMensagem: row.cartaoMensagem });
  }

  if (req.method === "PUT") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { pixChave, pixNome, cartaoMensagem } = await body(req);
    await db.update(pagamentoConfig).set({ pixChave: pixChave || "", pixNome: pixNome || "", cartaoMensagem: cartaoMensagem || "" }).where(eq(pagamentoConfig.id, 1));
    return json({ ok: true });
  }
}

async function handleSeller(req: Request, pathname: string) {
  if (!pathname.startsWith("/api/vendedor/")) return;
  await ensureSeedData();

  if (pathname === "/api/vendedor/login" && req.method === "POST") {
    const { senha } = await body(req);
    const [row] = await db.select().from(vendedor).where(eq(vendedor.id, 1));
    if (!bcrypt.compareSync(senha || "", row.senhaHash)) return json({ erro: "Senha incorreta" }, 401);
    return json({ token: sign({ role: "vendedor" }) });
  }

  const auth = requireAuth(req, ["vendedor"]);
  if ("response" in auth) return auth.response;

  if (pathname === "/api/vendedor/senha" && req.method === "PUT") {
    const { senhaAtual, novaSenha } = await body(req);
    const [row] = await db.select().from(vendedor).where(eq(vendedor.id, 1));
    if (!bcrypt.compareSync(senhaAtual || "", row.senhaHash)) return json({ erro: "Senha atual incorreta" }, 401);
    if (!novaSenha || novaSenha.length < 4) return json({ erro: "A nova senha deve ter ao menos 4 caracteres" }, 400);
    await db.update(vendedor).set({ senhaHash: bcrypt.hashSync(novaSenha, 10) }).where(eq(vendedor.id, 1));
    return json({ ok: true });
  }

  if (pathname === "/api/vendedor/excluir-conta" && req.method === "POST") {
    await db.update(vendedor).set({ senhaHash: bcrypt.hashSync("admin123", 10) }).where(eq(vendedor.id, 1));
    return json({ ok: true });
  }
}

async function handleCouriers(req: Request, pathname: string) {
  if (!pathname.startsWith("/api/motoqueiros")) return;

  if (pathname === "/api/motoqueiros/register" && req.method === "POST") {
    const { email, senha } = await body(req);
    if (!email?.includes("@")) return json({ erro: "E-mail inválido" }, 400);
    if (!senha || senha.length < 4) return json({ erro: "A senha deve ter ao menos 4 caracteres" }, 400);
    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await db.select({ id: motoqueiros.id }).from(motoqueiros).where(eq(motoqueiros.email, normalizedEmail));
    if (existing) return json({ erro: "Já existe uma conta com esse e-mail" }, 409);
    const id = uid("moto");
    await db.insert(motoqueiros).values({ id, email: normalizedEmail, senhaHash: bcrypt.hashSync(senha, 10) });
    return json({ token: sign({ role: "moto", id }), motoqueiro: { id, email: normalizedEmail } });
  }

  if (pathname === "/api/motoqueiros/login" && req.method === "POST") {
    const { email, senha } = await body(req);
    const normalizedEmail = (email || "").trim().toLowerCase();
    const [row] = await db.select().from(motoqueiros).where(eq(motoqueiros.email, normalizedEmail));
    if (!row || !bcrypt.compareSync(senha || "", row.senhaHash)) return json({ erro: "E-mail ou senha incorretos" }, 401);
    return json({ token: sign({ role: "moto", id: row.id }), motoqueiro: { id: row.id, email: row.email } });
  }

  if (pathname === "/api/motoqueiros" && req.method === "GET") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    return json(await db.select({ id: motoqueiros.id, email: motoqueiros.email }).from(motoqueiros));
  }

  if (pathname === "/api/motoqueiros" && req.method === "POST") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { email, senha } = await body(req);
    if (!email?.includes("@")) return json({ erro: "E-mail inválido" }, 400);
    if (!senha || senha.length < 4) return json({ erro: "A senha deve ter ao menos 4 caracteres" }, 400);
    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await db.select({ id: motoqueiros.id }).from(motoqueiros).where(eq(motoqueiros.email, normalizedEmail));
    if (existing) return json({ erro: "Já existe uma conta com esse e-mail" }, 409);
    const id = uid("moto");
    await db.insert(motoqueiros).values({ id, email: normalizedEmail, senhaHash: bcrypt.hashSync(senha, 10) });
    return json({ id, email: normalizedEmail });
  }

  const passwordMatch = routeMatch(pathname, /^\/api\/motoqueiros\/([^/]+)\/senha$/);
  if (passwordMatch && req.method === "PUT") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { novaSenha } = await body(req);
    if (!novaSenha || novaSenha.length < 4) return json({ erro: "A senha deve ter ao menos 4 caracteres" }, 400);
    await db.update(motoqueiros).set({ senhaHash: bcrypt.hashSync(novaSenha, 10) }).where(eq(motoqueiros.id, decodeURIComponent(passwordMatch[1])));
    return json({ ok: true });
  }

  const courierMatch = routeMatch(pathname, /^\/api\/motoqueiros\/([^/]+)$/);
  if (courierMatch && req.method === "DELETE") {
    const auth = requireAuth(req, ["vendedor", "moto"]);
    if ("response" in auth) return auth.response;
    const id = decodeURIComponent(courierMatch[1]);
    if (auth.payload.role !== "vendedor" && auth.payload.id !== id) return json({ erro: "Sem permissão" }, 403);
    await db.delete(motoqueiros).where(eq(motoqueiros.id, id));
    return json({ ok: true });
  }
}

async function handleOrders(req: Request, pathname: string, url: URL) {
  if (!pathname.startsWith("/api/orders")) return;

  if (pathname === "/api/orders" && req.method === "POST") {
    const { cliente, itens, total, pagamento } = await body(req);
    if (!cliente?.nome || !cliente?.telefone || !cliente?.endereco || !Array.isArray(itens) || !itens.length) {
      return json({ erro: "Dados do pedido incompletos" }, 400);
    }
    const id = uid("ped");
    const [order] = await db.insert(orders).values({
      id,
      numero: Math.floor(1000 + Math.random() * 9000),
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      clienteEndereco: cliente.endereco,
      itens,
      total: Number(total),
      pagamento: pagamento || {},
      status: "pendente",
      motoqueiroId: null,
      criadoEm: Date.now(),
    }).returning();
    return json(toOrder(order));
  }

  if (pathname === "/api/orders" && req.method === "GET") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    await purgeOldOrders();
    const status = url.searchParams.get("status");
    const rows = status === "ativos"
      ? await db.select().from(orders).where(inArray(orders.status, ACTIVE_STATUSES)).orderBy(desc(orders.criadoEm))
      : status === "historico"
        ? await db.select().from(orders).where(inArray(orders.status, HISTORY_STATUSES)).orderBy(desc(orders.criadoEm)).limit(60)
        : await db.select().from(orders).orderBy(desc(orders.criadoEm)).limit(200);
    return json(rows.map(toOrder));
  }

  if (pathname === "/api/orders/mine" && req.method === "GET") {
    const auth = requireAuth(req, ["moto"]);
    if ("response" in auth) return auth.response;
    const rows = await db.select().from(orders).where(and(eq(orders.motoqueiroId, auth.payload.id!), inArray(orders.status, ["em_entrega", "entregue"]))).orderBy(desc(orders.criadoEm));
    return json(rows.map(toOrder));
  }

  const statusMatch = routeMatch(pathname, /^\/api\/orders\/([^/]+)\/status$/);
  if (statusMatch && req.method === "PUT") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { status } = await body(req);
    if (!VALID_STATUSES.includes(status)) return json({ erro: "Status inválido" }, 400);
    await db.update(orders).set({ status }).where(eq(orders.id, decodeURIComponent(statusMatch[1])));
    return json({ ok: true });
  }

  const dispatchMatch = routeMatch(pathname, /^\/api\/orders\/([^/]+)\/enviar-entrega$/);
  if (dispatchMatch && req.method === "PUT") {
    const auth = requireAuth(req, ["vendedor"]);
    if ("response" in auth) return auth.response;
    const { motoqueiroId } = await body(req);
    if (!motoqueiroId) return json({ erro: "Selecione um motoqueiro" }, 400);
    await db.update(orders).set({ status: "em_entrega", motoqueiroId }).where(eq(orders.id, decodeURIComponent(dispatchMatch[1])));
    return json({ ok: true });
  }

  const deliverMatch = routeMatch(pathname, /^\/api\/orders\/([^/]+)\/entregar$/);
  if (deliverMatch && req.method === "PUT") {
    const auth = requireAuth(req, ["moto"]);
    if ("response" in auth) return auth.response;
    const id = decodeURIComponent(deliverMatch[1]);
    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    if (!row || row.motoqueiroId !== auth.payload.id) return json({ erro: "Este pedido não é seu" }, 403);
    await db.update(orders).set({ status: "entregue" }).where(eq(orders.id, id));
    return json({ ok: true });
  }
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function handleReports(req: Request, pathname: string) {
  if (!pathname.startsWith("/api/relatorio") || req.method !== "GET") return;
  const auth = requireAuth(req, ["vendedor"]);
  if ("response" in auth) return auth.response;

  await purgeOldOrders();
  const dateMatch = routeMatch(pathname, /^\/api\/relatorio\/([^/]+)$/);
  if (dateMatch) {
    const requestedDate = decodeURIComponent(dateMatch[1]);
    const rows = await db.select().from(orders).where(ne(orders.status, "cancelado")).orderBy(asc(orders.criadoEm));
    return json(rows.filter((row) => dateKey(row.criadoEm) === requestedDate).map(toOrder));
  }

  if (pathname === "/api/relatorio") {
    const rows = await db.select({ criadoEm: orders.criadoEm, total: orders.total }).from(orders).where(ne(orders.status, "cancelado"));
    const report: Record<string, { count: number; total: number }> = {};
    for (const row of rows) {
      const key = dateKey(row.criadoEm);
      report[key] ??= { count: 0, total: 0 };
      report[key].count += 1;
      report[key].total += row.total;
    }
    return json(report);
  }
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  try {
    if (pathname === "/api/health" && req.method === "GET") return json({ ok: true, time: Date.now() });

    const response =
      await handleMenu(req, pathname) ??
      await handleAddons(req, pathname) ??
      await handlePayment(req, pathname) ??
      await handleSeller(req, pathname) ??
      await handleCouriers(req, pathname) ??
      await handleOrders(req, pathname, url) ??
      await handleReports(req, pathname);

    return response ?? json({ erro: "Rota não encontrada" }, 404);
  } catch (error) {
    if (error instanceof Error && error.message === "JWT_SECRET_NOT_CONFIGURED") {
      return json({ erro: "Autenticação não configurada no servidor" }, 503);
    }
    console.error("Erro não tratado na API", error);
    return json({ erro: "Erro interno do servidor" }, 500);
  }
};

export const config: Config = {
  path: "/api/*",
};
