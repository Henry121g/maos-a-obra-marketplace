"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function moderateAction(_: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  await requireViewer("/moderacao");
  const p = z
    .object({
      reportId: z.uuid(),
      targetType: z.enum(["servico", "usuario", "avaliacao", "conversa"]),
      targetId: z.uuid(),
      decision: z.enum(["remover", "ocultar", "suspender", "descartar"]),
      reason: z.string().trim().min(3, "Informe o motivo.").max(300),
    })
    .safeParse({
      reportId: formData.get("reportId"),
      targetType: formData.get("targetType"),
      targetId: formData.get("targetId"),
      decision: formData.get("decision"),
      reason: formData.get("reason"),
    });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const d = p.data;
  const supabase = await createClient();
  if (d.decision !== "descartar") {
    const { error } = await supabase.rpc("moderate", { p_target_type: d.targetType, p_target: d.targetId, p_action: d.decision, p_reason: d.reason });
    if (error) return { error: friendlyDbError(error) };
  }
  const { error } = await supabase.rpc("resolve_report", {
    p_report: d.reportId,
    p_status: d.decision === "descartar" ? "descartada" : "resolvida",
    p_resolution: d.reason,
  });
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/moderacao");
  return {};
}
