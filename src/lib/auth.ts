import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  id: string;
  email: string | null;
  fullName: string;
  isProvider: boolean;
  role: "usuario" | "moderador";
  suspended: boolean;
}

/** Usuário autenticado (validado via getClaims) com perfil neste app. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, is_provider, role, suspended_at")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!p) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: p.full_name,
    isProvider: p.is_provider,
    role: p.role,
    suspended: Boolean(p.suspended_at),
  };
});

export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?proximo=${encodeURIComponent(next)}`);
  return viewer;
}
