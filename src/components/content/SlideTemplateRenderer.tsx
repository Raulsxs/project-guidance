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
  style_guide?: StyleGuideTokens | null;
}

interface StyleGuideTokens {
  style_preset?: string;
  brand_tokens?: {
    palette_roles?: Record<string, string>;
    typography?: { headline_weight?: number; body_weight?: number; uppercase_headlines?: boolean };
    logo?: { preferred_position?: string; watermark_opacity?: number };
  };
  formats?: Record<string, {
    recommended_templates?: string[];
    layout_rules?: Record<string, number>;
    text_limits?: { headline_chars?: number[]; body_chars?: number[] };
  }>;
  visual_patterns?: string[];
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

function hasWavePattern(brand: BrandSnapshot): boolean {
  const patterns = brand.style_guide?.visual_patterns;
  if (!patterns) return true;
  return patterns.some(p => p.toLowerCase().includes("wave"));
}

function getContentType(dimensions?: { width: number; height: number }): string {
  if (!dimensions) return "post";
  if (dimensions.height > 1500) return "story";
  return "post";
}

const WaveSVG = ({ color, position, heightPct = 18, parentH }: { color: string; position: "bottom" | "top"; heightPct?: number; parentH?: number }) => (
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
  const label = slideIndex === 0 ? "CAPA" : slideIndex === totalSlides - 1 ? "CTA" : `${slideIndex + 1}/${totalSlides}`;
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
  if (!brand.logo_url && !brand.name) return null;

  const posStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 3,
    objectFit: "contain",
  };

  if (position.includes("top")) {
    posStyle.top = 40;
  } else {
    posStyle.bottom = 40;
  }

  if (position.includes("right")) {
    posStyle.right = 40;
  } else if (position.includes("left")) {
    posStyle.left = 40;
  } else {
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  }

  if (brand.logo_url) {
    return (
      <img
        src={brand.logo_url}
        alt="Logo"
        style={{ ...posStyle, height: 48, opacity }}
      />
    );
  }

  return null;
}

function AccentBar({ color, style }: { color: string; style?: React.CSSProperties }) {
  return <div style={{ width: 60, height: 6, backgroundColor: color, borderRadius: 3, ...style }} />;
}

// ══════ TEMPLATES ══════

const WaveCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);
  const showWave = hasWavePattern(brand);

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      {showWave && <WaveSVG color="#ffffff" position="bottom" heightPct={layout.waveHeightPct} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `80px ${layout.safeMargin}px`, zIndex: 2 }}>
        <AccentBar color={accent} style={{ marginBottom: 32 }} />
        <h1 style={{ color: dark, fontSize: 64, fontWeight: typo.headlineWeight, lineHeight: 1.15, marginBottom: 24, letterSpacing: "-0.02em", textTransform: typo.uppercase ? "uppercase" : undefined }}>
          {slide.headline}
        </h1>
        <p style={{ color: dark, fontSize: 32, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>
          {slide.body}
        </p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={dark} textColor="#fff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveTextCardTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const cardBg = getHex(brand.palette, 3, "#f5eaee");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);
  const showWave = hasWavePattern(brand);

  // Determine card vs flat from style guide notes or layout_rules
  const notes = (brand.style_guide as any)?.notes as string[] | undefined;
  const layoutRules = (brand.style_guide as any)?.formats?.[ct]?.layout_rules;
  
  // Explicit layout_rules.content_card takes priority
  let useCard = true;
  if (layoutRules?.content_card !== undefined) {
    useCard = !!layoutRules.content_card;
  } else if (notes && notes.length > 0) {
    // Smart heuristic: "sem card" or "sem um card" = no card; "card branco" / "utilizam.*card" = yes card
    const hasCardNegative = notes.some(n => /sem\s+(um\s+)?card/i.test(n) || /sem\s+o\s+card/i.test(n) || /diretamente sobre o fundo/i.test(n));
    const hasCardPositive = notes.some(n => /card\s+branc/i.test(n) || /utilizam\s+(um\s+)?card/i.test(n));
    if (hasCardNegative) useCard = false;
    else if (hasCardPositive) useCard = true;
    // else default true
  }

  if (!useCard) {
    // Flat layout: text directly on background (e.g., "Artigos editoriais")
    return (
      <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {showWave && <WaveSVG color="#ffffff" position="bottom" heightPct={layout.waveHeightPct} />}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `80px ${layout.safeMargin}px`, zIndex: 2 }}>
          <AccentBar color={accent} style={{ marginBottom: 28 }} />
          <h2 style={{ color: dark, fontSize: 52, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
          <p style={{ color: dark, fontSize: 28, fontWeight: typo.bodyWeight, lineHeight: 1.6, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        </div>
        <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={dark} textColor="#fff" />
        <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
      </div>
    );
  }

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {showWave && <WaveSVG color="#ffffff" position="bottom" heightPct={layout.waveHeightPct} />}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 24, padding: `48px ${layout.safeMargin - 20}px`, margin: `0 ${layout.safeMargin - 12}px`, maxWidth: "85%", border: `3px solid ${cardBg}`, boxShadow: "0 8px 32px rgba(0,0,0,0.08)", zIndex: 2, textAlign: "center" }}>
        <AccentBar color={accent} style={{ margin: "0 auto 28px", width: 48, height: 4 }} />
        <h2 style={{ color: dark, fontSize: 48, fontWeight: typo.headlineWeight, lineHeight: 1.25, marginBottom: 20, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: dark, fontSize: 28, fontWeight: typo.bodyWeight, lineHeight: 1.6, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={dark} textColor="#fff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveBulletsTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const bullets = slide.bullets || [];
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);
  const showWave = hasWavePattern(brand);

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {showWave && <WaveSVG color="#ffffff" position="bottom" heightPct={Math.max(layout.waveHeightPct - 3, 12)} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `80px ${layout.safeMargin}px`, zIndex: 2 }}>
        <AccentBar color={accent} style={{ marginBottom: 24 }} />
        <h2 style={{ color: dark, fontSize: 52, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 32, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        {bullets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {bullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <p style={{ color: dark, fontSize: 28, lineHeight: 1.5, fontWeight: typo.bodyWeight, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{bullet}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: dark, fontSize: 28, lineHeight: 1.6, opacity: 0.8, fontWeight: typo.bodyWeight, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        )}
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={dark} textColor="#fff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveClosingTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 1, "#10559a");
  const light = getHex(brand.palette, 0, "#a4d3eb");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const ct = getContentType(dimensions);
  const layout = getLayoutRules(brand, ct);
  const showWave = hasWavePattern(brand);
  const isCta = slide.role === "cta";

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      {showWave && <WaveSVG color={light} position="bottom" heightPct={layout.waveHeightPct} />}
      <div style={{ zIndex: 2, padding: `${layout.safeMargin}px`, maxWidth: "85%" }}>
        <AccentBar color={accent} style={{ margin: "0 auto 32px", width: 60 }} />
        <h2 style={{ color: "#ffffff", fontSize: isCta ? 52 : 56, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: isCta ? 32 : 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: "#ffffff", fontSize: isCta ? 36 : 30, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.85, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`, letterSpacing: isCta ? "0.02em" : undefined }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor="#ffffff33" textColor="#fff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={isCta ? 1 : logoConf.opacity} />
    </div>
  );
};

const StoryCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const layout = getLayoutRules(brand, "story");
  const showWave = hasWavePattern(brand);

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.2 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      {showWave && <WaveSVG color="#ffffff" position="bottom" heightPct={15} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `${layout.safeTop}px ${layout.safeMargin}px ${layout.safeBottom}px`, zIndex: 2 }}>
        <AccentBar color={accent} style={{ marginBottom: 40 }} />
        <h1 style={{ color: dark, fontSize: 72, fontWeight: 900, lineHeight: 1.1, marginBottom: 32, letterSpacing: "-0.02em", textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h1>
        <p style={{ color: dark, fontSize: 36, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const StoryTipTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const bg = getHex(brand.palette, 0, "#a4d3eb");
  const dark = getHex(brand.palette, 1, "#10559a");
  const accent = getHex(brand.palette, 2, "#c52244");
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const showWave = hasWavePattern(brand);

  return (
    <div style={{ width: w, height: h, background: bg, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {showWave && <WaveSVG color="#ffffff" position="bottom" heightPct={12} />}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 32, padding: "56px 48px", margin: "0 48px", maxWidth: "88%", boxShadow: "0 12px 40px rgba(0,0,0,0.1)", zIndex: 2, textAlign: "center" }}>
        <AccentBar color={accent} style={{ margin: "0 auto 32px", width: 48, height: 5 }} />
        <h2 style={{ color: dark, fontSize: 56, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: dark, fontSize: 32, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
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
