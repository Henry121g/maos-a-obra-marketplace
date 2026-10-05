"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { saveProfile } from "./actions";

export function ProfileForm({ initial }: { initial: { fullName: string; bio: string; city: string; isProvider: boolean } }) {
  const [state, action] = useActionState(saveProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Nome" name="fullName" defaultValue={initial.fullName} required maxLength={100} />
      <Field label="Cidade" name="city" defaultValue={initial.city} maxLength={80} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Sobre você (aparece nos seus serviços)
        <textarea name="bio" defaultValue={initial.bio} maxLength={500} rows={4} className="rounded-lg border border-border bg-surface px-3 py-2 font-normal" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isProvider" defaultChecked={initial.isProvider} className="size-5" /> Quero oferecer serviços (perfil de prestador)
      </label>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.success && <Alert kind="success">{state.success}</Alert>}
      <SubmitButton pendingLabel="Salvando…" className="self-start">Salvar perfil</SubmitButton>
    </form>
  );
}
