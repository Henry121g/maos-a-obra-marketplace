import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SERVICE_SELECT, ServiceCard, type ServiceSummary } from "@/components/service-card";
import { Alert, buttonStyles } from "@/components/ui";
import { fold, parseSearch } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Buscar serviços" };

const PAGE_SIZE = 12;

export default async function SearchPage({ searchParams }: PageProps<"/servicos">) {
  const f = parseSearch(await searchParams);
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, slug, name").order("name");
  const category = categories?.find((c) => c.slug === f.categoria);

  let query = supabase.from("services").select(SERVICE_SELECT, { count: "exact" }).eq("status", "ativo");
  if (f.q) query = query.textSearch("search", fold(f.q), { config: "portuguese", type: "websearch" });
  if (category) query = query.eq("category_id", category.id);
  if (f.cidade) query = query.ilike("city", `%${f.cidade.replace(/[%_\\,()*"]/g, " ")}%`);
  if (f.remoto) query = query.eq("remote", true);
  if (f.precoMax != null) query = query.lte("price_from_cents", f.precoMax);
  if (f.notaMin != null) query = query.gte("rating_avg", f.notaMin);
  query =
    f.ordem === "preco"
      ? query.order("price_from_cents", { ascending: true, nullsFirst: false })
      : f.ordem === "nota"
        ? query.order("rating_avg", { ascending: false, nullsFirst: false })
        : query.order("created_at", { ascending: false });
  const { data, count, error } = await query.range((f.pagina - 1) * PAGE_SIZE, f.pagina * PAGE_SIZE - 1);
  const input = "min-h-11 rounded-lg border border-border bg-surface px-3 py-2";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Buscar serviços</h1>
      <form role="search" action="/servicos" className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium lg:col-span-2">
          O que você precisa?
          <input name="q" defaultValue={f.q} placeholder="Ex.: pintura de apartamento" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Categoria
          <select name="categoria" defaultValue={f.categoria} className={input}>
            <option value="">Todas</option>
            {(categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Cidade
          <input name="cidade" defaultValue={f.cidade} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Preço máximo (R$)
          <input name="preco_max" inputMode="decimal" defaultValue={f.precoMax != null ? String(f.precoMax / 100) : ""} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nota mínima
          <select name="nota_min" defaultValue={f.notaMin ?? ""} className={input}>
            <option value="">Qualquer</option>
            {[4, 3, 2].map((n) => <option key={n} value={n}>{n}+ estrelas</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ordenar por
          <select name="ordem" defaultValue={f.ordem} className={input}>
            <option value="recentes">Mais recentes</option>
            <option value="preco">Menor preço</option>
            <option value="nota">Melhor avaliados</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="remoto" value="1" defaultChecked={f.remoto} className="size-5" /> Apenas remotos
        </label>
        <button type="submit" className={`${buttonStyles.primary} sm:col-span-2 lg:col-span-4 lg:justify-self-start`}>Aplicar filtros</button>
      </form>

      {error && <Alert kind="error">Não foi possível buscar agora. Tente novamente.</Alert>}
      <p className="text-sm text-muted" aria-live="polite">{count ?? 0} serviço(s) encontrado(s).</p>

      {data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data as unknown as ServiceSummary[]).map((s) => <li key={s.id}><ServiceCard s={s} /></li>)}
        </ul>
      ) : (
        !error && <EmptyState title="Nenhum serviço com esses filtros.">Tente remover algum filtro ou buscar outro termo.</EmptyState>
      )}

      <Pagination
        basePath="/servicos"
        params={{
          q: f.q,
          categoria: f.categoria,
          cidade: f.cidade,
          remoto: f.remoto ? "1" : undefined,
          preco_max: f.precoMax != null ? String(f.precoMax / 100) : undefined,
          nota_min: f.notaMin ? String(f.notaMin) : undefined,
          ordem: f.ordem === "recentes" ? undefined : f.ordem,
        }}
        page={f.pagina}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  );
}
