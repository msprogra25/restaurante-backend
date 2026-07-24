CREATE TABLE "addon_groups" (
	"id" text PRIMARY KEY,
	"nome" text NOT NULL,
	"categoria" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_itens" (
	"id" text PRIMARY KEY,
	"group_id" text NOT NULL,
	"nome" text NOT NULL,
	"preco" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" text PRIMARY KEY,
	"nome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motoqueiros" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"senha_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"numero" integer NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_telefone" text NOT NULL,
	"cliente_endereco" text NOT NULL,
	"itens" jsonb NOT NULL,
	"total" double precision NOT NULL,
	"pagamento" jsonb DEFAULT '{}' NOT NULL,
	"status" text NOT NULL,
	"motoqueiro_id" text,
	"criado_em" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagamento_config" (
	"id" integer PRIMARY KEY,
	"pix_chave" text DEFAULT '' NOT NULL,
	"pix_nome" text DEFAULT '' NOT NULL,
	"cartao_mensagem" text DEFAULT 'Levamos maquininha na entrega. Aceitamos débito e crédito.' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" text PRIMARY KEY,
	"nome" text NOT NULL,
	"categoria" text NOT NULL,
	"preco" double precision NOT NULL,
	"imagem" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendedor" (
	"id" integer PRIMARY KEY,
	"senha_hash" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_addon_groups_categoria" ON "addon_groups" ("categoria");--> statement-breakpoint
CREATE INDEX "idx_addon_itens_group" ON "addon_itens" ("group_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_criado_em" ON "orders" ("criado_em");--> statement-breakpoint
CREATE INDEX "idx_orders_moto" ON "orders" ("motoqueiro_id");--> statement-breakpoint
CREATE INDEX "idx_produtos_categoria" ON "produtos" ("categoria");--> statement-breakpoint
ALTER TABLE "addon_itens" ADD CONSTRAINT "addon_itens_group_id_addon_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "addon_groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_motoqueiro_id_motoqueiros_id_fkey" FOREIGN KEY ("motoqueiro_id") REFERENCES "motoqueiros"("id") ON DELETE SET NULL;