import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SlideTemplateRenderer, { resolveTemplateForSlide } from "@/components/content/SlideTemplateRenderer";
import {
  Sparkles, Palette, Layers, Square, Smartphone, Save,
  ChevronLeft, ChevronRight, Plus, Trash2, Loader2,
  Newspaper, Quote, Lightbulb, GraduationCap, HelpCircle,
  Wand2, Copy, Hash,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

// ── Types ──

interface BrandOption {
  id: string;
  name: string;
  palette: string[];
  fonts: { headings: string; body: string } | null;
  visual_tone: string | null;
  logo_url: string | null;
  style_guide: any;
  default_template_set_id: string | null;
}

interface TemplateSetOption {
  id: string;
  name: string;
  description: string | null;
  template_set: any;
  category_name: string | null;
}

interface SlideData {
  headline: string;
  body: string;
  bullets?: string[];
  template?: string;
  role?: string;
  templateHint?: string;
  previewImage?: string;
  speakerNotes?: string;
  illustrationPrompt?: string;
  imagePrompt?: string;
}

// ── Constants ──

const FORMATS = [
  { id: "post", name: "Post", icon: Square, dims: { width: 1080, height: 1350 } },
  { id: "story", name: "Story", icon: Smartphone, dims: { width: 1080, height: 1920 } },
  { id: "carousel", name: "Carrossel", icon: Layers, dims: { width: 1080, height: 1350 } },
];

const STYLES = [
  { id: "news", name: "Notícia", icon: Newspaper },
  { id: "quote", name: "Frase", icon: Quote },
  { id: "tip", name: "Dica", icon: Lightbulb },
  { id: "educational", name: "Educativo", icon: GraduationCap },
  { id: "curiosity", name: "Curiosidade", icon: HelpCircle },
];

// Build initial slide array dynamically based on count + CTA toggle + template set
function buildSlideArray(
  format: string,
  count: number,
  includeCta: boolean,
  templateSet?: any,
): SlideData[] {
  if (format !== "carousel") {
    const tpl = format === "story" ? "story_cover" : resolveTemplateForSlide(templateSet, "cover");
    return [{ headline: "", body: "", template: tpl, templateHint: tpl, role: "cover" }];
  }

  const tbr = templateSet?.templates_by_role as Record<string, string> | undefined;

  // Build role sequence dynamically
  const roles: string[] = ["cover"];
  const contentSlots = includeCta ? count - 2 : count - 1;
  for (let i = 0; i < Math.max(0, contentSlots); i++) {
    if (i === 0) roles.push("context");
    else if (i === contentSlots - 1) roles.push("bullets");
    else roles.push("insight");
  }
  if (includeCta) roles.push("cta");

  return roles.map((role) => {
    // Use templates_by_role if available, otherwise resolve from layout_params
    const tpl = tbr?.[role] || resolveTemplateForSlide(templateSet, role);
    return {
      headline: role === "cta" ? "Gostou do conteúdo?" : "",
      body: role === "cta" ? "Curta ❤️ Comente 💬 Compartilhe 🔄 Salve 📌" : "",
      bullets: (role === "insight" || role === "bullets") ? [""] : undefined,
      role,
      template: tpl,
      templateHint: tpl,
    };
  });
}

// ── Component ──

export default function ManualStudioEditor() {
  const navigate = useNavigate();

  // Config state
  const [selectedBrand, setSelectedBrand] = useState<string>("free");
  const [selectedTemplateSet, setSelectedTemplateSet] = useState<string>("auto");
  const [selectedFormat, setSelectedFormat] = useState("carousel");
  const [selectedStyle, setSelectedStyle] = useState("news");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  // Carousel controls
  const [slideCountMode, setSlideCountMode] = useState<"auto" | "fixed">("auto");
  const [slideCountVal, setSlideCountVal] = useState(6);
  const [includeCta, setIncludeCta] = useState(true);

  // Data
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [templateSets, setTemplateSets] = useState<TemplateSetOption[]>([]);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [saving, setSaving] = useState(false);

  // AI generation
  const [generating, setGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [sourceSummary, setSourceSummary] = useState("");
  const [keyInsights, setKeyInsights] = useState<string[]>([]);

  // ── Load brands ──
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, palette, fonts, visual_tone, logo_url, style_guide, default_template_set_id")
        .order("name");
      if (data) setBrands(data as unknown as BrandOption[]);
    };
    load();
  }, []);

  // ── Load template sets when brand changes ──
  useEffect(() => {
    if (selectedBrand && selectedBrand !== "free") {
      const load = async () => {
        const { data } = await supabase
          .from("brand_template_sets")
          .select("id, name, description, template_set, category_name")
          .eq("brand_id", selectedBrand)
          .eq("status", "active")
          .order("created_at");
        setTemplateSets((data || []) as unknown as TemplateSetOption[]);
      };
      load();
    } else {
      setTemplateSets([]);
    }
    setSelectedTemplateSet("auto");
  }, [selectedBrand]);

  // ── Resolve brand snapshot for preview ──
  const currentBrand = brands.find(b => b.id === selectedBrand);
  const defaultTsId = currentBrand?.default_template_set_id || null;
  const defaultTsName = templateSets.find(ts => ts.id === defaultTsId)?.name || null;
  const resolvedTsId = selectedTemplateSet === "auto" ? defaultTsId : selectedTemplateSet;
  const resolvedTs = templateSets.find(ts => ts.id === resolvedTsId);

  // Resolved template set data for slide building
  const activeTemplateSetData = resolvedTs?.template_set || null;
  const pilarEditorial = resolvedTs?.category_name || resolvedTs?.name || null;

  // Effective slide count for "auto" mode
  const autoSlideCount = useMemo(() => {
    const range = activeTemplateSetData?.formats?.carousel?.slide_count_range as [number, number] | undefined;
    const min = range?.[0] || 4;
    const max = range?.[1] || 8;
    return Math.round((min + max) / 2);
  }, [activeTemplateSetData]);

  const effectiveSlideCount = slideCountMode === "fixed" ? slideCountVal : autoSlideCount;

  // ── Rebuild slides when format/count/CTA/template set changes ──
  useEffect(() => {
    setSlides(buildSlideArray(selectedFormat, effectiveSlideCount, includeCta, activeTemplateSetData));
    setCurrentSlide(0);
  }, [selectedFormat, effectiveSlideCount, includeCta, resolvedTsId]);

  const brandSnapshot = currentBrand ? {
    name: currentBrand.name,
    palette: currentBrand.palette || [],
    fonts: currentBrand.fonts || { headings: "Inter", body: "Inter" },
    visual_tone: currentBrand.visual_tone || "clean",
    logo_url: currentBrand.logo_url,
    style_guide: activeTemplateSetData || currentBrand.style_guide || null,
    visual_signature: activeTemplateSetData?.visual_signature || null,
    layout_params: activeTemplateSetData?.layout_params || null,
    templates_by_role: activeTemplateSetData?.templates_by_role || null,
    pilar_editorial: pilarEditorial,
    template_set_id: resolvedTsId,
  } : {
    name: "Modo Livre",
    palette: ["#667eea", "#764ba2", "#f093fb"],
    fonts: { headings: "Inter", body: "Inter" },
    visual_tone: "clean",
    logo_url: null,
    style_guide: null,
    visual_signature: null,
    layout_params: null,
    templates_by_role: null,
    pilar_editorial: null,
    template_set_id: null,
  };

  // ── Slide editing ──
  const updateSlide = (index: number, field: keyof SlideData, value: any) => {
    setSlides(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateBullet = (slideIdx: number, bulletIdx: number, value: string) => {
    setSlides(prev => {
      const next = [...prev];
      const bullets = [...(next[slideIdx].bullets || [])];
      bullets[bulletIdx] = value;
      next[slideIdx] = { ...next[slideIdx], bullets };
      return next;
    });
  };

  const addBullet = (slideIdx: number) => {
    setSlides(prev => {
      const next = [...prev];
      next[slideIdx] = { ...next[slideIdx], bullets: [...(next[slideIdx].bullets || []), ""] };
      return next;
    });
  };

  const removeBullet = (slideIdx: number, bulletIdx: number) => {
    setSlides(prev => {
      const next = [...prev];
      const bullets = [...(next[slideIdx].bullets || [])];
      bullets.splice(bulletIdx, 1);
      next[slideIdx] = { ...next[slideIdx], bullets };
      return next;
    });
  };

  // ── AI Generation ──
  const handleGenerateWithAI = async () => {
    if (!title.trim()) {
      toast.error("Defina um título antes de gerar com IA");
      return;
    }
    setGenerating(true);
    try {
      const brandId = selectedBrand === "free" ? null : selectedBrand;
      const effectiveMode = selectedBrand === "free" ? "free" : "brand_strict";

      // Build manual briefing from current slide content
      const currentSlideData = slides[currentSlide];
      const manualBriefing = {
        headline: currentSlideData?.headline || undefined,
        body: currentSlideData?.body || undefined,
        bullets: currentSlideData?.bullets?.filter(Boolean) || undefined,
        notes: notes || undefined,
      };

      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          trend: {
            title: title.trim(),
            description: notes || title.trim(),
            theme: selectedStyle === "news" ? "Saúde" : "Geral",
            keywords: [],
            fullContent: "",
          },
          contentType: selectedFormat,
          contentStyle: selectedStyle,
          brandId,
          visualMode: effectiveMode,
          templateSetId: resolvedTsId,
          slideCount: selectedFormat === "carousel" ? (slideCountMode === "auto" ? null : slideCountVal) : null,
          includeCta: selectedFormat === "carousel" ? includeCta : true,
          manualBriefing,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error("Erro ao gerar conteúdo");

      const content = data.content;

      // Fill slides from AI response, enforcing template set templates
      let newSlides: SlideData[] = [];
      if (content.slides && content.slides.length > 0) {
        const tbr = activeTemplateSetData?.templates_by_role as Record<string, string> | undefined;
        newSlides = content.slides.map((s: any) => {
          const role = s.role || "cover";
          // HARD LOCK: Use templates_by_role from template set first
          const tpl = tbr?.[role] || resolveTemplateForSlide(activeTemplateSetData, role);
          return {
            headline: s.headline || "",
            body: s.body || "",
            bullets: s.bullets || undefined,
            template: tpl,
            templateHint: tpl,
            role,
            previewImage: s.previewImage || undefined,
            speakerNotes: s.speakerNotes || "",
            illustrationPrompt: s.illustrationPrompt || "",
            imagePrompt: s.imagePrompt || "",
          };
        });

        // Enforce CTA slide
        if (selectedFormat === "carousel" && includeCta) {
          const lastSlide = newSlides[newSlides.length - 1];
          if (lastSlide?.role !== "cta") {
            const ctaTpl = tbr?.cta || resolveTemplateForSlide(activeTemplateSetData, "cta");
            newSlides.push({
              role: "cta",
              template: ctaTpl,
              templateHint: ctaTpl,
              headline: "Gostou do conteúdo?",
              body: "Curta ❤️ Comente 💬 Compartilhe 🔄 Salve 📌",
            });
          }
        }

        // Remove CTA if toggle is OFF
        if (selectedFormat === "carousel" && !includeCta) {
          newSlides = newSlides.filter(s => s.role !== "cta");
        }

        setSlides(newSlides);
        setCurrentSlide(0);
      }

      // Fill metadata
      if (content.caption) setCaption(content.caption);
      if (content.hashtags) setHashtags(content.hashtags);
      if (content.sourceSummary) setSourceSummary(content.sourceSummary);
      if (content.keyInsights) setKeyInsights(content.keyInsights);
      if (content.title) setTitle(content.title);

      toast.success("Texto gerado! Gerando imagens dos slides...");
      setGenerating(false);

      // ══════ STEP 2: Generate slide images ══════
      if (brandId && newSlides.length > 0) {
        setGeneratingImages(true);
        const contentId = `studio-${Date.now()}`;
        let completedCount = 0;
        setImageGenProgress(`Gerando imagens 0/${newSlides.length}...`);

        try {
          const batchSize = 2;
          const allResults: { index: number; data: any; error: any }[] = [];

          for (let batch = 0; batch < newSlides.length; batch += batchSize) {
            const batchSlides = newSlides.slice(batch, batch + batchSize);
            const batchPromises = batchSlides.map((s, batchIdx) => {
              const i = batch + batchIdx;
              return supabase.functions.invoke("generate-slide-images", {
                body: {
                  brandId,
                  slide: s,
                  slideIndex: i,
                  totalSlides: newSlides.length,
                  contentFormat: selectedFormat,
                  articleUrl: notes || undefined,
                  articleContent: "",
                  contentId,
                },
              }).then(result => {
                completedCount++;
                setImageGenProgress(`Gerando imagens ${completedCount}/${newSlides.length}...`);
                if (result.data?.imageUrl) {
                  setSlides(prev => prev.map((sl, idx) =>
                    idx === i ? { ...sl, previewImage: result.data.imageUrl } : sl
                  ));
                }
                return { index: i, data: result.data, error: result.error };
              });
            });

            const batchResults = await Promise.allSettled(batchPromises);
            for (const r of batchResults) {
              if (r.status === "fulfilled") allResults.push(r.value);
            }

            if (batch + batchSize < newSlides.length) {
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          const successCount = allResults.filter(r => r.data?.imageUrl).length;
          toast.success(`${successCount}/${newSlides.length} imagens geradas!`);
        } catch (imgErr: any) {
          console.error("Image generation error:", imgErr);
          toast.error("Erro ao gerar imagens: " + (imgErr.message || "Tente novamente"));
        } finally {
          setGeneratingImages(false);
          setImageGenProgress("");
        }
      } else {
        toast.success("Conteúdo gerado pela IA! Edite à vontade.");
      }
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error("Erro ao gerar: " + (err.message || "Tente novamente"));
      setGenerating(false);
    }
  };

  // ── Regenerate single slide image ──
  const handleRegenerateSlideImage = async (index: number) => {
    const brandId = selectedBrand === "free" ? null : selectedBrand;
    if (!brandId) {
      toast.error("Selecione uma marca para gerar imagens");
      return;
    }
    setGeneratingImages(true);
    setImageGenProgress(`Regenerando slide ${index + 1}...`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-slide-images", {
        body: {
          brandId,
          slide: slides[index],
          slideIndex: index,
          totalSlides: slides.length,
          contentFormat: selectedFormat,
          articleUrl: notes || undefined,
          contentId: `studio-regen-${Date.now()}`,
        },
      });

      if (error) throw error;
      if (data?.imageUrl) {
        setSlides(prev => prev.map((s, i) => ({
          ...s,
          previewImage: i === index ? data.imageUrl : s.previewImage,
        })));
        toast.success("Imagem regenerada!");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Tente novamente"));
    } finally {
      setGeneratingImages(false);
      setImageGenProgress("");
    }
  };

  // ── Save draft ──
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error("Defina um título para o conteúdo");
      return;
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Não autenticado");

      const brandId = selectedBrand === "free" ? null : selectedBrand;
      const { data, error } = await supabase
        .from("generated_contents")
        .insert({
          user_id: session.session.user.id,
          content_type: selectedFormat,
          title: title.trim(),
          caption: caption || "",
          hashtags: hashtags.length > 0 ? hashtags : [],
          slides: slides as any,
          status: "draft",
          brand_id: brandId,
          brand_snapshot: brandSnapshot as any,
          visual_mode: selectedBrand === "free" ? "free" : "brand_strict",
          source_summary: sourceSummary || null,
          key_insights: keyInsights.length > 0 ? keyInsights : null,
          template_set_id: resolvedTsId || null,
          slide_count: selectedFormat === "carousel" ? slides.length : null,
          include_cta: selectedFormat === "carousel" ? includeCta : true,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Rascunho salvo!");
      navigate(`/content/${data.id}`);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  // ── Dimensions ──
  const format = FORMATS.find(f => f.id === selectedFormat)!;
  const dims = format.dims;
  const slide = slides[currentSlide];
  const showBullets = slide?.role === "insight" || slide?.role === "bullets";
  const slideTemplate = selectedBrand === "free" ? "generic_free" : (slide?.templateHint || slide?.template || "parameterized");

  return (
    <div className="space-y-6">
      {/* Config Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Marca
          </Label>
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">
                <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-primary" /> Modo Livre</span>
              </SelectItem>
              {brands.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedBrand !== "free" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Estilo de Conteúdo
            </Label>
            <Select value={selectedTemplateSet} onValueChange={setSelectedTemplateSet}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto{defaultTsName ? ` — ${defaultTsName}` : " — (sem padrão)"}
                </SelectItem>
                {templateSets.map(ts => (
                  <SelectItem key={ts.id} value={ts.id}>
                    {ts.name}{ts.category_name ? ` (${ts.category_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Formato</Label>
          <Select value={selectedFormat} onValueChange={setSelectedFormat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMATS.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  <span className="flex items-center gap-2"><f.icon className="w-3.5 h-3.5" /> {f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Estilo Editorial</Label>
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STYLES.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2"><s.icon className="w-3.5 h-3.5" /> {s.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Carousel Controls */}
      {selectedFormat === "carousel" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border p-4 bg-muted/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Nº de slides ({effectiveSlideCount})</Label>
              <Select value={slideCountMode} onValueChange={(v) => setSlideCountMode(v as "auto" | "fixed")}>
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="fixed">Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {slideCountMode === "fixed" && (
              <div className="flex items-center gap-3">
                <Slider
                  value={[slideCountVal]}
                  onValueChange={([v]) => setSlideCountVal(v)}
                  min={3}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono font-medium w-6 text-center">{slideCountVal}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Slide CTA final</Label>
              <p className="text-[10px] text-muted-foreground">Fechamento com chamada para ação</p>
            </div>
            <Switch checked={includeCta} onCheckedChange={setIncludeCta} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Título / Tema do Conteúdo</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Novo estudo sobre cardiopatias congênitas"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notas / Briefing (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contexto adicional, links, pontos a abordar..."
              rows={3}
            />
          </div>
        </div>
        <div className="lg:col-span-7 flex items-end">
          <Button
            onClick={handleGenerateWithAI}
            disabled={generating || generatingImages || !title.trim()}
            className="gap-2 h-12"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Gerando texto...</>
            ) : generatingImages ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {imageGenProgress || "Gerando imagens..."}</>
            ) : (
              <><Wand2 className="w-5 h-5" /> Gerar com IA</>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Main: Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Slide {currentSlide + 1}/{slides.length}
              {slide?.role && (
                <Badge variant="outline" className="ml-2 text-[10px]">{slide.role}</Badge>
              )}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentSlide === 0} onClick={() => setCurrentSlide(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentSlide >= slides.length - 1} onClick={() => setCurrentSlide(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Headline</Label>
              <Input
                value={slide?.headline || ""}
                onChange={e => updateSlide(currentSlide, "headline", e.target.value)}
                placeholder="Título principal do slide"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={slide?.body || ""}
                onChange={e => updateSlide(currentSlide, "body", e.target.value)}
                placeholder="Texto complementar"
                rows={3}
              />
            </div>
            {showBullets && (
              <div className="space-y-2">
                <Label className="text-xs">Bullets</Label>
                {(slide?.bullets || []).map((bullet, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}</span>
                    <Input
                      value={bullet}
                      onChange={e => updateBullet(currentSlide, i, e.target.value)}
                      placeholder={`Ponto ${i + 1}`}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBullet(currentSlide, i)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addBullet(currentSlide)} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar bullet
                </Button>
              </div>
            )}
          </div>

          {/* Slide thumbnails */}
          {slides.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`shrink-0 rounded-lg border-2 p-1.5 transition-all ${
                    i === currentSlide ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                  style={{ width: 64 }}
                >
                  <div className="text-[8px] text-muted-foreground font-mono">{s.role || `#${i + 1}`}</div>
                  <div className="text-[9px] font-medium truncate">{s.headline || "—"}</div>
                </button>
              ))}
            </div>
          )}

          {/* Caption / Hashtags / Insights (AI output) */}
          {(caption || hashtags.length > 0) && (
            <div className="space-y-3 pt-2">
              <Separator />
              {caption && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Legenda gerada</Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(caption)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} className="text-xs" />
                </div>
              )}
              {hashtags.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium flex items-center gap-1"><Hash className="w-3 h-3" /> Hashtags</Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" "))}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hashtags.map((h, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{h.startsWith("#") ? h : `#${h}`}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {sourceSummary && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">📚 Resumo da Fonte</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">{sourceSummary}</p>
                </div>
              )}
              {keyInsights.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">💡 Insights-Chave</Label>
                  <ul className="space-y-0.5">
                    {keyInsights.map((ins, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary">•</span>{ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative mx-auto" style={{ width: 340 }}>
            <div className="rounded-[2.5rem] border-[6px] border-muted-foreground/20 bg-muted/30 p-2 shadow-2xl">
              <div className="mx-auto mb-2 h-5 w-28 rounded-full bg-muted-foreground/15" />
              <div
                className="overflow-hidden rounded-[1.5rem] bg-background"
                style={{ aspectRatio: selectedFormat === "story" ? "9/16" : "4/5" }}
              >
                {/* Show AI-generated image if available, otherwise fallback to template renderer */}
                {slide?.previewImage ? (
                  <img
                    src={slide.previewImage}
                    alt={`Slide ${currentSlide + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    style={{
                      transform: `scale(${328 / dims.width})`,
                      transformOrigin: "top left",
                      width: dims.width,
                      height: dims.height,
                    }}
                  >
                    <SlideTemplateRenderer
                      slide={slide || { headline: "", body: "" }}
                      slideIndex={currentSlide}
                      totalSlides={slides.length}
                      brand={brandSnapshot}
                      template={slideTemplate}
                      dimensions={dims}
                    />
                  </div>
                )}
              </div>
              <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-muted-foreground/20" />
            </div>
          </div>

          <div className="mt-4 text-center space-y-2">
            {/* Regenerate single slide button */}
            {selectedBrand !== "free" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => handleRegenerateSlideImage(currentSlide)}
                disabled={generatingImages}
              >
                {generatingImages ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                {slide?.previewImage ? "Regenerar imagem" : "Gerar imagem"}
              </Button>
            )}

            {/* Debug info */}
            <div className="space-y-1">
              {resolvedTs && (
                <Badge className="text-xs px-3 py-1">
                  Estilo: {resolvedTs.name}
                </Badge>
              )}
              {pilarEditorial && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  Pilar: {pilarEditorial}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground font-mono">
                Role: {slide?.role || "?"} | Template: {slide?.template || slide?.templateHint || "?"} | SetId: {resolvedTsId?.substring(0, 8) || "none"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>Cancelar</Button>
        <Button onClick={handleSaveDraft} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Rascunho
        </Button>
      </div>
    </div>
  );
}
