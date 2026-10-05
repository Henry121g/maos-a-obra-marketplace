"use server";

import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export interface ReportState {
  error?: string;
  success?: string;
}

export async function createReport(_: ReportState, formData: FormData): Promise<ReportState> {
  const viewer = await requireViewer("/servicos");
  const parsed = z
    .object({
      targetType: z.enum(["servico", "usuario", "avaliacao", "conversa"]),
      targetId: z.uuid(),
      reason: z.enum(["fraude", "ofensivo", "spam", "informacao_falsa", "outro"], { message: "Escolha o motivo." }),
      details: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      targetType: formData.get("targetType"),
      targetId: formData.get("targetId"),
      reason: formData.get("reason"),
      details: formData.get("details") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: viewer.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) return { error: friendlyDbError(error) };
  return { success: "Denúncia enviada. A moderação vai analisar." };
}
