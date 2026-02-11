import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SlideTemplateRenderer from "@/components/content/SlideTemplateRenderer";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import {
  CheckCircle,
  Download as DownloadIcon,
  ArrowLeft,
  FileImage,
  FileText,
  Sparkles,
  Loader2,
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
  image_urls: string[] | null;
  created_at: string;
  brand_snapshot: BrandSnapshotData | null;
  visual_mode?: string;
}

const DownloadPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [renderIndex, setRenderIndex] = useState<number | null>(null);
  const renderRef = useRef<HTMLDivElement>(null);

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

  const getDimensions = useCallback(() => {
    if (!content) return { width: 1080, height: 1350 };
    return content.content_type === "story"
      ? { width: 1080, height: 1920 }
      : { width: 1080, height: 1350 };
  }, [content]);

  const captureSlide = useCallback(async (index: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      setRenderIndex(index);
      // Wait for render
      setTimeout(async () => {
        try {
          if (!renderRef.current) throw new Error("Render container not found");
          const dims = getDimensions();
          const dataUrl = await toPng(renderRef.current, {
            width: dims.width,
            height: dims.height,
            pixelRatio: 1,
            quality: 0.95,
            cacheBust: true,
          });
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      }, 500);
    });
  }, [getDimensions]);

  const handleDownload = async () => {
    if (!content) return;

    setDownloading(true);
    setProgress(5);
    setProgressMessage("Preparando renderização...");

    try {
      const zip = new JSZip();
      const dims = getDimensions();
      const slides = content.slides;

      for (let i = 0; i < slides.length; i++) {
        setProgress(10 + Math.floor((i / slides.length) * 70));
        setProgressMessage(`Renderizando slide ${i + 1} de ${slides.length}...`);
        const blob = await captureSlide(i);
        zip.file(`slide_${String(i + 1).padStart(2, "0")}.png`, blob);
      }

      // Add caption text file
      setProgress(85);
      setProgressMessage("Adicionando legendas...");

      let captionText = `TÍTULO: ${content.title}\n\n`;
      captionText += `LEGENDA:\n${content.caption}\n\n`;
      if (content.hashtags?.length) {
        captionText += `HASHTAGS:\n${content.hashtags.join(" ")}\n\n`;
      }
      captionText += `SLIDES:\n`;
      slides.forEach((slide, i) => {
        captionText += `\n--- Slide ${i + 1} ---\n`;
        captionText += `Headline: ${slide.headline}\n`;
        captionText += `Body: ${slide.body}\n`;
        if (slide.bullets?.length) {
          captionText += `Bullets:\n${slide.bullets.map((b) => `  • ${b}`).join("\n")}\n`;
        }
      });
      zip.file("legendas.txt", captionText);

      setProgress(90);
      setProgressMessage("Gerando ZIP...");

      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = content.title.replace(/[^a-zA-Z0-9À-ú\s]/g, "").slice(0, 40).trim().replace(/\s+/g, "_");
      link.download = `${safeName}_${dims.width}x${dims.height}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setProgressMessage("Download concluído!");

      // Update status
      await supabase
        .from("generated_contents")
        .update({ status: "approved" })
        .eq("id", content.id);
      setContent((prev) => (prev ? { ...prev, status: "approved" } : null));

      toast.success("Download concluído!", { description: "ZIP com PNGs e legendas." });
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erro ao gerar download", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setDownloading(false);
      setRenderIndex(null);
      setProgress(0);
      setProgressMessage("");
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

  const dims = getDimensions();
  const brandSnapshot = content.brand_snapshot || {
    name: "Free",
    palette: ["#667eea", "#764ba2", "#f093fb"],
    fonts: { headings: "Inter", body: "Inter" },
    visual_tone: "clean",
    logo_url: null,
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {content.status === "approved" ? "Conteúdo Aprovado!" : "Exportar Conteúdo"}
            </h1>
            <p className="text-muted-foreground">
              Exporta PNGs renderizados com o template da marca
            </p>
          </div>
        </div>

        {/* Success Card */}
        <Card className="shadow-card border-success/20 bg-success/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-success-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-heading font-semibold text-foreground mb-1">{content.title}</h2>
                <p className="text-muted-foreground">
                  {content.content_type === "carousel"
                    ? `Carrossel com ${content.slides.length} slides`
                    : content.content_type === "story"
                    ? "Story para Instagram"
                    : "Post para Feed"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Download Section */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Exportar PNG/ZIP</CardTitle>
              <CardDescription>
                {downloading ? "Renderizando slides com template..." : "Renderização determinística via template — sem depender de IA para layout"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileImage className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {content.slides.length} imagens PNG
                    </p>
                    <p className="text-xs text-muted-foreground">{dims.width}×{dims.height}px — renderizado via template</p>
                  </div>
                  <Badge variant="outline">PNG</Badge>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="w-5 h-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Legendas + Hashtags</p>
                    <p className="text-xs text-muted-foreground">Copys prontas para cada slide</p>
                  </div>
                  <Badge variant="outline">TXT</Badge>
                </div>
              </div>

              {downloading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">{progressMessage}</p>
                </div>
              )}

              <Button className="w-full gap-2" size="lg" onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Renderizando...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="w-5 h-5" />
                    Exportar PNG/ZIP
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Content Info */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Detalhes do Conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Formato</span>
                <Badge variant="secondary">
                  {content.content_type === "carousel"
                    ? `Carrossel (${content.slides.length} slides)`
                    : content.content_type === "story"
                    ? "Story"
                    : "Post"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Dimensões</span>
                <span className="text-sm font-medium">{dims.width} × {dims.height}px</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Modo Visual</span>
                <Badge variant="outline">
                  {content.visual_mode === "brand_strict" ? "🔒 Template" : content.visual_mode === "brand_guided" ? "🧭 Template + IA" : "🎨 Livre"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Hashtags</span>
                <span className="text-sm font-medium">{content.hashtags?.length || 0} tags</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Gerado em</span>
                <span className="text-sm font-medium">{new Date(content.created_at).toLocaleDateString("pt-BR")}</span>
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Legenda:</p>
                <p className="text-sm text-foreground line-clamp-3">{content.caption}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hashtags */}
        {content.hashtags?.length > 0 && (
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Hashtags Sugeridas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-wrap gap-2 cursor-pointer p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(content.hashtags.join(" "));
                  toast.success("Hashtags copiadas!");
                }}
              >
                {content.hashtags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-sm">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>

      {/* Off-screen renderer for PNG capture */}
      {renderIndex !== null && content.slides[renderIndex] && (
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: dims.width,
            height: dims.height,
            overflow: "hidden",
            zIndex: -1,
          }}
        >
          <div ref={renderRef} style={{ width: dims.width, height: dims.height }}>
            <SlideTemplateRenderer
              slide={content.slides[renderIndex]}
              slideIndex={renderIndex}
              totalSlides={content.slides.length}
              brand={brandSnapshot as any}
              template={content.slides[renderIndex].templateHint || content.slides[renderIndex].template}
              dimensions={dims}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default DownloadPage;
