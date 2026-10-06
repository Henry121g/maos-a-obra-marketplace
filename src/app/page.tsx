import Link from "next/link";
import { SERVICE_SELECT, ServiceCard, type ServiceSummary } from "@/components/service-card";
import { buttonStyles } from "@/components/button-styles";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: recent }] = await Promise.all([
    supabase.from("categories").select("slug, name").order("name"),
    supabase.from("services").select(SERVICE_SELECT).eq("status", "ativo").order("created_at", { ascending: false }).limit(6),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4 py-6">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight">Encontre quem resolve — e combine tudo num só lugar.</h1>
        <p className="max-w-xl text-lg text-muted">
          Peça orçamentos, compare propostas, converse com o prestador e avalie depois que o serviço for concluído.
        </p>
        <form action="/servicos" role="search" className="flex w-full max-w-xl gap-2">
          <label htmlFor="busca-home" className="sr-only">O que você precisa?</label>
          <input id="busca-home" name="q" placeholder="Ex.: pintura, aulas de violão, eletricista" className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-3" />
          <button type="submit" className={buttonStyles.primary}>Buscar</button>
        </form>
      </section>

      <section aria-labelledby="categorias">
        <h2 id="categorias" className="mb-3 text-xl font-semibold">Categorias</h2>
        <ul className="flex flex-wrap gap-2">
          {(categories ?? []).map((c) => (
            <li key={c.slug}>
              <Link href={`/servicos?categoria=${c.slug}`} className="inline-block rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-brand">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recent && recent.length > 0 && (
        <section aria-labelledby="recentes">
          <h2 id="recentes" className="mb-3 text-xl font-semibold">Serviços recentes</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(recent as unknown as ServiceSummary[]).map((s) => <li key={s.id}><ServiceCard s={s} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
