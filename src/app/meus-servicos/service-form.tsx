"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { saveService } from "./actions";

export function ServiceForm(props: {
  categories: { id: string; name: string }[];
  initial?: { id: string; category_id: string; title: string; description: string; price: string; price_unit: string; city: string | null; remote: boolean };
}) {
  const [state, action] = useActionState(saveService, {});
  const p = props.initial;
  const key = p?.id ?? "novo";
  const select = "min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base";
  return (
    <form action={action} className="flex flex-col gap-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" name="title" id={`titulo-${key}`} defaultValue={p?.title} required minLength={5} maxLength={100} />
        <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor={`categoria-${key}`}>
          Categoria
          <select id={`categoria-${key}`} name="categoryId" defaultValue={p?.category_id ?? ""} required className={select}>
            <option value="" disabled>Escolha…</option>
            {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor={`descricao-${key}`}>
        Descrição
        <textarea id={`descricao-${key}`} name="description" defaultValue={p?.description} required minLength={20} maxLength={3000} rows={4} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Preço a partir de (R$, opcional)" name="price" id={`preco-${key}`} inputMode="decimal" defaultValue={p?.price} />
        <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor={`unidade-${key}`}>
          Unidade
          <select id={`unidade-${key}`} name="unit" defaultValue={p?.price_unit ?? "projeto"} className={select}>
            <option value="projeto">por projeto</option>
            <option value="hora">por hora</option>
            <option value="visita">por visita</option>
            <option value="mes">por mês</option>
          </select>
        </label>
        <Field label="Cidade" name="city" id={`cidade-${key}`} defaultValue={p?.city ?? ""} maxLength={80} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="remote" defaultChecked={p?.remote} className="size-5" /> Atende remotamente
      </label>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.success && <Alert kind="success">{state.success}</Alert>}
      <SubmitButton pendingLabel="Salvando…" className="self-start">{p ? "Salvar alterações" : "Publicar serviço"}</SubmitButton>
    </form>
  );
}
