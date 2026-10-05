import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Alert, buttonStyles } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { centsToInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { setServiceStatus } from "./actions";
import { ServiceForm } from "./service-form";

export const metadata: Metadata = { title: "Meus serviços" };

export default async function MyServicesPage() {
  const viewer = await requireViewer("/meus-servicos");
  if (!viewer.isProvider) {
    return (
      <EmptyState title="Seu perfil ainda não é de prestador.">
        Ative em <Link href="/perfil" className="underline">Perfil</Link> para cadastrar serviços.
      </EmptyState>
    );
  }
  const supabase = await createClient();
  const [{ data: categories }, { data: services }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase
      .from("services")
      .select("id, category_id, title, description, price_from_cents, price_unit, city, remote, status, rating_avg, rating_count")
      .eq("provider_id", viewer.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Meus serviços</h1>
      {viewer.suspended && <Alert kind="error">Sua conta está suspensa: seus serviços não aparecem na busca e não podem ser editados.</Alert>}
      <section aria-labelledby="novo" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="novo" className="mb-3 font-semibold">Novo serviço</h2>
        <ServiceForm categories={categories ?? []} />
      </section>
      <section aria-labelledby="publicados" className="flex flex-col gap-3">
        <h2 id="publicados" className="text-lg font-semibold">Publicados</h2>
        {services?.length ? (
          services.map((s) => (
            <article key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <Link href={`/servicos/${s.id}`} className="font-semibold underline">{s.title}</Link>{" "}
                  <span className="text-sm text-muted">
                    · {s.status === "removido" ? "removido pela moderação" : s.status}
                    {s.rating_count ? ` · ★ ${Number(s.rating_avg).toFixed(1)} (${s.rating_count})` : ""}
                  </span>
                </p>
                {s.status !== "removido" && (
                  <form action={setServiceStatus}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="status" value={s.status === "ativo" ? "pausado" : "ativo"} />
                    <button className={buttonStyles.secondary}>{s.status === "ativo" ? "Pausar" : "Reativar"} <span className="sr-only">{s.title}</span></button>
                  </form>
                )}
              </div>
              {s.status !== "removido" && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-brand">Editar <span className="sr-only">{s.title}</span></summary>
                  <div className="mt-3">
                    <ServiceForm
                      categories={categories ?? []}
                      initial={{
                        id: s.id,
                        category_id: s.category_id,
                        title: s.title,
                        description: s.description,
                        price: s.price_from_cents != null ? centsToInput(Number(s.price_from_cents)) : "",
                        price_unit: s.price_unit,
                        city: s.city,
                        remote: s.remote,
                      }}
                    />
                  </div>
                </details>
              )}
            </article>
          ))
        ) : (
          <EmptyState title="Você ainda não publicou serviços." />
        )}
      </section>
    </div>
  );
}
