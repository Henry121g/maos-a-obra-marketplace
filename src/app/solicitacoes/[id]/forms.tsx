"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { sendMessage, transition, type ActionState } from "../actions";

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  return null;
}

/** Botão simples para uma transição (com motivo opcional/obrigatório). */
export function TransitionButton(props: {
  requestId: string;
  action: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  proposalId?: string;
  reason?: "opcional" | "obrigatorio";
  hint?: string;
}) {
  const [state, action] = useActionState(transition, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={props.requestId} />
      <input type="hidden" name="action" value={props.action} />
      {props.proposalId && <input type="hidden" name="proposalId" value={props.proposalId} />}
      {props.reason && (
        <Field
          label={props.reason === "obrigatorio" ? "Motivo" : "Motivo (opcional)"}
          name="reason"
          id={`motivo-${props.action}`}
          required={props.reason === "obrigatorio"}
          maxLength={300}
        />
      )}
      {props.hint && <p className="text-xs text-muted">{props.hint}</p>}
      <Feedback state={state} />
      <SubmitButton variant={props.variant ?? "primary"} pendingLabel="Enviando…" className="self-start">{props.label}</SubmitButton>
    </form>
  );
}

export function ProposalForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(transition, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="action" value="enviar_proposta" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor (R$)" name="price" inputMode="decimal" placeholder="1.200,00" required />
        <Field label="Prazo estimado (dias)" name="days" type="number" min={1} max={365} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Detalhes da proposta
        <textarea name="message" required minLength={5} maxLength={2000} rows={3} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" />
      </label>
      <p className="text-xs text-muted">Uma nova proposta substitui a anterior, se ela ainda não foi aceita. Sem pagamento pela plataforma.</p>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Enviando…" className="self-start">Enviar proposta</SubmitButton>
    </form>
  );
}

export function ReviewForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(transition, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="action" value="avaliar" />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Nota</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-sm">
              <input type="radio" name="rating" value={n} required /> {n} ★
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Comentário (opcional)
        <textarea name="comment" maxLength={1000} rows={3} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" />
      </label>
      <Feedback state={state} />
      <SubmitButton pendingLabel="Enviando…" className="self-start">Publicar avaliação</SubmitButton>
    </form>
  );
}

export function MessageForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(sendMessage, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="nova-mensagem" className="sr-only">Nova mensagem</label>
      <textarea id="nova-mensagem" name="body" required maxLength={2000} rows={2} placeholder="Escreva uma mensagem…" className="rounded-lg border border-border bg-background px-3 py-2" />
      <Feedback state={state} />
      <SubmitButton variant="secondary" pendingLabel="Enviando…" className="self-start">Enviar mensagem</SubmitButton>
    </form>
  );
}
