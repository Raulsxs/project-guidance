import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
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
} from "lucide-react";

interface Slide {
  headline: string;
  body: string;
  imagePrompt?: string;
  illustrationPrompt?: string;
  previewImage?: string;
  templateHint?: string;
  template?: string;
  role?: string;
  bullets?: string[];
  speakerNotes?: string;
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
  brand_snapshot: BrandSnapshotData | null;
  visual_mode?: string;
  source_summary?: string;
  key_insights?: string[];
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
        setSlides((data.slides as unknown) as Slide[]);
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

  const handleApprove = () => {
    toast.success("Conteúdo aprovado!", {
      description: "Você pode baixar as imagens agora.",
    });
    navigate(`/download/${id}`);
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
    updatedSlides[index] = {
      ...updatedSlides[index],
      headline,
      body,
      imagePrompt,
    };
    setSlides(updatedSlides);
    setEditingSlide(null);
    
    if (id) {
      try {
        await supabase
          .from("generated_contents")
          .update({ slides: JSON.parse(JSON.stringify(updatedSlides)) })
          .eq("id", id);
        
        toast.success("Slide atualizado");
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
      previewImage: imageUrl,
    };
    setSlides(updatedSlides);
    setCurrentSlide(index);
    toast.success("Imagem selecionada!");
  };

  const handleGeneratePreview = async (index: number) => {
    const slide = slides[index];
    if (!slide.imagePrompt) {
      toast.error("Este slide não tem um prompt de imagem definido");
      return;
    }

    setGeneratingPreview(true);
    setCurrentSlide(index);

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { 
          prompt: slide.imagePrompt,
          style: `professional healthcare marketing for Instagram, ${templates[selectedTemplate].name} style`
        },
      });

      if (error) throw error;

      if (data.imageUrl) {
        const updatedSlides = [...slides];
        updatedSlides[index] = {
          ...updatedSlides[index],
          previewImage: data.imageUrl,
        };
        setSlides(updatedSlides);
        toast.success("Preview gerado com sucesso!");
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Erro ao gerar preview", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleGenerateAllPreviews = async () => {
    setGeneratingPreview(true);
    
    for (let i = 0; i < slides.length; i++) {
      if (slides[i].imagePrompt && !slides[i].previewImage) {
        setCurrentSlide(i);
        await handleGeneratePreviewSingle(i);
      }
    }
    
    setGeneratingPreview(false);
    toast.success("Todos os previews gerados!");
  };

  const handleGeneratePreviewSingle = async (index: number) => {
    const slide = slides[index];
    if (!slide.imagePrompt) return;

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { 
          prompt: slide.imagePrompt,
          style: `professional healthcare marketing for Instagram, ${templates[selectedTemplate].name} style`
        },
      });

      if (error) throw error;

      if (data.imageUrl) {
        setSlides(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], previewImage: data.imageUrl };
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

  const previewCount = slides.filter(s => s.previewImage).length;

  return (
    <DashboardLayout>
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

            {content?.brand_snapshot && slides[currentSlide]?.templateHint ? (
              <div className="flex justify-center">
                <div className="w-[320px] overflow-hidden rounded-2xl shadow-2xl" style={{ aspectRatio: "9/16" }}>
                  <div style={{ transform: "scale(0.296)", transformOrigin: "top left", width: 1080, height: 1350 }}>
                    <SlideTemplateRenderer
                      slide={slides[currentSlide]}
                      slideIndex={currentSlide}
                      totalSlides={slides.length}
                      brand={content.brand_snapshot as any}
                      template={slides[currentSlide].templateHint}
                      dimensions={{ width: 1080, height: 1350 }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <SlidePreview
                slides={slides}
                currentSlide={currentSlide}
                setCurrentSlide={setCurrentSlide}
                template={templates[selectedTemplate]}
                generatingImage={generatingPreview}
              />
            )}

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
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleReject}
          >
            <X className="w-4 h-4" />
            Rejeitar
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsRegenerateModalOpen(true)}
          >
            <RefreshCw className="w-4 h-4" />
            Regenerar Tudo
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
          <Button className="gap-2" onClick={handleApprove}>
            <Check className="w-4 h-4" />
            Aprovar e Baixar
          </Button>
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
