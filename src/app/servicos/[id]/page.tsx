import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ReportButton } from "@/components/report-button";
import { getViewer } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { PRICE_UNIT_LABEL } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Serviço" };

export default async function ServicePage({ params }: PageProps<"/servicos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [viewer, supabase] = await Promise.all([getViewer(), createClient()]);
  const { data: s } = await supabase
    .from("services")
    .select("id, provider_id, title, description, city, remote, price_from_cents, price_unit, rating_avg, rating_count, status, categories(name, slug), profiles!services_provider_id_fkey(id, full_name, bio, city, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(full_name)")
    .eq("service_id", id)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const provider = s.profiles as unknown as { id: string; full_name: string; bio: string | null; city: string | null; created_at: string };
  const category = s.categories as unknown as { name: string; slug: string };
  const own = viewer?.id === s.provider_id;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <article className="flex flex-col gap-6">
        <nav aria-label="Trilha" className="text-sm">
          <Link href="/servicos" className="underline">Serviços</Link> /{" "}
          <Link href={`/servicos?categoria=${category.slug}`} className="underline">{category.name}</Link>
        </nav>
        <header>
          <h1 className="text-3xl font-bold">{s.title}</h1>
          <p className="mt-1 text-muted">
            {s.remote ? "Atende remotamente" : ""}{s.remote && s.city ? " · " : ""}{s.city ?? ""} ·{" "}
            {s.rating_count ? `★ ${Number(s.rating_avg).toFixed(1)} (${s.rating_count} avaliações)` : "Ainda sem avaliações"}
          </p>
          {s.status !== "ativo" && <p className="mt-2 text-sm text-danger">Este serviço está {s.status} e não aparece na busca.</p>}
        </header>
        <p className="whitespace-pre-wrap">{s.description}</p>

        <section aria-labelledby="avaliacoes" className="flex flex-col gap-3">
          <h2 id="avaliacoes" className="text-lg font-semibold">Avaliações de contratações concluídas</h2>
          {reviews?.length ? (
            <ul className="flex flex-col gap-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span aria-label={`Nota ${r.rating} de 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>{" "}
                      <span className="text-muted">— {(r.profiles as unknown as { full_name: string }).full_name}, {new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                    </span>
                    {viewer && <ReportButton targetType="avaliacao" targetId={r.id} />}
                  </p>
                  {r.comment && <p className="mt-1">{r.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma avaliação ainda." />
          )}
        </section>
      </article>

      <aside className="flex h-fit flex-col gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Preço de referência</p>
          <p className="text-2xl font-bold">
            {s.price_from_cents != null ? formatMoney(Number(s.price_from_cents)) : "Sob consulta"}
            {s.price_from_cents != null && <span className="text-sm font-normal text-muted"> {PRICE_UNIT_LABEL[s.price_unit]}</span>}
          </p>
          <p className="mt-1 text-xs text-muted">O valor final vem na proposta. Sem pagamento pela plataforma.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          {own ? (
            <p className="text-sm">Este é o seu serviço. <Link href="/meus-servicos" className="underline">Gerenciar</Link></p>
          ) : viewer ? (
            viewer.suspended ? (
              <p className="text-sm text-danger">Sua conta está suspensa e não pode solicitar orçamentos.</p>
            ) : (
              <RequestForm serviceId={s.id} />
            )
          ) : (
            <p className="text-sm">
              <Link href={`/entrar?proximo=/servicos/${s.id}`} className="font-semibold text-brand underline">Entre</Link> para pedir um orçamento.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <p className="font-semibold">{provider.full_name}</p>
          {provider.city && <p className="text-muted">{provider.city}</p>}
          {provider.bio && <p className="mt-2">{provider.bio}</p>}
          <p className="mt-2 text-xs text-muted">Na plataforma desde {new Date(provider.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
        {viewer && !own && (
          <div className="flex gap-4">
            <ReportButton targetType="servico" targetId={s.id} />
            <ReportButton targetType="usuario" targetId={provider.id} />
          </div>
        )}
      </aside>
    </div>
  );
}
