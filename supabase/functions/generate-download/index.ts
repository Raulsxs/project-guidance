import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Slide {
  headline: string;
  body: string;
  imagePrompt: string;
  previewImage?: string;
  templateHint?: string;
}

interface BrandTokens {
  name: string;
  palette: { name: string; hex: string }[];
  fonts: { headings: string; body: string };
  visual_tone: string;
  logo_url: string | null;
  do_rules: string | null;
  dont_rules: string | null;
  image_style: string;
}

// Build SVG-based deterministic slide (server-side render)
function renderSlideToSVG(
  slide: Slide,
  slideIndex: number,
  totalSlides: number,
  brand: BrandTokens,
  width: number,
  height: number,
): string {
  const palette = brand.palette.map(c => c.hex);
  const bg = palette[0] || "#a4d3eb";
  const dark = palette[1] || "#10559a";
  const accent = palette[2] || "#c52244";
  const cardBg = palette[3] || "#f5eaee";
  const headingFont = brand.fonts?.headings || "Inter";
  const bodyFont = brand.fonts?.body || "Inter";
  const isWaveCard = slide.templateHint === "wave_text_card";

  const badge = slideIndex === 0 ? "CAPA" : slideIndex === totalSlides - 1 ? "CTA" : `${slideIndex + 1}/${totalSlides}`;

  // Escape XML entities
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Word-wrap text for SVG
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

  // Wave path
  const wavePath = `M0,${height * 0.85} C${width * 0.17},${height * 0.82} ${width * 0.33},${height * 0.88} ${width * 0.5},${height * 0.85} C${width * 0.67},${height * 0.82} ${width * 0.83},${height * 0.88} ${width},${height * 0.85} L${width},${height} L0,${height} Z`;

  if (isWaveCard) {
    // Card template
    const cardY = height * 0.25;
    const cardH = height * 0.45;
    const cardW = width * 0.82;
    const cardX = (width - cardW) / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <path d="${wavePath}" fill="white"/>
  
  <!-- Card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="24" fill="white" stroke="${cardBg}" stroke-width="3"/>
  
  <!-- Accent bar -->
  <rect x="${width / 2 - 24}" y="${cardY + 48}" width="48" height="4" rx="2" fill="${accent}"/>
  
  <!-- Headline -->
  ${headlineLines.map((line, i) => `<text x="${width / 2}" y="${cardY + 100 + i * 52}" text-anchor="middle" fill="${dark}" font-family="${esc(headingFont)}, sans-serif" font-size="48" font-weight="700">${esc(line)}</text>`).join("\n  ")}
  
  <!-- Body -->
  ${bodyLines.map((line, i) => `<text x="${width / 2}" y="${cardY + 100 + headlineLines.length * 52 + 30 + i * 36}" text-anchor="middle" fill="${dark}" font-family="${esc(bodyFont)}, sans-serif" font-size="28" opacity="0.75">${esc(line)}</text>`).join("\n  ")}
  
  <!-- Badge -->
  <rect x="${width - 130}" y="30" width="100" height="36" rx="18" fill="${dark}"/>
  <text x="${width - 80}" y="54" text-anchor="middle" fill="white" font-family="${esc(headingFont)}, sans-serif" font-size="16" font-weight="600">${badge}</text>
</svg>`;
  }

  // Default: wave_cover template
  const textY = height * 0.4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <path d="${wavePath}" fill="white"/>
  
  <!-- Accent bar -->
  <rect x="60" y="${textY}" width="60" height="6" rx="3" fill="${accent}"/>
  
  <!-- Headline -->
  ${headlineLines.map((line, i) => `<text x="60" y="${textY + 60 + i * 68}" fill="${dark}" font-family="${esc(headingFont)}, sans-serif" font-size="64" font-weight="800">${esc(line)}</text>`).join("\n  ")}
  
  <!-- Body -->
  ${bodyLines.map((line, i) => `<text x="60" y="${textY + 60 + headlineLines.length * 68 + 30 + i * 40}" fill="${dark}" font-family="${esc(bodyFont)}, sans-serif" font-size="32" opacity="0.8">${esc(line)}</text>`).join("\n  ")}
  
  <!-- Badge -->
  <rect x="${width - 130}" y="30" width="100" height="36" rx="18" fill="${dark}"/>
  <text x="${width - 80}" y="54" text-anchor="middle" fill="white" font-family="${esc(headingFont)}, sans-serif" font-size="16" font-weight="600">${badge}</text>
</svg>`;
}

// Convert SVG to PNG using resvg-wasm (Deno-compatible)
async function svgToPng(svg: string): Promise<Uint8Array> {
  // Use the Lovable AI gateway to convert SVG to a rendered image
  // Since we can't run resvg in Deno easily, we encode SVG as data URI
  const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
  return Uint8Array.from(atob(svgBase64), c => c.charCodeAt(0));
}

async function generateAIImage(prompt: string, brand: BrandTokens, LOVABLE_API_KEY: string): Promise<string | null> {
  const colorHexes = brand.palette.map(c => c.hex).filter(Boolean).join(", ");
  const fullPrompt = [
    "=== BRAND TOKENS (USE EXACTLY) ===",
    `Visual style: ${brand.visual_tone}`,
    `Color palette: ${colorHexes || "professional defaults"}`,
    brand.do_rules ? `Rules: ${brand.do_rules}` : "",
    "=== MANDATORY RULES ===",
    `- Dominant colors: ${colorHexes}`,
    "- NO text overlays on the image",
    "- Ultra high resolution, professional quality",
    "=== NEGATIVES (FORBIDDEN) ===",
    brand.dont_rules ? `- ${brand.dont_rules}` : "",
    "- No watermarks, no generic stock feel, no text",
    "=== OUTPUT ===",
    "Background/illustration only. No text.",
    prompt,
    "Style: Editorial photography, premium magazine quality, 1080x1350 portrait format.",
  ].filter(Boolean).join("\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: fullPrompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { contentId } = await req.json();
    if (!contentId) {
      return new Response(JSON.stringify({ error: "contentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const slides = content.slides as Slide[];
    const brandSnapshot = content.brand_snapshot as BrandTokens | null;
    const zip = new JSZip();
    const imageUrls: string[] = [];
    
    // Determine dimensions based on content type
    const isFeed = content.content_type !== "story";
    const width = 1080;
    const height = isFeed ? 1350 : 1920;

    const useDeterministic = !!brandSnapshot && slides.some(s => s.templateHint);
    console.log(`[generate-download] Mode: ${useDeterministic ? 'DETERMINISTIC' : 'AI'}, ${slides.length} slides, ${width}x${height}`);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`[generate-download] Processing slide ${i + 1}/${slides.length} (template: ${slide.templateHint || 'none'})`);

      if (useDeterministic && brandSnapshot) {
        // Deterministic SVG render
        const svg = renderSlideToSVG(slide, i, slides.length, brandSnapshot, width, height);
        const svgBytes = new TextEncoder().encode(svg);
        zip.file(`slide_${i + 1}.svg`, svgBytes);
        
        // Also save base64 SVG as a data URI for preview
        const svgB64 = btoa(unescape(encodeURIComponent(svg)));
        imageUrls.push(`data:image/svg+xml;base64,${svgB64}`);
      } else if (brandSnapshot) {
        // AI image generation with brand
        const imageUrl = await generateAIImage(slide.imagePrompt, brandSnapshot, LOVABLE_API_KEY);
        if (imageUrl) {
          imageUrls.push(imageUrl);
          if (imageUrl.startsWith("data:image")) {
            const base64Data = imageUrl.split(",")[1];
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            zip.file(`slide_${i + 1}.png`, binaryData);
          }
        }
      } else {
        // No brand at all - basic AI generation
        const prompt = `${slide.imagePrompt}. Style: professional healthcare marketing, modern, clean, Instagram, high quality, 1080x1350 portrait. No text.`;
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
            if (url.startsWith("data:image")) {
              const b64 = url.split(",")[1];
              zip.file(`slide_${i + 1}.png`, Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
            }
          }
        }
      }
    }

    // Captions file
    let captionsText = `# ${content.title}\n\n`;
    if (brandSnapshot) captionsText += `## Marca: ${brandSnapshot.name}\n\n`;
    captionsText += `## Legenda Principal\n${content.caption}\n\n`;
    captionsText += `## Hashtags\n${content.hashtags?.join(" ") || ""}\n\n`;
    captionsText += `## Slides\n\n`;
    slides.forEach((slide, idx) => {
      captionsText += `### Slide ${idx + 1}\n**${slide.headline}**\n${slide.body}\n\n`;
    });
    zip.file("legendas.txt", captionsText);

    const zipContent = await zip.generateAsync({ type: "base64" });

    await supabase
      .from("generated_contents")
      .update({ image_urls: imageUrls, status: "approved", updated_at: new Date().toISOString() })
      .eq("id", contentId);

    console.log(`[generate-download] ZIP generated: ${imageUrls.length} files, deterministic=${useDeterministic}`);

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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
