import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useBrandExamples, useAddBrandExample, useDeleteBrandExample, useUpdateBrandExample } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Image, X, Edit, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EXAMPLE_TYPES = [
  { value: "post", label: "Post" },
  { value: "story", label: "Story" },
  { value: "carousel", label: "Carrossel" },
];

const EXAMPLE_SUBTYPES = [
  { value: "cover", label: "Capa" },
  { value: "text_card", label: "Card de Texto" },
  { value: "bullets", label: "Bullets" },
  { value: "closing", label: "Fechamento" },
];

interface BrandExamplesProps {
  brandId: string;
  brandName: string;
  onAnalyzeStyle?: () => void;
  isAnalyzing?: boolean;
}

export default function BrandExamples({ brandId, brandName, onAnalyzeStyle, isAnalyzing }: BrandExamplesProps) {
  const { data: examples, isLoading } = useBrandExamples(brandId);
  const addExample = useAddBrandExample();
  const deleteExample = useDeleteBrandExample();
  const updateExample = useUpdateBrandExample();

  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [uploadType, setUploadType] = useState("post");
  const [uploadSubtype, setUploadSubtype] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog state
  const [editingExample, setEditingExample] = useState<any>(null);
  const [editType, setEditType] = useState("post");
  const [editSubtype, setEditSubtype] = useState<string>("");
  const [editDescription, setEditDescription] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são aceitas");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${brandId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("content-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("content-images")
        .getPublicUrl(fileName);

      await addExample.mutateAsync({
        brand_id: brandId,
        image_url: publicUrl,
        description: description || undefined,
        content_type: uploadType,
        type: uploadType,
        subtype: uploadSubtype || undefined,
      });

      setDescription("");
      setUploadSubtype("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remover este exemplo?")) {
      await deleteExample.mutateAsync({ id, brandId });
    }
  };

  const openEdit = (example: any) => {
    setEditingExample(example);
    setEditType(example.type || "post");
    setEditSubtype(example.subtype || "");
    setEditDescription(example.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingExample) return;
    await updateExample.mutateAsync({
      id: editingExample.id,
      brandId,
      type: editType,
      subtype: editSubtype || null,
      description: editDescription || null,
    });
    setEditingExample(null);
  };

  const typeLabel = (type: string) => EXAMPLE_TYPES.find((t) => t.value === type)?.label || type;
  const subtypeLabel = (subtype: string) => EXAMPLE_SUBTYPES.find((t) => t.value === subtype)?.label || subtype;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Exemplos de Referência</h3>
          <p className="text-xs text-muted-foreground">
            Imagens classificadas por formato para a IA se basear
          </p>
        </div>
        {onAnalyzeStyle && (
          <Button variant="outline" size="sm" onClick={onAnalyzeStyle} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Reanalisar Estilo
          </Button>
        )}
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Formato *</Label>
            <Select value={uploadType} onValueChange={setUploadType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXAMPLE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Papel do slide {uploadType === "carousel" ? "*" : "(opcional)"}</Label>
            <Select value={uploadSubtype} onValueChange={setUploadSubtype}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {EXAMPLE_SUBTYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Descrição do exemplo (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading || (uploadType === "carousel" && !uploadSubtype)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || (uploadType === "carousel" && (!uploadSubtype || uploadSubtype === "none"))}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Examples grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : examples && examples.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {examples.map((example: any) => (
            <div key={example.id} className="relative group aspect-square">
              <img
                src={example.image_url}
                alt={example.description || "Exemplo"}
                className="w-full h-full object-cover rounded-lg border border-border"
              />
              {/* Action buttons */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(example)}
                  className="w-6 h-6 bg-background/90 text-foreground rounded-full flex items-center justify-center border border-border"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(example.id)}
                  className="w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {/* Chips */}
              <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-background/80">
                  {typeLabel(example.type || example.content_type || "post")}
                </Badge>
                {example.subtype && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-background/80">
                    {subtypeLabel(example.subtype)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Nenhum exemplo ainda</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingExample} onOpenChange={(open) => { if (!open) setEditingExample(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Exemplo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Formato</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAMPLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Papel do slide</Label>
              <Select value={editSubtype || "none"} onValueChange={(v) => setEditSubtype(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {EXAMPLE_SUBTYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descrição do exemplo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={updateExample.isPending} size="sm">
              {updateExample.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
