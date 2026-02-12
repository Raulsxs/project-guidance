import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import type { StyleGuide } from "@/types/studio";

// ══════ TYPES ══════

interface LayoutParams {
  bg: { type: string; palette_index: number; gradient_angle?: number; overlay_opacity?: number };
  wave: { enabled: boolean; height_pct: number; palette_index: number };
  card?: { enabled: boolean; border_radius: number; palette_index: number; shadow: boolean; position: string };
  text: {
    alignment: string; vertical_position: string;
    headline_size: number; headline_weight: number; headline_uppercase: boolean; headline_letter_spacing?: number;
    body_size: number; body_weight: number; body_italic?: boolean;
    text_color: string; body_color: string;
  };
  decorations?: {
    accent_bar?: { enabled: boolean; position?: string; width?: number; height?: number };
    corner_accents?: { enabled: boolean };
    border?: { enabled: boolean };
  };
  logo?: { position: string; opacity: number; size?: number };
  padding?: { x: number; y: number };
  bullet_style?: {
    type: string; accent_palette_index?: number;
    container_enabled?: boolean; container_palette_index?: number; container_border_radius?: number;
  };
  cta_icons?: { enabled: boolean; style?: string; items?: string[] };
}

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
  style_guide?: any | null;
  visual_signature?: any | null;
  layout_params?: Record<string, LayoutParams> | null;
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

function getLayoutParams(brand: BrandSnapshot): Record<string, LayoutParams> | null {
  return brand.layout_params
    || (brand.style_guide as any)?.layout_params
    || null;
}

function getParamsForRole(brand: BrandSnapshot, role: string): LayoutParams | null {
  const lp = getLayoutParams(brand);
  if (!lp) return null;
  // Try exact role, then fallbacks
  return lp[role] || lp["content"] || null;
}

// ══════ PARAMETERIZED TEMPLATE ══════
// This single component renders ANY visual structure based on layout_params from AI analysis

const ParameterizedTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const role = slide.role || (slideIndex === 0 ? "cover" : "content");
  const params = getParamsForRole(brand, role);
  if (!params) return null; // Signal to fallback to legacy

  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const px = params.padding?.x || 60;
  const py = params.padding?.y || 80;

  // Resolve colors from palette
  const bgPaletteColor = getHex(brand.palette, params.bg.palette_index, "#1a1a2e");
  const wavePaletteColor = getHex(brand.palette, params.wave.palette_index, "#a4d3eb");
  const accentColor = getHex(brand.palette, 2, "#c52244");
  const cardBgColor = params.card?.enabled ? getHex(brand.palette, params.card.palette_index, "#ffffff") : "transparent";

  // Build background
  let bgStyle: string;
  if (params.bg.type === "gradient") {
    const c0 = getHex(brand.palette, params.bg.palette_index, "#1a1a2e");
    const c1 = getHex(brand.palette, (params.bg.palette_index + 1) % (brand.palette?.length || 3), "#a4d3eb");
    bgStyle = `linear-gradient(${params.bg.gradient_angle || 135}deg, ${c0}, ${c1})`;
  } else {
    bgStyle = bgPaletteColor;
  }

  // Text alignment
  const textAlign = (params.text.alignment || "center") as "left" | "center" | "right";
  const justifyContent = params.text.vertical_position === "top" ? "flex-start"
    : params.text.vertical_position === "bottom" ? "flex-end" : "center";

  const isBullets = role === "bullets" || role === "insight";
  const isCta = role === "cta" || role === "closing";
  const bullets = slide.bullets || [];

  // CTA items
  const ctaItems = [
    { icon: "❤️", label: "Curta" },
    { icon: "💬", label: "Comente" },
    { icon: "🔄", label: "Compartilhe" },
    { icon: "📌", label: "Salve" },
  ];

  return (
    <div style={{
      width: w, height: h, background: bgStyle, position: "relative", overflow: "hidden",
      fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Preview image overlay */}
      {slide.previewImage && params.bg.type === "image_overlay" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: `${bgPaletteColor}${Math.round((params.bg.overlay_opacity || 0.5) * 255).toString(16).padStart(2, '0')}` }} />
        </div>
      )}

      {/* Wave */}
      {params.wave.enabled && (
        <svg
          viewBox="0 0 1080 200" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: `${params.wave.height_pct || 18}%`, zIndex: 1 }}
        >
          <path d="M0,80 C180,20 360,140 540,80 C720,20 900,140 1080,80 L1080,200 L0,200 Z" fill={wavePaletteColor} />
        </svg>
      )}

      {/* Decorative corner accents */}
      {params.decorations?.corner_accents?.enabled && (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, width: 120, height: 120, background: `linear-gradient(135deg, ${wavePaletteColor}33 0%, transparent 70%)`, zIndex: 1 }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 200, height: 200, background: `linear-gradient(315deg, ${accentColor}22 0%, transparent 70%)`, zIndex: 1 }} />
        </>
      )}

      {/* Main content area */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent,
        alignItems: textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
        padding: `${py}px ${px}px`, zIndex: 2, textAlign,
      }}>
        {/* Card wrapper (optional) */}
        {params.card?.enabled ? (
          <div style={{
            backgroundColor: cardBgColor,
            borderRadius: params.card.border_radius || 24,
            padding: `48px ${px - 12}px`,
            maxWidth: "88%",
            boxShadow: params.card.shadow ? "0 8px 32px rgba(0,0,0,0.08)" : "none",
            textAlign,
          }}>
            {renderContent()}
          </div>
        ) : renderContent()}
      </div>

      {/* Slide badge */}
      <div style={{
        position: "absolute", top: 40, right: 40,
        backgroundColor: accentColor, color: "#ffffff",
        padding: "8px 20px", borderRadius: 20,
        fontSize: 18, fontWeight: 600, zIndex: 3,
      }}>
        {slideIndex === 0 ? "CAPA" : `${slideIndex + 1}/${totalSlides}`}
      </div>

      {/* Logo */}
      {brand.logo_url && params.logo && (
        <LogoMarkParameterized
          logoUrl={brand.logo_url}
          position={params.logo.position}
          opacity={params.logo.opacity}
          size={params.logo.size || 48}
        />
      )}
    </div>
  );

  function renderContent() {
    return (
      <>
        {/* Accent bar */}
        {params!.decorations?.accent_bar?.enabled && (
          <div style={{
            width: params!.decorations.accent_bar.width || 60,
            height: params!.decorations.accent_bar.height || 6,
            backgroundColor: accentColor,
            borderRadius: 3,
            marginBottom: 28,
            ...(textAlign === "center" ? { marginLeft: "auto", marginRight: "auto" } : {}),
          }} />
        )}

        {/* Headline */}
        <h1 style={{
          color: params!.text.text_color,
          fontSize: params!.text.headline_size,
          fontWeight: params!.text.headline_weight,
          lineHeight: 1.15,
          letterSpacing: params!.text.headline_letter_spacing ? `${params!.text.headline_letter_spacing}em` : undefined,
          textTransform: params!.text.headline_uppercase ? "uppercase" : undefined,
          marginBottom: 24,
        }}>
          {slide.headline}
        </h1>

        {/* Bullets */}
        {isBullets && bullets.length > 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", gap: 16,
            ...(params!.bullet_style?.container_enabled ? {
              backgroundColor: getHex(brand.palette, params!.bullet_style.container_palette_index || 3, "#e8a8a0") + "dd",
              borderRadius: params!.bullet_style.container_border_radius || 16,
              padding: "36px 40px",
            } : {}),
          }}>
            {bullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                {params!.bullet_style?.type === "checkmark" ? (
                  <span style={{ fontSize: 22, lineHeight: 1, marginTop: 4, color: params!.text.text_color }}>✓</span>
                ) : params!.bullet_style?.type === "dash" ? (
                  <span style={{ fontSize: 22, lineHeight: 1, marginTop: 4, color: params!.text.text_color }}>—</span>
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    backgroundColor: getHex(brand.palette, params!.bullet_style?.accent_palette_index || 2, accentColor),
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700, flexShrink: 0, marginTop: 2,
                  }}>
                    {i + 1}
                  </div>
                )}
                <p style={{
                  color: params!.bullet_style?.container_enabled ? "#1a1a2e" : params!.text.body_color,
                  fontSize: params!.text.body_size,
                  lineHeight: 1.5,
                  fontWeight: params!.text.body_weight,
                  fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`,
                }}>{bullet}</p>
              </div>
            ))}
          </div>
        ) : isCta && params!.cta_icons?.enabled ? (
          /* CTA Layout */
          <>
            <p style={{
              color: params!.text.body_color,
              fontSize: params!.text.body_size,
              fontWeight: params!.text.body_weight,
              lineHeight: 1.5,
              marginBottom: 40,
              fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`,
            }}>
              {slide.body}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 24 }}>
              {ctaItems.map((item, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 48, lineHeight: 1 }}>{item.icon}</div>
                  <span style={{
                    color: params!.text.body_color, fontSize: 18, fontWeight: 500,
                    fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`,
                  }}>{item.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Regular body text */
          <p style={{
            color: params!.text.body_color,
            fontSize: params!.text.body_size,
            fontWeight: params!.text.body_weight,
            lineHeight: 1.6,
            fontStyle: params!.text.body_italic ? "italic" : undefined,
            fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif`,
          }}>
            {slide.body}
          </p>
        )}
      </>
    );
  }
};

function LogoMarkParameterized({ logoUrl, position, opacity, size }: { logoUrl: string; position: string; opacity: number; size: number }) {
  const posStyle: React.CSSProperties = { position: "absolute", zIndex: 3, objectFit: "contain" };
  if (position.includes("top")) posStyle.top = 40;
  else posStyle.bottom = 40;
  if (position.includes("right")) posStyle.right = 40;
  else if (position.includes("left")) posStyle.left = 40;
  else { posStyle.left = "50%"; posStyle.transform = "translateX(-50%)"; }
  return <img src={logoUrl} alt="Logo" style={{ ...posStyle, height: size, opacity }} />;
}

// ══════ LEGACY TEMPLATES (fallback when no layout_params) ══════

function getTypo(brand: BrandSnapshot) {
  const typo = (brand.style_guide as any)?.brand_tokens?.typography;
  return {
    headlineWeight: typo?.headline_weight || 800,
    bodyWeight: typo?.body_weight || 400,
    uppercase: typo?.uppercase_headlines || false,
  };
}

function getLogoConfig(brand: BrandSnapshot) {
  const logo = (brand.style_guide as any)?.brand_tokens?.logo;
  return {
    position: logo?.preferred_position || "bottom-center",
    opacity: logo?.watermark_opacity || 0.35,
  };
}

const WaveSVG = ({ color, position, heightPct = 18 }: { color: string; position: "bottom" | "top"; heightPct?: number }) => (
  <svg
    viewBox="0 0 1080 200" preserveAspectRatio="none"
    style={{
      position: "absolute", [position]: 0, left: 0, width: "100%", height: `${heightPct}%`,
      transform: position === "top" ? "rotate(180deg)" : undefined,
    }}
  >
    <path d="M0,80 C180,20 360,140 540,80 C720,20 900,140 1080,80 L1080,200 L0,200 Z" fill={color} />
  </svg>
);

function SlideBadge({ slideIndex, totalSlides, bgColor, textColor }: { slideIndex: number; totalSlides: number; bgColor: string; textColor: string }) {
  return (
    <div style={{
      position: "absolute", top: 40, right: 40,
      backgroundColor: bgColor, color: textColor,
      padding: "8px 20px", borderRadius: 20, fontSize: 18, fontWeight: 600, zIndex: 3,
    }}>
      {slideIndex === 0 ? "CAPA" : `${slideIndex + 1}/${totalSlides}`}
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

// Legacy template components (kept for backwards compatibility)

const WaveCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const c0 = getHex(brand.palette, 0, "#a4d3eb");
  const c1 = getHex(brand.palette, 1, "#10559a");
  const c2 = getHex(brand.palette, 2, "#c52244");
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  return (
    <div style={{ width: w, height: h, background: c0, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}><img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
      <WaveSVG color="#ffffff" position="bottom" heightPct={18} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 60px", zIndex: 2 }}>
        <AccentBar color={c2} style={{ marginBottom: 32 }} />
        <h1 style={{ color: c1, fontSize: 64, fontWeight: typo.headlineWeight, lineHeight: 1.15, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h1>
        <p style={{ color: c1, fontSize: 32, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={c1} textColor="#ffffff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveTextCardTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const c0 = getHex(brand.palette, 0, "#a4d3eb");
  const c1 = getHex(brand.palette, 1, "#10559a");
  const c2 = getHex(brand.palette, 2, "#c52244");
  const c3 = getHex(brand.palette, 3, "#f5eaee");
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  return (
    <div style={{ width: w, height: h, background: c0, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <WaveSVG color="#ffffff" position="bottom" heightPct={18} />
      <div style={{ backgroundColor: "#ffffff", borderRadius: 24, padding: "48px 48px", margin: "0 48px", maxWidth: "85%", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", zIndex: 2, textAlign: "center" }}>
        <AccentBar color={c2} style={{ margin: "0 auto 28px", width: 48, height: 4 }} />
        <h2 style={{ color: c1, fontSize: 48, fontWeight: typo.headlineWeight, lineHeight: 1.25, marginBottom: 20, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: c1, fontSize: 28, fontWeight: typo.bodyWeight, lineHeight: 1.6, opacity: 0.75, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={c1} textColor="#ffffff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveBulletsTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const c0 = getHex(brand.palette, 0, "#a4d3eb");
  const c1 = getHex(brand.palette, 1, "#10559a");
  const c2 = getHex(brand.palette, 2, "#c52244");
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  const bullets = slide.bullets || [];
  return (
    <div style={{ width: w, height: h, background: c0, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      <WaveSVG color="#ffffff" position="bottom" heightPct={15} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 60px", zIndex: 2 }}>
        <AccentBar color={c2} style={{ marginBottom: 24 }} />
        <h2 style={{ color: c1, fontSize: 52, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 32, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        {bullets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {bullets.map((bullet, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: c2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                <p style={{ color: c1, fontSize: 28, lineHeight: 1.5, fontWeight: typo.bodyWeight, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{bullet}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: c1, fontSize: 28, lineHeight: 1.6, opacity: 0.8, fontWeight: typo.bodyWeight, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
        )}
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor={c1} textColor="#ffffff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={logoConf.opacity} />
    </div>
  );
};

const WaveClosingTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const c0 = getHex(brand.palette, 0, "#a4d3eb");
  const c1 = getHex(brand.palette, 1, "#10559a");
  const c2 = getHex(brand.palette, 2, "#c52244");
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1350;
  return (
    <div style={{ width: w, height: h, background: c1, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <WaveSVG color={c0} position="bottom" heightPct={18} />
      <div style={{ zIndex: 2, padding: "60px", maxWidth: "85%" }}>
        <AccentBar color={c2} style={{ margin: "0 auto 32px", width: 60 }} />
        <h2 style={{ color: "#ffffff", fontSize: 52, fontWeight: typo.headlineWeight, lineHeight: 1.2, marginBottom: 24, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h2>
        <p style={{ color: "#ffffff", fontSize: 30, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.85, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
      </div>
      <SlideBadge slideIndex={slideIndex} totalSlides={totalSlides} bgColor="#ffffff33" textColor="#fff" />
      <LogoMark brand={brand} position={logoConf.position} opacity={1} />
    </div>
  );
};

const StoryCoverTemplate = ({ slide, brand, dimensions, slideIndex, totalSlides }: SlideTemplateRendererProps) => {
  const c0 = getHex(brand.palette, 0, "#a4d3eb");
  const c1 = getHex(brand.palette, 1, "#10559a");
  const c2 = getHex(brand.palette, 2, "#c52244");
  const typo = getTypo(brand);
  const logoConf = getLogoConfig(brand);
  const w = dimensions?.width || 1080;
  const h = dimensions?.height || 1920;
  return (
    <div style={{ width: w, height: h, background: c0, position: "relative", overflow: "hidden", fontFamily: `'${brand.fonts?.headings || "Inter"}', sans-serif`, display: "flex", flexDirection: "column" }}>
      {slide.previewImage && <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.2 }}><img src={slide.previewImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
      <WaveSVG color="#ffffff" position="bottom" heightPct={15} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "220px 60px 260px", zIndex: 2 }}>
        <AccentBar color={c2} style={{ marginBottom: 40 }} />
        <h1 style={{ color: c1, fontSize: 72, fontWeight: 900, lineHeight: 1.1, marginBottom: 32, textTransform: typo.uppercase ? "uppercase" : undefined }}>{slide.headline}</h1>
        <p style={{ color: c1, fontSize: 36, fontWeight: typo.bodyWeight, lineHeight: 1.5, opacity: 0.8, fontFamily: `'${brand.fonts?.body || "Inter"}', sans-serif` }}>{slide.body}</p>
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

// ══════ LEGACY TEMPLATE MAP ══════

const LegacyTemplateMap: Record<string, React.FC<SlideTemplateRendererProps>> = {
  wave_cover: WaveCoverTemplate,
  wave_text_card: WaveTextCardTemplate,
  wave_bullets: WaveBulletsTemplate,
  wave_closing: WaveClosingTemplate,
  wave_closing_cta: WaveClosingTemplate,
  wave_cta: WaveClosingTemplate,
  story_cover: StoryCoverTemplate,
  generic_free: GenericFreeTemplate,
};

// ══════ RESOLVE TEMPLATE ══════

export function resolveTemplateForSlide(
  templateSet: any | null,
  role: string,
): string {
  // With layout_params, template name is just "parameterized"
  if (templateSet?.layout_params?.[role] || templateSet?.layout_params?.["content"]) {
    return "parameterized";
  }
  // Legacy: return role name for generic mapping
  const roleMap: Record<string, string> = {
    cover: "wave_cover", context: "wave_text_card", content: "wave_text_card",
    insight: "wave_bullets", bullets: "wave_bullets", quote: "wave_text_card",
    question: "wave_text_card", closing: "wave_closing", cta: "wave_closing",
  };
  return roleMap[role] || "wave_text_card";
}

export function getTemplateForSlide(slideIndex: number, totalSlides: number, styleGuide?: StyleGuide | null): string {
  if (slideIndex === 0) return "wave_cover";
  if (slideIndex === totalSlides - 1) return "wave_closing";
  return "wave_text_card";
}

// ══════ MAIN RENDERER ══════

const SlideTemplateRenderer = (props: SlideTemplateRendererProps) => {
  const templateName = props.template || props.slide.templateHint || props.slide.template || "wave_cover";

  // Try parameterized template first (new system)
  const hasLayoutParams = getLayoutParams(props.brand) !== null;
  if (hasLayoutParams || templateName === "parameterized") {
    const result = ParameterizedTemplate(props);
    if (result) return result;
  }

  // Fallback to legacy templates
  const Component = LegacyTemplateMap[templateName] || WaveCoverTemplate;
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
      width: opts?.width || 1080, height: opts?.height || 1350,
      pixelRatio: 1, quality: 0.95, cacheBust: true,
    });
    return dataUrl;
  }, []);
  return { ref, exportToPng };
}

export default SlideTemplateRenderer;
