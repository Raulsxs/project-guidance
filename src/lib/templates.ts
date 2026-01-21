export type TemplateStyle = "minimal" | "bold" | "elegant" | "corporate";

export interface TemplateConfig {
  id: TemplateStyle;
  name: string;
  description: string;
  coverBg: string;
  contentBg: string;
  ctaBg: string;
  textColor: string;
  accentColor: string;
  fontStyle: string;
  overlayOpacity: number;
}

export const templates: Record<TemplateStyle, TemplateConfig> = {
  minimal: {
    id: "minimal",
    name: "Minimalista",
    description: "Clean e moderno",
    coverBg: "from-slate-900 to-slate-800",
    contentBg: "from-white to-slate-50",
    ctaBg: "from-primary to-primary/90",
    textColor: "text-white",
    accentColor: "text-primary",
    fontStyle: "font-light tracking-wide",
    overlayOpacity: 0.4,
  },
  bold: {
    id: "bold",
    name: "Bold",
    description: "Impactante e vibrante",
    coverBg: "from-violet-600 via-purple-600 to-fuchsia-600",
    contentBg: "from-violet-950 to-purple-950",
    ctaBg: "from-amber-500 to-orange-500",
    textColor: "text-white",
    accentColor: "text-amber-400",
    fontStyle: "font-black uppercase tracking-tight",
    overlayOpacity: 0.5,
  },
  elegant: {
    id: "elegant",
    name: "Elegante",
    description: "Sofisticado e premium",
    coverBg: "from-stone-900 via-stone-800 to-stone-900",
    contentBg: "from-stone-100 to-stone-200",
    ctaBg: "from-amber-700 to-amber-800",
    textColor: "text-white",
    accentColor: "text-amber-500",
    fontStyle: "font-serif italic",
    overlayOpacity: 0.35,
  },
  corporate: {
    id: "corporate",
    name: "Corporativo",
    description: "Profissional para saúde",
    coverBg: "from-sky-700 via-blue-700 to-indigo-800",
    contentBg: "from-sky-50 to-blue-50",
    ctaBg: "from-teal-600 to-emerald-600",
    textColor: "text-white",
    accentColor: "text-sky-600",
    fontStyle: "font-semibold",
    overlayOpacity: 0.45,
  },
};

export const getTemplateForSlide = (
  template: TemplateConfig,
  slideIndex: number,
  totalSlides: number
): { bg: string; text: string; overlay: number } => {
  if (slideIndex === 0) {
    return { bg: template.coverBg, text: template.textColor, overlay: template.overlayOpacity };
  }
  if (slideIndex === totalSlides - 1) {
    return { bg: template.ctaBg, text: "text-white", overlay: template.overlayOpacity };
  }
  return { bg: template.contentBg, text: "text-foreground", overlay: 0.1 };
};
