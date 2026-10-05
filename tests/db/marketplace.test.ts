import type { Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let pedro: string, clara: string, bia: string, mod: string, outroApp: string;
let servico: string;

const as = <T,>(uid: string | null, sql: string, params: unknown[] = []) =>
  t.as(uid, async (tx: Transaction) => (await tx.query<T>(sql, params)).rows);
const one = async <T,>(uid: string | null, sql: string, params: unknown[] = []) => (await as<T>(uid, sql, params))[0];
const status = async (req: string) =>
  (await t.db.query<{ status: string }>(`select status from marketplace.requests where id = $1`, [req])).rows[0].status;

async function newService(provider: string, title = "Pintura de apartamentos", extra: Record<string, unknown> = {}) {
  const { rows } = await t.db.query<{ id: string }>(`select id from marketplace.categories where slug = 'reformas'`);
  const r = await one<{ id: string }>(
    provider,
    `insert into marketplace.services (provider_id, category_id, title, description, price_from_cents, price_unit, city, remote)
     values ($1, $2, $3, $4, $5, 'projeto', $6, $7) returning id`,
    [provider, rows[0].id, title, "Pintura interna com massa corrida e acabamento caprichado.", extra.price ?? 80000, extra.city ?? "Campinas", extra.remote ?? false],
  );
  return r.id;
}

/** Leva uma solicitação nova até o estado pedido. */
async function requestAt(target: "aberta" | "proposta_enviada" | "contratada" | "aguardando_confirmacao" | "concluida", client = clara) {
  const { id } = await one<{ id: string }>(client, `select marketplace.create_request($1, 'Preciso pintar dois quartos.', null) id`, [servico]);
  if (target === "aberta") return id;
  const { pid } = await one<{ pid: string }>(pedro, `select marketplace.send_proposal($1, 120000, 'Faço em 3 dias, material incluso.', 3) pid`, [id]);
  if (target === "proposta_enviada") return id;
  await as(client, `select marketplace.accept_proposal($1)`, [pid]);
  if (target === "contratada") return id;
  await as(pedro, `select marketplace.mark_done($1)`, [id]);
  if (target === "aguardando_confirmacao") return id;
  await as(client, `select marketplace.confirm_done($1)`, [id]);
  return id;
}

beforeAll(async () => {
  t = await createTestDb();
  pedro = await t.signUp("Pedro Pintor", { provider: true });
  clara = await t.signUp("Clara Contratante");
  bia = await t.signUp("Bia Curiosa");
  mod = await t.signUp("Moderadora");
  outroApp = await t.signUp("Usuário de outro app", { app: "erp" });
  await t.db.query(`update marketplace.profiles set role = 'moderador' where id = $1`, [mod]);
  servico = await newService(pedro);
});

describe("cadastro e serviços", () => {
  it("cadastro nunca vira moderador; conta de outro app não tem perfil", async () => {
    const { rows } = await t.db.query<{ role: string }>(`select role from marketplace.profiles where id = $1`, [clara]);
    expect(rows[0].role).toBe("usuario");
    expect((await t.db.query(`select 1 from marketplace.profiles where id = $1`, [outroApp])).rows).toHaveLength(0);
  });

  it("só quem é prestador cadastra serviço, e só em nome próprio", async () => {
    await expect(newService(clara)).rejects.toThrow(/row-level security/);
    const { rows } = await t.db.query<{ id: string }>(`select id from marketplace.categories limit 1`);
    await expect(
      as(pedro, `insert into marketplace.services (provider_id, category_id, title, description, city) values ($1, $2, 'Título falso', 'Descrição longa o suficiente para passar.', 'X')`, [clara, rows[0].id]),
    ).rejects.toThrow(/row-level security/);
  });

  it("usuário não se promove a moderador nem edita perfil alheio", async () => {
    await expect(as(clara, `update marketplace.profiles set role = 'moderador' where id = $1`, [clara])).rejects.toThrow(/permission denied/);
    expect(await as(clara, `update marketplace.profiles set bio = 'x' where id = $1 returning id`, [pedro])).toHaveLength(0);
  });
});

describe("busca", () => {
  beforeAll(async () => {
    await newService(pedro, "Aulas de violão para iniciantes", { city: null, remote: true, price: 6000 });
    await newService(pedro, "Instalação elétrica residencial", { city: "Sorocaba", price: 150000 });
  });

  const busca = (q: string) =>
    as<{ title: string }>(null, `select title from marketplace.services where search @@ websearch_to_tsquery('portuguese', marketplace.fold($1)) order by title`, [q]);

  it("visitante anônimo busca; plural e singular casam (apartamento ≈ apartamentos)", async () => {
    expect((await busca("apartamento")).map((x) => x.title)).toEqual(["Pintura de apartamentos"]);
  });

  it("acentos são ignorados nos dois sentidos (eletrica ≈ elétrica, violao ≈ violão)", async () => {
    expect((await busca("eletrica")).map((x) => x.title)).toEqual(["Instalação elétrica residencial"]);
    expect((await busca("VIOLÃO iniciante")).map((x) => x.title)).toEqual(["Aulas de violão para iniciantes"]);
  });

  it("termos que não existem não retornam nada", async () => {
    expect(await busca("encanador")).toEqual([]);
  });

  it("filtros combinados: remoto e preço máximo", async () => {
    const r = await as<{ title: string }>(null, `select title from marketplace.services where remote and price_from_cents <= 10000`);
    expect(r.map((x) => x.title)).toEqual(["Aulas de violão para iniciantes"]);
  });

  it("serviço pausado some da busca pública, mas o dono continua vendo", async () => {
    const id = await newService(pedro, "Serviço temporariamente pausado");
    await as(pedro, `update marketplace.services set status = 'pausado' where id = $1`, [id]);
    expect(await as(null, `select 1 from marketplace.services where id = $1`, [id])).toHaveLength(0);
    expect(await as(pedro, `select 1 from marketplace.services where id = $1`, [id])).toHaveLength(1);
  });
});

describe("estados da contratação", () => {
  it("fluxo completo: aberta → proposta → contratada → aguardando → concluída, com preço acordado", async () => {
    const id = await requestAt("aberta");
    expect(await status(id)).toBe("aberta");
    const { pid } = await one<{ pid: string }>(pedro, `select marketplace.send_proposal($1, 99990, 'Proposta detalhada', 2) pid`, [id]);
    expect(await status(id)).toBe("proposta_enviada");
    await as(clara, `select marketplace.accept_proposal($1)`, [pid]);
    expect(await status(id)).toBe("contratada");
    await as(pedro, `select marketplace.mark_done($1)`, [id]);
    expect(await status(id)).toBe("aguardando_confirmacao");
    await as(clara, `select marketplace.confirm_done($1)`, [id]);
    const { rows } = await t.db.query<{ status: string; agreed: number }>(`select status, agreed_price_cents::int agreed from marketplace.requests where id = $1`, [id]);
    expect(rows[0]).toEqual({ status: "concluida", agreed: 99990 });
  });

  it("nova proposta substitui a anterior; a antiga não pode mais ser aceita", async () => {
    const id = await requestAt("aberta");
    const { p1 } = await one<{ p1: string }>(pedro, `select marketplace.send_proposal($1, 100000, 'Primeira proposta', 3) p1`, [id]);
    const { p2 } = await one<{ p2: string }>(pedro, `select marketplace.send_proposal($1, 90000, 'Proposta revisada', 3) p2`, [id]);
    await expect(as(clara, `select marketplace.accept_proposal($1)`, [p1])).rejects.toThrow(/PROPOSTA_INVALIDA/);
    await as(clara, `select marketplace.accept_proposal($1)`, [p2]);
    expect(await status(id)).toBe("contratada");
  });

  it("transições inválidas são recusadas", async () => {
    const aberta = await requestAt("aberta");
    await expect(as(pedro, `select marketplace.mark_done($1)`, [aberta])).rejects.toThrow(/TRANSICAO_INVALIDA/);
    await expect(as(clara, `select marketplace.confirm_done($1)`, [aberta])).rejects.toThrow(/TRANSICAO_INVALIDA/);
    const contratada = await requestAt("contratada");
    await expect(as(pedro, `select marketplace.send_proposal($1, 1, 'Tarde demais', 1)`, [contratada])).rejects.toThrow(/TRANSICAO_INVALIDA/);
    const concluida = await requestAt("concluida");
    await expect(as(clara, `select marketplace.cancel_request($1, 'quero cancelar')`, [concluida])).rejects.toThrow(/TRANSICAO_INVALIDA/);
  });

  it("cada ação só pelo papel certo; terceiros nem enxergam a solicitação", async () => {
    const id = await requestAt("proposta_enviada");
    await expect(as(clara, `select marketplace.send_proposal($1, 1, 'Proposta do cliente?', 1)`, [id])).rejects.toThrow(/ACAO_NAO_PERMITIDA/);
    await expect(as(pedro, `select marketplace.decline_request($1)`, [id])).resolves.toBeDefined();
    const outra = await requestAt("aberta");
    await expect(as(bia, `select marketplace.cancel_request($1)`, [outra])).rejects.toThrow(/SOLICITACAO_INEXISTENTE/);
    expect(await as(bia, `select 1 from marketplace.requests where id = $1`, [outra])).toHaveLength(0);
  });

  it("não se contrata o próprio serviço; cancelar depois de contratada exige motivo", async () => {
    await expect(as(pedro, `select marketplace.create_request($1, 'Quero contratar a mim mesmo', null)`, [servico])).rejects.toThrow(/PROPRIO_SERVICO/);
    const id = await requestAt("contratada");
    await expect(as(pedro, `select marketplace.cancel_request($1, '')`, [id])).rejects.toThrow(/MOTIVO_OBRIGATORIO/);
    await as(pedro, `select marketplace.cancel_request($1, 'Imprevisto de saúde')`, [id]);
    expect(await status(id)).toBe("cancelada");
  });

  it("solicitações e propostas não são editáveis diretamente", async () => {
    const id = await requestAt("aberta");
    await expect(as(clara, `update marketplace.requests set status = 'concluida' where id = $1`, [id])).rejects.toThrow(/permission denied/);
    await expect(as(pedro, `insert into marketplace.proposals (request_id, provider_id, price_cents, message) values ($1, $2, 1, 'forjada')`, [id, pedro])).rejects.toThrow(/permission denied/);
  });
});

describe("mensagens restritas aos participantes", () => {
  let req: string;
  beforeAll(async () => {
    req = await requestAt("proposta_enviada");
    await as(clara, `insert into marketplace.messages (request_id, sender_id, body) values ($1, $2, 'Pode ser no sábado?')`, [req, clara]);
    await as(pedro, `insert into marketplace.messages (request_id, sender_id, body) values ($1, $2, 'Pode sim.')`, [req, pedro]);
  });

  it("os dois participantes leem a conversa", async () => {
    expect(await as(clara, `select body from marketplace.messages where request_id = $1`, [req])).toHaveLength(2);
    expect(await as(pedro, `select body from marketplace.messages where request_id = $1`, [req])).toHaveLength(2);
  });

  it("terceiro não lê nem escreve; ninguém envia em nome de outro", async () => {
    expect(await as(bia, `select 1 from marketplace.messages where request_id = $1`, [req])).toHaveLength(0);
    await expect(as(bia, `insert into marketplace.messages (request_id, sender_id, body) values ($1, $2, 'intrusa')`, [req, bia])).rejects.toThrow(/row-level security/);
    await expect(as(clara, `insert into marketplace.messages (request_id, sender_id, body) values ($1, $2, 'falso')`, [req, pedro])).rejects.toThrow(/row-level security/);
  });

  it("moderadora só lê a conversa enquanto houver denúncia aberta sobre ela", async () => {
    expect(await as(mod, `select 1 from marketplace.messages where request_id = $1`, [req])).toHaveLength(0);
    const { id: rep } = await one<{ id: string }>(clara, `insert into marketplace.reports (reporter_id, target_type, target_id, reason, details) values ($1, 'conversa', $2, 'ofensivo', 'teste') returning id`, [clara, req]);
    expect(await as(mod, `select 1 from marketplace.messages where request_id = $1`, [req])).toHaveLength(2);
    await as(mod, `select marketplace.resolve_report($1, 'descartada', 'Sem violação')`, [rep]);
    expect(await as(mod, `select 1 from marketplace.messages where request_id = $1`, [req])).toHaveLength(0);
  });

  it("só participantes denunciam uma conversa", async () => {
    await expect(
      as(bia, `insert into marketplace.reports (reporter_id, target_type, target_id, reason) values ($1, 'conversa', $2, 'spam')`, [bia, req]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("avaliações", () => {
  it("recusadas antes da conclusão (inclusive aguardando confirmação)", async () => {
    for (const st of ["aberta", "contratada", "aguardando_confirmacao"] as const) {
      const id = await requestAt(st);
      await expect(as(clara, `select marketplace.create_review($1, 5, 'Ótimo')`, [id])).rejects.toThrow(/AVALIACAO_SO_APOS_CONCLUSAO/);
    }
  });

  it("só o contratante avalia, uma única vez, e a média do serviço é atualizada", async () => {
    const id = await requestAt("concluida");
    await expect(as(pedro, `select marketplace.create_review($1, 5, 'Autoavaliação')`, [id])).rejects.toThrow(/ACAO_NAO_PERMITIDA/);
    await expect(as(bia, `select marketplace.create_review($1, 1, 'Nem contratei')`, [id])).rejects.toThrow(/SOLICITACAO_INEXISTENTE/);
    await as(clara, `select marketplace.create_review($1, 4, 'Bom trabalho')`, [id]);
    await expect(as(clara, `select marketplace.create_review($1, 5, 'De novo')`, [id])).rejects.toThrow(/JA_AVALIADO/);
    const id2 = await requestAt("concluida");
    await as(clara, `select marketplace.create_review($1, 2, null)`, [id2]);
    const { rows } = await t.db.query<{ avg: string; n: number }>(`select rating_avg::text avg, rating_count n from marketplace.services where id = $1`, [servico]);
    expect(rows[0]).toEqual({ avg: "3.00", n: 2 });
  });

  it("avaliação direta por insert é bloqueada", async () => {
    await expect(
      as(clara, `insert into marketplace.reviews (request_id, service_id, reviewer_id, provider_id, rating) select id, service_id, client_id, provider_id, 5 from marketplace.requests limit 1`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("moderação", () => {
  it("só moderadores moderam; ação exige motivo e fica registrada", async () => {
    await expect(as(clara, `select marketplace.moderate('servico', $1, 'remover', 'spam')`, [servico])).rejects.toThrow(/SOMENTE_MODERADORES/);
    await expect(as(mod, `select marketplace.moderate('servico', $1, 'remover', '')`, [servico])).rejects.toThrow(/MOTIVO_OBRIGATORIO/);
    const extra = await newService(pedro, "Serviço com informação falsa");
    await as(mod, `select marketplace.moderate('servico', $1, 'remover', 'Informação falsa')`, [extra]);
    expect(await as(null, `select 1 from marketplace.services where id = $1`, [extra])).toHaveLength(0);
    // O dono não consegue "desremover".
    expect(await as(pedro, `update marketplace.services set status = 'ativo' where id = $1 returning id`, [extra])).toHaveLength(0);
    expect(await as(mod, `select action from marketplace.moderation_log where target_id = $1`, [extra])).toEqual([{ action: "remover" }]);
  });

  it("ocultar avaliação tira da média e da listagem pública", async () => {
    const { rows } = await t.db.query<{ id: string }>(`select id from marketplace.reviews where rating = 2`);
    await as(mod, `select marketplace.moderate('avaliacao', $1, 'ocultar', 'Conteúdo ofensivo')`, [rows[0].id]);
    expect(await as(null, `select 1 from marketplace.reviews where id = $1`, [rows[0].id])).toHaveLength(0);
    const s = await t.db.query<{ avg: string; n: number }>(`select rating_avg::text avg, rating_count n from marketplace.services where id = $1`, [servico]);
    expect(s.rows[0]).toEqual({ avg: "4.00", n: 1 });
  });

  it("usuário suspenso não cria solicitações nem envia mensagens, e seus serviços somem da busca", async () => {
    const req = await requestAt("aberta");
    await as(mod, `select marketplace.moderate('usuario', $1, 'suspender', 'Fraude comprovada')`, [pedro]);
    expect(await as(null, `select 1 from marketplace.services where provider_id = $1`, [pedro])).toHaveLength(0);
    await expect(as(pedro, `select marketplace.send_proposal($1, 1, 'Ainda aqui?', 1)`, [req])).rejects.toThrow(/USUARIO_SUSPENSO/);
    await expect(as(pedro, `insert into marketplace.messages (request_id, sender_id, body) values ($1, $2, 'oi')`, [req, pedro])).rejects.toThrow(/row-level security/);
    await expect(as(clara, `select marketplace.create_request($1, 'Serviço de suspenso', null)`, [servico])).rejects.toThrow(/SERVICO_INDISPONIVEL/);
    await as(mod, `select marketplace.moderate('usuario', $1, 'reativar', 'Revisão concluída')`, [pedro]);
  });

  it("denunciante vê só as próprias denúncias; moderação vê todas e resolve uma vez", async () => {
    const { id } = await one<{ id: string }>(bia, `insert into marketplace.reports (reporter_id, target_type, target_id, reason) values ($1, 'servico', $2, 'spam') returning id`, [bia, servico]);
    expect(await as(clara, `select 1 from marketplace.reports where id = $1`, [id])).toHaveLength(0);
    expect(await as(bia, `select 1 from marketplace.reports where id = $1`, [id])).toHaveLength(1);
    await as(mod, `select marketplace.resolve_report($1, 'resolvida', 'Serviço revisado')`, [id]);
    await expect(as(mod, `select marketplace.resolve_report($1, 'descartada', 'de novo')`, [id])).rejects.toThrow(/DENUNCIA_INEXISTENTE/);
  });
});
