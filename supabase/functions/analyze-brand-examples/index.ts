import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brandId } = await req.json();
    if (!brandId) {
      return new Response(JSON.stringify({ error: "brandId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[analyze-brand-examples] Starting analysis for brand: ${brandId}`);

    // Fetch brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch examples (up to 3 images for multimodal)
    const { data: examples } = await supabase
      .from("brand_examples")
      .select("image_url, description, content_type")
      .eq("brand_id", brandId)
      .limit(3);

    if (!examples || examples.length === 0) {
      return new Response(JSON.stringify({ error: "No brand examples found. Upload at least 1 example image." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[analyze-brand-examples] Found ${examples.length} examples, palette: ${JSON.stringify(brand.palette)}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build multimodal message with images
    const contentParts: any[] = [
      {
        type: "text",
        text: `You are a brand identity analyst. Analyze these ${examples.length} brand example images and the brand metadata below. Return ONLY valid JSON (no markdown, no code fences).

Brand name: ${brand.name}
Current palette: ${JSON.stringify(brand.palette)}
Visual tone: ${brand.visual_tone || "not set"}
Fonts: ${JSON.stringify(brand.fonts)}

Analyze the visual patterns across ALL images and return this exact JSON structure:
{
  "style_preset": "<a short unique identifier like 'wave_minimal', 'navy_editorial', 'gradient_cards', etc.>",
  "recommended_templates": ["wave_cover", "wave_text_card", "solid_cover", "gradient_card"],
  "layout_rules": {
    "wave_position": "bottom or top - based on visual patterns seen",
    "card_style": "describe card styling: rounded, bordered, shadowed, etc.",
    "logo_position": "bottom-center, top-right, top-left, etc.",
    "typography_notes": "describe font weight, size relationships, alignment patterns"
  },
  "confirmed_palette": ["#hex1", "#hex2", "...reconfirm the dominant colors from the images, max 6"]
}

Focus on:
- Shape patterns (waves, curves, geometric elements)
- Color distribution (which color is dominant, accent, background)
- Text placement and card layouts
- Logo positioning
- Overall composition style`
      }
    ];

    // Add each example image as a URL reference
    for (const example of examples) {
      contentParts.push({
        type: "image_url",
        image_url: { url: example.image_url }
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: contentParts }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[analyze-brand-examples] AI error: ${response.status}`, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    console.log(`[analyze-brand-examples] AI response length: ${rawContent.length}`);

    // Parse JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[analyze-brand-examples] Could not parse JSON from:", rawContent.substring(0, 500));
      throw new Error("Failed to parse style guide from AI response");
    }

    const styleGuide = JSON.parse(jsonMatch[0]);
    console.log(`[analyze-brand-examples] Style preset: ${styleGuide.style_preset}, templates: ${styleGuide.recommended_templates?.join(", ")}`);

    // Save to brands.style_guide
    const { error: updateError } = await supabase
      .from("brands")
      .update({ style_guide: styleGuide })
      .eq("id", brandId);

    if (updateError) {
      console.error("[analyze-brand-examples] DB update error:", updateError);
      throw new Error("Failed to save style guide");
    }

    console.log(`[analyze-brand-examples] Style guide saved for brand ${brand.name}`);

    return new Response(JSON.stringify({
      success: true,
      styleGuide,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[analyze-brand-examples] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
