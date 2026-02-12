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

    const { brandId, categoryId } = await req.json();
    if (!brandId) throw new Error("brandId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Load brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id, name, palette, fonts, visual_tone, do_rules, dont_rules, logo_url, style_guide, style_guide_version")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) throw new Error("Brand not found");

    // Load categories
    const { data: categories } = await supabase
      .from("brand_example_categories")
      .select("id, name, description")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    // Determine which categories to process
    let categoriesToProcess: { id: string; name: string; description: string | null }[] = [];

    if (categoryId) {
      const cat = (categories || []).find((c: any) => c.id === categoryId);
      if (!cat) throw new Error("Category not found");
      categoriesToProcess = [cat];
    } else {
      const manualCats = (categories || []).filter((c: any) => c.name);
      if (manualCats.length > 0) {
        categoriesToProcess = manualCats;
      }
    }

    // Load ALL examples WITH image_url for multimodal
    const { data: allExamples } = await supabase
      .from("brand_examples")
      .select("id, image_url, type, subtype, description, category_id, category_mode")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!allExamples || allExamples.length === 0) {
      throw new Error("No brand examples found. Upload examples first.");
    }

    const paletteStr = Array.isArray(brand.palette)
      ? (brand.palette as string[]).join(", ")
      : "não definida";

    // ══════ PER-CATEGORY MODE ══════
    if (categoriesToProcess.length > 0) {
      const insertedSets: any[] = [];

      for (const cat of categoriesToProcess) {
        const catExamples = allExamples.filter((ex: any) => ex.category_id === cat.id);
        if (catExamples.length === 0) {
          console.log(`[generate-template-sets] Skipping category "${cat.name}" — no examples`);
          continue;
        }

        const result = await generateTemplateSetMultimodal({
          brand, cat, examples: catExamples,
          paletteStr, LOVABLE_API_KEY,
        });

        if (!result) continue;

        // Archive existing active set for this category
        await supabase
          .from("brand_template_sets")
          .update({ status: "archived" })
          .eq("brand_id", brandId)
          .eq("category_id", cat.id)
          .eq("status", "active");

        const { data: inserted, error: insertError } = await supabase
          .from("brand_template_sets")
          .insert({
            brand_id: brandId,
            name: cat.name,
            description: result.description || null,
            status: "active",
            source_example_ids: result.source_example_ids || [],
            category_id: cat.id,
            category_name: cat.name,
            visual_signature: result.visual_signature || null,
            template_set: {
              id_hint: result.id_hint,
              formats: result.formats,
              notes: result.notes || [],
              visual_signature: result.visual_signature || null,
              layout_params: result.layout_params || null,
            },
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[generate-template-sets] Insert error for "${cat.name}":`, insertError);
          continue;
        }
        insertedSets.push(inserted);
        console.log(`[generate-template-sets] Created set "${cat.name}" with layout_params: ${!!result.layout_params}`);
      }

      // Update brand metadata
      if (insertedSets.length > 0) {
        const { data: currentBrand } = await supabase
          .from("brands")
          .select("default_template_set_id")
          .eq("id", brandId)
          .single();

        const currentDefault = currentBrand?.default_template_set_id;
        const newIds = new Set(insertedSets.map((s: any) => s.id));
        const updatePayload: Record<string, any> = {
          template_sets_dirty: false,
          template_sets_dirty_count: 0,
          template_sets_status: "ready",
          template_sets_updated_at: new Date().toISOString(),
          template_sets_last_error: null,
        };
        if (!currentDefault || !newIds.has(currentDefault)) {
          updatePayload.default_template_set_id = insertedSets[0].id;
        }
        await supabase.from("brands").update(updatePayload).eq("id", brandId);
      }

      return new Response(JSON.stringify({
        success: true,
        count: insertedSets.length,
        templateSets: insertedSets,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════ LEGACY MODE (no manual categories) ══════
    const result = await generateTemplateSetMultimodal({
      brand,
      cat: { id: "legacy", name: brand.name, description: null },
      examples: allExamples,
      paletteStr, LOVABLE_API_KEY,
    });

    if (!result) throw new Error("AI returned no result");

    // Archive existing active sets
    await supabase
      .from("brand_template_sets")
      .update({ status: "archived" })
      .eq("brand_id", brandId)
      .eq("status", "active");

    const { data: inserted, error: insertError } = await supabase
      .from("brand_template_sets")
      .insert({
        brand_id: brandId,
        name: result.name || brand.name,
        description: result.description || null,
        status: "active",
        source_example_ids: result.source_example_ids || [],
        visual_signature: result.visual_signature || null,
        template_set: {
          id_hint: result.id_hint,
          formats: result.formats,
          notes: result.notes || [],
          visual_signature: result.visual_signature || null,
          layout_params: result.layout_params || null,
        },
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase.from("brands").update({
      template_sets_dirty: false,
      template_sets_dirty_count: 0,
      template_sets_status: "ready",
      template_sets_updated_at: new Date().toISOString(),
      template_sets_last_error: null,
      default_template_set_id: inserted.id,
    }).eq("id", brandId);

    return new Response(JSON.stringify({
      success: true,
      count: 1,
      templateSets: [inserted],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-template-sets] error:", error);
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { brandId: bId } = await req.clone().json().catch(() => ({ brandId: null }));
        if (bId) {
          await sb.from("brands").update({
            template_sets_status: "error",
            template_sets_last_error: error instanceof Error ? error.message : "Unknown error",
          }).eq("id", bId);
        }
      }
    } catch (_) { /* best effort */ }
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════ MULTIMODAL GENERATION ══════

interface GenerateParams {
  brand: any;
  cat: { id: string; name: string; description: string | null };
  examples: any[];
  paletteStr: string;
  LOVABLE_API_KEY: string;
}

async function generateTemplateSetMultimodal(params: GenerateParams) {
  const { brand, cat, examples, paletteStr, LOVABLE_API_KEY } = params;

  console.log(`[generate-template-sets] MULTIMODAL analysis for "${cat.name}" with ${examples.length} images...`);

  // Build multimodal message: text prompt + reference images
  const contentParts: any[] = [
    {
      type: "text",
      text: buildMultimodalPrompt(brand, cat, examples, paletteStr),
    }
  ];

  // Add up to 8 reference images for multimodal analysis
  const imagesToSend = examples.slice(0, 8);
  for (const ex of imagesToSend) {
    if (ex.image_url) {
      contentParts.push({
        type: "image_url",
        image_url: { url: ex.image_url },
      });
    }
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: contentParts }],
    }),
  });

  if (!response.ok) {
    console.error(`[generate-template-sets] AI error for "${cat.name}": ${response.status}`);
    if (response.status === 429) throw new Error("Rate limit exceeded. Try again later.");
    if (response.status === 402) throw new Error("Insufficient credits.");
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[generate-template-sets] No JSON found for "${cat.name}":`, content.substring(0, 500));
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[generate-template-sets] Parsed layout_params for "${cat.name}": ${JSON.stringify(Object.keys(parsed.layout_params || {}))}`);
    return parsed;
  } catch (e) {
    console.error(`[generate-template-sets] Parse error for "${cat.name}":`, e);
    return null;
  }
}

function buildMultimodalPrompt(brand: any, cat: any, examples: any[], paletteStr: string): string {
  const exampleMeta = examples.map((ex: any, i: number) =>
    `Image ${i + 1}: type=${ex.type}${ex.subtype ? '/' + ex.subtype : ''}, description="${ex.description || 'none'}"`
  ).join("\n");

  return `You are a senior visual design analyst. You are analyzing REAL reference images from a brand's content library.
Your job is to extract PRECISE layout parameters from what you SEE in the images, so a renderer can faithfully reproduce the same visual structure.

BRAND: ${brand.name}
PALETTE: ${paletteStr}
FONTS: ${JSON.stringify(brand.fonts)}
VISUAL TONE: ${brand.visual_tone || "clean"}
${brand.do_rules ? `POSITIVE RULES: ${brand.do_rules}` : ""}
${brand.dont_rules ? `NEGATIVE RULES: ${brand.dont_rules}` : ""}

CATEGORY: "${cat.name}"
${cat.description ? `Description: ${cat.description}` : ""}

IMAGES METADATA:
${exampleMeta}

INSTRUCTIONS:
1. LOOK CAREFULLY at each image. Identify the visual structure:
   - Is the background solid color, gradient, or photo?
   - Are there wave/curve shapes at the top or bottom? What height percentage?
   - Is there a card/box containing text? What style (rounded, sharp corners)?
   - Where is the text positioned (top, center, bottom)? Aligned left, center, right?
   - Is the headline uppercase? Bold weight? What approximate size relative to the canvas?
   - Is there a logo? Where? What size?
   - Are there decorative elements (accent bars, corner shapes, borders, icons)?
   - What's the spacing/padding pattern?

2. Classify each image by its role: cover, content/text, bullets/list, closing/cta

3. For EACH role you identify, extract layout_params

Return ONLY valid JSON (no markdown, no backticks):
{
  "name": "${cat.name}",
  "description": "brief description of when to use this style",
  "id_hint": "snake_case_identifier",
  "source_example_ids": [],
  "visual_signature": {
    "theme_variant": "describe the overall theme (e.g., dark_editorial, light_clinical, warm_organic, bold_modern)",
    "primary_bg_mode": "solid | gradient | image",
    "card_style": "none | rounded_card | sharp_card | bottom_card",
    "wave_enabled": true,
    "accent_usage": "minimal | moderate | strong"
  },
  "layout_params": {
    "cover": {
      "bg": {
        "type": "solid | gradient | image_overlay",
        "palette_index": 1,
        "gradient_angle": 135,
        "overlay_opacity": 0.5
      },
      "wave": { "enabled": false, "height_pct": 0, "palette_index": 0 },
      "card": { "enabled": false, "border_radius": 0, "palette_index": 3, "shadow": false, "position": "center" },
      "text": {
        "alignment": "center",
        "vertical_position": "center",
        "headline_size": 62,
        "headline_weight": 900,
        "headline_uppercase": true,
        "headline_letter_spacing": 0.02,
        "body_size": 30,
        "body_weight": 400,
        "body_italic": false,
        "text_color": "#ffffff",
        "body_color": "#ffffffcc"
      },
      "decorations": {
        "accent_bar": { "enabled": true, "position": "above_headline", "width": 60, "height": 6 },
        "corner_accents": { "enabled": false },
        "border": { "enabled": false }
      },
      "logo": { "position": "bottom-center", "opacity": 1, "size": 48 },
      "padding": { "x": 70, "y": 80 }
    },
    "content": {
      "bg": { "type": "solid", "palette_index": 1, "gradient_angle": 0, "overlay_opacity": 0 },
      "wave": { "enabled": false, "height_pct": 0, "palette_index": 0 },
      "card": { "enabled": false, "border_radius": 24, "palette_index": 3, "shadow": true, "position": "center" },
      "text": {
        "alignment": "center",
        "vertical_position": "center",
        "headline_size": 48,
        "headline_weight": 800,
        "headline_uppercase": true,
        "headline_letter_spacing": 0.02,
        "body_size": 26,
        "body_weight": 400,
        "body_italic": false,
        "text_color": "#ffffff",
        "body_color": "#ffffffcc"
      },
      "decorations": {
        "accent_bar": { "enabled": true, "position": "above_headline", "width": 48, "height": 4 },
        "corner_accents": { "enabled": false },
        "border": { "enabled": false }
      },
      "logo": { "position": "bottom-center", "opacity": 0.35, "size": 40 },
      "padding": { "x": 60, "y": 80 }
    },
    "bullets": {
      "bg": { "type": "solid", "palette_index": 1, "gradient_angle": 0, "overlay_opacity": 0 },
      "wave": { "enabled": false, "height_pct": 0, "palette_index": 0 },
      "card": { "enabled": false, "border_radius": 16, "palette_index": 3, "shadow": false, "position": "center" },
      "bullet_style": {
        "type": "numbered_circle | checkmark | dash | icon",
        "accent_palette_index": 2,
        "container_enabled": false,
        "container_palette_index": 3,
        "container_border_radius": 16
      },
      "text": {
        "alignment": "left",
        "vertical_position": "center",
        "headline_size": 46,
        "headline_weight": 900,
        "headline_uppercase": true,
        "headline_letter_spacing": 0.02,
        "body_size": 24,
        "body_weight": 500,
        "body_italic": false,
        "text_color": "#ffffff",
        "body_color": "#ffffffcc"
      },
      "decorations": {
        "accent_bar": { "enabled": true, "position": "above_headline", "width": 48, "height": 4 },
        "corner_accents": { "enabled": false },
        "border": { "enabled": false }
      },
      "logo": { "position": "bottom-center", "opacity": 0.35, "size": 40 },
      "padding": { "x": 60, "y": 80 }
    },
    "cta": {
      "bg": { "type": "solid", "palette_index": 1, "gradient_angle": 0, "overlay_opacity": 0 },
      "wave": { "enabled": false, "height_pct": 0, "palette_index": 0 },
      "card": { "enabled": false, "border_radius": 0, "palette_index": 3, "shadow": false, "position": "center" },
      "cta_icons": {
        "enabled": true,
        "style": "emoji | minimal | bold",
        "items": ["like", "send", "save", "comment"]
      },
      "text": {
        "alignment": "center",
        "vertical_position": "center",
        "headline_size": 56,
        "headline_weight": 900,
        "headline_uppercase": true,
        "headline_letter_spacing": 0.02,
        "body_size": 36,
        "body_weight": 500,
        "body_italic": false,
        "text_color": "#ffffff",
        "body_color": "#ffffffcc"
      },
      "decorations": {
        "accent_bar": { "enabled": true, "position": "above_headline", "width": 60, "height": 6 },
        "corner_accents": { "enabled": false },
        "border": { "enabled": false }
      },
      "logo": { "position": "bottom-center", "opacity": 1, "size": 48 },
      "padding": { "x": 60, "y": 60 }
    }
  },
  "formats": {
    "carousel": {
      "slide_count_range": [4, 9],
      "cta_policy": "optional",
      "text_limits": { "headline_chars": [35, 60], "body_chars": [140, 260], "bullets_max": 5 }
    },
    "post": {
      "text_limits": { "headline_chars": [35, 60], "body_chars": [140, 260] }
    },
    "story": {
      "text_limits": { "headline_chars": [25, 45], "body_chars": [90, 160] }
    }
  },
  "notes": ["pattern 1 observed", "pattern 2 observed"]
}

CRITICAL RULES:
- Look at the ACTUAL images. Extract what you SEE, not what you guess.
- bg.palette_index refers to the brand palette array index (0-based). Use 0 for primary light, 1 for primary dark, 2 for accent, 3 for soft bg.
- wave.enabled=true means you saw actual curved/wave shapes in the images. If not, set false.
- card.enabled=true means text is inside a visible box/card shape. If text is directly on background, set false.
- text.alignment and vertical_position must match what you see in the images.
- headline_uppercase=true only if you see UPPERCASE text in the images.
- Each layout_params role (cover, content, bullets, cta) should faithfully describe the corresponding images.
- If you only see covers, infer the other roles from the same visual system but be explicit about it.
- The "name" MUST be exactly "${cat.name}".`;
}
