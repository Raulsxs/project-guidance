export type TemplateStyle = "editorial" | "magazine" | "clinical" | "modern";

export interface TemplateConfig {
  id: TemplateStyle;
  name: string;
  description: string;
  // Overlay styles
  overlayStyle: string;
  overlayGradient: string;
  // Typography
  headlineStyle: string;
  bodyStyle: string;
  // Accent elements
  accentColor: string;
  accentBg: string;
  // Decorative
  hasFrame: boolean;
  frameStyle?: string;
  badgeStyle: string;
}

export const templates: Record<TemplateStyle, TemplateConfig> = {
  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "Estilo revista premium",
    overlayStyle: "bg-gradient-to-t from-black/90 via-black/50 to-transparent",
    overlayGradient: "from-black/90 via-black/40 to-black/20",
    headlineStyle: "font-serif text-2xl font-bold tracking-tight leading-tight",
    bodyStyle: "font-sans text-sm font-light tracking-wide leading-relaxed",
    accentColor: "text-amber-400",
    accentBg: "bg-amber-400",
    hasFrame: true,
    frameStyle: "border-2 border-white/20",
    badgeStyle: "bg-white/10 backdrop-blur-md border border-white/20",
  },
  magazine: {
    id: "magazine",
    name: "Magazine",
    description: "Layout bold de revista",
    overlayStyle: "bg-gradient-to-br from-violet-900/80 via-purple-900/60 to-fuchsia-900/80",
    overlayGradient: "from-violet-900/80 via-transparent to-fuchsia-900/70",
    headlineStyle: "font-black text-3xl uppercase tracking-tighter leading-none",
    bodyStyle: "font-medium text-sm tracking-wide leading-relaxed",
    accentColor: "text-fuchsia-400",
    accentBg: "bg-fuchsia-500",
    hasFrame: false,
    badgeStyle: "bg-fuchsia-500/80 backdrop-blur-sm",
  },
  clinical: {
    id: "clinical",
    name: "Clínico",
    description: "Profissional de saúde",
    overlayStyle: "bg-gradient-to-t from-slate-900/95 via-slate-800/60 to-slate-700/30",
    overlayGradient: "from-slate-900/90 via-slate-800/50 to-transparent",
    headlineStyle: "font-semibold text-2xl tracking-tight leading-tight",
    bodyStyle: "font-normal text-sm tracking-normal leading-relaxed",
    accentColor: "text-teal-400",
    accentBg: "bg-teal-500",
    hasFrame: true,
    frameStyle: "border border-teal-500/30",
    badgeStyle: "bg-teal-500/20 backdrop-blur-md border border-teal-500/30",
  },
  modern: {
    id: "modern",
    name: "Moderno",
    description: "Clean e minimalista",
    overlayStyle: "bg-gradient-to-t from-zinc-950/95 via-zinc-900/70 to-zinc-800/40",
    overlayGradient: "from-zinc-950/90 via-zinc-900/50 to-transparent",
    headlineStyle: "font-light text-2xl tracking-wide leading-snug",
    bodyStyle: "font-extralight text-sm tracking-widest leading-relaxed uppercase",
    accentColor: "text-sky-400",
    accentBg: "bg-sky-500",
    hasFrame: false,
    badgeStyle: "bg-white/5 backdrop-blur-lg border border-white/10",
  },
};
