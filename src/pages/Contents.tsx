import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Search,
  Loader2,
  Calendar,
  Layers,
  CheckCircle,
  Clock,
  XCircle,
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

const Contents = () => {
  const navigate = useNavigate();
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchContents = async () => {
    try {
      const { data, error } = await supabase
        .from("generated_contents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setContents((data as unknown as GeneratedContent[]) || []);
    } catch (error) {
      console.error("Error fetching contents:", error);
      toast.error("Erro ao carregar conteúdos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents();
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("generated_contents")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setContents(contents.filter((c) => c.id !== id));
      toast.success("Conteúdo excluído");
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Erro ao excluir conteúdo");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4 text-success" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Aprovado";
      case "rejected":
        return "Rejeitado";
      default:
        return "Rascunho";
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case "carousel":
        return "Carrossel";
      case "story":
        return "Story";
      default:
        return "Post";
    }
  };

  const filteredContents = contents.filter((content) =>
    content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    content.caption?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Meus Conteúdos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os conteúdos gerados
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">
            {contents.length} {contents.length === 1 ? "conteúdo" : "conteúdos"}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou legenda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Contents Grid */}
        {filteredContents.length === 0 ? (
          <Card className="shadow-card border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {searchQuery ? "Nenhum conteúdo encontrado" : "Nenhum conteúdo gerado ainda"}
              </h3>
              <p className="text-muted-foreground text-sm text-center max-w-sm">
                {searchQuery
                  ? "Tente buscar com outros termos"
                  : "Vá ao Dashboard e gere seu primeiro conteúdo a partir de uma tendência"}
              </p>
              {!searchQuery && (
                <Button
                  className="mt-4"
                  onClick={() => navigate("/dashboard")}
                >
                  Ir para o Dashboard
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredContents.map((content) => (
              <Card
                key={content.id}
                className="shadow-card border-border/50 hover:shadow-card-hover transition-all duration-300 overflow-hidden group"
              >
                <CardContent className="p-0">
                  {/* Status Bar */}
                  <div
                    className={`h-1 w-full ${
                      content.status === "approved"
                        ? "bg-success"
                        : content.status === "rejected"
                        ? "bg-destructive"
                        : "bg-warning"
                    }`}
                  />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getContentTypeLabel(content.content_type)}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getStatusIcon(content.status)}
                          <span>{getStatusLabel(content.status)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-heading font-semibold text-foreground mb-2 line-clamp-2">
                      {content.title}
                    </h3>

                    {/* Caption */}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {content.caption}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{content.slides?.length || 0} slides</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(content.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => navigate(`/content/${content.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => navigate(`/download/${content.id}`)}
                      >
                        <Download className="w-4 h-4" />
                        Baixar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            {deletingId === content.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O conteúdo será permanentemente
                              excluído.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(content.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Contents;
