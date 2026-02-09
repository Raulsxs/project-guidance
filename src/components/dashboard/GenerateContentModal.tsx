import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Trend } from "./TrendCard";
import { 
  Square, 
  Smartphone, 
  Layers, 
  Sparkles,
  Loader2,
  Newspaper,
  Quote,
  Lightbulb,
  GraduationCap,
  HelpCircle,
  Wand2,
  Palette
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface GenerateContentModalProps {
  trend: Trend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (trendId: string, format: string, contentStyle: string, brandId: string | null) => void;
  isGenerating: boolean;
}

const formats = [
  {
    id: "post",
    name: "Post",
    description: "Imagem única 1080x1350px",
    icon: Square,
    dimensions: "1080 × 1350",
  },
  {
    id: "story",
    name: "Story",
    description: "Formato vertical 1080x1920px",
    icon: Smartphone,
    dimensions: "1080 × 1920",
  },
  {
    id: "carousel",
    name: "Carrossel",
    description: "5 slides 1080x1350px cada",
    icon: Layers,
    dimensions: "5 × 1080 × 1350",
  },
];

const contentStyles = [
  {
    id: "news",
    name: "Notícia",
    description: "Informativo sobre a tendência",
    icon: Newspaper,
    example: "Nova regulamentação da ANS entra em vigor...",
    color: "bg-blue-500",
  },
  {
    id: "quote",
    name: "Frase",
    description: "Motivacional ou reflexiva, sem CTA",
    icon: Quote,
    example: "Liderança em saúde é sobre pessoas",
    color: "bg-purple-500",
  },
  {
    id: "tip",
    name: "Dica Rápida",
    description: "Conselho prático e direto",
    icon: Lightbulb,
    example: "3 formas de reduzir custos operacionais",
    color: "bg-amber-500",
  },
  {
    id: "educational",
    name: "Educativo",
    description: "Explicação simples de conceito",
    icon: GraduationCap,
    example: "O que é acreditação hospitalar?",
    color: "bg-emerald-500",
  },
  {
    id: "curiosity",
    name: "Curiosidade",
    description: "Fato interessante para engajar",
    icon: HelpCircle,
    example: "Você sabia que 70% dos hospitais...",
    color: "bg-rose-500",
  },
];

const getSuggestedStyle = (theme: string, title: string): string => {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes("dica") || titleLower.includes("como") || titleLower.includes("formas de")) {
    return "tip";
  }
  if (titleLower.includes("o que é") || titleLower.includes("entenda") || titleLower.includes("guia")) {
    return "educational";
  }
  if (titleLower.includes("você sabia") || titleLower.includes("curiosidade") || titleLower.includes("%")) {
    return "curiosity";
  }
  if (titleLower.includes("frase") || titleLower.includes("reflexão") || titleLower.includes("inspiração")) {
    return "quote";
  }
  
  const themeMap: Record<string, string> = {
    "Gestão": "tip",
    "Tecnologia": "news",
    "Legislação": "news",
    "Inovação": "curiosity",
    "Qualidade": "educational",
  };
  
  return themeMap[theme] || "news";
};

interface BrandOption {
  id: string;
  name: string;
  visual_tone: string | null;
  palette: unknown;
}

const GenerateContentModal = ({
  trend,
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: GenerateContentModalProps) => {
  const [selectedFormat, setSelectedFormat] = useState("carousel");
  const [selectedStyle, setSelectedStyle] = useState("news");
  const [suggestedStyle, setSuggestedStyle] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("ai");
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Fetch user brands when modal opens
  useEffect(() => {
    if (open) {
      const fetchBrands = async () => {
        setLoadingBrands(true);
        try {
          const { data, error } = await supabase
            .from("brands")
            .select("id, name, visual_tone, palette")
            .order("name");
          if (!error && data) {
            setBrands(data);
          }
        } catch (e) {
          console.error("Error fetching brands:", e);
        } finally {
          setLoadingBrands(false);
        }
      };
      fetchBrands();
    }
  }, [open]);

  useEffect(() => {
    if (trend) {
      const suggested = getSuggestedStyle(trend.theme, trend.title);
      setSuggestedStyle(suggested);
      setSelectedStyle(suggested);
    }
  }, [trend]);

  const handleGenerate = () => {
    if (trend) {
      onGenerate(trend.id, selectedFormat, selectedStyle, selectedBrand === "ai" ? null : selectedBrand);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Gerar Conteúdo
          </DialogTitle>
          <DialogDescription>
            A IA irá criar o conteúdo no estilo e formato escolhidos.
          </DialogDescription>
        </DialogHeader>

        {trend && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {trend.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {trend.source} • {trend.theme}
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Brand Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Identidade Visual</Label>
              <Palette className="w-4 h-4 text-muted-foreground" />
            </div>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Deixar a IA decidir</span>
                  </div>
                </SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      <span>{brand.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingBrands && brands.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma marca cadastrada. As imagens serão geradas com estilo padrão da IA.
              </p>
            )}
            {selectedBrand !== "ai" && (
              <p className="text-xs text-muted-foreground">
                As imagens seguirão a paleta, tom visual e regras da marca selecionada.
              </p>
            )}
          </div>

          {/* Content Style Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Estilo do Conteúdo</Label>
              <Wand2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <RadioGroup
              value={selectedStyle}
              onValueChange={setSelectedStyle}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {contentStyles.map((style) => (
                <Label
                  key={style.id}
                  htmlFor={`style-${style.id}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    selectedStyle === style.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={style.id} id={`style-${style.id}`} className="sr-only" />
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    selectedStyle === style.id ? style.color + " text-white" : "bg-muted text-muted-foreground"
                  )}>
                    <style.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm">{style.name}</p>
                      {suggestedStyle === style.id && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Sugerido
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{style.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
            
            <div className="bg-muted/30 rounded-lg p-3 border border-dashed border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Exemplo:</span>{" "}
                <span className="italic">
                  "{contentStyles.find(s => s.id === selectedStyle)?.example}"
                </span>
              </p>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Formato do Conteúdo</Label>
            <RadioGroup
              value={selectedFormat}
              onValueChange={setSelectedFormat}
              className="grid gap-2"
            >
              {formats.map((format) => (
                <Label
                  key={format.id}
                  htmlFor={format.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    selectedFormat === format.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={format.id} id={format.id} className="sr-only" />
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    selectedFormat === format.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <format.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{format.name}</p>
                    <p className="text-xs text-muted-foreground">{format.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {format.dimensions}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando conteúdo...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar Conteúdo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateContentModal;
