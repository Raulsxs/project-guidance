/**
 * SlideBgOverlayRenderer — Renders AI-generated background with editable text overlay.
 * Used when render_mode === "AI_BG_OVERLAY" and background_image_url exists.
 */

import { cn } from "@/lib/utils";

export interface OverlayData {
  headline?: string;
  body?: string;
  bullets?: string[];
  footer?: string;
}

export interface OverlayStyle {
  safe_area_top?: number;
  safe_area_bottom?: number;
  text_align?: "left" | "center";
  max_headline_lines?: number;
  font_scale?: number;
}

interface SlideBgOverlayRendererProps {
  backgroundImageUrl: string;
  overlay: OverlayData;
  overlayStyle?: OverlayStyle;
  dimensions?: { width: number; height: number };
  role?: string;
  slideIndex?: number;
  totalSlides?: number;
  brandSnapshot?: {
    palette?: string[];
    fonts?: { headings?: string; body?: string };
  } | null;
  className?: string;
}

export default function SlideBgOverlayRenderer({
  backgroundImageUrl,
  overlay,
  overlayStyle,
  dimensions = { width: 1080, height: 1350 },
  role,
  slideIndex = 0,
  totalSlides = 1,
  brandSnapshot,
  className,
}: SlideBgOverlayRendererProps) {
  const safeTop = overlayStyle?.safe_area_top ?? 80;
  const safeBottom = overlayStyle?.safe_area_bottom ?? 120;
  const textAlign = overlayStyle?.text_align ?? "left";
  const maxHeadlineLines = overlayStyle?.max_headline_lines ?? 2;
  const fontScale = overlayStyle?.font_scale ?? 1;

  const headingFont = brandSnapshot?.fonts?.headings || "Inter";
  const bodyFont = brandSnapshot?.fonts?.body || "Inter";

  // Palette-based accent color
  const accentColor = brandSnapshot?.palette?.[0] || "#667eea";

  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === totalSlides - 1;
  const isCta = role === "cta";

  // Truncate headline to max lines (~40 chars per line)
  const maxHeadlineChars = maxHeadlineLines * 40;
  const truncatedHeadline = overlay.headline && overlay.headline.length > maxHeadlineChars
    ? overlay.headline.substring(0, maxHeadlineChars).replace(/\s+\S*$/, "…")
    : overlay.headline;

  // Truncate body based on role
  const maxBodyChars = role === "cover" ? 120 : 200;
  const truncatedBody = overlay.body && overlay.body.length > maxBodyChars
    ? overlay.body.substring(0, maxBodyChars).replace(/\s+\S*$/, "…")
    : overlay.body;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Background image — NO filters, NO opacity */}
      <img
        src={backgroundImageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: "block" }}
      />

      {/* Text overlay — centered in the card area */}
      <div
        className="absolute inset-0 flex flex-col justify-center items-center"
        style={{
          paddingTop: safeTop,
          paddingBottom: safeBottom,
          paddingLeft: 60,
          paddingRight: 60,
          textAlign,
        }}
      >
        {/* Semi-transparent card backdrop for text readability */}
        <div
          className="relative z-10 w-full rounded-2xl space-y-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            padding: "32px 28px",
            maxWidth: "90%",
          }}
        >
          {/* Slide counter badge */}
          {totalSlides > 1 && (
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: accentColor,
                color: "#fff",
                fontSize: 14 * fontScale,
              }}
            >
              {isFirstSlide ? "CAPA" : isCta ? "CTA" : `${slideIndex + 1}/${totalSlides}`}
            </div>
          )}

          {/* Headline */}
          {truncatedHeadline && (
            <h2
              style={{
                fontFamily: headingFont,
                fontSize: 36 * fontScale,
                fontWeight: 800,
                lineHeight: 1.15,
                color: "#ffffff",
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                WebkitLineClamp: maxHeadlineLines,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as any,
                overflow: "hidden",
              }}
            >
              {truncatedHeadline}
            </h2>
          )}

          {/* Body text */}
          {truncatedBody && (
            <p
              style={{
                fontFamily: bodyFont,
                fontSize: 20 * fontScale,
                fontWeight: 400,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.9)",
                textShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            >
              {truncatedBody}
            </p>
          )}

          {/* Bullets */}
          {overlay.bullets && overlay.bullets.length > 0 && (
            <ul className="space-y-2" style={{ paddingLeft: 8 }}>
              {overlay.bullets.slice(0, 5).map((bullet, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2"
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 18 * fontScale,
                    color: "rgba(255,255,255,0.9)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  <span style={{ color: accentColor, fontWeight: 700 }}>•</span>
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {/* CTA Button */}
          {isCta && (
            <div
              className="mt-4 py-3 px-6 rounded-xl text-center font-bold"
              style={{
                backgroundColor: accentColor,
                color: "#fff",
                fontSize: 18 * fontScale,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              Saiba Mais →
            </div>
          )}

          {/* Footer */}
          {overlay.footer && (
            <p
              style={{
                fontFamily: bodyFont,
                fontSize: 14 * fontScale,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {overlay.footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
