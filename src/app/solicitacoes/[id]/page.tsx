import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportButton } from "@/components/report-button";
import { Alert } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { availableActions, STATUS_LABEL, TIMELINE, timelineIndex, type RequestStatus } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";
import { MessageForm, ProposalForm, ReviewForm, TransitionButton } from "./forms";

export const metadata: Metadata = { title: "Solicitação" };

export default async function RequestPage({ params, searchParams }: PageProps<"/solicitacoes/[id]">) {
  const viewer = await requireViewer("/solicitacoes");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("requests")
    .select("id, service_id, client_id, provider_id, description, desired_date, status, agreed_price_cents, status_reason, created_at, services(id, title), client:profiles!requests_client_id_fkey(full_name), provider:profiles!requests_provider_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound(); // RLS: quem não participa recebe "não encontrado"
  const [{ data: proposals }, { data: messages }, { data: review }] = await Promise.all([
    supabase.from("proposals").select("id, price_cents, estimated_days, message, status, created_at").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("messages").select("id, sender_id, body, created_at").eq("request_id", id).order("created_at"),
    supabase.from("reviews").select("id, rating, comment").eq("request_id", id).maybeSingle(),
  ]);

  const status = r.status as RequestStatus;
  const role = viewer.id === r.client_id ? "contratante" : viewer.id === r.provider_id ? "prestador" : null;
  const actions = role ? availableActions(status, role, Boolean(review)) : [];
  const pending = proposals?.find((p) => p.status === "enviada");
  const names: Record<string, string> = {
    [r.client_id]: (r.client as unknown as { full_name: string }).full_name,
    [r.provider_id]: (r.provider as unknown as { full_name: string }).full_name,
  };
  const service = r.services as unknown as { id: string; title: string };
  const step = timelineIndex(status);
  const ended = status === "cancelada" || status === "recusada";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-6">
        <Link href="/solicitacoes" className="text-sm underline">← Solicitações</Link>
        <header>
          <h1 className="text-2xl font-bold">{service.title}</h1>
          <p className="text-sm text-muted">
            Contratante: {names[r.client_id]} · Prestador: {names[r.provider_id]} · você é o <strong>{role}</strong>
          </p>
        </header>
        {sp.nova && <Alert kind="success">Solicitação enviada! O prestador vai responder com uma proposta.</Alert>}

        <ol aria-label="Andamento da solicitação" className="flex flex-wrap gap-2 text-xs">
          {TIMELINE.map((s, i) => (
            <li
              key={s}
              aria-current={s === status ? "step" : undefined}
              className={`rounded-full border px-3 py-1 ${!ended && i <= step ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted"}`}
            >
              {i + 1}. {STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
        {ended && (
          <Alert kind="error">
            {STATUS_LABEL[status]}
            {r.status_reason ? ` — motivo: ${r.status_reason}` : ""}
          </Alert>
        )}

        <section className="rounded-xl border border-border bg-surface p-4 text-sm">
          <h2 className="mb-1 font-semibold">Pedido</h2>
          <p className="whitespace-pre-wrap">{r.description}</p>
          {r.desired_date && <p className="mt-2 text-muted">Data desejada: {r.desired_date.split("-").reverse().join("/")}</p>}
          {r.agreed_price_cents != null && (
            <p className="mt-2">
              Valor acordado: <strong>{formatMoney(Number(r.agreed_price_cents))}</strong>{" "}
              <span className="text-muted">(pagamento combinado diretamente — não processado pela plataforma)</span>
            </p>
          )}
        </section>

        <section aria-labelledby="propostas" className="flex flex-col gap-3">
          <h2 id="propostas" className="text-lg font-semibold">Propostas</h2>
          {proposals?.length ? (
            <ul className="flex flex-col gap-2">
              {proposals.map((p) => (
                <li key={p.id} className={`rounded-xl border p-4 text-sm ${p.status === "enviada" ? "border-brand" : "border-border opacity-80"}`}>
                  <p className="flex flex-wrap justify-between gap-2">
                    <strong>{formatMoney(Number(p.price_cents))}</strong>
                    <span className="text-muted">
                      {p.estimated_days ? `${p.estimated_days} dias · ` : ""}
                      {{ enviada: "Aguardando resposta", aceita: "Aceita", recusada: "Recusada", substituida: "Substituída" }[p.status as string]}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{p.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhuma proposta ainda.</p>
          )}
        </section>

        {review && (
          <section className="rounded-xl border border-border bg-surface p-4 text-sm">
            <h2 className="mb-1 font-semibold">Avaliação</h2>
            <p>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} {review.comment}</p>
          </section>
        )}
      </div>

      <aside className="flex h-fit flex-col gap-4">
        {actions.length > 0 && (
          <section aria-labelledby="acoes" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <h2 id="acoes" className="font-semibold">O que você pode fazer agora</h2>
            {actions.includes("aceitar") && pending && (
              <TransitionButton requestId={id} action="aceitar" proposalId={pending.id} label={`Aceitar proposta de ${formatMoney(Number(pending.price_cents))}`} />
            )}
            {actions.includes("enviar_proposta") && <ProposalForm requestId={id} />}
            {actions.includes("marcar_feito") && (
              <TransitionButton requestId={id} action="marcar_feito" label="Marcar serviço como realizado" hint="O contratante precisará confirmar a conclusão." />
            )}
            {actions.includes("confirmar") && (
              <TransitionButton requestId={id} action="confirmar" label="Confirmar que o serviço foi concluído" hint="Depois disso você poderá avaliar." />
            )}
            {actions.includes("avaliar") && <ReviewForm requestId={id} />}
            {actions.includes("recusar") && <TransitionButton requestId={id} action="recusar" label="Recusar solicitação" variant="danger" reason="opcional" />}
            {actions.includes("cancelar") && (
              <TransitionButton
                requestId={id}
                action="cancelar"
                label="Cancelar solicitação"
                variant="danger"
                reason={status === "contratada" || status === "aguardando_confirmacao" ? "obrigatorio" : "opcional"}
              />
            )}
          </section>
        )}

        <section aria-labelledby="conversa" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="conversa" className="font-semibold">Conversa</h2>
            {role && <ReportButton targetType="conversa" targetId={id} />}
          </div>
          <p className="text-xs text-muted">Visível apenas para você e {role === "contratante" ? names[r.provider_id] : names[r.client_id]}.</p>
          {messages?.length ? (
            <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {messages.map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-lg p-2 text-sm ${m.sender_id === viewer.id ? "self-end bg-brand text-brand-foreground" : "self-start bg-background"}`}>
                  <span className="block text-xs opacity-80">{m.sender_id === viewer.id ? "Você" : names[m.sender_id] ?? "Moderação"} · {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  <span className="whitespace-pre-wrap">{m.body}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Nenhuma mensagem ainda.</p>
          )}
          {role && !viewer.suspended && <MessageForm requestId={id} />}
        </section>
      </aside>
    </div>
  );
}
