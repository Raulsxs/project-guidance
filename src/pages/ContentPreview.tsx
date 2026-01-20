import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  Download,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { mockTrends } from "@/data/mockTrends";

const mockCarouselSlides = [
  {
    slideNumber: 1,
    title: "IA Generativa na Saúde",
    content: "A revolução dos diagnósticos por imagem chegou aos hospitais brasileiros",
    type: "cover",
  },
  {
    slideNumber: 2,
    title: "Redução de 60% no Tempo",
    content: "Diagnósticos que levavam horas agora são concluídos em minutos com auxílio de modelos de IA avançados",
    type: "content",
  },
  {
    slideNumber: 3,
    title: "Precisão Aumentada",
    content: "Detecção de anomalias com taxas de acerto superiores a 95%, superando a análise humana isolada",
    type: "content",
  },
  {
    slideNumber: 4,
    title: "Implementação Simples",
    content: "Integração com sistemas existentes de PACS e RIS sem necessidade de grandes mudanças na infraestrutura",
    type: "content",
  },
  {
    slideNumber: 5,
    title: "O Futuro é Agora",
    content: "Invista na transformação digital do seu centro de diagnóstico. A IA é a parceira que seus radiologistas precisam.",
    type: "cta",
  },
];

const ContentPreview = () => {
  const navigate = useNavigate();
  const { trendId } = useParams();
  const [searchParams] = useSearchParams();
  const format = searchParams.get("format") || "carousel";

  const trend = mockTrends.find((t) => t.id === trendId);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState(mockCarouselSlides);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);

  const handleApprove = () => {
    toast.success("Conteúdo aprovado!", {
      description: "Você pode baixar as imagens agora.",
    });
    navigate(`/download/${trendId}?format=${format}`);
  };

  const handleReject = () => {
    toast.info("Conteúdo rejeitado");
    navigate("/dashboard");
  };

  const handleRegenerate = () => {
    toast.info("Regenerando conteúdo...");
  };

  const handleEditSlide = (index: number) => {
    setEditingSlide(index);
    setIsEditing(true);
  };

  const handleSaveEdit = (index: number, newTitle: string, newContent: string) => {
    const updatedSlides = [...slides];
    updatedSlides[index] = {
      ...updatedSlides[index],
      title: newTitle,
      content: newContent,
    };
    setSlides(updatedSlides);
    setIsEditing(false);
    setEditingSlide(null);
    toast.success("Slide atualizado");
  };

  const getSlideStyle = (type: string) => {
    switch (type) {
      case "cover":
        return "gradient-primary text-white";
      case "cta":
        return "bg-accent text-white";
      default:
        return "bg-card";
    }
  };

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
            {format === "carousel" ? "Carrossel" : format === "story" ? "Story" : "Post"}
          </Badge>
        </div>

        {/* Trend Info */}
        {trend && (
          <Card className="shadow-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary/10 text-primary">{trend.theme}</Badge>
                <span className="text-sm text-muted-foreground">{trend.source}</span>
              </div>
              <p className="font-medium text-foreground">{trend.title}</p>
            </CardContent>
          </Card>
        )}

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
                        getSlideStyle(slides[currentSlide].type)
                      )}
                    >
                      <span className="text-xs opacity-60 mb-4">
                        Slide {slides[currentSlide].slideNumber} de {slides.length}
                      </span>
                      <h3 className={cn(
                        "text-xl font-heading font-bold mb-3",
                        slides[currentSlide].type !== "cover" && slides[currentSlide].type !== "cta" && "text-foreground"
                      )}>
                        {slides[currentSlide].title}
                      </h3>
                      <p className={cn(
                        "text-sm leading-relaxed",
                        slides[currentSlide].type !== "cover" && slides[currentSlide].type !== "cta" && "text-muted-foreground"
                      )}>
                        {slides[currentSlide].content}
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
                        Slide {slide.slideNumber}
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
                          defaultValue={slide.title}
                          className="text-sm font-medium"
                          rows={1}
                          id={`title-${index}`}
                        />
                        <Textarea
                          defaultValue={slide.content}
                          className="text-sm"
                          rows={3}
                          id={`content-${index}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const title = (document.getElementById(`title-${index}`) as HTMLTextAreaElement).value;
                              const content = (document.getElementById(`content-${index}`) as HTMLTextAreaElement).value;
                              handleSaveEdit(index, title, content);
                            }}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false);
                              setEditingSlide(null);
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-foreground text-sm">
                          {slide.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {slide.content}
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
