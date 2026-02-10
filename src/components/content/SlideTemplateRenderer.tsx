import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import type { StyleGuide } from "@/types/studio";

interface SlideData {
  headline: string;
  body: string;
  imagePrompt: string;
  previewImage?: string;
  templateHint?: string;
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
  template?: string; // "wave_cover" | "wave_text_card" | "solid_cover"
  dimensions?: { width: number; height: number };
}

// Extract hex from palette (supports both string[] and {hex}[])
function getHex(palette: BrandSnapshot["palette"], index: number, fallback: string): string {
  if (!palette || !palette[index]) return fallback;
  const item = palette[index];
  if (typeof item === "string") return item;
  return item.hex || fallback;
}

// Wave SVG path
const WaveSVG = ({ color, position }: { color: string; position: "bottom" | "top" }) => (
  <svg
    viewBox="0 0 1080 200"
    preserveAspectRatio="none"
    style={{
      position: "absolute",
      [position]: 0,
      left: 0,
      width: "100%",
      height: "15%",
      transform: position === "top" ? "rotate(180deg)" : undefined,
    }}
  >
    <path
      d="M0,80 C180,20 360,140 540,80 C720,20 900,140 1080,80 L1080,200 L0,200 Z"
      fill={color}
    />
  </svg>
);

// Template: Wave Cover (slide de capa)
const WaveCoverTemplate = ({
  slide, brand, dimensions, slideIndex, totalSlides,
}: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const wavePos = brand.style_guide?.layout_rules?.wave_position || "bottom";

  return (
    <div
      style={{
        width: dimensions?.width || 1080,
        height: dimensions?.height || 1350,
        background: bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <WaveSVG color="#ffffff" position={wavePos as "bottom" | "top"} />

      {/* Content area */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 60px",
        zIndex: 2,
      }}>
        {/* Accent bar */}
        <div style={{
          width: 60,
          height: 6,
          backgroundColor: accent,
          borderRadius: 3,
          marginBottom: 32,
        }} />

        <h1 style={{
          color: dark,
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: 24,
          letterSpacing: "-0.02em",
        }}>
          {slide.headline}
        </h1>

        <p style={{
          color: dark,
          fontSize: 32,
          fontWeight: 400,
          lineHeight: 1.5,
          opacity: 0.8,
          fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`,
        }}>
          {slide.body}
        </p>
      </div>

      {/* Slide indicator */}
      <div style={{
        position: "absolute",
        top: 40,
        right: 40,
        backgroundColor: dark,
        color: "#fff",
        padding: "8px 20px",
        borderRadius: 20,
        fontSize: 18,
        fontWeight: 600,
        zIndex: 3,
      }}>
        {slideIndex === 0 ? "CAPA" : slideIndex === totalSlides - 1 ? "CTA" : `${slideIndex + 1}/${totalSlides}`}
      </div>

      {/* Logo */}
      {brand.logo_url && (
        <img
          src={brand.logo_url}
          alt="Logo"
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            height: 48,
            objectFit: "contain",
            zIndex: 3,
          }}
        />
      )}
    </div>
  );
};

// Template: Wave Text Card (slide de texto com card central)
const WaveTextCardTemplate = ({
  slide, brand, dimensions, slideIndex, totalSlides,
}: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const cardBg = getHex(brand.palette, 3, "#f5eaee");

  return (
    <div
      style={{
        width: dimensions?.width || 1080,
        height: dimensions?.height || 1350,
        background: bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <WaveSVG color="#ffffff" position="bottom" />

      {/* Card */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: 24,
        padding: "48px 40px",
        margin: "0 48px",
        maxWidth: "85%",
        border: `3px solid ${cardBg}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        zIndex: 2,
        textAlign: "center",
      }}>
        <div style={{
          width: 48,
          height: 4,
          backgroundColor: accent,
          borderRadius: 2,
          margin: "0 auto 28px",
        }} />

        <h2 style={{
          color: dark,
          fontSize: 48,
          fontWeight: 700,
          lineHeight: 1.25,
          marginBottom: 20,
        }}>
          {slide.headline}
        </h2>

        <p style={{
          color: dark,
          fontSize: 28,
          fontWeight: 400,
          lineHeight: 1.6,
          opacity: 0.75,
          fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`,
        }}>
          {slide.body}
        </p>
      </div>

      {/* Slide indicator */}
      <div style={{
        position: "absolute",
        top: 40,
        right: 40,
        backgroundColor: dark,
        color: "#fff",
        padding: "8px 20px",
        borderRadius: 20,
        fontSize: 18,
        fontWeight: 600,
        zIndex: 3,
      }}>
        {`${slideIndex + 1}/${totalSlides}`}
      </div>

      {/* Logo */}
      {brand.logo_url && (
        <img
          src={brand.logo_url}
          alt="Logo"
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            height: 48,
            objectFit: "contain",
            zIndex: 3,
          }}
        />
      )}
    </div>
  );
};

// Template selector
const TemplateMap: Record<string, React.FC<SlideTemplateRendererProps>> = {
  wave_cover: WaveCoverTemplate,
  wave_text_card: WaveTextCardTemplate,
  solid_cover: WaveCoverTemplate, // fallback
};

export function getTemplateForSlide(slideIndex: number, totalSlides: number, styleGuide?: StyleGuide | null): string {
  const recommended = styleGuide?.recommended_templates || ["wave_cover", "wave_text_card"];
  if (slideIndex === 0) return recommended[0] || "wave_cover";
  if (slideIndex === totalSlides - 1) return recommended[0] || "wave_cover";
  return recommended[1] || "wave_text_card";
}

// Main renderer component (used for preview)
const SlideTemplateRenderer = (props: SlideTemplateRendererProps) => {
  const templateName = props.template || getTemplateForSlide(props.slideIndex, props.totalSlides, props.brand.style_guide);
  const Component = TemplateMap[templateName] || WaveCoverTemplate;
  return <Component {...props} />;
};

// Export to PNG hook
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
