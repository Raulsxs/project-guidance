/**
 * SlideBgOverlayRenderer — Renders AI-generated background with editable text overlay.
 * Supports free drag-and-drop positioning when `editable` is true.
 * Used when render_mode === "AI_BG_OVERLAY" and background_image_url exists.
 */

import { useRef } from "react";
import { cn } from "@/lib/utils";
import DraggableTextBlock, { type BlockPosition } from "./DraggableTextBlock";

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

export interface OverlayPositions {
  headline?: BlockPosition;
  body?: BlockPosition;
  bullets?: BlockPosition;
  cta?: BlockPosition;
  footer?: BlockPosition;
  badge?: BlockPosition;
}

interface SlideBgOverlayRendererProps {
  backgroundImageUrl: string;
  overlay: OverlayData;
  overlayStyle?: OverlayStyle;
  overlayPositions?: OverlayPositions;
  onPositionChange?: (key: string, pos: BlockPosition) => void;
  editable?: boolean;
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

// Default positions (percentage-based) for auto-layout fallback
function getDefaultPositions(role?: string): OverlayPositions {
  return {
    badge:    { x: 4, y: 52 },
    headline: { x: 4, y: 56 },
    body:     { x: 4, y: 68 },
    bullets:  { x: 4, y: 62 },
    cta:      { x: 4, y: 80 },
    footer:   { x: 4, y: 90 },
  };
}

export default function SlideBgOverlayRenderer({
  backgroundImageUrl,
  overlay,
  overlayStyle,
  overlayPositions,
  onPositionChange,
  editable = false,
  dimensions = { width: 1080, height: 1350 },
  role,
  slideIndex = 0,
  totalSlides = 1,
  brandSnapshot,
  className,
}: SlideBgOverlayRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const textAlign = overlayStyle?.text_align ?? "left";
  const maxHeadlineLines = overlayStyle?.max_headline_lines ?? 2;
  const fontScale = overlayStyle?.font_scale ?? 1;

  const headingFont = brandSnapshot?.fonts?.headings || "Inter";
  const bodyFont = brandSnapshot?.fonts?.body || "Inter";
  const accentColor = brandSnapshot?.palette?.[0] || "#667eea";

  const isFirstSlide = slideIndex === 0;
  const isCta = role === "cta";

  // Truncation
  const maxHeadlineChars = maxHeadlineLines * 40;
  const truncatedHeadline =
    overlay.headline && overlay.headline.length > maxHeadlineChars
      ? overlay.headline.substring(0, maxHeadlineChars).replace(/\s+\S*$/, "…")
      : overlay.headline;

  const maxBodyChars = role === "cover" ? 120 : 200;
  const truncatedBody =
    overlay.body && overlay.body.length > maxBodyChars
      ? overlay.body.substring(0, maxBodyChars).replace(/\s+\S*$/, "…")
      : overlay.body;

  // Merge custom positions with defaults
  const defaults = getDefaultPositions(role);
  const pos: OverlayPositions = {
    badge:    overlayPositions?.badge    ?? defaults.badge,
    headline: overlayPositions?.headline ?? defaults.headline,
    body:     overlayPositions?.body     ?? defaults.body,
    bullets:  overlayPositions?.bullets  ?? defaults.bullets,
    cta:      overlayPositions?.cta      ?? defaults.cta,
    footer:   overlayPositions?.footer   ?? defaults.footer,
  };

  const blockProps = (key: string, position: BlockPosition) => ({
    blockKey: key,
    position,
    onPositionChange,
    editable,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
  });

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Background image */}
      <img
        src={backgroundImageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: "block" }}
      />

      {/* Subtle bottom scrim for readability */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "55%",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
        }}
      />

      {/* === Draggable text blocks === */}

      {/* Badge removed — role labels like CAPA/CTA should only appear in the editor UI, not on the slide image */}

      {/* Headline */}
      {truncatedHeadline && (
        <DraggableTextBlock {...blockProps("headline", pos.headline!)}>
          <h2
            style={{
              fontFamily: headingFont,
              fontSize: 36 * fontScale,
              fontWeight: 800,
              lineHeight: 1.15,
              color: "#ffffff",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              textAlign,
              WebkitLineClamp: maxHeadlineLines,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}
          >
            {truncatedHeadline}
          </h2>
        </DraggableTextBlock>
      )}

      {/* Body */}
      {truncatedBody && (
        <DraggableTextBlock {...blockProps("body", pos.body!)}>
          <p
            style={{
              fontFamily: bodyFont,
              fontSize: 20 * fontScale,
              fontWeight: 400,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.9)",
              textShadow: "0 1px 4px rgba(0,0,0,0.4)",
              textAlign,
            }}
          >
            {truncatedBody}
          </p>
        </DraggableTextBlock>
      )}

      {/* Bullets */}
      {overlay.bullets && overlay.bullets.length > 0 && (
        <DraggableTextBlock {...blockProps("bullets", pos.bullets!)}>
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
        </DraggableTextBlock>
      )}

      {/* CTA */}
      {isCta && (
        <DraggableTextBlock {...blockProps("cta", pos.cta!)}>
          <div
            className="py-3 px-6 rounded-xl text-center font-bold"
            style={{
              backgroundColor: accentColor,
              color: "#fff",
              fontSize: 18 * fontScale,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            Saiba Mais →
          </div>
        </DraggableTextBlock>
      )}

      {/* Footer */}
      {overlay.footer && (
        <DraggableTextBlock {...blockProps("footer", pos.footer!)}>
          <p
            style={{
              fontFamily: bodyFont,
              fontSize: 14 * fontScale,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {overlay.footer}
          </p>
        </DraggableTextBlock>
      )}
    </div>
  );
}
