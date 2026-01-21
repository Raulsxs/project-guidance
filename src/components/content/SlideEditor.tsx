import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Edit2, Image, Wand2, Check, X } from "lucide-react";

interface Slide {
  headline: string;
  body: string;
  imagePrompt: string;
  previewImage?: string;
}

interface SlideEditorProps {
  slides: Slide[];
  currentSlide: number;
  editingSlide: number | null;
  onSlideClick: (index: number) => void;
  onEditSlide: (index: number) => void;
  onSaveEdit: (index: number, headline: string, body: string, imagePrompt: string) => void;
  onCancelEdit: () => void;
  onGeneratePreview: (index: number) => void;
  generatingPreview: boolean;
}

const SlideEditor = ({
  slides,
  currentSlide,
  editingSlide,
  onSlideClick,
  onEditSlide,
  onSaveEdit,
  onCancelEdit,
  onGeneratePreview,
  generatingPreview,
}: SlideEditorProps) => {
  const [editHeadline, setEditHeadline] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editImagePrompt, setEditImagePrompt] = useState("");

  const handleStartEdit = (index: number) => {
    setEditHeadline(slides[index].headline);
    setEditBody(slides[index].body);
    setEditImagePrompt(slides[index].imagePrompt);
    onEditSlide(index);
  };

  const handleSave = (index: number) => {
    onSaveEdit(index, editHeadline, editBody, editImagePrompt);
  };

  const getSlideLabel = (index: number) => {
    if (index === 0) return "Capa";
    if (index === slides.length - 1) return "CTA";
    return `Slide ${index + 1}`;
  };

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
      {slides.map((slide, index) => (
        <Card
          key={index}
          className={cn(
            "shadow-card border-border/50 transition-all cursor-pointer group",
            currentSlide === index && "ring-2 ring-primary shadow-lg"
          )}
          onClick={() => onSlideClick(index)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={index === 0 ? "default" : index === slides.length - 1 ? "secondary" : "outline"} 
                  className="text-xs"
                >
                  {getSlideLabel(index)}
                </Badge>
                {slide.previewImage && (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                    <Image className="w-3 h-3 mr-1" />
                    Preview
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGeneratePreview(index);
                  }}
                  disabled={generatingPreview}
                >
                  <Wand2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(index);
                  }}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {editingSlide === index ? (
              <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <Input
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    className="text-sm font-medium"
                    placeholder="Título do slide"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Texto</Label>
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="text-sm"
                    rows={2}
                    placeholder="Texto do slide"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Prompt da Imagem (IA)</Label>
                  <Textarea
                    value={editImagePrompt}
                    onChange={(e) => setEditImagePrompt(e.target.value)}
                    className="text-sm text-muted-foreground"
                    rows={2}
                    placeholder="Descreva a imagem que a IA deve gerar..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(index)}
                    className="gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancelEdit}
                    className="gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-medium text-foreground text-sm line-clamp-1">
                  {slide.headline}
                </p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {slide.body}
                </p>
                {slide.imagePrompt && (
                  <p className="text-xs text-muted-foreground/60 mt-2 line-clamp-1 italic">
                    🎨 {slide.imagePrompt.substring(0, 60)}...
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SlideEditor;
