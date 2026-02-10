import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import type { StyleGuide } from "@/types/studio";

// ══════ TYPES ══════

interface SlideData {
  headline: string;
  body: string;
  imagePrompt?: string;
  illustrationPrompt?: string;
  previewImage?: string;
  templateHint?: string;
  template?: string;
  role?: string;
  bullets?: string[];
}

interface BrandSnapshot {
  name: string;
  palette: { name: string; hex: string }[] | string[];
  fonts: { headings: string; body: string };
  visual_tone: string;
  logo_url: string | null;
  style_guide?: StyleGuide | null;
}

interface SlideTemplateRendererProps {
  slide: SlideData;
  slideIndex: number;
  totalSlides: number;
  brand: BrandSnapshot;
  template?: string;
  dimensions?: { width: number; height: number };
}

// ══════ HELPERS ══════

function getHex(palette: BrandSnapshot["palette"], index: number, fallback: string): string {
  if (!palette || !palette[index]) return fallback;
  const item = palette[index];
  if (typeof item === "string") return item;
  return item.hex || fallback;
}

const WaveSVG = ({ color, position, height = "18%" }: { color: string; position: "bottom" | "top"; height?: string }) => (
  <svg
    viewBox="0 0 1080 200"
    preserveAspectRatio="none"
    style={{
      position: "absolute",
      [position]: 0,
      left: 0,
      width: "100%",
      height,
      transform: position === "top" ? "rotate(180deg)" : undefined,
    }}
  >
    <path d="M0,80 C180,20 360,140 540,80 C720,20 900,140 1080,80 L1080,200 L0,200 Z" fill={color} />
  </svg>
);

function SlideBadge({ slideIndex, totalSlides, dark }: { slideIndex: number; totalSlides: number; dark: string }) {
  const label = slideIndex === 0 ? "CAPA" : slideIndex === totalSlides - 1 ? "CTA" : `${slideIndex + 1}/${totalSlides}`;
  return (
    <div style={{
      position: "absolute", top: 40, right: 40,
      backgroundColor: dark, color: "#fff",
      padding: "8px 20px", borderRadius: 20,
      fontSize: 18, fontWeight: 600, zIndex: 3,
    }}>
      {label}
    </div>
  );
}

function LogoWatermark({ logoUrl }: { logoUrl: string | null }) {
  if (!logoUrl) return null;
  return (
    <img
      src={logoUrl}
      alt="Logo"
      style={{
        position: "absolute", bottom: 40, left: "50%",
        transform: "translateX(-50%)", height: 48,
        objectFit: "contain", zIndex: 3,
      }}
    />
  );
}

function AccentBar({ color, style }: { color: string; style?: React.CSSProperties }) {
  return <div style={{ width: 60, height: 6, backgroundColor: color, borderRadius: 3, ...style }} />;
}

// ══════ TEMPLATES ══════

// 1. Wave Cover (capa / closing)
const WaveCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <WaveSVG color="#ffffff" position="bottom" height="20%" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 60px", zIndex: 2 }}>
        <AccentBar color={accent} style={{ marginBottom: 32 }} />
        <h1 style={{ color: dark, fontSize: 64, fontWeight: 800, lineHeight: 1.15, marginBottom: 24, letterSpacing: "-0.02em" }}>
          {slide.headline}
        </h1>
        <p style={{ color: dark, fontSize: 32, fontWeight: 400, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>
          {slide.body}
        </p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} dark={dark} />
      <LogoWatermark logoUrl={brand.logo_url} />
    </div>
  );
};

// 2. Wave Text Card (context / insight text)
const WaveTextCardTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const cardBg = getHex(brand.palette, 3, "#f5eaee");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <WaveSVG color="#ffffff" position="bottom" />
      <div style={{ backgroundColor: "#ffffff", borderRadius: 24, padding: "48px 40px", margin: "0 48px", maxWidth: "85%", border: `3px solid ${cardBg}`, boxShadow: "0 8px 32px rgba(0,0,0,0.08)", zIndex: 2, textAlign: "center" }}>
        <AccentBar color={accent} style={{ margin: "0 auto 28px", width: 48, height: 4 }} />
        <h2 style={{ color: dark, fontSize: 48, fontWeight: 700, lineHeight: 1.25, marginBottom: 20 }}>{slide.headline}</h2>
        <p style={{ color: dark, fontSize: 28, fontWeight: 400, lineHeight: 1.6, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} dark={dark} />
      <LogoWatermark logoUrl={brand.logo_url} />
    </div>
  );
};

// 3. Wave Bullets (insight with list)
const WaveBulletsTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const bullets = slide.bullets || [];

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      <WaveSVG color="#ffffff" position="bottom" height="15%" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 60px", zIndex: 2 }}>
        <AccentBar color={accent} style={{ marginBottom: 24 }} />
        <h2 style={{ color: dark, fontSize: 52, fontWeight: 800, lineHeight: 1.2, marginBottom: 32 }}>{slide.headline}</h2>
        {bullets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {bullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <p style={{ color: dark, fontSize: 28, lineHeight: 1.5, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{bullet}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: dark, fontSize: 28, lineHeight: 1.6, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        )}
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} dark={dark} />
      <LogoWatermark logoUrl={brand.logo_url} />
    </div>
  );
};

// 4. Wave Closing (CTA slide)
const WaveClosingTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 1, "#10559a"); // Dark bg for closing
  const light = getHex(brand.palette, 0, "#a4d3eb");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <WaveSVG color={light} position="bottom" height="20%" />
      <div style={{ zIndex: 2, padding: "60px", maxWidth: "85%" }}>
        <AccentBar color={accent} style={{ margin: "0 auto 32px", width: 60 }} />
        <h2 style={{ color: "#ffffff", fontSize: 56, fontWeight: 800, lineHeight: 1.2, marginBottom: 24 }}>{slide.headline}</h2>
        <p style={{ color: "#ffffff", fontSize: 30, fontWeight: 400, lineHeight: 1.5, opacity: 0.85, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} dark="#ffffff33" />
      <LogoWatermark logoUrl={brand.logo_url} />
    </div>
  );
};

// 5. Story Cover (1080x1920)
const StoryCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.2 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <WaveSVG color="#ffffff" position="bottom" height="15%" />
      {/* Safe area: top 14%, bottom 10% */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "270px 60px 192px", zIndex: 2 }}>
        <AccentBar color={accent} style={{ marginBottom: 40 }} />
        <h1 style={{ color: dark, fontSize: 72, fontWeight: 900, lineHeight: 1.1, marginBottom: 32, letterSpacing: "-0.02em" }}>{slide.headline}</h1>
        <p style={{ color: dark, fontSize: 36, fontWeight: 400, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <LogoWatermark logoUrl={brand.logo_url} />
    </div>
  );
};

// 6. Story Tip (1080x1920 with card)
const StoryTipTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <WaveSVG color="#ffffff" position="bottom" height="12%" />
      <div style={{ backgroundColor: "#ffffff", borderRadius: 32, padding: "56px 48px", margin: "0 48px", maxWidth: "88%", boxShadow: "0 12px 40px rgba(0,0,0,0.1)", zIndex: 2, textAlign: "center" }}>
        <AccentBar color={accent} style={{ margin: "0 auto 32px", width: 48, height: 5 }} />
        <h2 style={{ color: dark, fontSize: 56, fontWeight: 700, lineHeight: 1.2, marginBottom: 24 }}>{slide.headline}</h2>
        <p style={{ color: dark, fontSize: 32, fontWeight: 400, lineHeight: 1.5, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <LogoWatermark logoUrl={brand.logo_url} />
    </div>
  );
};

// 7. Generic Free (no brand identity)
const GenericFreeTemplate = ({ slide, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;

  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", position: "relative", overflow: "hidden", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
        </div>
      )}
      <div style={{ zIndex: 2, padding: "60px", maxWidth: "90%" }}>
        <h1 style={{ color: "#ffffff", fontSize: 56, fontWeight: 800, lineHeight: 1.2, marginBottom: 24, textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>{slide.headline}</h1>
        <p style={{ color: "#ffffff", fontSize: 28, fontWeight: 400, lineHeight: 1.6, opacity: 0.9, textShadow: "0 1px 5px rgba(0,0,0,0.2)" }}>{slide.body}</p>
      </div>
      {totalSlides > 1 && (
        <div style={{ position: "absolute", top: 40, right: 40, backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", padding: "8px 20px", borderRadius: 20, fontSize: 18, fontWeight: 600 }}>
          {`${slideIndex + 1}/${totalSlides}`}
        </div>
      )}
    </div>
  );
};

// ══════ TEMPLATE MAP ══════

const TemplateMap: Record<string, React.FC<SlideTemplateRendererProps>> = {
  wave_cover: WaveCoverTemplate,
  wave_text_card: WaveTextCardTemplate,
  wave_bullets: WaveBulletsTemplate,
  wave_closing: WaveClosingTemplate,
  story_cover: StoryCoverTemplate,
  story_tip: StoryTipTemplate,
  generic_free: GenericFreeTemplate,
  solid_cover: WaveCoverTemplate, // fallback alias
};

export function getTemplateForSlide(slideIndex: number, totalSlides: number, styleGuide?: StyleGuide | null): string {
  const recommended = styleGuide?.recommended_templates || ["wave_cover", "wave_text_card"];
  if (slideIndex === 0) return recommended[0] || "wave_cover";
  if (slideIndex === totalSlides - 1) return recommended[recommended.length > 2 ? recommended.length - 1 : 0] || "wave_closing";
  return recommended[1] || "wave_text_card";
}

// ══════ MAIN RENDERER ══════

const SlideTemplateRenderer = (props: SlideTemplateRendererProps) => {
  const templateName = props.template || props.slide.templateHint || props.slide.template || getTemplateForSlide(props.slideIndex, props.totalSlides, props.brand.style_guide);
  const Component = TemplateMap[templateName] || WaveCoverTemplate;
  return <Component {...props} />;
};

// ══════ EXPORT TO PNG ══════

export function useExportSlide() {
  const ref = useRef<HTMLDivElement>(null);

  const exportToPng = useCallback(async (
    node: HTMLElement,
    opts?: { width?: number; height?: number }
  ): Promise<string> => {
    const dataUrl = await toPng(node, {
      width: opts?.width || 1080,
      height: opts?.height || 1350,
      pixelRatio: 1,
      quality: 0.95,
      cacheBust: true,
    });
    return dataUrl;
  }, []);

  return { ref, exportToPng };
}

export default SlideTemplateRenderer;
