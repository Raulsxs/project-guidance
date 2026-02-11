import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useBrands, useDeleteBrand } from "@/hooks/useStudio";
import { VISUAL_TONES } from "@/types/studio";
import { Plus, Palette, Trash2, Edit, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Brands() {
  const navigate = useNavigate();
  const { data: brands, isLoading, refetch } = useBrands();
  const deleteBrand = useDeleteBrand();
  const [analyzingBrandId, setAnalyzingBrandId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta marca? Todos os projetos associados serão excluídos.")) {
      await deleteBrand.mutateAsync(id);
    }
  };

  const handleAnalyzeStyle = async (brandId: string) => {
    setAnalyzingBrandId(brandId);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-brand-examples", {
        body: { brandId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Style Guide gerado com sucesso!", {
        description: `Preset: ${data.styleGuide?.style_preset || "detectado"}`,
      });
      refetch();
    } catch (err: any) {
      toast.error("Erro ao analisar estilo: " + (err.message || "Tente novamente"));
    } finally {
      setAnalyzingBrandId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Brand Kit</h1>
            <p className="text-muted-foreground">Gerencie suas marcas e identidades visuais</p>
          </div>
          <Button onClick={() => navigate("/brands/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Marca
          </Button>
        </div>

        {/* Brands List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : brands && brands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((brand) => (
              <Card key={brand.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/brands/${brand.id}/edit`)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Palette className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{brand.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {VISUAL_TONES.find(t => t.value === brand.visual_tone)?.label || brand.visual_tone}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAnalyzeStyle(brand.id)}
                        disabled={analyzingBrandId === brand.id}
                        title="Analisar estilo dos exemplos"
                      >
                        {analyzingBrandId === brand.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-primary" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/brands/${brand.id}/edit`)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(brand.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {(brand.palette as string[] || []).slice(0, 5).map((color, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div
                          className="w-6 h-6 rounded-full border border-border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[10px] font-mono text-muted-foreground">{color}</span>
                      </div>
                    ))}
                  </div>
                  {brand.do_rules && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">✓ {brand.do_rules}</p>
                  )}
                  {brand.dont_rules && (
                    <p className="text-xs text-muted-foreground line-clamp-2">✗ {brand.dont_rules}</p>
                  )}
                  {(brand as any).style_guide && (
                    <Badge className="mt-2 text-[10px]" variant="secondary">
                      ✨ Style Guide: {(brand as any).style_guide?.style_preset || "ativo"}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Palette className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma marca ainda</h3>
              <p className="text-muted-foreground mb-4">
                Crie sua primeira marca para definir identidade visual
              </p>
              <Button onClick={() => navigate("/brands/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Marca
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
