import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrandExamples, useAddBrandExample, useDeleteBrandExample } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Upload, Image, X } from "lucide-react";
import { toast } from "sonner";

interface BrandExamplesProps {
  brandId: string;
  brandName: string;
}

export default function BrandExamples({ brandId, brandName }: BrandExamplesProps) {
  const { data: examples, isLoading } = useBrandExamples(brandId);
  const addExample = useAddBrandExample();
  const deleteExample = useDeleteBrandExample();
  
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são aceitas');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${brandId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('content-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content-images')
        .getPublicUrl(fileName);

      await addExample.mutateAsync({
        brand_id: brandId,
        image_url: publicUrl,
        description: description || undefined
      });

      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remover este exemplo?')) {
      await deleteExample.mutateAsync({ id, brandId });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Exemplos de Referência</h3>
          <p className="text-xs text-muted-foreground">
            Imagens de referência para a IA se basear ao gerar conteúdo
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-3">
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
            disabled={uploading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
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
        <p className="text-xs text-muted-foreground text-center">
          Arraste imagens ou clique para fazer upload de exemplos de conteúdo
        </p>
      </div>

      {/* Examples grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : examples && examples.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {examples.map((example) => (
            <div key={example.id} className="relative group aspect-square">
              <img
                src={example.image_url}
                alt={example.description || 'Exemplo'}
                className="w-full h-full object-cover rounded-lg border border-border"
              />
              <button
                onClick={() => handleDelete(example.id)}
                className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
              {example.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                  {example.description}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Nenhum exemplo ainda</p>
        </div>
      )}
    </div>
  );
}
