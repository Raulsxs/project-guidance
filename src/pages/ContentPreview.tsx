import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { normalizeSlides, buildContentDraftKey, getSlideRenderMode } from "@/lib/slideUtils";
import { useDraft } from "@/hooks/useDraft";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import DraftRestoreModal from "@/components/content/DraftRestoreModal";
import SlideBgOverlayRenderer from "@/components/content/SlideBgOverlayRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { templates, TemplateStyle } from "@/lib/templates";
import TemplateSelector from "@/components/content/TemplateSelector";
import SlidePreview from "@/components/content/SlidePreview";
import SlideEditor from "@/components/content/SlideEditor";
import GenerationDebugPanel from "@/components/content/GenerationDebugPanel";
import RegenerateModal from "@/components/content/RegenerateModal";
import ScheduleModal from "@/components/content/ScheduleModal";
import SlideTemplateRenderer, { getTemplateForSlide } from "@/components/content/SlideTemplateRenderer";
import {
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Loader2,
  Wand2,
  CalendarClock,
  Download,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Slide {
  headline: string;
  body: string;
  imagePrompt?: string;
  illustrationPrompt?: string;
  image_url?: string;
  // Legacy fields - normalized to image_url on load
  previewImage?: string;
  imageUrl?: string;
  image?: string;
  templateHint?: string;
  template?: string;
  role?: string;
  bullets?: string[];
  speakerNotes?: string;
  image_stale?: boolean;
  // AI_BG_OVERLAY mode fields
  background_image_url?: string;
  overlay?: { headline?: string; body?: string; bullets?: string[]; footer?: string };
  overlay_style?: { safe_area_top?: number; safe_area_bottom?: number; text_align?: "left" | "center"; max_headline_lines?: number; font_scale?: number };
  render_mode?: "legacy_image" | "ai_bg_overlay";
}

interface BrandSnapshotData {
  name: string;
  palette: { name: string; hex: string }[] | string[];
  fonts: { headings: string; body: string };
  visual_tone: string;
  logo_url: string | null;
  style_guide?: any;
}

interface GeneratedContent {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  slides: Slide[];
  content_type: string;
  trend_id: string | null;
  status: string;
  scheduled_at: string | null;
  brand_snapshot: BrandSnapshotData | null;
  visual_mode?: string;
  source_summary?: string;
  key_insights?: string[];
  generation_metadata?: Record<string, any> | null;
}

const ContentPreview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>("editorial");
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Draft persistence for content editor
  const draftKey = id ? buildContentDraftKey(id) : null;
  const { pendingDraft, restoreDraft, discardDraft, saveToDraft, hasUnsavedChanges } = useDraft({
    draftKey,
    enabled: !!id,
  });
  useUnsavedChangesGuard(hasUnsavedChanges);

  // Auto-save draft when slides change
  useEffect(() => {
    if (!content || slides.length === 0) return;
    saveToDraft({ slides, caption: content.caption, hashtags: content.hashtags, title: content.title });
  }, [slides, content?.caption, content?.hashtags, content?.title, saveToDraft]);

  const handleRestoreContentDraft = useCallback(() => {
    const draft = restoreDraft();
    if (!draft) return;
    if (draft.slides) setSlides(normalizeSlides(draft.slides as Slide[]));
    toast.success("Rascunho restaurado!");
  }, [restoreDraft]);

  useEffect(() => {
    const fetchContent = async () => {
      if (!id) return;
      
      try {
        const { data, error } = await supabase
          .from("generated_contents")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        setContent(data as unknown as GeneratedContent);
        // Normalize slides: image_url is the single source of truth
        const rawSlides = (data.slides as unknown) as Slide[];
        setSlides(normalizeSlides(rawSlides));
      } catch (error) {
        console.error("Error fetching content:", error);
        toast.error("Erro ao carregar conteúdo");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [id, navigate]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await supabase
        .from("generated_contents")
        .update({ status: "approved" })
        .eq("id", id);
      setContent(prev => prev ? { ...prev, status: "approved" } : null);
      toast.success("Conteúdo aprovado!", {
        description: "Quer agendar agora?",
        action: {
          label: "Agendar",
          onClick: () => setIsScheduleModalOpen(true),
        },
      });
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Erro ao aprovar");
    }
  };

  const handleApproveAndDownload = async () => {
    if (!id) return;
    try {
      await supabase
        .from("generated_contents")
        .update({ status: "approved" })
        .eq("id", id);
      setContent(prev => prev ? { ...prev, status: "approved" } : null);
      toast.success("Conteúdo aprovado!");
      navigate(`/download/${id}`);
    } catch (error) {
      toast.error("Erro ao aprovar");
    }
  };

  const handleReopen = async () => {
    if (!id) return;
    try {
      await supabase
        .from("generated_contents")
        .update({ status: "draft", scheduled_at: null })
        .eq("id", id);
      setContent(prev => prev ? { ...prev, status: "draft", scheduled_at: null } : null);
      toast.success("Conteúdo reaberto para edição");
    } catch (error) {
      toast.error("Erro ao reabrir");
    }
  };

  const handleReject = async () => {
    if (!id) return;
    
    try {
      await supabase
        .from("generated_contents")
        .update({ status: "rejected" })
        .eq("id", id);
      
      toast.info("Conteúdo rejeitado");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error rejecting content:", error);
    }
  };

  const handleRegenerate = async (customPrompt: string) => {
    if (!id || !content) return;
    
    setIsRegenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          trend: {
            title: content.title,
            description: content.caption,
            theme: "Saúde",
            keywords: content.hashtags,
          },
          contentType: content.content_type,
          customPrompt: customPrompt || undefined,
          templateSetId: (content as any).template_set_id || undefined,
          brandId: (content as any).brand_snapshot ? (content.brand_snapshot as any)?.brandId || undefined : undefined,
          visualMode: (content as any).visual_mode || "free",
          includeCta: (content as any).include_cta ?? true,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao regenerar");
      }

      // Update content in database
      const { error: updateError } = await supabase
        .from("generated_contents")
        .update({
          title: data.content.title,
          caption: data.content.caption,
          hashtags: data.content.hashtags,
          slides: data.content.slides,
          generation_metadata: data.content.generationMetadata || null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Update local state
      setContent({
        ...content,
        title: data.content.title,
        caption: data.content.caption,
        hashtags: data.content.hashtags,
      });
      setSlides(data.content.slides);
      setCurrentSlide(0);
      
      toast.success("Conteúdo regenerado com sucesso!");
      setIsRegenerateModalOpen(false);
    } catch (error) {
      console.error("Error regenerating:", error);
      toast.error("Erro ao regenerar conteúdo");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSchedule = async (scheduledDate: Date) => {
    if (!id) return;
    
    setIsScheduling(true);
    
    try {
      const { error } = await supabase
        .from("generated_contents")
        .update({ 
          scheduled_at: scheduledDate.toISOString(),
          status: "scheduled" 
        })
        .eq("id", id);

      if (error) throw error;

      setContent(prev => prev ? { ...prev, status: "scheduled", scheduled_at: scheduledDate.toISOString() } : null);
      toast.success("Conteúdo agendado!", {
        description: `Publicação agendada para ${scheduledDate.toLocaleString("pt-BR")}`,
      });
      setIsScheduleModalOpen(false);
    } catch (error) {
      console.error("Error scheduling:", error);
      toast.error("Erro ao agendar publicação");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSaveEdit = async (index: number, headline: string, body: string, imagePrompt: string) => {
    const updatedSlides = [...slides];
    const existing = updatedSlides[index];
    const textChanged = existing.headline !== headline || existing.body !== body;
    const hasImage = !!existing.image_url;
    
    updatedSlides[index] = {
      ...existing,
      headline,
      body,
      imagePrompt,
      image_url: existing.image_url,
      previewImage: existing.image_url,
      // Mark stale if text changed and slide already has an AI image
      image_stale: (textChanged && hasImage) ? true : existing.image_stale,
    };
    setSlides(updatedSlides);
    setEditingSlide(null);
    
    if (id) {
      try {
        await supabase
          .from("generated_contents")
          .update({ slides: JSON.parse(JSON.stringify(updatedSlides)) })
          .eq("id", id);
        
        toast.success(textChanged && hasImage
          ? "Slide atualizado — imagem precisa ser regenerada"
          : "Slide atualizado");
      } catch (error) {
        console.error("Error updating slide:", error);
        toast.error("Erro ao salvar alterações");
      }
    }
  };

  const handleSetStockImage = (index: number, imageUrl: string) => {
    const updatedSlides = [...slides];
    updatedSlides[index] = {
      ...updatedSlides[index],
      image_url: imageUrl,
      previewImage: imageUrl,
    };
    setSlides(updatedSlides);
    setCurrentSlide(index);
    toast.success("Imagem selecionada!");
  };

  const handleGeneratePreview = async (index: number) => {
    const slide = slides[index];
    const brandId = (content as any)?.brand_id;

    if (!brandId) {
      // Fallback for free mode — use generic generate-image
      if (!slide.imagePrompt) {
        toast.error("Este slide não tem um prompt de imagem definido");
        return;
      }
      setGeneratingPreview(true);
      setCurrentSlide(index);
      try {
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: slide.imagePrompt, style: `professional healthcare marketing for Instagram` },
        });
        if (error) throw error;
      if (data.imageUrl) {
          const updatedSlides = [...slides];
          updatedSlides[index] = { ...updatedSlides[index], image_url: data.imageUrl, previewImage: data.imageUrl, image_stale: false };
          setSlides(updatedSlides);
          toast.success("Preview gerado com sucesso!");
        }
      } catch (error) {
        console.error("Error generating preview:", error);
        toast.error("Erro ao gerar preview", { description: error instanceof Error ? error.message : "Tente novamente" });
      } finally {
        setGeneratingPreview(false);
      }
      return;
    }

    // Brand mode — use generate-slide-images (same as Studio)
    setGeneratingPreview(true);
    setCurrentSlide(index);
    try {
      const templateSetId = (content as any)?.template_set_id || undefined;
      const { data, error } = await supabase.functions.invoke("generate-slide-images", {
        body: {
          brandId,
          slide,
          slideIndex: index,
          totalSlides: slides.length,
          contentFormat: content?.content_type || "carousel",
          contentId: `dashboard-${id}-${Date.now()}`,
          templateSetId,
        },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        const updatedSlides = [...slides];
        updatedSlides[index] = { ...updatedSlides[index], image_url: data.imageUrl, previewImage: data.imageUrl, image_stale: false };
        setSlides(updatedSlides);
        // Save image generation debug info to metadata
        if (data?.debug) {
          setContent(prev => {
            if (!prev) return prev;
            const meta = { ...(prev.generation_metadata || {}) };
            const imageGens = [...(meta.image_generations || [])];
            imageGens.push({
              slideIndex: index,
              image_model: data.debug.image_model || "google/gemini-2.5-flash-image",
              image_generation_ms: data.debug.image_generation_ms,
              references_used: data.debug.referencesUsedCount,
              fallback_level: data.debug.fallbackLevel,
              generated_at: data.debug.generated_at,
            });
            meta.image_generations = imageGens;
            // Persist metadata
            if (id) {
              supabase.from("generated_contents").update({ generation_metadata: meta }).eq("id", id);
            }
            return { ...prev, generation_metadata: meta };
          });
        }
        // Persist to DB
        if (id) {
          const updatedForDb = [...slides];
          updatedForDb[index] = { ...updatedForDb[index], image_url: data.imageUrl, previewImage: data.imageUrl, image_stale: false };
          await supabase.from("generated_contents").update({ slides: JSON.parse(JSON.stringify(updatedForDb)) }).eq("id", id);
        }
        toast.success("Imagem gerada com sucesso!");
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Erro ao gerar preview", { description: error instanceof Error ? error.message : "Tente novamente" });
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleGenerateAllPreviews = async () => {
    const brandId = (content as any)?.brand_id;
    setGeneratingPreview(true);

    if (brandId) {
      // Brand mode — batch with generate-slide-images (same as Studio)
      const templateSetId = (content as any)?.template_set_id || undefined;
      const contentId = `dashboard-${id}-${Date.now()}`;
      let completedCount = 0;
      const batchSize = 2;

      for (let batch = 0; batch < slides.length; batch += batchSize) {
        const batchSlides = slides.slice(batch, batch + batchSize);
        const batchPromises = batchSlides.map((s, batchIdx) => {
          const i = batch + batchIdx;
          return supabase.functions.invoke("generate-slide-images", {
            body: {
              brandId,
              slide: s,
              slideIndex: i,
              totalSlides: slides.length,
              contentFormat: content?.content_type || "carousel",
              contentId,
              templateSetId,
            },
          }).then(result => {
            completedCount++;
            if (result.data?.imageUrl) {
              setSlides(prev => prev.map((sl, idx) =>
                idx === i ? { ...sl, image_url: result.data.imageUrl, previewImage: result.data.imageUrl } : sl
              ));
            }
            return { index: i, data: result.data, error: result.error };
          });
        });

        await Promise.allSettled(batchPromises);

        if (batch + batchSize < slides.length) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      // Persist all updated slides to DB
      setSlides(prev => {
        if (id) {
          supabase.from("generated_contents").update({ slides: JSON.parse(JSON.stringify(prev)) }).eq("id", id);
        }
        return prev;
      });

      toast.success(`${completedCount} imagens geradas!`);
    } else {
      // Free mode — fallback to old generic method
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].imagePrompt && !slides[i].previewImage) {
          setCurrentSlide(i);
          await handleGeneratePreviewSingle(i);
        }
      }
      toast.success("Todos os previews gerados!");
    }

    setGeneratingPreview(false);
  };

  const handleGeneratePreviewSingle = async (index: number) => {
    const slide = slides[index];
    if (!slide.imagePrompt) return;

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: slide.imagePrompt, style: `professional healthcare marketing for Instagram` },
      });
      if (error) throw error;
      if (data.imageUrl) {
        setSlides(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], image_url: data.imageUrl, previewImage: data.imageUrl };
          return updated;
        });
      }
    } catch (error) {
      console.error("Error generating preview:", error);
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

  if (!content) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-muted-foreground">Conteúdo não encontrado</p>
          <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const previewCount = slides.filter(s => s.image_url).length;

  return (
    <DashboardLayout>
      {/* Draft Restore Modal */}
      <DraftRestoreModal
        open={!!pendingDraft}
        savedAt={pendingDraft?.savedAt || 0}
        onRestore={handleRestoreContentDraft}
        onDiscard={discardDraft}
      />
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Editor de Conteúdo
            </h1>
            <p className="text-muted-foreground">
              Personalize seu conteúdo antes de baixar
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {content.content_type === "carousel" ? "Carrossel" : content.content_type === "story" ? "Story" : "Post"}
          </Badge>
        </div>

        {/* Content Info */}
        <Card className="shadow-card border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-foreground">{content.title}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{content.caption}</p>
                {content.visual_mode && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    {content.visual_mode === "brand_strict" ? "🔒 Identidade Rígida" : content.visual_mode === "brand_guided" ? "🧭 Identidade + IA" : "🎨 Livre"}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleGenerateAllPreviews}
                disabled={generatingPreview}
              >
                {generatingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Gerar Previews ({previewCount}/{slides.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Source Context (Base do Conteúdo) */}
        {(content.source_summary || (content.key_insights && content.key_insights.length > 0)) && (
          <Card className="shadow-card border-border/50">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                📚 Base do Conteúdo
              </h3>
              {content.source_summary && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Resumo da Fonte</p>
                  <p className="text-sm text-foreground leading-relaxed">{content.source_summary}</p>
                </div>
              )}
              {content.key_insights && content.key_insights.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Insights-Chave</p>
                  <ul className="space-y-1">
                    {content.key_insights.map((insight, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Preview */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Preview Visual
              </h2>
            </div>

            {(() => {
              const currentSlideSrc = slides[currentSlide]?.image_url;

              // If there's a generated image, show it directly (no scale transform = crisp)
              if (currentSlideSrc) {
                return (
                  <div className="flex justify-center">
                    <div className="relative mx-auto" style={{ width: 320 }}>
                      <div className="rounded-[2.5rem] border-[6px] border-muted-foreground/20 bg-muted/30 p-2 shadow-2xl">
                        <div className="mx-auto mb-2 h-5 w-28 rounded-full bg-muted-foreground/15" />
                        <div className="overflow-hidden rounded-[1.5rem] bg-background" style={{ aspectRatio: content.content_type === "story" ? "9/16" : "4/5" }}>
                          <img
                            src={currentSlideSrc}
                            alt={`Slide ${currentSlide + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-muted-foreground/20" />
                      </div>
                    </div>
                  </div>
                );
              }

              // Fallback to template renderer (no image yet)
              if (content?.brand_snapshot && slides[currentSlide]?.templateHint) {
                return (
                  <div className="flex justify-center">
                    <div className="relative mx-auto" style={{ width: 320 }}>
                      <div className="rounded-[2.5rem] border-[6px] border-muted-foreground/20 bg-muted/30 p-2 shadow-2xl">
                        <div className="mx-auto mb-2 h-5 w-28 rounded-full bg-muted-foreground/15" />
                        <div className="overflow-hidden rounded-[1.5rem] bg-background" style={{ aspectRatio: content.content_type === "story" ? "9/16" : "4/5" }}>
                          <div style={{
                            transform: `scale(${308 / 1080})`,
                            transformOrigin: "top left",
                            width: 1080,
                            height: content.content_type === "story" ? 1920 : 1350,
                          }}>
                            <SlideTemplateRenderer
                              slide={slides[currentSlide]}
                              slideIndex={currentSlide}
                              totalSlides={slides.length}
                              brand={content.brand_snapshot as any}
                              template={slides[currentSlide].templateHint}
                              dimensions={{ width: 1080, height: content.content_type === "story" ? 1920 : 1350 }}
                            />
                          </div>
                        </div>
                        <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-muted-foreground/20" />
                      </div>
                    </div>
                  </div>
                );
              }

              // Generic fallback
              return (
                <SlidePreview
                  slides={slides}
                  currentSlide={currentSlide}
                  setCurrentSlide={setCurrentSlide}
                  template={templates[selectedTemplate]}
                  generatingImage={generatingPreview}
                />
              );
            })()}

            <Separator />

            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
            />
          </div>

          {/* Right Column - Editor */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Editar Slides
            </h2>

            <SlideEditor
              slides={slides}
              currentSlide={currentSlide}
              editingSlide={editingSlide}
              onSlideClick={setCurrentSlide}
              onEditSlide={setEditingSlide}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingSlide(null)}
              onGeneratePreview={handleGeneratePreview}
              onSetStockImage={handleSetStockImage}
              generatingPreview={generatingPreview}
            />

            {/* Hashtags */}
            {content.hashtags && content.hashtags.length > 0 && (
              <Card className="shadow-card border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-2">Hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {content.hashtags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Debug Panel */}
            <GenerationDebugPanel metadata={content.generation_metadata || null} />
          </div>
        </div>

        {/* Actions - Status-aware */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          {content.status === "draft" && (
            <>
              <Button className="gap-2" onClick={handleApprove}>
                <Check className="w-4 h-4" />
                Aprovar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsScheduleModalOpen(true)}
              >
                <CalendarClock className="w-4 h-4" />
                Agendar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsRegenerateModalOpen(true)}
              >
                <RefreshCw className="w-4 h-4" />
                Regenerar Tudo
              </Button>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleApproveAndDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Aprovar e Baixar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleReject} className="text-destructive">
                    <X className="w-4 h-4 mr-2" />
                    Rejeitar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {content.status === "approved" && (
            <>
              <Button className="gap-2" onClick={() => navigate(`/download/${id}`)}>
                <Download className="w-4 h-4" />
                Baixar Agora
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsScheduleModalOpen(true)}
              >
                <CalendarClock className="w-4 h-4" />
                Agendar
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                className="gap-2 text-muted-foreground"
                onClick={handleReopen}
              >
                <RotateCcw className="w-4 h-4" />
                Reabrir para Edição
              </Button>
            </>
          )}

          {content.status === "scheduled" && (
            <>
              <Badge className="bg-primary/15 text-primary border-primary/30 px-3 py-2 text-sm self-center">
                <CalendarClock className="w-4 h-4 mr-1.5" />
                Agendado para {content.scheduled_at ? format(new Date(content.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : ""}
              </Badge>
              <Button className="gap-2" onClick={() => navigate(`/download/${id}`)}>
                <Download className="w-4 h-4" />
                Baixar Agora
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsScheduleModalOpen(true)}
              >
                <CalendarClock className="w-4 h-4" />
                Editar Agendamento
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                className="gap-2 text-muted-foreground"
                onClick={handleReopen}
              >
                <RotateCcw className="w-4 h-4" />
                Reabrir para Edição
              </Button>
            </>
          )}
        </div>

        {/* Regenerate Modal */}
        <RegenerateModal
          open={isRegenerateModalOpen}
          onClose={() => setIsRegenerateModalOpen(false)}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
          currentTitle={content?.title || ""}
        />

        {/* Schedule Modal */}
        <ScheduleModal
          open={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSchedule={handleSchedule}
          isScheduling={isScheduling}
        />
      </div>
    </DashboardLayout>
  );
};

export default ContentPreview;
