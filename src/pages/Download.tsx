import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  Download as DownloadIcon,
  ArrowLeft,
  FileImage,
  FileText,
  Sparkles,
} from "lucide-react";
import { mockTrends } from "@/data/mockTrends";

const DownloadPage = () => {
  const navigate = useNavigate();
  const { trendId } = useParams();
  const [searchParams] = useSearchParams();
  const format = searchParams.get("format") || "carousel";

  const trend = mockTrends.find((t) => t.id === trendId);

  const handleDownload = () => {
    toast.success("Download iniciado!", {
      description: "Seu arquivo ZIP está sendo preparado.",
    });
  };

  const suggestedTrends = mockTrends
    .filter((t) => t.id !== trendId)
    .slice(0, 3);

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
              Conteúdo Aprovado!
            </h1>
            <p className="text-muted-foreground">
              Seu conteúdo está pronto para download
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
                  Conteúdo Aprovado com Sucesso!
                </h2>
                <p className="text-muted-foreground">
                  Seu {format === "carousel" ? "carrossel" : format === "story" ? "story" : "post"} foi gerado e está pronto para ser baixado. 
                  Use as imagens diretamente no seu Instagram.
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
              <CardTitle className="font-heading text-lg">Arquivos Disponíveis</CardTitle>
              <CardDescription>
                Baixe todos os arquivos em um único ZIP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File List */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileImage className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Imagens do Carrossel</p>
                    <p className="text-xs text-muted-foreground">5 arquivos PNG (1080×1350)</p>
                  </div>
                  <Badge variant="outline">PNG</Badge>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="w-5 h-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Textos para Legenda</p>
                    <p className="text-xs text-muted-foreground">Copys prontas para cada slide</p>
                  </div>
                  <Badge variant="outline">TXT</Badge>
                </div>
              </div>

              {/* Download Button */}
              <Button className="w-full gap-2" size="lg" onClick={handleDownload}>
                <DownloadIcon className="w-5 h-5" />
                Baixar Tudo (ZIP)
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                O arquivo contém todas as imagens e textos prontos para uso
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
                    {format === "carousel" ? "Carrossel (5 slides)" : format === "story" ? "Story" : "Post"}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Dimensões</span>
                  <span className="text-sm font-medium">1080 × 1350px</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <Badge className="bg-primary/10 text-primary">{trend?.theme}</Badge>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Fonte</span>
                  <span className="text-sm font-medium">{trend?.source}</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Gerado em</span>
                  <span className="text-sm font-medium">
                    {new Date().toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {trend && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {trend.title}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Suggested Trends */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Próximas Tendências para Você
            </CardTitle>
            <CardDescription>
              Continue gerando conteúdo com essas tendências em alta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestedTrends.map((t) => (
                <div
                  key={t.id}
                  className="p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate("/dashboard")}
                >
                  <Badge variant="secondary" className="mb-2 text-xs">
                    {t.theme}
                  </Badge>
                  <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{t.source}</span>
                    <span>•</span>
                    <span>Score: {t.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
