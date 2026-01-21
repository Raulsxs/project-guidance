import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Slide {
  headline: string;
  body: string;
  imagePrompt: string;
}

interface GenerateDownloadRequest {
  contentId: string;
}

async function generateImage(prompt: string, LOVABLE_API_KEY: string): Promise<string | null> {
  const enhancedPrompt = `${prompt}. Style: professional healthcare marketing, modern, clean design, suitable for Instagram, high quality, vibrant colors, professional healthcare aesthetic, 1080x1350 portrait format`;

  console.log("Generating image for prompt:", enhancedPrompt.substring(0, 100) + "...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        { role: "user", content: enhancedPrompt }
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    console.error("Image generation failed:", response.status);
    return null;
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  return imageUrl || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
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
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    const { contentId } = await req.json() as GenerateDownloadRequest;
    
    if (!contentId) {
      return new Response(JSON.stringify({ error: "contentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch content from database
    const { data: content, error: contentError } = await supabase
      .from("generated_contents")
      .select("*")
      .eq("id", contentId)
      .eq("user_id", userId)
      .single();

    if (contentError || !content) {
      console.error("Content fetch error:", contentError);
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
    const zip = new JSZip();
    const imageUrls: string[] = [];

    // Generate images for each slide
    console.log(`Generating ${slides.length} images...`);
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`Generating image ${i + 1}/${slides.length}`);
      
      const imageUrl = await generateImage(slide.imagePrompt, LOVABLE_API_KEY);
      
      if (imageUrl) {
        imageUrls.push(imageUrl);
        
        // Extract base64 data from data URL
        if (imageUrl.startsWith("data:image")) {
          const base64Data = imageUrl.split(",")[1];
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          zip.file(`slide_${i + 1}.png`, binaryData);
        }
      } else {
        console.warn(`Failed to generate image for slide ${i + 1}`);
      }
    }

    // Create captions text file
    let captionsText = `# ${content.title}\n\n`;
    captionsText += `## Legenda Principal\n${content.caption}\n\n`;
    captionsText += `## Hashtags\n${content.hashtags?.join(" ") || ""}\n\n`;
    captionsText += `## Slides\n\n`;
    
    slides.forEach((slide: Slide, index: number) => {
      captionsText += `### Slide ${index + 1}\n`;
      captionsText += `**${slide.headline}**\n`;
      captionsText += `${slide.body}\n\n`;
    });

    zip.file("legendas.txt", captionsText);

    // Generate ZIP
    const zipContent = await zip.generateAsync({ type: "base64" });

    // Update content with image URLs
    await supabase
      .from("generated_contents")
      .update({
        image_urls: imageUrls,
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentId);

    console.log("ZIP generated successfully");

    return new Response(JSON.stringify({
      success: true,
      zipBase64: zipContent,
      imageUrls,
      filename: `${content.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}_content.zip`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-download error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
