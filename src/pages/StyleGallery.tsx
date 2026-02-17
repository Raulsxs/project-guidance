import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Palette, Star, StarOff, Search, Loader2, Layers, Square, Smartphone } from "lucide-react";

interface SystemTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content_format: string;
  preview_colors: string[];
  template_set: any;
}

interface BrandTemplate {
  id: string;
  name: string;
  description: string | null;
  brand_id: string;
  brand_name?: string;
  category_name: string | null;
}

interface FavoriteRecord {
  id: string;
  template_set_type: string;
  template_set_id: string;
}

const FORMAT_ICONS: Record<string, any> = { post: Square, story: Smartphone, carousel: Layers };
const CATEGORY_LABELS: Record<string, string> = {
  noticia: "Notícia", frase: "Frase", dica: "Dica Rápida", educativo: "Educativo", curiosidade: "Curiosidade", geral: "Geral",
};

export default function StyleGallery() {
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[]>([]);
  const [brandTemplates, setBrandTemplates] = useState<BrandTemplate[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id || null;
      setUserId(uid);

      const [sysRes, brandRes, favRes] = await Promise.all([
        supabase.from("system_template_sets").select("*").eq("is_active", true).order("sort_order"),
        uid ? supabase.from("brand_template_sets").select("id, name, description, brand_id, category_name").eq("status", "active").order("name") : Promise.resolve({ data: [] }),
        uid ? supabase.from("favorite_template_sets").select("*").eq("user_id", uid) : Promise.resolve({ data: [] }),
      ]);

      setSystemTemplates((sysRes.data || []) as unknown as SystemTemplate[]);
      setBrandTemplates((brandRes.data || []) as unknown as BrandTemplate[]);
      setFavorites((favRes.data || []) as unknown as FavoriteRecord[]);
      setLoading(false);
    };
    load();
  }, []);

  const isFavorite = (type: string, id: string) => favorites.some(f => f.template_set_type === type && f.template_set_id === id);

  const toggleFavorite = async (type: "system" | "brand", templateId: string) => {
    if (!userId) return;
    const existing = favorites.find(f => f.template_set_type === type && f.template_set_id === templateId);
    if (existing) {
      await supabase.from("favorite_template_sets").delete().eq("id", existing.id);
      setFavorites(prev => prev.filter(f => f.id !== existing.id));
      toast.success("Removido dos favoritos");
    } else {
      const { data } = await supabase.from("favorite_template_sets").insert({ user_id: userId, template_set_type: type, template_set_id: templateId } as any).select().single();
      if (data) setFavorites(prev => [...prev, data as unknown as FavoriteRecord]);
      toast.success("Adicionado aos favoritos!");
    }
  };

  const filterBySearch = (name: string, desc: string | null) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || (desc || "").toLowerCase().includes(q);
  };

  const favoriteSystemIds = new Set(favorites.filter(f => f.template_set_type === "system").map(f => f.template_set_id));
  const favoriteBrandIds = new Set(favorites.filter(f => f.template_set_type === "brand").map(f => f.template_set_id));

  const favSystemTemplates = systemTemplates.filter(t => favoriteSystemIds.has(t.id));
  const favBrandTemplates = brandTemplates.filter(t => favoriteBrandIds.has(t.id));
  const hasFavorites = favSystemTemplates.length > 0 || favBrandTemplates.length > 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  const renderTemplateCard = (t: { id: string; name: string; description: string | null; preview_colors?: string[]; content_format?: string; category?: string; category_name?: string | null }, type: "system" | "brand") => {
    const FormatIcon = FORMAT_ICONS[t.content_format || "post"] || Square;
    const colors = (t as any).preview_colors || [];
    const cat = (t as any).category || t.category_name || "geral";
    const fav = isFavorite(type, t.id);

    return (
      <Card key={t.id} className="group border-border/50 hover:border-primary/30 hover:shadow-md transition-all">
        <CardContent className="p-4 space-y-3">
          {/* Color preview bar */}
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            {colors.length > 0 ? colors.map((c: string, i: number) => (
              <div key={i} className="flex-1 rounded-full" style={{ backgroundColor: c }} />
            )) : (
              <div className="flex-1 rounded-full bg-muted" />
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{t.name}</p>
              {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => toggleFavorite(type, t.id)}>
              {fav ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <StarOff className="w-4 h-4 text-muted-foreground" />}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] gap-1">
              <FormatIcon className="w-3 h-3" />
              {t.content_format || "post"}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {CATEGORY_LABELS[cat] || cat}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Palette className="w-7 h-7 text-primary" />
              Galeria de Estilos
            </h1>
            <p className="text-muted-foreground mt-1">Explore e favorite estilos visuais para usar na geração de conteúdo</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estilos..." className="pl-9" />
          </div>
        </div>

        <Tabs defaultValue={hasFavorites ? "favorites" : "system"}>
          <TabsList>
            {hasFavorites && <TabsTrigger value="favorites" className="gap-1"><Star className="w-4 h-4" /> Favoritos</TabsTrigger>}
            <TabsTrigger value="brand" className="gap-1"><Palette className="w-4 h-4" /> Da sua marca</TabsTrigger>
            <TabsTrigger value="system" className="gap-1"><Layers className="w-4 h-4" /> Estilos prontos</TabsTrigger>
          </TabsList>

          {hasFavorites && (
            <TabsContent value="favorites">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                {favBrandTemplates.filter(t => filterBySearch(t.name, t.description)).map(t => renderTemplateCard(t, "brand"))}
                {favSystemTemplates.filter(t => filterBySearch(t.name, t.description)).map(t => renderTemplateCard(t, "system"))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="brand">
            {brandTemplates.length === 0 ? (
              <Card className="mt-4">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Palette className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">Nenhum estilo da marca</h3>
                  <p className="text-muted-foreground text-sm text-center max-w-sm">Vá ao Brand Kit e gere estilos a partir dos seus exemplos visuais</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                {brandTemplates.filter(t => filterBySearch(t.name, t.description)).map(t => renderTemplateCard(t, "brand"))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="system">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
              {systemTemplates.filter(t => filterBySearch(t.name, t.description)).map(t => renderTemplateCard(t, "system"))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
