import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  image_urls: string[] | null;
  created_at: string;
}

const DownloadPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

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

  const handleDownload = async () => {
    if (!content) return;
    
    setDownloading(true);
    setProgress(10);
    setProgressMessage("Iniciando geração de imagens...");

    try {
      // Call edge function to generate images and create ZIP
      setProgress(20);
      setProgressMessage(`Gerando ${content.slides.length} imagens com IA...`);
      
      const { data, error } = await supabase.functions.invoke("generate-download", {
        body: { contentId: content.id },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Erro ao gerar download");
      }

      setProgress(80);
      setProgressMessage("Preparando arquivo ZIP...");

      // Convert base64 to blob and download
      const byteCharacters = atob(data.zipBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || "content.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setProgress(100);
      setProgressMessage("Download concluído!");

      toast.success("Download concluído!", {
        description: "Seu arquivo ZIP foi baixado com sucesso.",
      });

      // Update content status
      setContent(prev => prev ? { ...prev, status: "approved", image_urls: data.imageUrls } : null);

    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erro ao gerar download", {
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
      });
    } finally {
      setDownloading(false);
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
              {content.status === "approved" ? "Conteúdo Aprovado!" : "Gerar Download"}
            </h1>
            <p className="text-muted-foreground">
              {content.status === "approved" 
                ? "Seu conteúdo está pronto para download" 
                : "Clique no botão para gerar as imagens e baixar"}
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
                <h2 className="text-xl font-heading font-semibold text-foreground mb-1">
                  {content.title}
                </h2>
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

        {/* Content Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Download Section */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Arquivos para Download</CardTitle>
              <CardDescription>
                {downloading ? "Gerando imagens com IA..." : "Clique para gerar e baixar todos os arquivos"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File List */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileImage className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Imagens do {content.content_type === "carousel" ? "Carrossel" : "Conteúdo"}</p>
                    <p className="text-xs text-muted-foreground">{content.slides.length} arquivos PNG (1080×1350)</p>
                  </div>
                  <Badge variant="outline">PNG</Badge>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="w-5 h-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Textos para Legenda</p>
                    <p className="text-xs text-muted-foreground">Copys prontas para cada slide + hashtags</p>
                  </div>
                  <Badge variant="outline">TXT</Badge>
                </div>
              </div>

              {/* Progress */}
              {downloading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">{progressMessage}</p>
                </div>
              )}

              {/* Download Button */}
              <Button 
                className="w-full gap-2" 
                size="lg" 
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando Imagens...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="w-5 h-5" />
                    {content.image_urls?.length ? "Baixar Novamente (ZIP)" : "Gerar e Baixar (ZIP)"}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                O arquivo contém todas as imagens geradas por IA e textos prontos para uso
              </p>
            </CardContent>
          </Card>

          {/* Content Info */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Detalhes do Conteúdo</CardTitle>
              <CardDescription>
                Informações sobre o conteúdo gerado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
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
                  <span className="text-sm font-medium">1080 × 1350px</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={content.status === "approved" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}>
                    {content.status === "approved" ? "Aprovado" : content.status === "draft" ? "Rascunho" : content.status}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Hashtags</span>
                  <span className="text-sm font-medium">{content.hashtags?.length || 0} tags</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Gerado em</span>
                  <span className="text-sm font-medium">
                    {new Date(content.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Caption Preview */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Legenda:</p>
                <p className="text-sm text-foreground line-clamp-3">
                  {content.caption}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hashtags */}
        {content.hashtags && content.hashtags.length > 0 && (
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Hashtags Sugeridas
              </CardTitle>
              <CardDescription>
                Clique para copiar todas as hashtags
              </CardDescription>
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
                  <Badge key={i} variant="outline" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back to Dashboard */}
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DownloadPage;
