import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Save, Loader2 } from "lucide-react";
import ProfileAvatarSection from "@/components/profile/ProfileAvatarSection";
import ProfilePersonalInfo from "@/components/profile/ProfilePersonalInfo";
import ProfilePreferences from "@/components/profile/ProfilePreferences";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  instagram_handle: string | null;
  avatar_url: string | null;
  native_language: string;
  secondary_languages: string[];
  preferred_tone: string;
  preferred_audience: string;
  interest_areas: string[];
  rss_sources: string[];
}

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    instagram_handle: "",
    native_language: "pt-BR",
    secondary_languages: [] as string[],
    preferred_tone: "profissional",
    preferred_audience: "gestores",
    interest_areas: [] as string[],
    rss_sources: [] as string[],
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { navigate("/auth"); return; }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.session.user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const row = data as unknown as ProfileRow;
        setProfile(row);
        setFormData({
          full_name: row.full_name || "",
          company_name: row.company_name || "",
          instagram_handle: row.instagram_handle || "",
          native_language: row.native_language || "pt-BR",
          secondary_languages: row.secondary_languages || [],
          preferred_tone: row.preferred_tone || "profissional",
          preferred_audience: row.preferred_audience || "gestores",
          interest_areas: row.interest_areas || [],
          rss_sources: row.rss_sources || [],
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Por favor, selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 2MB"); return; }

    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${session.session.user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("content-images").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("content-images").getPublicUrl(fileName);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", session.session.user.id);
      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : null);
      toast.success("Avatar atualizado!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao fazer upload do avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const { error } = await supabase.from("profiles").upsert({
        user_id: session.session.user.id,
        full_name: formData.full_name,
        company_name: formData.company_name,
        instagram_handle: formData.instagram_handle,
        native_language: formData.native_language,
        secondary_languages: formData.secondary_languages,
        preferred_tone: formData.preferred_tone,
        preferred_audience: formData.preferred_audience,
        interest_areas: formData.interest_areas,
        rss_sources: formData.rss_sources,
      } as any);

      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <User className="w-7 h-7 text-primary" />
            Meu Perfil
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais e preferências</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ProfileAvatarSection
            avatarUrl={profile?.avatar_url}
            fullName={formData.full_name}
            companyName={formData.company_name}
            uploading={uploading}
            onAvatarUpload={handleAvatarUpload}
          />

          <ProfilePersonalInfo
            fullName={formData.full_name}
            companyName={formData.company_name}
            instagramHandle={formData.instagram_handle}
            onChange={handleFieldChange}
          />

          <ProfilePreferences
            nativeLanguage={formData.native_language}
            secondaryLanguages={formData.secondary_languages}
            preferredTone={formData.preferred_tone}
            preferredAudience={formData.preferred_audience}
            interestAreas={formData.interest_areas}
            rssSources={formData.rss_sources}
            onChange={handleFieldChange}
          />

          <div className="flex justify-end">
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
