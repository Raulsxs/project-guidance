import { useState, useEffect } from "react";
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
import SlideTemplateRenderer from "@/components/content/SlideTemplateRenderer";
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

const CAROUSEL_ROLES = ["cover", "context", "insight", "insight", "closing"];
const ROLE_TEMPLATES: Record<string, string> = {
  cover: "wave_cover",
  context: "wave_text_card",
  insight: "wave_bullets",
  closing: "wave_closing",
  cta: "wave_closing",
};

function getDefaultSlides(format: string): SlideData[] {
  if (format === "carousel") {
    return CAROUSEL_ROLES.map((role) => ({
      headline: "",
      body: "",
      bullets: role === "insight" ? [""] : undefined,
      role,
      template: ROLE_TEMPLATES[role] || "wave_text_card",
      templateHint: ROLE_TEMPLATES[role] || "wave_text_card",
    }));
  }
  const tpl = format === "story" ? "story_cover" : "wave_cover";
  return [{ headline: "", body: "", template: tpl, templateHint: tpl, role: "cover" }];
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
  const [slideCountVal, setSlideCountVal] = useState(5);
  const [includeCta, setIncludeCta] = useState(true);

  // Data
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [templateSets, setTemplateSets] = useState<TemplateSetOption[]>([]);
  const [slides, setSlides] = useState<SlideData[]>(getDefaultSlides("carousel"));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [saving, setSaving] = useState(false);

  // AI generation
  const [generating, setGenerating] = useState(false);
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
          .select("id, name, description, template_set")
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

  // ── Reset slides when format changes ──
  useEffect(() => {
    setSlides(getDefaultSlides(selectedFormat));
    setCurrentSlide(0);
  }, [selectedFormat]);

  // ── Resolve brand snapshot for preview ──
  const currentBrand = brands.find(b => b.id === selectedBrand);
  const defaultTsId = currentBrand?.default_template_set_id || null;
  const defaultTsName = templateSets.find(ts => ts.id === defaultTsId)?.name || null;
  const resolvedTsId = selectedTemplateSet === "auto" ? defaultTsId : selectedTemplateSet;
  const resolvedTs = templateSets.find(ts => ts.id === resolvedTsId);

  const brandSnapshot = currentBrand ? {
    name: currentBrand.name,
    palette: currentBrand.palette || [],
    fonts: currentBrand.fonts || { headings: "Inter", body: "Inter" },
    visual_tone: currentBrand.visual_tone || "clean",
    logo_url: currentBrand.logo_url,
    style_guide: resolvedTs?.template_set || currentBrand.style_guide || null,
    visual_signature: resolvedTs?.template_set?.visual_signature || null,
  } : {
    name: "Modo Livre",
    palette: ["#667eea", "#764ba2", "#f093fb"],
    fonts: { headings: "Inter", body: "Inter" },
    visual_tone: "clean",
    logo_url: null,
    style_guide: null,
    visual_signature: null,
  };

  // Apply template set templates to slides
  useEffect(() => {
    if (resolvedTs?.template_set?.formats) {
      const fmt = resolvedTs.template_set.formats[selectedFormat];
      if (fmt?.role_to_template && selectedFormat === "carousel") {
        setSlides(prev => prev.map(s => ({
          ...s,
          template: fmt.role_to_template[s.role || "context"] || s.template,
          templateHint: fmt.role_to_template[s.role || "context"] || s.templateHint,
        })));
      } else if (fmt?.recommended_templates?.[0]) {
        setSlides(prev => prev.map((s, i) => ({
          ...s,
          template: i === 0 ? fmt.recommended_templates[0] : (fmt.recommended_templates[1] || fmt.recommended_templates[0]),
          templateHint: i === 0 ? fmt.recommended_templates[0] : (fmt.recommended_templates[1] || fmt.recommended_templates[0]),
        })));
      }
    }
  }, [resolvedTsId, selectedFormat]);

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

      // Fill slides from AI response
      if (content.slides && content.slides.length > 0) {
        setSlides(content.slides.map((s: any) => ({
          headline: s.headline || "",
          body: s.body || "",
          bullets: s.bullets || undefined,
          template: s.template || s.templateHint || "wave_cover",
          templateHint: s.templateHint || s.template || "wave_cover",
          role: s.role || "cover",
          previewImage: s.previewImage || undefined,
          speakerNotes: s.speakerNotes || "",
          illustrationPrompt: s.illustrationPrompt || "",
          imagePrompt: s.imagePrompt || "",
        })));
        setCurrentSlide(0);
      }

      // Fill metadata
      if (content.caption) setCaption(content.caption);
      if (content.hashtags) setHashtags(content.hashtags);
      if (content.sourceSummary) setSourceSummary(content.sourceSummary);
      if (content.keyInsights) setKeyInsights(content.keyInsights);
      if (content.title) setTitle(content.title);

      toast.success("Conteúdo gerado pela IA! Edite à vontade.");
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error("Erro ao gerar: " + (err.message || "Tente novamente"));
    } finally {
      setGenerating(false);
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
  const showBullets = slide?.role === "insight" || slide?.template === "wave_bullets";
  const slideTemplate = selectedBrand === "free" ? "generic_free" : (slide?.templateHint || slide?.template || "wave_cover");

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
                  <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>
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
              <Label className="text-xs font-medium">Nº de slides</Label>
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
            disabled={generating || !title.trim()}
            className="gap-2 h-12"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Gerando com IA...</>
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
              </div>
              <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-muted-foreground/20" />
            </div>
          </div>

          <div className="mt-4 text-center space-y-1">
            {resolvedTs && (
              <Badge className="text-xs px-3 py-1">
                Estilo aplicado: {resolvedTs.name}
              </Badge>
            )}
            <div>
              <Badge variant="secondary" className="text-[10px]">
                Template: {slideTemplate}
              </Badge>
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
