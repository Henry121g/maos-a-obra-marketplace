import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModerationActions } from "./actions-form";

export const metadata: Metadata = { title: "Moderação" };

const REASON: Record<string, string> = {
  fraude: "Fraude ou golpe",
  ofensivo: "Conteúdo ofensivo",
  spam: "Spam",
  informacao_falsa: "Informação falsa",
  outro: "Outro",
};
const TARGET: Record<string, string> = { servico: "Serviço", usuario: "Usuário", avaliacao: "Avaliação", conversa: "Conversa" };

export default async function ModerationPage() {
  const viewer = await requireViewer("/moderacao");
  if (viewer.role !== "moderador") redirect("/");
  const supabase = await createClient();
  const [{ data: reports }, { data: log }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, target_type, target_id, reason, details, created_at, reporter:profiles!reports_reporter_id_fkey(full_name)")
      .eq("status", "aberta")
      .order("created_at"),
    supabase.from("moderation_log").select("id, action, target_type, reason, created_at").order("id", { ascending: false }).limit(15),
  ]);

  const link = (type: string, id: string) =>
    type === "servico" ? `/servicos/${id}` : type === "conversa" ? `/solicitacoes/${id}` : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold">Moderação</h1>
        <p className="text-sm text-muted">
          Conversas denunciadas ficam legíveis para a moderação apenas enquanto a denúncia estiver aberta.
        </p>
      </header>
      <section aria-labelledby="abertas" className="flex flex-col gap-3">
        <h2 id="abertas" className="text-lg font-semibold">Denúncias abertas ({reports?.length ?? 0})</h2>
        {reports?.length ? (
          reports.map((r) => {
            const href = link(r.target_type, r.target_id);
            return (
              <article key={r.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
                <p>
                  <strong>{TARGET[r.target_type]}</strong> · {REASON[r.reason]} · por {(r.reporter as unknown as { full_name: string }).full_name} em{" "}
                  {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
                {r.details && <p className="rounded bg-background p-2">{r.details}</p>}
                {href ? <Link href={href} className="self-start underline">Ver item denunciado</Link> : <code className="text-xs text-muted">{r.target_id}</code>}
                <ModerationActions reportId={r.id} targetType={r.target_type} targetId={r.target_id} />
              </article>
            );
          })
        ) : (
          <EmptyState title="Nenhuma denúncia aberta." />
        )}
      </section>
      {log && log.length > 0 && (
        <section aria-labelledby="historico">
          <h2 id="historico" className="mb-2 text-lg font-semibold">Ações recentes</h2>
          <ul className="text-sm text-muted">
            {log.map((l) => (
              <li key={l.id}>{new Date(l.created_at).toLocaleDateString("pt-BR")} — {l.action} ({TARGET[l.target_type]}): {l.reason}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
