import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";

interface Slide {
  headline: string;
  body: string;
  imagePrompt: string;
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
}

const ContentPreview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);

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

  const handleRegenerate = () => {
    toast.info("Regenerando conteúdo...", {
      description: "Esta funcionalidade será implementada em breve.",
    });
  };

  const handleEditSlide = (index: number) => {
    setEditingSlide(index);
  };

  const handleSaveEdit = async (index: number, newHeadline: string, newBody: string) => {
    const updatedSlides = [...slides];
    updatedSlides[index] = {
      ...updatedSlides[index],
      headline: newHeadline,
      body: newBody,
    };
    setSlides(updatedSlides);
    setEditingSlide(null);
    
    // Update in database
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

  const getSlideStyle = (index: number) => {
    if (index === 0) return "gradient-primary text-white";
    if (index === slides.length - 1) return "bg-accent text-white";
    return "bg-card";
  };

  const getSlideType = (index: number) => {
    if (index === 0) return "cover";
    if (index === slides.length - 1) return "cta";
    return "content";
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
              Preview do Conteúdo
            </h1>
            <p className="text-muted-foreground">
              Revise e aprove o conteúdo gerado antes de baixar
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {content.content_type === "carousel" ? "Carrossel" : content.content_type === "story" ? "Story" : "Post"}
          </Badge>
        </div>

        {/* Content Info */}
        <Card className="shadow-card border-border/50">
          <CardContent className="p-4">
            <p className="font-medium text-foreground">{content.title}</p>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{content.caption}</p>
            {content.hashtags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {content.hashtags.slice(0, 5).map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {content.hashtags.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{content.hashtags.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Visual Preview */}
          <div className="space-y-4">
            <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Preview Visual
            </h2>

            {/* Phone Mockup */}
            <div className="flex justify-center">
              <div className="relative w-[300px]">
                {/* Phone Frame */}
                <div className="bg-foreground rounded-[2.5rem] p-2 shadow-lg">
                  <div className="bg-background rounded-[2rem] overflow-hidden aspect-[4/5]">
                    {/* Slide Content */}
                    <div
                      className={cn(
                        "w-full h-full flex flex-col items-center justify-center p-6 text-center transition-all",
                        getSlideStyle(currentSlide)
                      )}
                    >
                      <span className="text-xs opacity-60 mb-4">
                        Slide {currentSlide + 1} de {slides.length}
                      </span>
                      <h3 className={cn(
                        "text-xl font-heading font-bold mb-3",
                        getSlideType(currentSlide) === "content" && "text-foreground"
                      )}>
                        {slides[currentSlide]?.headline}
                      </h3>
                      <p className={cn(
                        "text-sm leading-relaxed",
                        getSlideType(currentSlide) === "content" && "text-muted-foreground"
                      )}>
                        {slides[currentSlide]?.body}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {/* Dots */}
                  <div className="flex gap-2">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          currentSlide === index
                            ? "bg-primary w-6"
                            : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        )}
                      />
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))
                    }
                    disabled={currentSlide === slides.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Text Editor */}
          <div className="space-y-4">
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Conteúdo dos Slides
            </h2>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {slides.map((slide, index) => (
                <Card
                  key={index}
                  className={cn(
                    "shadow-card border-border/50 transition-all cursor-pointer",
                    currentSlide === index && "ring-2 ring-primary"
                  )}
                  onClick={() => setCurrentSlide(index)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        Slide {index + 1}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSlide(index);
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {editingSlide === index ? (
                      <div className="space-y-3">
                        <Textarea
                          defaultValue={slide.headline}
                          className="text-sm font-medium"
                          rows={1}
                          id={`headline-${index}`}
                        />
                        <Textarea
                          defaultValue={slide.body}
                          className="text-sm"
                          rows={3}
                          id={`body-${index}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const headline = (document.getElementById(`headline-${index}`) as HTMLTextAreaElement).value;
                              const body = (document.getElementById(`body-${index}`) as HTMLTextAreaElement).value;
                              handleSaveEdit(index, headline, body);
                            }}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingSlide(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-foreground text-sm">
                          {slide.headline}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {slide.body}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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
            onClick={handleRegenerate}
          >
            <RefreshCw className="w-4 h-4" />
            Regenerar
          </Button>
          <div className="flex-1" />
          <Button className="gap-2" onClick={handleApprove}>
            <Check className="w-4 h-4" />
            Aprovar e Baixar
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ContentPreview;
