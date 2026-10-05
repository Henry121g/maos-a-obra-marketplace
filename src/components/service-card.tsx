import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { PRICE_UNIT_LABEL } from "@/lib/market";

export interface ServiceSummary {
  id: string;
  title: string;
  city: string | null;
  remote: boolean;
  price_from_cents: number | null;
  price_unit: string;
  rating_avg: number | null;
  rating_count: number;
  categories: { name: string } | null;
  profiles: { full_name: string } | null;
}

export function ServiceCard({ s }: { s: ServiceSummary }) {
  return (
    <Link href={`/servicos/${s.id}`} className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 hover:border-brand">
      <span className="text-xs text-muted">{s.categories?.name}</span>
      <span className="font-semibold">{s.title}</span>
      <span className="text-sm text-muted">
        {s.profiles?.full_name} · {s.remote ? "Remoto" : ""}{s.remote && s.city ? " ou " : ""}{s.city ?? ""}
      </span>
      <span className="mt-auto flex items-center justify-between pt-2 text-sm">
        <span>
          {s.price_from_cents != null ? (
            <>a partir de <strong>{formatMoney(Number(s.price_from_cents))}</strong> {PRICE_UNIT_LABEL[s.price_unit]}</>
          ) : (
            "Preço sob consulta"
          )}
        </span>
        <span aria-label={s.rating_count ? `Nota ${Number(s.rating_avg).toFixed(1)} de 5 em ${s.rating_count} avaliações` : "Sem avaliações"}>
          {s.rating_count ? `★ ${Number(s.rating_avg).toFixed(1)} (${s.rating_count})` : "Novo"}
        </span>
      </span>
    </Link>
  );
}

export const SERVICE_SELECT =
  "id, title, city, remote, price_from_cents, price_unit, rating_avg, rating_count, created_at, categories(name, slug), profiles!services_provider_id_fkey(full_name)";
