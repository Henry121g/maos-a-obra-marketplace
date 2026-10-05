"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer("/servicos");
  const p = z
    .object({
      serviceId: z.uuid(),
      description: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres.").max(2000),
      desiredDate: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
    })
    .safeParse({ serviceId: formData.get("serviceId"), description: formData.get("description"), desiredDate: formData.get("desiredDate") ?? "" });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_request", {
    p_service: p.data.serviceId,
    p_description: p.data.description,
    p_desired_date: p.data.desiredDate,
  });
  if (error) return { error: friendlyDbError(error) };
  redirect(`/solicitacoes/${data}?nova=1`);
}

const id = z.uuid();

/** Executa uma transição de estado (validada pelas funções do banco). */
export async function transition(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer("/solicitacoes");
  const action = String(formData.get("action"));
  const requestId = id.safeParse(formData.get("requestId"));
  if (!requestId.success) return { error: "Solicitação inválida." };
  const supabase = await createClient();
  let result;

  switch (action) {
    case "enviar_proposta": {
      const p = z
        .object({
          price: z.string().transform((v, ctx) => {
            const c = parseMoneyToCents(v);
            if (c === null) {
              ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.200,00." });
              return z.NEVER;
            }
            return c;
          }),
          days: z.union([z.coerce.number().int().min(1).max(365), z.literal("")]).transform((v) => (v === "" ? null : v)),
          message: z.string().trim().min(5, "Explique a proposta (mín. 5 caracteres).").max(2000),
        })
        .safeParse({ price: formData.get("price"), days: formData.get("days") ?? "", message: formData.get("message") });
      if (!p.success) return { error: p.error.issues[0]?.message };
      result = await supabase.rpc("send_proposal", { p_request: requestId.data, p_price_cents: p.data.price, p_message: p.data.message, p_estimated_days: p.data.days });
      break;
    }
    case "aceitar": {
      const proposal = id.safeParse(formData.get("proposalId"));
      if (!proposal.success) return { error: "Proposta inválida." };
      result = await supabase.rpc("accept_proposal", { p_proposal: proposal.data });
      break;
    }
    case "recusar":
      result = await supabase.rpc("decline_request", { p_request: requestId.data, p_reason: String(formData.get("reason") ?? "") });
      break;
    case "cancelar":
      result = await supabase.rpc("cancel_request", { p_request: requestId.data, p_reason: String(formData.get("reason") ?? "") });
      break;
    case "marcar_feito":
      result = await supabase.rpc("mark_done", { p_request: requestId.data });
      break;
    case "confirmar":
      result = await supabase.rpc("confirm_done", { p_request: requestId.data });
      break;
    case "avaliar": {
      const p = z
        .object({ rating: z.coerce.number().int().min(1, "Escolha uma nota.").max(5), comment: z.string().trim().max(1000).optional() })
        .safeParse({ rating: formData.get("rating"), comment: formData.get("comment") || undefined });
      if (!p.success) return { error: p.error.issues[0]?.message };
      result = await supabase.rpc("create_review", { p_request: requestId.data, p_rating: p.data.rating, p_comment: p.data.comment ?? null });
      break;
    }
    default:
      return { error: "Ação desconhecida." };
  }
  if (result.error) return { error: friendlyDbError(result.error) };
  revalidatePath(`/solicitacoes/${requestId.data}`);
  revalidatePath("/solicitacoes");
  return { success: "Feito!" };
}

export async function sendMessage(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer("/solicitacoes");
  const p = z
    .object({ requestId: z.uuid(), body: z.string().trim().min(1, "Escreva uma mensagem.").max(2000) })
    .safeParse({ requestId: formData.get("requestId"), body: formData.get("body") });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ request_id: p.data.requestId, sender_id: viewer.id, body: p.data.body });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath(`/solicitacoes/${p.data.requestId}`);
  return { success: "Mensagem enviada." };
}
