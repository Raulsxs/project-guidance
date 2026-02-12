import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { brandId, slide, slideIndex, totalSlides, contentFormat, articleUrl, articleContent, contentId } = await req.json();

    if (!slide) throw new Error("slide object is required");
    if (!brandId) throw new Error("brandId is required");

    // ══════ LOAD BRAND + REFERENCE IMAGES (filtered by content format) ══════
    const contentTypeFilter = contentFormat === "carousel" ? "carrossel"
      : contentFormat === "story" ? "story"
      : "post";

    const [brandResult, examplesResult] = await Promise.all([
      supabase
        .from("brands")
        .select("name, palette, fonts, visual_tone, do_rules, dont_rules, logo_url")
        .eq("id", brandId)
        .single(),
      supabase
        .from("brand_examples")
        .select("image_url, type, subtype, carousel_group_id, slide_index")
        .eq("brand_id", brandId)
        .in("type", [contentTypeFilter, "carrossel"]) // always include carousel refs
        .order("carousel_group_id", { ascending: true, nullsFirst: false })
        .order("slide_index", { ascending: true })
        .limit(12),
    ]);

    const brandInfo = brandResult.data;
    const referenceImageUrls = (examplesResult.data || [])
      .map((e: any) => e.image_url)
      .filter(Boolean);

    console.log(`[generate-slide-images] Slide ${(slideIndex || 0) + 1}/${totalSlides || "?"}, ${referenceImageUrls.length} refs (filter: ${contentTypeFilter})`);

    // ══════ BUILD MULTIMODAL REQUEST ══════
    const contentParts: any[] = [];

    // Add reference images (max 6 to reduce payload)
    for (const imgUrl of referenceImageUrls.slice(0, 6)) {
      contentParts.push({
        type: "image_url",
        image_url: { url: imgUrl },
      });
    }

    // Build prompt
    const prompt = buildPrompt(slide, slideIndex || 0, totalSlides || 1, brandInfo, articleUrl, articleContent, contentFormat);
    contentParts.push({ type: "text", text: prompt });

    // Retry logic for transient errors (502, 503, 429)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000 + Math.random() * 2000;
        console.log(`[generate-slide-images] Retry ${attempt}/2 after ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!base64Image) {
          return new Response(JSON.stringify({ success: true, imageUrl: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const imageUrl = await uploadBase64ToStorage(supabaseAdmin, base64Image, contentId || "draft", slideIndex || 0);
        console.log(`[generate-slide-images] ✅ Slide ${(slideIndex || 0) + 1} uploaded`);

        return new Response(JSON.stringify({ success: true, imageUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = response.status;
      if (status === 402) throw new Error("Insufficient credits.");
      
      // Retryable errors
      if (status === 429 || status === 502 || status === 503) {
        const errText = await response.text();
        console.warn(`[generate-slide-images] Retryable error ${status} on attempt ${attempt + 1}`);
        lastError = new Error(`AI error: ${status}`);
        continue;
      }

      // Non-retryable
      const errText = await response.text();
      console.error(`[generate-slide-images] Non-retryable error ${status}:`, errText.substring(0, 200));
      throw new Error(`AI image error: ${status}`);
    }

    throw lastError || new Error("Max retries exceeded");

  } catch (error) {
    console.error("[generate-slide-images] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════ PROMPT BUILDER ══════

function buildPrompt(
  slide: any,
  slideIndex: number,
  totalSlides: number,
  brandInfo: any,
  articleUrl?: string,
  articleContent?: string,
  contentFormat?: string,
): string {
  const role = slide.role || (slideIndex === 0 ? "cover" : slideIndex === totalSlides - 1 ? "cta" : "content");
  const headline = slide.headline || "";
  const body = slide.body || "";
  const bullets = slide.bullets || [];

  const formatStr = contentFormat === "story" ? "1080x1920 (Story, portrait 9:16)"
    : contentFormat === "post" ? "1080x1350 (Post, portrait 4:5)"
    : "1080x1350 (Carousel slide, portrait 4:5)";

  let roleDesc = "";
  switch (role) {
    case "cover": roleDesc = "COVER slide — first slide, most visually striking, bold headline, grabs attention."; break;
    case "context": roleDesc = "CONTEXT slide — provides background information clearly."; break;
    case "insight": roleDesc = "INSIGHT slide — presents a key finding with supporting data."; break;
    case "bullets": roleDesc = "BULLET POINTS slide — lists key items with visual markers."; break;
    case "cta": roleDesc = "CTA/CLOSING slide — encourages engagement with a call-to-action."; break;
    default: roleDesc = "Content slide presenting information clearly.";
  }

  const paletteStr = brandInfo?.palette
    ? (Array.isArray(brandInfo.palette)
      ? brandInfo.palette.map((c: any) => typeof c === "string" ? c : c.hex).join(", ")
      : "")
    : "";

  const brandBlock = brandInfo ? `
BRAND: ${brandInfo.name}
Colors: ${paletteStr}
Visual tone: ${brandInfo.visual_tone || "professional"}
${brandInfo.do_rules ? `DO: ${brandInfo.do_rules}` : ""}
${brandInfo.dont_rules ? `DON'T: ${brandInfo.dont_rules}` : ""}` : "";

  const articleBlock = articleUrl ? `\nSource: ${articleUrl}` : "";
  const articleSnippet = articleContent ? `\nArticle excerpt: ${articleContent.substring(0, 800)}` : "";

  return `I'm showing you reference images from a brand's Instagram. CREATE a NEW slide that follows the EXACT SAME visual style, layout, typography, colors, and design patterns.

${roleDesc}

SLIDE ${slideIndex + 1} of ${totalSlides} — Format: ${formatStr}
${headline ? `HEADLINE: "${headline}"` : ""}
${body ? `BODY: "${body}"` : ""}
${bullets.length > 0 ? `BULLETS:\n${bullets.map((b: string, i: number) => `  ${i + 1}. ${b}`).join("\n")}` : ""}
${brandBlock}${articleBlock}${articleSnippet}

CRITICAL RULES:
1. MATCH the visual style of the reference images EXACTLY — same colors, layout, decorative elements, card styles, background treatment
2. Include ALL text content above, rendered beautifully and legibly on the slide
3. The slide must be PORTRAIT format (${formatStr})
4. Text must be LEGIBLE with proper contrast and sizing
5. Maintain the brand's visual language consistently
6. If references show phone mockups, cards, specific decorative elements — replicate them
7. The result must look PROFESSIONAL and ready to publish
8. DO NOT add random stock photos unless references show that pattern`;
}

// ══════ STORAGE UPLOAD ══════

async function uploadBase64ToStorage(
  supabaseAdmin: any,
  base64Data: string,
  contentId: string,
  slideIndex: number,
): Promise<string> {
  const base64Clean = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  const mimeMatch = base64Data.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fileName = `ai-slides/${contentId}/slide-${slideIndex}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("generated-images")
    .upload(fileName, bytes.buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[generate-slide-images] Upload error:", uploadError);
    throw new Error("Failed to upload generated image");
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("generated-images")
    .getPublicUrl(fileName);

  return publicUrl;
}
