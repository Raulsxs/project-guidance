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

function buildImagePromptWithBrand(basePrompt: string, tokens: BrandTokens): string {
  const colorHexes = tokens.palette.map((c) => c.hex).filter(Boolean).join(", ");

  return [
    "=== BRAND TOKENS (USE EXACTLY) ===",
    `Visual style: ${tokens.visual_tone}`,
    `Color palette: ${colorHexes || "professional defaults"}`,
    tokens.do_rules ? `Rules: ${tokens.do_rules}` : "",
    "",
    "=== MANDATORY RULES ===",
    `- Dominant colors: ${colorHexes}`,
    `- Style: ${tokens.visual_tone}`,
    "- NO text overlays on the image",
    "- Ultra high resolution, professional quality",
    "",
    "=== NEGATIVES (FORBIDDEN) ===",
    tokens.dont_rules ? `- ${tokens.dont_rules}` : "",
    "- No watermarks, no generic stock feel, no text",
    "",
    "=== OUTPUT ===",
    "Background/illustration only. No text.",
    basePrompt,
    "Style: Editorial photography, premium magazine quality, 1080x1350 portrait format for Instagram.",
  ].filter(Boolean).join("\n");
}

async function generateImage(prompt: string, LOVABLE_API_KEY: string): Promise<string | null> {
  console.log("[generate-download] Image prompt:", prompt.substring(0, 120) + "...");

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

  if (!response.ok) {
    console.error("[generate-download] Image generation failed:", response.status);
    return null;
  }

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
    console.log("[generate-download] User:", userId);

    const { contentId } = await req.json();
    
    if (!contentId) {
      return new Response(JSON.stringify({ error: "contentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch content WITH brand_snapshot
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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const slides = content.slides as Slide[];
    const brandSnapshot = content.brand_snapshot as BrandTokens | null;
    const zip = new JSZip();
    const imageUrls: string[] = [];

    console.log(`[generate-download] Generating ${slides.length} images${brandSnapshot ? ` with brand "${brandSnapshot.name}"` : ' without brand'}...`);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`[generate-download] Generating image ${i + 1}/${slides.length}`);
      
      let finalPrompt: string;
      if (brandSnapshot) {
        finalPrompt = buildImagePromptWithBrand(slide.imagePrompt, brandSnapshot);
      } else {
        finalPrompt = `${slide.imagePrompt}. Style: professional healthcare marketing, modern, clean design, suitable for Instagram, high quality, 1080x1350 portrait format. No text overlays.`;
      }

      const imageUrl = await generateImage(finalPrompt, LOVABLE_API_KEY);
      
      if (imageUrl) {
        imageUrls.push(imageUrl);
        
        if (imageUrl.startsWith("data:image")) {
          const base64Data = imageUrl.split(",")[1];
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          zip.file(`slide_${i + 1}.png`, binaryData);
        }
      } else {
        console.warn(`[generate-download] Failed to generate image for slide ${i + 1}`);
      }
    }

    // Create captions file
    let captionsText = `# ${content.title}\n\n`;
    if (brandSnapshot) {
      captionsText += `## Marca: ${brandSnapshot.name}\n\n`;
    }
    captionsText += `## Legenda Principal\n${content.caption}\n\n`;
    captionsText += `## Hashtags\n${content.hashtags?.join(" ") || ""}\n\n`;
    captionsText += `## Slides\n\n`;
    
    slides.forEach((slide: Slide, index: number) => {
      captionsText += `### Slide ${index + 1}\n`;
      captionsText += `**${slide.headline}**\n`;
      captionsText += `${slide.body}\n\n`;
    });

    zip.file("legendas.txt", captionsText);

    const zipContent = await zip.generateAsync({ type: "base64" });

    await supabase
      .from("generated_contents")
      .update({
        image_urls: imageUrls,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentId);

    console.log("[generate-download] ZIP generated successfully");

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
