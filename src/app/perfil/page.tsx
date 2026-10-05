import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const viewer = await requireViewer("/perfil");
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name, bio, city, is_provider, suspension_reason").eq("id", viewer.id).single();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Perfil</h1>
      {viewer.suspended && (
        <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">
          Conta suspensa pela moderação{p?.suspension_reason ? `: ${p.suspension_reason}` : ""}.
        </p>
      )}
      <ProfileForm initial={{ fullName: p?.full_name ?? "", bio: p?.bio ?? "", city: p?.city ?? "", isProvider: Boolean(p?.is_provider) }} />
    </div>
  );
}
