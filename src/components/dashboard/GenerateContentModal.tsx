import { useState } from "react";
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
  Loader2
} from "lucide-react";

interface GenerateContentModalProps {
  trend: Trend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (trendId: string, format: string) => void;
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

const GenerateContentModal = ({
  trend,
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: GenerateContentModalProps) => {
  const [selectedFormat, setSelectedFormat] = useState("carousel");

  const handleGenerate = () => {
    if (trend) {
      onGenerate(trend.id, selectedFormat);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Gerar Conteúdo
          </DialogTitle>
          <DialogDescription>
            Escolha o formato do conteúdo que deseja criar para esta tendência.
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

        <div className="space-y-4">
          <Label className="text-sm font-medium">Formato do Conteúdo</Label>
          <RadioGroup
            value={selectedFormat}
            onValueChange={setSelectedFormat}
            className="grid gap-3"
          >
            {formats.map((format) => (
              <Label
                key={format.id}
                htmlFor={format.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  selectedFormat === format.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value={format.id} id={format.id} className="sr-only" />
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center",
                  selectedFormat === format.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <format.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{format.name}</p>
                  <p className="text-sm text-muted-foreground">{format.description}</p>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {format.dimensions}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
                Gerando...
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
