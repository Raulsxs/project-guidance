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

interface VisualSignature {
  theme_variant?: string; // "editorial_dark" | "clinical_cards" | "minimal_light" | "photo_overlay"
  primary_bg_mode?: string; // "solid" | "gradient" | "image"
  cover_style?: string; // "dark_full_bleed" | "light_wave" | "photo_overlay"
  card_style?: string; // "none" | "center_card" | "split_card"
  accent_usage?: string; // "minimal" | "moderate" | "strong"
  cta_style?: string; // "minimal_icons" | "bold_bar"
}

interface BrandSnapshot {
  name: string;
  palette: { name: string; hex: string }[] | string[];
  fonts: { headings: string; body: string };
  visual_tone: string;
  logo_url: string | null;
  style_guide?: any | null;
  visual_signature?: VisualSignature | null;
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

function getVisualSignature(brand: BrandSnapshot): VisualSignature {
  // Priority: top-level visual_signature > style_guide.visual_signature > defaults
  return brand.visual_signature
    || (brand.style_guide as any)?.visual_signature
    || {};
}

function getTypo(brand: BrandSnapshot) {
  const typo = brand.style_guide?.brand_tokens?.typography;
  return {
    headlineWeight: typo?.headline_weight || 800,
    bodyWeight: typo?.body_weight || 400,
    uppercase: typo?.uppercase_headlines || false,
  };
}

function getLogoConfig(brand: BrandSnapshot) {
  const logo = brand.style_guide?.brand_tokens?.logo;
  return {
    position: logo?.preferred_position || "bottom-center",
    opacity: logo?.watermark_opacity || 0.35,
  };
}

function getLayoutRules(brand: BrandSnapshot, contentType: string) {
  const format = brand.style_guide?.formats?.[contentType];
  const rules = format?.layout_rules || {};
  return {
    waveHeightPct: (rules as any).wave_height_pct || 18,
    safeMargin: (rules as any).safe_margin_px || 60,
    safeTop: (rules as any).safe_top_px || 40,
    safeBottom: (rules as any).safe_bottom_px || 80,
    footerHeight: (rules as any).footer_height_px || 140,
  };
}

function getContentType(dimensions?: { width: number; height: number }): string {
  if (!dimensions) return "post";
  if (dimensions.height > 1500) return "story";
  return "post";
}

/**
 * Resolve colors based on visual_signature theme_variant.
 * This is the KEY function that makes different template sets look different.
 */
function resolveThemeColors(palette: BrandSnapshot["palette"], vs: VisualSignature) {
  const c0 = getHex(palette, 0, "#a4d3eb"); // primary light
  const c1 = getHex(palette, 1, "#10559a"); // primary dark
  const c2 = getHex(palette, 2, "#c52244"); // accent
  const c3 = getHex(palette, 3, "#f5eaee"); // soft bg

  const variant = vs.theme_variant || "minimal_light";

  if (variant.includes("dark") || variant.includes("editorial")) {
    // Dark theme: dark bg, light text
    return { bg: c1, text: "#ffffff", accent: c2, cardBg: "#ffffff", waveFill: c0, badgeBg: c2, badgeText: "#ffffff" };
  }
  if (variant.includes("clinical") || variant.includes("card")) {
    // Clinical/Cards: light bg, card-centric
    return { bg: c0, text: c1, accent: c2, cardBg: "#ffffff", waveFill: "#ffffff", badgeBg: c1, badgeText: "#ffffff" };
  }
  if (variant.includes("photo") || variant.includes("overlay")) {
    // Photo overlay: gradient overlay
    return { bg: `linear-gradient(135deg, ${c1}dd, ${c0}aa)`, text: "#ffffff", accent: c2, cardBg: "#ffffffcc", waveFill: "#ffffff33", badgeBg: "#ffffff33", badgeText: "#ffffff" };
  }
  // Default: minimal_light
  return { bg: c0, text: c1, accent: c2, cardBg: c3, waveFill: "#ffffff", badgeBg: c1, badgeText: "#ffffff" };
}

function shouldUseCard(vs: VisualSignature): boolean {
  const cs = vs.card_style || "";
  if (cs === "none") return false;
  if (cs === "center_card" || cs === "split_card") return true;
  // If theme is dark/editorial, no card by default
  if ((vs.theme_variant || "").includes("dark") || (vs.theme_variant || "").includes("editorial")) return false;
  // If theme is clinical/card, card by default
  if ((vs.theme_variant || "").includes("clinical") || (vs.theme_variant || "").includes("card")) return true;
  return true; // default
}

const WaveSVG = ({ color, position, heightPct = 18 }: { color: string; position: "bottom" | "top"; heightPct?: number }) => (
  <svg
    viewBox="0 0 1080 200"
    preserveAspectRatio="none"
    style={{
      position: "absolute",
      [position]: 0,
      left: 0,
      width: "100%",
      height: `${heightPct}%`,
      transform: position === "top" ? "rotate(180deg)" : undefined,
    }}
  >
    <path d="M0,80 C180,20 360,140 540,80 C720,20 900,140 1080,80 L1080,200 L0,200 Z" fill={color} />
  </svg>
);

function SlideBadge({ slideIndex, totalSlides, bgColor, textColor }: { slideIndex: number; totalSlides: number; bgColor: string; textColor: string }) {
  const label = slideIndex === 0 ? "CAPA" : `${slideIndex + 1}/${totalSlides}`;
  return (
    <div style={{
      position: "absolute", top: 40, right: 40,
      backgroundColor: bgColor, color: textColor,
      padding: "8px 20px", borderRadius: 20,
      fontSize: 18, fontWeight: 600, zIndex: 3,
    }}>
      {label}
    </div>
  );
}

function LogoMark({ brand, position, opacity }: { brand: BrandSnapshot; position: string; opacity: number }) {
  if (!brand.logo_url) return null;

  const posStyle: React.CSSProperties = { position: "absolute", zIndex: 3, objectFit: "contain" };

  if (position.includes("top")) posStyle.top = 40;
  else posStyle.bottom = 40;

  if (position.includes("right")) posStyle.right = 40;
  else if (position.includes("left")) posStyle.left = 40;
  else { posStyle.left = "50%"; posStyle.transform = "translateX(-50%)"; }

  return <img src={brand.logo_url} alt="Logo" style={{ ...posStyle, height: 48, opacity }} />;
}

function AccentBar({ color, style }: { color: string; style?: React.CSSProperties }) {
  return <div style={{ width: 60, height: 6, backgroundColor: color, borderRadius: 3, ...style }} />;
}

// ══════ TEMPLATES ══════

const WaveCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const vs = getVisualSignature(brand);
  const colors = resolveThemeColors(brand.palette, vs);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);

  return (
    <div style={{ width: w, height: h, background: colors.bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <WaveSVG color={colors.waveFill} position="bottom" heightPct={layout.waveHeightPct} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `80px ${layout.safeMargin}px`, zIndex: 2 }}>
        <AccentBar color={colors.accent} style={{ marginBottom: 32 }} />
        <h1 style={{ color: colors.text, fontSize: 64, fontWeight: typo.headlineWeight, lineHeight: 1.15, marginBottom: 24, letterSpacing: "-0.02em", textTransform: typo.uppercase ? "uppercase" : undefined }}>
          {slide.headline}
        </h1>
        <p style={{ color: colors.text, fontSize: 32, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>
          {slide.body}
        </p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={colors.badgeBg} textColor={colors.badgeText} />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveTextCardTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const vs = getVisualSignature(brand);
  const colors = resolveThemeColors(brand.palette, vs);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);
  const useCard = shouldUseCard(vs);

  if (!useCard) {
    // Flat layout: text directly on background
    return (
      <div style={{ width: w, height: h, background: colors.bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <WaveSVG color={colors.waveFill} position="bottom" heightPct={layout.waveHeightPct} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `80px ${layout.safeMargin}px`, zIndex: 2 }}>
          <AccentBar color={colors.accent} style={{ marginBottom: 28 }} />
          <h2 style={{ color: colors.text, fontSize: 52, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
          <p style={{ color: colors.text, fontSize: 28, fontWeight: typo.bodyWeight, lineHeight: 1.6, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        </div>
        <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={colors.badgeBg} textColor={colors.badgeText} />
        <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
      </div>
    );
  }

  // Card layout
  return (
    <div style={{ width: w, height: h, background: colors.bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <WaveSVG color={colors.waveFill} position="bottom" heightPct={layout.waveHeightPct} />
      <div style={{ backgroundColor: colors.cardBg, borderRadius: 24, padding: `48px ${layout.safeMargin - 20}px`, margin: `0 ${layout.safeMargin - 12}px`, maxWidth: "85%", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", zIndex: 2, textAlign: "center" }}>
        <AccentBar color={colors.accent} style={{ margin: "0 auto 28px", width: 48, height: 4 }} />
        <h2 style={{ color: colors.text, fontSize: 48, fontWeight: typo.headlineWeight, lineHeight: 1.25, marginBottom: 20, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: colors.text, fontSize: 28, fontWeight: typo.bodyWeight, lineHeight: 1.6, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={colors.badgeBg} textColor={colors.badgeText} />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveBulletsTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const vs = getVisualSignature(brand);
  const colors = resolveThemeColors(brand.palette, vs);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const bullets = slide.bullets || [];
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);

  return (
    <div style={{ width: w, height: h, background: colors.bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      <WaveSVG color={colors.waveFill} position="bottom" heightPct={Math.max(layout.waveHeightPct - 3, 12)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `80px ${layout.safeMargin}px`, zIndex: 2 }}>
        <AccentBar color={colors.accent} style={{ marginBottom: 24 }} />
        <h2 style={{ color: colors.text, fontSize: 52, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 32, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        {bullets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {bullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <p style={{ color: colors.text, fontSize: 28, lineHeight: 1.5, fontWeight: typo.bodyWeight, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{bullet}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: colors.text, fontSize: 28, lineHeight: 1.6, opacity: 0.8, fontWeight: typo.bodyWeight, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        )}
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={colors.badgeBg} textColor={colors.badgeText} />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveClosingTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const vs = getVisualSignature(brand);
  const colors = resolveThemeColors(brand.palette, vs);
  const c0 = getHex(brand.palette, 0, "#a4d3eb");
  const c1 = getHex(brand.palette, 1, "#10559a");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);
  const isCta = slide.role === "cta" || slide.role === "closing";

  // CTA always uses dark bg for contrast
  const bgColor = isCta ? c1 : colors.bg;
  const textColor = isCta ? "#ffffff" : colors.text;

  return (
    <div style={{ width: w, height: h, background: bgColor, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <WaveSVG color={isCta ? c0 : colors.waveFill} position="bottom" heightPct={layout.waveHeightPct} />
      <div style={{ zIndex: 2, padding: `${layout.safeMargin}px`, maxWidth: "85%" }}>
        <AccentBar color={colors.accent} style={{ margin: "0 auto 32px", width: 60 }} />
        <h2 style={{ color: textColor, fontSize: isCta ? 52 : 56, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: isCta ? 32 : 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: textColor, fontSize: isCta ? 36 : 30, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.85, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`, letterSpacing: isCta ? "0.02em" : undefined }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor="#ffffff33" textColor="#fff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={isCta ? 1 : logoConf.opacity} />
    </div>
  );
};

const StoryCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const vs = getVisualSignature(brand);
  const colors = resolveThemeColors(brand.palette, vs);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const layout = getLayoutRules(brand, "story");

  return (
    <div style={{ width: w, height: h, background: colors.bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.2 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <WaveSVG color={colors.waveFill} position="bottom" heightPct={15} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `${layout.safeTop}px ${layout.safeMargin}px ${layout.safeBottom}px`, zIndex: 2 }}>
        <AccentBar color={colors.accent} style={{ marginBottom: 40 }} />
        <h1 style={{ color: colors.text, fontSize: 72, fontWeight: 900, lineHeight: 1.1, marginBottom: 32, letterSpacing: "-0.02em", textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h1>
        <p style={{ color: colors.text, fontSize: 36, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const StoryTipTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const vs = getVisualSignature(brand);
  const colors = resolveThemeColors(brand.palette, vs);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const useCard = shouldUseCard(vs);

  return (
    <div style={{ width: w, height: h, background: colors.bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <WaveSVG color={colors.waveFill} position="bottom" heightPct={12} />
      {useCard ? (
        <div style={{ backgroundColor: colors.cardBg, borderRadius: 32, padding: "56px 48px", margin: "0 48px", maxWidth: "88%", boxShadow: "0 12px 40px rgba(0,0,0,0.1)", zIndex: 2, textAlign: "center" }}>
          <AccentBar color={colors.accent} style={{ margin: "0 auto 32px", width: 48, height: 5 }} />
          <h2 style={{ color: colors.text, fontSize: 56, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
          <p style={{ color: colors.text, fontSize: 32, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        </div>
      ) : (
        <div style={{ zIndex: 2, padding: "56px 48px", maxWidth: "88%", textAlign: "center" }}>
          <AccentBar color={colors.accent} style={{ margin: "0 auto 32px", width: 48, height: 5 }} />
          <h2 style={{ color: colors.text, fontSize: 56, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
          <p style={{ color: colors.text, fontSize: 32, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        </div>
      )}
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

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
  wave_closing_cta: WaveClosingTemplate,
  story_cover: StoryCoverTemplate,
  story_tip: StoryTipTemplate,
  generic_free: GenericFreeTemplate,
  solid_cover: WaveCoverTemplate,
};

export function getTemplateForSlide(slideIndex: number, totalSlides: number, styleGuide?: StyleGuide | null): string {
  const recommended = (styleGuide as any)?.recommended_templates || (styleGuide as any)?.formats?.carousel?.recommended_templates || ["wave_cover", "wave_text_card"];
  if (slideIndex === 0) return recommended[0] || "wave_cover";
  if (slideIndex === totalSlides - 1) return recommended[recommended.length > 2 ? recommended.length - 1 : 0] || "wave_closing";
  return recommended[1] || "wave_text_card";
}

// ══════ MAIN RENDERER ══════

const SlideTemplateRenderer = (props: SlideTemplateRendererProps) => {
  const templateName = props.template || props.slide.templateHint || props.slide.template || getTemplateForSlide(props.slideIndex, props.totalSlides, props.brand.style_guide as any);
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
