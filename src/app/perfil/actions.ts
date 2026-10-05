"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(_: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const viewer = await requireViewer("/perfil");
  const p = z
    .object({
      fullName: z.string().trim().min(2, "Informe seu nome.").max(100),
      city: z.string().trim().max(80),
      bio: z.string().trim().max(500),
      isProvider: z.boolean(),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      city: formData.get("city") ?? "",
      bio: formData.get("bio") ?? "",
      isProvider: formData.get("isProvider") === "on",
    });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: p.data.fullName, city: p.data.city || null, bio: p.data.bio || null, is_provider: p.data.isProvider })
    .eq("id", viewer.id);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/", "layout");
  return { success: "Perfil salvo." };
}
