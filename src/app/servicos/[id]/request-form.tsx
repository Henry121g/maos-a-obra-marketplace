"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { createRequest } from "@/app/solicitacoes/actions";

export function RequestForm({ serviceId }: { serviceId: string }) {
  const [state, action] = useActionState(createRequest, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <h2 className="font-semibold">Pedir orçamento</h2>
      <input type="hidden" name="serviceId" value={serviceId} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descreva o que você precisa
        <textarea name="description" required minLength={10} maxLength={2000} rows={4} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" />
      </label>
      <Field label="Data desejada (opcional)" name="desiredDate" type="date" />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pendingLabel="Enviando…">Enviar solicitação</SubmitButton>
    </form>
  );
}
