import SlideTemplateRenderer from "@/components/content/SlideTemplateRenderer";

interface TemplateSetPreviewProps {
  templateSet: {
    template_set: any;
    visual_signature?: any;
  };
  brand: {
    name: string;
    palette: any;
    fonts: any;
    visual_tone: string;
    logo_url: string | null;
  };
}

const PREVIEW_ROLES = ["cover", "content", "cta"] as const;
const MINI_W = 120;
const MINI_H = 150;
const RENDER_W = 1080;
const RENDER_H = 1350;
const SCALE = MINI_W / RENDER_W;

export default function TemplateSetPreview({ templateSet, brand }: TemplateSetPreviewProps) {
  const layoutParams = templateSet.template_set?.layout_params;
  if (!layoutParams) return null;

  const brandSnapshot = {
    name: brand.name,
    palette: brand.palette || [],
    fonts: brand.fonts || { headings: "Inter", body: "Inter" },
    visual_tone: brand.visual_tone || "clean",
    logo_url: brand.logo_url,
    layout_params: layoutParams,
  };

  const sampleSlides = PREVIEW_ROLES.map((role) => ({
    headline: role === "cover" ? "Título" : role === "cta" ? "CTA" : "Conteúdo",
    body: role === "cta" ? "Siga-nos" : "Texto de exemplo",
    role,
    bullets: role === "content" ? ["Item 1", "Item 2"] : undefined,
  }));

  // Only render roles that have layout_params
  const availableSlides = sampleSlides.filter(
    (s) => layoutParams[s.role] || layoutParams["content"]
  );

  if (availableSlides.length === 0) return null;

  return (
    <div className="flex gap-2 mt-2">
      {availableSlides.map((slide, i) => (
        <div
          key={slide.role}
          className="rounded-md overflow-hidden border border-border/50 shadow-sm"
          style={{ width: MINI_W, height: MINI_H }}
        >
          <div
            style={{
              width: RENDER_W,
              height: RENDER_H,
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
          >
            <SlideTemplateRenderer
              slide={slide as any}
              slideIndex={i}
              totalSlides={availableSlides.length}
              brand={brandSnapshot}
              template="parameterized"
              dimensions={{ width: RENDER_W, height: RENDER_H }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
