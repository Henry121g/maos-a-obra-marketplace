"use client";

import { useActionState, useRef } from "react";
import { createReport } from "@/app/denuncias/actions";
import { Alert, buttonStyles, SubmitButton } from "./ui";

const TARGET_LABEL = { servico: "este serviço", usuario: "este usuário", avaliacao: "esta avaliação", conversa: "esta conversa" };

export function ReportButton({ targetType, targetId }: { targetType: keyof typeof TARGET_LABEL; targetId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(createReport, {});
  const titleId = `denunciar-${targetType}-${targetId}`;
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="text-sm text-muted underline hover:text-danger">
        Denunciar <span className="sr-only">{TARGET_LABEL[targetType]}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border bg-surface p-5 text-foreground backdrop:bg-black/50"
      >
        <form action={action} className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-semibold">Denunciar {TARGET_LABEL[targetType]}</h2>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          {state.success ? (
            <Alert kind="success">{state.success}</Alert>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Motivo
                <select name="reason" required defaultValue="" className="min-h-11 rounded-lg border border-border bg-background px-3">
                  <option value="" disabled>Escolha…</option>
                  <option value="fraude">Fraude ou golpe</option>
                  <option value="ofensivo">Conteúdo ofensivo</option>
                  <option value="spam">Spam</option>
                  <option value="informacao_falsa">Informação falsa</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Detalhes (opcional)
                <textarea name="details" maxLength={1000} rows={3} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" />
              </label>
              {state.error && <Alert kind="error">{state.error}</Alert>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.close()}>Fechar</button>
            {!state.success && <SubmitButton variant="danger" pendingLabel="Enviando…">Enviar denúncia</SubmitButton>}
          </div>
        </form>
      </dialog>
    </>
  );
}
