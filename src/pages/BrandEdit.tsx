import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrands, useUpdateBrand } from "@/hooks/useStudio";
import { VISUAL_TONES } from "@/types/studio";
import { ArrowLeft, Plus, X, Save, Loader2 } from "lucide-react";
import BrandExamples from "@/components/studio/BrandExamples";
import TemplateSetsSection from "@/components/studio/TemplateSetsSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BrandEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: brands, isLoading, refetch } = useBrands();
  const updateBrand = useUpdateBrand();
  const [analyzingStyle, setAnalyzingStyle] = useState(false);

  const brand = brands?.find((b) => b.id === id);

  const [formData, setFormData] = useState({
    name: "",
    visual_tone: "clean",
    palette: ["#6366f1", "#ec4899", "#f59e0b"],
    fonts: { headings: "Inter", body: "Inter" },
    do_rules: "",
    dont_rules: "",
  });

  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name,
        visual_tone: brand.visual_tone || "clean",
        palette: (brand.palette as string[]) || ["#6366f1", "#ec4899", "#f59e0b"],
        fonts: (brand.fonts as { headings: string; body: string }) || { headings: "Inter", body: "Inter" },
        do_rules: brand.do_rules || "",
        dont_rules: brand.dont_rules || "",
      });
    }
  }, [brand]);

  const handleSave = async () => {
    if (!formData.name || !id) return;
    await updateBrand.mutateAsync({ id, ...formData });
    navigate("/brands");
  };

  const updatePaletteColor = (index: number, color: string) => {
    const newPalette = [...formData.palette];
    newPalette[index] = color;
    setFormData({ ...formData, palette: newPalette });
  };

  const addColor = () => {
    if (formData.palette.length < 6) {
      setFormData({ ...formData, palette: [...formData.palette, "#000000"] });
    }
  };

  const removeColor = (index: number) => {
    if (formData.palette.length > 1) {
      setFormData({ ...formData, palette: formData.palette.filter((_, i) => i !== index) });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Marca não encontrada.</p>
          <Button variant="link" onClick={() => navigate("/brands")}>Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/brands")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Editar Marca</h1>
              <p className="text-muted-foreground">{brand.name}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!formData.name || updateBrand.isPending}>
            {updateBrand.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="examples">Exemplos Visuais</TabsTrigger>
            <TabsTrigger value="templates">Estilos de Conteúdo</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Nome da Marca *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Minha Empresa"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tom Visual</Label>
                  <Select value={formData.visual_tone} onValueChange={(value) => setFormData({ ...formData, visual_tone: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISUAL_TONES.map((tone) => (
                        <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Paleta de Cores</Label>
                    {formData.palette.length < 6 && (
                      <Button variant="ghost" size="sm" onClick={addColor}><Plus className="w-4 h-4" /></Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {formData.palette.map((color, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        <input type="color" value={color} onChange={(e) => updatePaletteColor(index, e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border flex-shrink-0" />
                        <Input value={color} onChange={(e) => { const val = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(val) || val === "") updatePaletteColor(index, val); }} placeholder="#000000" className="font-mono text-sm w-28" maxLength={7} />
                        {formData.palette.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeColor(index)} className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8">
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fonte Títulos</Label>
                    <Input value={formData.fonts.headings} onChange={(e) => setFormData({ ...formData, fonts: { ...formData.fonts, headings: e.target.value } })} placeholder="Inter" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fonte Corpo</Label>
                    <Input value={formData.fonts.body} onChange={(e) => setFormData({ ...formData, fonts: { ...formData.fonts, body: e.target.value } })} placeholder="Inter" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Regras Positivas (O que fazer)</Label>
                  <Textarea value={formData.do_rules} onChange={(e) => setFormData({ ...formData, do_rules: e.target.value })} placeholder="Ex: Usar cores vibrantes, incluir elementos geométricos..." rows={3} />
                </div>

                <div className="space-y-2">
                  <Label>Regras Negativas (O que evitar)</Label>
                  <Textarea value={formData.dont_rules} onChange={(e) => setFormData({ ...formData, dont_rules: e.target.value })} placeholder="Ex: Evitar fundos muito escuros, não usar muitos elementos..." rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="examples">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <BrandExamples
                  brandId={brand.id}
                  brandName={brand.name}
                  onAnalyzeStyle={async () => {
                    setAnalyzingStyle(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("analyze-brand-examples", {
                        body: { brandId: brand.id },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success("Style Guide gerado!", {
                        description: `Preset: ${data.styleGuide?.style_preset || "detectado"} (v${data.version})`,
                      });
                      refetch();
                    } catch (err: any) {
                      toast.error("Erro ao analisar: " + (err.message || "Tente novamente"));
                    } finally {
                      setAnalyzingStyle(false);
                    }
                  }}
                  isAnalyzing={analyzingStyle}
                />
                {/* Style Guide Preview */}
                {(brand as any).style_guide && (
                  <div className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">Style Guide Ativo</h4>
                      <Badge variant="secondary" className="text-[10px]">
                        v{(brand as any).style_guide_version || 1} • {(brand as any).style_guide?.confidence || "—"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Preset: <strong>{(brand as any).style_guide?.style_preset}</strong>
                    </p>
                    <pre className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 max-h-48 overflow-auto">
                      {JSON.stringify((brand as any).style_guide, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardContent className="pt-6">
                <TemplateSetsSection
                  brandId={brand.id}
                  brandName={brand.name}
                  defaultTemplateSetId={(brand as any).default_template_set_id || null}
                  templateSetsDirty={(brand as any).template_sets_dirty || false}
                  templateSetsDirtyCount={(brand as any).template_sets_dirty_count || 0}
                  templateSetsStatus={(brand as any).template_sets_status || "idle"}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
