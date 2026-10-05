"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { moderateAction } from "./actions";

const ACTIONS: Record<string, { value: string; label: string }[]> = {
  servico: [{ value: "remover", label: "Remover serviço" }],
  avaliacao: [{ value: "ocultar", label: "Ocultar avaliação" }],
  usuario: [{ value: "suspender", label: "Suspender usuário" }],
  conversa: [],
};

export function ModerationActions({ reportId, targetType, targetId }: { reportId: string; targetType: string; targetId: string }) {
  const [state, action] = useActionState(moderateAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <Field label="Motivo / resolução (obrigatório)" name="reason" id={`motivo-${reportId}`} required maxLength={300} />
      <div className="flex flex-wrap gap-2">
        {ACTIONS[targetType]?.map((a) => (
          <SubmitButton key={a.value} name="decision" value={a.value} variant="danger" pendingLabel="Aplicando…">{a.label} e resolver</SubmitButton>
        ))}
        <SubmitButton name="decision" value="descartar" variant="secondary" pendingLabel="Salvando…">Descartar denúncia</SubmitButton>
      </div>
      {state.error && <Alert kind="error">{state.error}</Alert>}
    </form>
  );
}
