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
  backgroundImageUrl?: string;
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
  if (role === "cover") {
    return {
      badge:    { x: 5, y: 8 },
      headline: { x: 5, y: 25 },
      body:     { x: 5, y: 50 },
      bullets:  { x: 5, y: 55 },
      cta:      { x: 5, y: 78 },
      footer:   { x: 5, y: 90 },
    };
  }
  return {
    badge:    { x: 5, y: 4 },
    headline: { x: 5, y: 8 },
    body:     { x: 5, y: 25 },
    bullets:  { x: 5, y: 22 },
    cta:      { x: 5, y: 78 },
    footer:   { x: 5, y: 90 },
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

  // Truncation — allow more text to show rich content
  const maxHeadlineChars = maxHeadlineLines * 50;
  const truncatedHeadline =
    overlay.headline && overlay.headline.length > maxHeadlineChars
      ? overlay.headline.substring(0, maxHeadlineChars).replace(/\s+\S*$/, "…")
      : overlay.headline;

  const maxBodyChars = role === "cover" ? 250 : 450;
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
      {/* Background image or gradient fallback */}
      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: "block" }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${accentColor} 0%, #1a1a2e 100%)`,
          }}
        />
      )}

      {/* Full-slide scrim for readability over any background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.65) 100%)",
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
              fontSize: (isFirstSlide ? 52 : 44) * fontScale,
              fontWeight: 800,
              lineHeight: 1.15,
              color: "#ffffff",
              textShadow: "0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)",
              textAlign,
              maxWidth: "90%",
              letterSpacing: "-0.02em",
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
              fontSize: 26 * fontScale,
              fontWeight: 400,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.95)",
              textShadow: "0 1px 6px rgba(0,0,0,0.5)",
              textAlign,
              maxWidth: "90%",
            }}
          >
            {truncatedBody}
          </p>
        </DraggableTextBlock>
      )}

      {/* Bullets */}
      {overlay.bullets && overlay.bullets.length > 0 && (
        <DraggableTextBlock {...blockProps("bullets", pos.bullets!)}>
          <ul className="space-y-3" style={{ paddingLeft: 8, maxWidth: "90%" }}>
            {overlay.bullets.slice(0, 5).map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-3"
                style={{
                  fontFamily: bodyFont,
                  fontSize: 24 * fontScale,
                  lineHeight: 1.4,
                  color: "rgba(255,255,255,0.95)",
                  textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                }}
              >
                <span style={{ color: accentColor, fontWeight: 700, fontSize: 28 * fontScale }}>•</span>
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
