import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useProjects, useBrands, useCreateProject, useQualityMetrics } from "@/hooks/useStudio";
import { Plus, Folder, TrendingUp, CheckCircle, Eye, Sparkles, Palette } from "lucide-react";

export default function Studio() {
  const navigate = useNavigate();
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { data: brands, isLoading: loadingBrands } = useBrands();
  const { data: metrics } = useQualityMetrics(30);
  const createProject = useCreateProject();
  
  const [newProject, setNewProject] = useState({ name: "", brand_id: "", description: "" });
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.brand_id) return;
    
    await createProject.mutateAsync(newProject);
    setNewProject({ name: "", brand_id: "", description: "" });
    setDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Studio</h1>
            <p className="text-muted-foreground">Geração de imagens de alta qualidade com IA</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/studio/brands")}>
              <Palette className="w-4 h-4 mr-2" />
              Brand Kit
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Projeto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Projeto</Label>
                    <Input 
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="Ex: Campanha Janeiro 2025"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Select 
                      value={newProject.brand_id}
                      onValueChange={(value) => setNewProject({ ...newProject, brand_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma marca" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands?.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(!brands || brands.length === 0) && !loadingBrands && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma marca encontrada. <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/studio/brands")}>Criar marca</Button>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição (opcional)</Label>
                    <Input 
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="Descrição breve do projeto"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleCreateProject} 
                    disabled={!newProject.name || !newProject.brand_id || createProject.isPending}
                  >
                    {createProject.isPending ? "Criando..." : "Criar Projeto"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.publishReadyRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Pronto p/ Publicar</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.avgAdherence || 0}</p>
                  <p className="text-sm text-muted-foreground">Aderência Média</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.avgLegibility || 0}</p>
                  <p className="text-sm text-muted-foreground">Legibilidade</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.avgPremium || 0}</p>
                  <p className="text-sm text-muted-foreground">Look Premium</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Projetos</h2>
          
          {loadingProjects ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/studio/project/${project.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Folder className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          {project.brand && (
                            <Badge variant="outline" className="mt-1">
                              {project.brand.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {project.description || "Sem descrição"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Criado em {new Date(project.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Folder className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum projeto ainda</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro projeto para começar a gerar imagens incríveis
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Projeto
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
