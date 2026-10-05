// Recria os dados de demonstração: contas públicas (contratante e prestador), outros prestadores
// fictícios, serviços e contratações em vários estados — percorrendo as MESMAS funções do app.
// Uso: pnpm seed:demo   (também roda diariamente no GitHub Actions)
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!url || !service || !anon) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admin = createClient(url, service, { db: { schema: "marketplace" }, auth: { persistSession: false } });
const PUBLIC_PASSWORD = "demo12345";

const USERS = [
  { email: "contratante@market.demo.test", name: "Carla Contratante", provider: false, public: true, city: "Campinas" },
  { email: "prestador@market.demo.test", name: "Paulo Prestador", provider: true, public: true, city: "Campinas", bio: "Pintor e reparos gerais há 10 anos (perfil fictício)." },
  { email: "lia@market.demo.test", name: "Lia Professora", provider: true, public: false, city: "São Paulo", bio: "Aulas de violão e teoria musical (perfil fictício)." },
  { email: "rui@market.demo.test", name: "Rui Eletricista", provider: true, public: false, city: "Sorocaba", bio: "Instalações residenciais (perfil fictício)." },
  { email: "nina@market.demo.test", name: "Nina Designer", provider: true, public: false, city: null, bio: "Identidade visual para pequenos negócios (perfil fictício)." },
];

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
type Client = typeof admin;
const clients = new Map<string, Client>();
const ids = new Map<string, string>();
for (const u of USERS) {
  const old = list.users.find((x) => x.email === u.email);
  if (old) await admin.auth.admin.deleteUser(old.id); // cascata limpa serviços, solicitações e avaliações
  const password = u.public ? PUBLIC_PASSWORD : randomUUID() + randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { app: "marketplace", full_name: u.name, is_provider: u.provider },
  });
  if (error) throw error;
  ids.set(u.email, data.user.id);
  await admin.from("profiles").update({ city: u.city, bio: u.bio ?? null }).eq("id", data.user.id);
  const c = createClient(url, anon, { db: { schema: "marketplace" }, auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: u.email, password });
  clients.set(u.email, c);
}

const { data: cats } = await admin.from("categories").select("id, slug");
const cat = (slug: string) => cats!.find((c) => c.slug === slug)!.id;
const SERVICES = [
  { by: "prestador@market.demo.test", c: "reformas", title: "Pintura de apartamentos e casas", desc: "Pintura interna e externa, massa corrida, textura e acabamento. Orçamento sem compromisso.", price: 80000, unit: "projeto", city: "Campinas", remote: false },
  { by: "prestador@market.demo.test", c: "reformas", title: "Pequenos reparos domésticos", desc: "Troca de torneiras, fixação de prateleiras, ajustes de portas e pequenos consertos.", price: 9000, unit: "visita", city: "Campinas", remote: false },
  { by: "lia@market.demo.test", c: "aulas", title: "Aulas de violão para iniciantes", desc: "Aulas individuais online ou presenciais, do primeiro acorde às primeiras músicas.", price: 7000, unit: "hora", city: "São Paulo", remote: true },
  { by: "rui@market.demo.test", c: "reformas", title: "Instalação elétrica residencial", desc: "Tomadas, disjuntores, chuveiros e revisão do quadro elétrico com segurança.", price: 15000, unit: "visita", city: "Sorocaba", remote: false },
  { by: "nina@market.demo.test", c: "design", title: "Logotipo e identidade visual", desc: "Criação de logotipo, paleta de cores e aplicações para redes sociais.", price: 120000, unit: "projeto", city: null, remote: true },
];
const serviceIds: string[] = [];
for (const s of SERVICES) {
  const c = clients.get(s.by)!;
  const { data, error } = await c
    .from("services")
    .insert({ provider_id: ids.get(s.by), category_id: cat(s.c), title: s.title, description: s.desc, price_from_cents: s.price, price_unit: s.unit, city: s.city, remote: s.remote })
    .select("id")
    .single();
  if (error) throw error;
  serviceIds.push(data.id);
}

// Uma contratação concluída e avaliada, uma em andamento e uma aguardando proposta.
const carla = clients.get("contratante@market.demo.test")!;
const paulo = clients.get("prestador@market.demo.test")!;
async function rpc(c: Client, fn: string, args: Record<string, unknown>) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}
const r1 = await rpc(carla, "create_request", { p_service: serviceIds[0], p_description: "Pintar sala e dois quartos, paredes brancas.", p_desired_date: null });
const p1 = await rpc(paulo, "send_proposal", { p_request: r1, p_price_cents: 145000, p_message: "Inclui massa corrida e duas demãos. 4 dias de trabalho.", p_estimated_days: 4 });
await rpc(carla, "accept_proposal", { p_proposal: p1 });
await carla.from("messages").insert({ request_id: r1, sender_id: ids.get("contratante@market.demo.test"), body: "Pode começar na segunda?" });
await paulo.from("messages").insert({ request_id: r1, sender_id: ids.get("prestador@market.demo.test"), body: "Combinado, chego às 8h." });
await rpc(paulo, "mark_done", { p_request: r1 });
await rpc(carla, "confirm_done", { p_request: r1 });
await rpc(carla, "create_review", { p_request: r1, p_rating: 5, p_comment: "Pontual e caprichoso. (avaliação fictícia)" });

const r2 = await rpc(carla, "create_request", { p_service: serviceIds[1], p_description: "Trocar duas torneiras da cozinha e banheiro.", p_desired_date: null });
const p2 = await rpc(paulo, "send_proposal", { p_request: r2, p_price_cents: 18000, p_message: "Uma visita resolve as duas trocas.", p_estimated_days: 1 });
await rpc(carla, "accept_proposal", { p_proposal: p2 });

await rpc(carla, "create_request", { p_service: serviceIds[2], p_description: "Quero aprender violão do zero, duas aulas por semana.", p_desired_date: null });

console.log(`✓ ${USERS.length} contas, ${SERVICES.length} serviços e 3 solicitações (concluída, contratada, aberta).`);
console.log(`  Contas públicas: contratante@market.demo.test e prestador@market.demo.test (senha ${PUBLIC_PASSWORD}).`);
