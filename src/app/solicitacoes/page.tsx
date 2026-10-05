import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { requireViewer } from "@/lib/auth";
import { STATUS_LABEL, type RequestStatus } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solicitações" };

interface Row {
  id: string;
  status: RequestStatus;
  updated_at: string;
  client_id: string;
  services: { title: string } | null;
  client: { full_name: string } | null;
  provider: { full_name: string } | null;
}

function RequestList({ items, other }: { items: Row[]; other: "client" | "provider" }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/solicitacoes/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:bg-background">
            <span>
              <span className="font-semibold">{r.services?.title}</span>
              <span className="block text-muted">com {r[other]?.full_name} · atualizada em {new Date(r.updated_at).toLocaleDateString("pt-BR")}</span>
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs">{STATUS_LABEL[r.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function RequestsPage() {
  const viewer = await requireViewer("/solicitacoes");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id, status, updated_at, client_id, services(title), client:profiles!requests_client_id_fkey(full_name), provider:profiles!requests_provider_id_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];
  const asClient = rows.filter((r) => r.client_id === viewer.id);
  const asProvider = rows.filter((r) => r.client_id !== viewer.id);


  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Solicitações</h1>
      {error && <p role="alert" className="text-danger">Não foi possível carregar suas solicitações.</p>}
      <section aria-labelledby="contratei" className="flex flex-col gap-3">
        <h2 id="contratei" className="text-lg font-semibold">Que fiz (como contratante)</h2>
        <RequestList items={asClient} other="provider" />
        {asClient.length === 0 && (
          <EmptyState title="Você ainda não pediu orçamentos."><Link href="/servicos" className="underline">Buscar serviços</Link></EmptyState>
        )}
      </section>
      {(viewer.isProvider || asProvider.length > 0) && (
        <section aria-labelledby="recebi" className="flex flex-col gap-3">
          <h2 id="recebi" className="text-lg font-semibold">Que recebi (como prestador)</h2>
          <RequestList items={asProvider} other="client" />
          {asProvider.length === 0 && <EmptyState title="Nenhuma solicitação recebida ainda." />}
        </section>
      )}
    </div>
  );
}
