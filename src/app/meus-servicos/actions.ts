"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface ServiceState {
  error?: string;
  success?: string;
}

const schema = z
  .object({
    id: z.uuid().optional(),
    categoryId: z.uuid("Escolha a categoria."),
    title: z.string().trim().min(5, "Título com pelo menos 5 caracteres.").max(100),
    description: z.string().trim().min(20, "Descrição com pelo menos 20 caracteres.").max(3000),
    price: z.string().transform((v, ctx) => {
      if (!v.trim()) return null;
      const c = parseMoneyToCents(v);
      if (c === null) {
        ctx.addIssue({ code: "custom", message: "Preço inválido. Use o formato 150,00 ou deixe em branco." });
        return z.NEVER;
      }
      return c;
    }),
    unit: z.enum(["hora", "projeto", "visita", "mes"]),
    city: z.string().trim().max(80).transform((v) => v || null),
    remote: z.boolean(),
  })
  .refine((d) => d.remote || d.city, { message: "Informe a cidade ou marque “atende remotamente”." });

export async function saveService(_: ServiceState, formData: FormData): Promise<ServiceState> {
  const viewer = await requireViewer("/meus-servicos");
  const p = schema.safeParse({
    id: formData.get("id") || undefined,
    categoryId: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price") ?? "",
    unit: formData.get("unit"),
    city: formData.get("city") ?? "",
    remote: formData.get("remote") === "on",
  });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const d = p.data;
  const row = {
    category_id: d.categoryId,
    title: d.title,
    description: d.description,
    price_from_cents: d.price,
    price_unit: d.unit,
    city: d.city,
    remote: d.remote,
  };
  const supabase = await createClient();
  const { error } = d.id
    ? await supabase.from("services").update({ ...row, updated_at: new Date().toISOString() }).eq("id", d.id)
    : await supabase.from("services").insert({ ...row, provider_id: viewer.id });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/meus-servicos");
  return { success: d.id ? "Serviço atualizado." : "Serviço publicado." };
}

export async function setServiceStatus(formData: FormData) {
  await requireViewer("/meus-servicos");
  const p = z.object({ id: z.uuid(), status: z.enum(["ativo", "pausado"]) }).safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from("services").update({ status: p.data.status, updated_at: new Date().toISOString() }).eq("id", p.data.id);
  revalidatePath("/meus-servicos");
}
