import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, Star, StarOff, Edit, Trash2, Square, Smartphone, Layers } from "lucide-react";

interface TemplateSetsProps {
  brandId: string;
  brandName: string;
  defaultTemplateSetId: string | null;
}

interface TemplateSet {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  status: string;
  source_example_ids: string[];
  template_set: {
    id_hint?: string;
    formats?: Record<string, unknown>;
    notes?: string[];
  };
  created_at: string;
  updated_at: string;
}

function useTemplateSets(brandId: string) {
  return useQuery({
    queryKey: ["template-sets", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_template_sets")
        .select("*")
        .eq("brand_id", brandId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as TemplateSet[];
    },
    enabled: !!brandId,
  });
}

export default function TemplateSetsSection({ brandId, brandName, defaultTemplateSetId }: TemplateSetsProps) {
  const queryClient = useQueryClient();
  const { data: templateSets, isLoading } = useTemplateSets(brandId);
  const [generating, setGenerating] = useState(false);
  const [editingSet, setEditingSet] = useState<TemplateSet | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-template-sets", {
        body: { brandId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.count} Template Set(s) criado(s)!`);
      queryClient.invalidateQueries({ queryKey: ["template-sets", brandId] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSetDefault = async (setId: string) => {
    const { error } = await supabase
      .from("brands")
      .update({ default_template_set_id: setId } as any)
      .eq("id", brandId);
    if (error) {
      toast.error("Erro ao definir padrão");
    } else {
      toast.success("Template padrão atualizado!");
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
  };

  const handleDelete = async (setId: string) => {
    if (!confirm("Excluir este Template Set?")) return;
    const { error } = await supabase
      .from("brand_template_sets")
      .delete()
      .eq("id", setId);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Template Set excluído");
      queryClient.invalidateQueries({ queryKey: ["template-sets", brandId] });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSet) return;
    const { error } = await supabase
      .from("brand_template_sets")
      .update({ name: editName, description: editDesc || null })
      .eq("id", editingSet.id);
    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      toast.success("Atualizado!");
      queryClient.invalidateQueries({ queryKey: ["template-sets", brandId] });
      setEditingSet(null);
    }
  };

  const openEdit = (ts: TemplateSet) => {
    setEditingSet(ts);
    setEditName(ts.name);
    setEditDesc(ts.description || "");
  };

  const getFormatIcons = (formats: Record<string, unknown> | undefined) => {
    if (!formats) return [];
    const icons = [];
    if (formats.post) icons.push({ key: "post", label: "Post", Icon: Square });
    if (formats.story) icons.push({ key: "story", label: "Story", Icon: Smartphone });
    if (formats.carousel) icons.push({ key: "carousel", label: "Carrossel", Icon: Layers });
    return icons;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Template Sets</h3>
          <p className="text-xs text-muted-foreground">
            Templates gerados automaticamente a partir dos exemplos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Gerar Template Sets
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : templateSets && templateSets.length > 0 ? (
        <div className="space-y-2">
          {templateSets.map((ts) => {
            const isDefault = defaultTemplateSetId === ts.id;
            const formats = getFormatIcons(ts.template_set?.formats as Record<string, unknown> | undefined);
            return (
              <div
                key={ts.id}
                className={`border rounded-lg p-3 space-y-2 ${
                  isDefault ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{ts.name}</h4>
                    {isDefault && (
                      <Badge variant="default" className="text-[10px]">Padrão</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">{ts.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDefault && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSetDefault(ts.id)} title="Definir como padrão">
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ts)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(ts.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {ts.description && (
                  <p className="text-xs text-muted-foreground">{ts.description}</p>
                )}
                <div className="flex items-center gap-2">
                  {formats.map(({ key, label, Icon }) => (
                    <Badge key={key} variant="outline" className="text-[10px] gap-1">
                      <Icon className="w-3 h-3" />
                      {label}
                    </Badge>
                  ))}
                </div>
                {ts.template_set?.notes && (ts.template_set.notes as string[]).length > 0 && (
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {(ts.template_set.notes as string[]).map((note, i) => (
                      <p key={i}>• {note}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Nenhum Template Set criado</p>
          <p className="text-[10px] mt-1">Faça upload de exemplos e clique em "Gerar Template Sets"</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSet} onOpenChange={(open) => { if (!open) setEditingSet(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Template Set</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} size="sm">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
