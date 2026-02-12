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

    const { brandId, slides, slideIndex, contentId, articleUrl, articleContent } = await req.json();

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      throw new Error("slides array is required");
    }

    // ══════ LOAD BRAND REFERENCE IMAGES ══════
    let referenceImageUrls: string[] = [];
    let brandInfo: any = null;

    if (brandId) {
      const [brandResult, examplesResult] = await Promise.all([
        supabase
          .from("brands")
          .select("name, palette, fonts, visual_tone, do_rules, dont_rules, logo_url")
          .eq("id", brandId)
          .single(),
        supabase
          .from("brand_examples")
          .select("image_url, type, subtype, description")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      brandInfo = brandResult.data;
      referenceImageUrls = (examplesResult.data || [])
        .map((e: any) => e.image_url)
        .filter(Boolean);
    }

    // ══════ DETERMINE WHICH SLIDES TO GENERATE ══════
    const slidesToGenerate = slideIndex != null
      ? [{ slide: slides[slideIndex], index: slideIndex }]
      : slides.map((slide: any, i: number) => ({ slide, index: i }));

    console.log(`[generate-slide-images] Generating ${slidesToGenerate.length} slide(s) with ${referenceImageUrls.length} reference images`);

    const results: any[] = [...slides]; // Copy all slides

    for (const { slide, index } of slidesToGenerate) {
      try {
        const imageUrl = await generateSlideImage({
          slide,
          slideIndex: index,
          totalSlides: slides.length,
          referenceImageUrls,
          brandInfo,
          articleUrl,
          articleContent,
          LOVABLE_API_KEY,
          supabaseAdmin,
          contentId,
        });

        if (imageUrl) {
          results[index] = { ...results[index], previewImage: imageUrl };
          console.log(`[generate-slide-images] ✅ Slide ${index + 1}/${slides.length} generated`);
        } else {
          console.log(`[generate-slide-images] ⚠️ Slide ${index + 1} - no image returned`);
        }
      } catch (err) {
        console.error(`[generate-slide-images] ❌ Slide ${index + 1} error:`, err);
        // Continue with other slides
      }
    }

    return new Response(JSON.stringify({
      success: true,
      slides: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-slide-images] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════ GENERATE A SINGLE SLIDE IMAGE ══════

interface GenerateSlideParams {
  slide: any;
  slideIndex: number;
  totalSlides: number;
  referenceImageUrls: string[];
  brandInfo: any;
  articleUrl?: string;
  articleContent?: string;
  LOVABLE_API_KEY: string;
  supabaseAdmin: any;
  contentId?: string;
}

async function generateSlideImage(params: GenerateSlideParams): Promise<string | null> {
  const {
    slide, slideIndex, totalSlides, referenceImageUrls,
    brandInfo, articleUrl, articleContent,
    LOVABLE_API_KEY, supabaseAdmin, contentId,
  } = params;

  // Build multimodal content: reference images + prompt
  const contentParts: any[] = [];

  // Add reference images (max 6 to avoid token limits)
  for (const imgUrl of referenceImageUrls.slice(0, 6)) {
    contentParts.push({
      type: "image_url",
      image_url: { url: imgUrl },
    });
  }

  // Build the text prompt
  const prompt = buildSlidePrompt(slide, slideIndex, totalSlides, brandInfo, articleUrl, articleContent);
  contentParts.push({ type: "text", text: prompt });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{ role: "user", content: contentParts }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("Rate limit exceeded. Try again later.");
    if (status === 402) throw new Error("Insufficient credits.");
    throw new Error(`AI image error: ${status}`);
  }

  const data = await response.json();
  const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!base64Image) return null;

  // Upload to Supabase Storage
  const imageUrl = await uploadBase64ToStorage(supabaseAdmin, base64Image, contentId || "draft", slideIndex);
  return imageUrl;
}

// ══════ PROMPT BUILDER ══════

function buildSlidePrompt(
  slide: any,
  slideIndex: number,
  totalSlides: number,
  brandInfo: any,
  articleUrl?: string,
  articleContent?: string,
): string {
  const role = slide.role || (slideIndex === 0 ? "cover" : slideIndex === totalSlides - 1 ? "cta" : "content");
  const headline = slide.headline || "";
  const body = slide.body || "";
  const bullets = slide.bullets || [];

  const paletteStr = brandInfo?.palette
    ? (Array.isArray(brandInfo.palette)
      ? brandInfo.palette.map((c: any) => typeof c === "string" ? c : c.hex).join(", ")
      : "")
    : "";

  let roleDescription = "";
  switch (role) {
    case "cover":
      roleDescription = "This is the COVER slide (first slide of the carousel). It should be the most visually striking, with a strong headline that grabs attention. It often features a mockup, main visual element, or bold typography.";
      break;
    case "context":
      roleDescription = "This is a CONTEXT slide that provides background information. It should present the topic clearly with supporting text.";
      break;
    case "insight":
      roleDescription = "This is an INSIGHT slide that presents a key finding or argument. It should be informative and visually organized.";
      break;
    case "bullets":
      roleDescription = "This is a BULLET POINTS slide that lists key items clearly. Use visual markers (checkmarks, numbers, or icons) for each point.";
      break;
    case "cta":
      roleDescription = "This is the CLOSING/CTA slide (last slide). It should encourage engagement with a clear call-to-action.";
      break;
    default:
      roleDescription = "This is a content slide presenting information clearly.";
  }

  const brandContext = brandInfo ? `
BRAND IDENTITY:
- Name: ${brandInfo.name}
- Colors: ${paletteStr}
- Fonts: Headings="${brandInfo.fonts?.headings || 'Inter'}", Body="${brandInfo.fonts?.body || 'Inter'}"
- Visual tone: ${brandInfo.visual_tone || "professional"}
${brandInfo.do_rules ? `- Design DO: ${brandInfo.do_rules}` : ""}
${brandInfo.dont_rules ? `- Design DON'T: ${brandInfo.dont_rules}` : ""}
` : "";

  const articleContext = articleUrl ? `\nSource article: ${articleUrl}` : "";
  const articleSnippet = articleContent ? `\nArticle excerpt: ${articleContent.substring(0, 500)}` : "";

  return `You are given reference images showing the visual style of an Instagram carousel from a specific brand. 
Your task is to CREATE A NEW Instagram carousel slide (1080x1350px, portrait format) that follows the EXACT SAME visual style, layout structure, typography style, color scheme, and design patterns you see in these references.

${roleDescription}

SLIDE ${slideIndex + 1} of ${totalSlides}:
${headline ? `HEADLINE TEXT: "${headline}"` : ""}
${body ? `BODY TEXT: "${body}"` : ""}
${bullets.length > 0 ? `BULLET POINTS:\n${bullets.map((b: string, i: number) => `  ${i + 1}. ${b}`).join("\n")}` : ""}
${brandContext}${articleContext}${articleSnippet}

CRITICAL INSTRUCTIONS:
1. MATCH the visual style of the reference images EXACTLY — same color palette, same layout structure, same decorative elements
2. Include ALL the text content provided above rendered beautifully on the slide
3. The slide must be in PORTRAIT format (taller than wide, like an Instagram post)
4. Text must be LEGIBLE — use proper contrast, sizing, and spacing
5. Use the brand's color palette and visual language as seen in the references
6. DO NOT add random stock photos unless the references show that pattern
7. Maintain consistent design language across all slides in the carousel
8. The slide should look PROFESSIONAL and ready to publish on Instagram
9. Include the brand logo if visible in the references (position it similarly)
10. Keep the same background treatment (gradient, solid, pattern) as the references`;
}

// ══════ STORAGE UPLOAD ══════

async function uploadBase64ToStorage(
  supabaseAdmin: any,
  base64Data: string,
  contentId: string,
  slideIndex: number,
): Promise<string> {
  // Extract actual base64 data (remove data:image/png;base64, prefix if present)
  const base64Clean = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  // Determine mime type
  const mimeMatch = base64Data.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

  // Decode base64
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
