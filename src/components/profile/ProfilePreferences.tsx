import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette, Globe, Tags, Rss, Instagram, Linkedin, X } from "lucide-react";
import { useState } from "react";

interface ProfilePreferencesProps {
  nativeLanguage: string;
  secondaryLanguages: string[];
  preferredTone: string;
  preferredAudience: string;
  interestAreas: string[];
  rssSources: string[];
  onChange: (field: string, value: any) => void;
}

const TONE_OPTIONS = [
  { value: "profissional", label: "Profissional" },
  { value: "educativo", label: "Educativo" },
  { value: "inspirador", label: "Inspirador" },
  { value: "informal", label: "Informal" },
  { value: "técnico", label: "Técnico" },
];

const AUDIENCE_OPTIONS = [
  { value: "gestores", label: "Gestores de Saúde" },
  { value: "medicos", label: "Médicos" },
  { value: "enfermeiros", label: "Enfermeiros" },
  { value: "pacientes", label: "Pacientes" },
  { value: "estudantes", label: "Estudantes" },
  { value: "geral", label: "Público Geral" },
];

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "en-US", label: "English (US)" },
  { value: "es", label: "Español" },
];

const ProfilePreferences = ({
  nativeLanguage, secondaryLanguages, preferredTone, preferredAudience,
  interestAreas, rssSources, onChange,
}: ProfilePreferencesProps) => {
  const [newTag, setNewTag] = useState("");
  const [newRss, setNewRss] = useState("");

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !interestAreas.includes(tag)) {
      onChange("interest_areas", [...interestAreas, tag]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    onChange("interest_areas", interestAreas.filter(t => t !== tag));
  };

  const addRss = () => {
    const url = newRss.trim();
    if (url && !rssSources.includes(url)) {
      onChange("rss_sources", [...rssSources, url]);
      setNewRss("");
    }
  };

  const removeRss = (url: string) => {
    onChange("rss_sources", rssSources.filter(u => u !== url));
  };

  return (
    <>
      {/* Language & Tone */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Preferências de Conteúdo
          </CardTitle>
          <CardDescription>Configure idioma, tom e público-alvo padrão para geração de conteúdo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="native_language">
                <Globe className="w-4 h-4 inline mr-1" />
                Idioma Nativo
              </Label>
              <Select value={nativeLanguage} onValueChange={(v) => onChange("native_language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tom de Voz Padrão</Label>
              <Select value={preferredTone} onValueChange={(v) => onChange("preferred_tone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Público-Alvo Padrão</Label>
              <Select value={preferredAudience} onValueChange={(v) => onChange("preferred_audience", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interest Areas */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tags className="w-5 h-5 text-primary" />
            Áreas de Interesse
          </CardTitle>
          <CardDescription>Tags que influenciam a busca de tendências e geração de conteúdo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {interestAreas.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Ex: cardiologia, gestão hospitalar..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              className="flex-1"
            />
            <button type="button" onClick={addTag} className="px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Adicionar
            </button>
          </div>
        </CardContent>
      </Card>

      {/* RSS Sources */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Rss className="w-5 h-5 text-primary" />
            Fontes de Conteúdo (RSS/URLs)
          </CardTitle>
          <CardDescription>URLs de blogs, portais e feeds para busca automática de tendências</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rssSources.length > 0 && (
            <div className="space-y-2">
              {rssSources.map(url => (
                <div key={url} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                  <span className="flex-1 truncate text-muted-foreground">{url}</span>
                  <button onClick={() => removeRss(url)} className="hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newRss}
              onChange={(e) => setNewRss(e.target.value)}
              placeholder="https://exemplo.com/feed"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRss())}
              className="flex-1"
            />
            <button type="button" onClick={addRss} className="px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Adicionar
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Future Connections (placeholder) */}
      <Card className="shadow-card border-border/50 opacity-60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Conexões
            <Badge variant="outline" className="text-xs">Em breve</Badge>
          </CardTitle>
          <CardDescription>Conecte suas redes sociais para publicação automática</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
              <Instagram className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Instagram</p>
                <p className="text-xs text-muted-foreground">Não conectado</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
              <Linkedin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">LinkedIn</p>
                <p className="text-xs text-muted-foreground">Não conectado</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ProfilePreferences;
