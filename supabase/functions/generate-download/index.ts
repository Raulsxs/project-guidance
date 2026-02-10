import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Slide {
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

interface BrandTokens {
  name: string;
  palette: { name: string; hex: string }[] | string[];
  fonts: { headings: string; body: string };
  visual_tone: string;
  logo_url: string | null;
}

// Normalize palette for SVG rendering
function getPaletteHexes(palette: BrandTokens["palette"]): string[] {
  if (!palette) return [];
  return palette.map((item) => {
    if (typeof item === "string") return item;
    return item.hex || "#000000";
  });
}

// Build deterministic SVG for a slide
function renderSlideToSVG(
  slide: Slide,
  slideIndex: number,
  totalSlides: number,
  brand: BrandTokens,
  width: number,
  height: number,
): string {
  const hexes = getPaletteHexes(brand.palette);
  const bg = hexes[0] || "#a4d3eb";
  const dark = hexes[1] || "#10559a";
  const accent = hexes[2] || "#c52244";
  const cardBg = hexes[3] || "#f5eaee";
  const headingFont = brand.fonts?.headings || "Inter";
  const bodyFont = brand.fonts?.body || "Inter";
  const templateName = slide.templateHint || slide.template || "wave_cover";

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (current.length + word.length + 1 > maxCharsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  const headlineLines = wrapText(slide.headline, 28);
  const bodyLines = wrapText(slide.body, 45);
  const badge = slideIndex === 0 ? "CAPA" : slideIndex === totalSlides - 1 ? "CTA" : `${slideIndex + 1}/${totalSlides}`;

  // Wave path
  const wavePath = `M0,${height * 0.82} C${width * 0.17},${height * 0.79} ${width * 0.33},${height * 0.85} ${width * 0.5},${height * 0.82} C${width * 0.67},${height * 0.79} ${width * 0.83},${height * 0.85} ${width},${height * 0.82} L${width},${height} L0,${height} Z`;

  const badgeSvg = `<rect x="${width - 130}" y="30" width="100" height="36" rx="18" fill="${dark}"/>
  <text x="${width - 80}" y="54" text-anchor="middle" fill="white" font-family="${esc(headingFont)}, sans-serif" font-size="16" font-weight="600">${badge}</text>`;

  if (templateName === "wave_text_card") {
    const cardY = height * 0.25;
    const cardH = height * 0.45;
    const cardW = width * 0.82;
    const cardX = (width - cardW) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <path d="${wavePath}" fill="white"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="24" fill="white" stroke="${cardBg}" stroke-width="3"/>
  <rect x="${width / 2 - 24}" y="${cardY + 48}" width="48" height="4" rx="2" fill="${accent}"/>
  ${headlineLines.map((line, i) => `<text x="${width / 2}" y="${cardY + 100 + i * 52}" text-anchor="middle" fill="${dark}" font-family="${esc(headingFont)}, sans-serif" font-size="48" font-weight="700">${esc(line)}</text>`).join("\n  ")}
  ${bodyLines.map((line, i) => `<text x="${width / 2}" y="${cardY + 100 + headlineLines.length * 52 + 30 + i * 36}" text-anchor="middle" fill="${dark}" font-family="${esc(bodyFont)}, sans-serif" font-size="28" opacity="0.75">${esc(line)}</text>`).join("\n  ")}
  ${badgeSvg}
</svg>`;
  }

  if (templateName === "wave_bullets") {
    const bullets = slide.bullets || [];
    const bulletsSvg = bullets.map((b, i) => {
      const y = height * 0.4 + 80 + i * 60;
      return `<circle cx="90" cy="${y}" r="18" fill="${accent}"/>
  <text x="90" y="${y + 6}" text-anchor="middle" fill="white" font-family="${esc(headingFont)}, sans-serif" font-size="16" font-weight="700">${i + 1}</text>
  <text x="120" y="${y + 8}" fill="${dark}" font-family="${esc(bodyFont)}, sans-serif" font-size="26">${esc(b)}</text>`;
    }).join("\n  ");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <path d="${wavePath}" fill="white"/>
  <rect x="60" y="${height * 0.35}" width="60" height="6" rx="3" fill="${accent}"/>
  ${headlineLines.map((line, i) => `<text x="60" y="${height * 0.35 + 50 + i * 56}" fill="${dark}" font-family="${esc(headingFont)}, sans-serif" font-size="52" font-weight="800">${esc(line)}</text>`).join("\n  ")}
  ${bulletsSvg || bodyLines.map((line, i) => `<text x="60" y="${height * 0.35 + 50 + headlineLines.length * 56 + 30 + i * 40}" fill="${dark}" font-family="${esc(bodyFont)}, sans-serif" font-size="28" opacity="0.8">${esc(line)}</text>`).join("\n  ")}
  ${badgeSvg}
</svg>`;
  }

  if (templateName === "wave_closing") {
    const textY = height * 0.35;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${dark}"/>
  <path d="${`M0,${height * 0.82} C${width * 0.17},${height * 0.79} ${width * 0.33},${height * 0.85} ${width * 0.5},${height * 0.82} C${width * 0.67},${height * 0.79} ${width * 0.83},${height * 0.85} ${width},${height * 0.82} L${width},${height} L0,${height} Z`}" fill="${bg}"/>
  <rect x="${width / 2 - 30}" y="${textY}" width="60" height="6" rx="3" fill="${accent}"/>
  ${headlineLines.map((line, i) => `<text x="${width / 2}" y="${textY + 60 + i * 64}" text-anchor="middle" fill="white" font-family="${esc(headingFont)}, sans-serif" font-size="56" font-weight="800">${esc(line)}</text>`).join("\n  ")}
  ${bodyLines.map((line, i) => `<text x="${width / 2}" y="${textY + 60 + headlineLines.length * 64 + 30 + i * 40}" text-anchor="middle" fill="white" font-family="${esc(bodyFont)}, sans-serif" font-size="30" opacity="0.85">${esc(line)}</text>`).join("\n  ")}
  <rect x="${width - 130}" y="30" width="100" height="36" rx="18" fill="rgba(255,255,255,0.2)"/>
  <text x="${width - 80}" y="54" text-anchor="middle" fill="white" font-family="${esc(headingFont)}, sans-serif" font-size="16" font-weight="600">${badge}</text>
</svg>`;
  }

  // Default: wave_cover / story_cover / generic
  const textY = height * 0.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <path d="${wavePath}" fill="white"/>
  <rect x="60" y="${textY}" width="60" height="6" rx="3" fill="${accent}"/>
  ${headlineLines.map((line, i) => `<text x="60" y="${textY + 60 + i * 68}" fill="${dark}" font-family="${esc(headingFont)}, sans-serif" font-size="64" font-weight="800">${esc(line)}</text>`).join("\n  ")}
  ${bodyLines.map((line, i) => `<text x="60" y="${textY + 60 + headlineLines.length * 68 + 30 + i * 40}" fill="${dark}" font-family="${esc(bodyFont)}, sans-serif" font-size="32" opacity="0.8">${esc(line)}</text>`).join("\n  ")}
  ${badgeSvg}
</svg>`;
}

// Fetch image bytes from URL
async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith("data:image")) {
      const base64Data = url.split(",")[1];
      return Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    }
    if (url.startsWith("http")) {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return new Uint8Array(await resp.arrayBuffer());
    }
    return null;
  } catch (e) {
    console.error("[generate-download] Error fetching image:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { contentId } = await req.json();
    if (!contentId) {
      return new Response(JSON.stringify({ error: "contentId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: content, error: contentError } = await supabase
      .from("generated_contents")
      .select("*")
      .eq("id", contentId)
      .eq("user_id", userId)
      .single();

    if (contentError || !content) {
      return new Response(JSON.stringify({ error: "Content not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const slides = content.slides as Slide[];
    const brandSnapshot = content.brand_snapshot as BrandTokens | null;
    const visualMode = (content as any).visual_mode || "free";
    const zip = new JSZip();
    const imageUrls: string[] = [];

    const isFeed = content.content_type !== "story";
    const width = 1080;
    const height = isFeed ? 1350 : 1920;

    const useDeterministic = visualMode === "brand_strict" || (visualMode === "brand_guided" && !!brandSnapshot);
    console.log(`[generate-download] mode=${visualMode}, deterministic=${useDeterministic}, slides=${slides.length}, ${width}x${height}`);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const templateName = slide.templateHint || slide.template || "wave_cover";
      console.log(`[generate-download] Slide ${i + 1}/${slides.length} (template=${templateName}, role=${slide.role || 'unknown'})`);

      if (useDeterministic && brandSnapshot) {
        // Deterministic SVG
        const svg = renderSlideToSVG(slide, i, slides.length, brandSnapshot, width, height);
        const svgBytes = new TextEncoder().encode(svg);
        zip.file(`slide_${i + 1}.svg`, svgBytes);
        const svgB64 = btoa(unescape(encodeURIComponent(svg)));
        imageUrls.push(`data:image/svg+xml;base64,${svgB64}`);
      } else if (slide.previewImage) {
        // Use existing preview image
        const bytes = await fetchImageBytes(slide.previewImage);
        if (bytes) {
          const ext = slide.previewImage.includes("png") ? "png" : "jpg";
          zip.file(`slide_${i + 1}.${ext}`, bytes);
          imageUrls.push(slide.previewImage);
        }
      } else {
        // Fallback: generate AI image
        const prompt = `${slide.illustrationPrompt || slide.imagePrompt || slide.headline}. Professional healthcare marketing image, modern, clean, Instagram, high quality, ${width}x${height}. No text.`;
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          });
          if (response.ok) {
            const data = await response.json();
            const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (url) {
              imageUrls.push(url);
              const bytes = await fetchImageBytes(url);
              if (bytes) zip.file(`slide_${i + 1}.png`, bytes);
            }
          }
        } catch (e) {
          console.error(`[generate-download] AI image error slide ${i + 1}:`, e);
        }
      }
    }

    // Captions file
    let captionsText = `# ${content.title}\n\n`;
    if (brandSnapshot) captionsText += `## Marca: ${(brandSnapshot as any).name}\n`;
    captionsText += `## Modo Visual: ${visualMode}\n\n`;
    captionsText += `## Legenda Principal\n${content.caption}\n\n`;
    captionsText += `## Hashtags\n${content.hashtags?.join(" ") || ""}\n\n`;
    if ((content as any).source_summary) captionsText += `## Base do Conteúdo\n${(content as any).source_summary}\n\n`;
    captionsText += `## Slides\n\n`;
    slides.forEach((slide, idx) => {
      captionsText += `### Slide ${idx + 1} (${slide.role || "slide"})\n**${slide.headline}**\n${slide.body}\n`;
      if (slide.speakerNotes) captionsText += `_Speaker Notes: ${slide.speakerNotes}_\n`;
      captionsText += "\n";
    });
    zip.file("legendas.txt", captionsText);

    const zipContent = await zip.generateAsync({ type: "base64" });

    await supabase
      .from("generated_contents")
      .update({ image_urls: imageUrls, status: "approved", updated_at: new Date().toISOString() })
      .eq("id", contentId);

    console.log(`[generate-download] ZIP generated: ${imageUrls.length} files`);

    return new Response(JSON.stringify({
      success: true,
      zipBase64: zipContent,
      imageUrls,
      filename: `${content.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}_content.zip`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-download] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
