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
        console.log(`[generate-template-sets] Created set "${cat.name}" with layout_params keys: ${JSON.stringify(Object.keys(result.layout_params || {}))}`);
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
    console.log(`[generate-template-sets] Parsed for "${cat.name}": layout_params keys=${JSON.stringify(Object.keys(parsed.layout_params || {}))}, visual_signature=${JSON.stringify(parsed.visual_signature)}`);
    return parsed;
  } catch (e) {
    console.error(`[generate-template-sets] Parse error for "${cat.name}":`, e);
    return null;
  }
}

function buildMultimodalPrompt(brand: any, cat: any, examples: any[], paletteStr: string): string {
  // Group examples by subtype/role
  const byRole: Record<string, any[]> = {};
  examples.forEach((ex: any) => {
    const role = ex.subtype || ex.type || "unknown";
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(ex);
  });

  const exampleMeta = examples.map((ex: any, i: number) =>
    `Image ${i + 1}: role="${ex.subtype || 'general'}", type=${ex.type}, description="${ex.description || 'none'}"`
  ).join("\n");

  const rolesSummary = Object.entries(byRole).map(([role, exs]) => `  - ${role}: ${exs.length} image(s)`).join("\n");

  return `You are an expert visual design reverse-engineer. You must analyze the PROVIDED IMAGES and extract the EXACT visual layout structure you see.

Your output will be used by a programmatic renderer that supports these visual features:
- Background: solid color, linear gradient (any angle), or photo with color overlay
- Decorative shapes: SVG wave curves, diagonal clip cuts, horizontal divider bars
- Content cards: floating rounded/sharp rectangles with optional shadow, positioned center/bottom/top
- Text: any alignment (left/center/right), any vertical position (top/center/bottom), with configurable size/weight/case
- Decorative elements: accent bars (horizontal lines above/below headlines), corner accents (gradient triangles), borders, inner frames
- Logo: any position (top-left, top-center, top-right, bottom-left, bottom-center, bottom-right)
- Bullets: numbered circles, checkmarks, dashes, with optional container card
- Device mockups: phone frame overlaying the background (for showcasing app screens, articles, etc.)
- Multiple text boxes: separate floating cards for headline and body content

BRAND CONTEXT:
- Name: ${brand.name}
- Palette (hex): ${paletteStr}
- Fonts: headings="${(brand.fonts as any)?.headings || 'Inter'}", body="${(brand.fonts as any)?.body || 'Inter'}"
- Visual tone: ${brand.visual_tone || "clean"}
${brand.do_rules ? `- Design rules (DO): ${brand.do_rules}` : ""}
${brand.dont_rules ? `- Design rules (DON'T): ${brand.dont_rules}` : ""}

CATEGORY: "${cat.name}"
${cat.description ? `Description: ${cat.description}` : ""}

IMAGES BY ROLE:
${rolesSummary}

DETAILED METADATA:
${exampleMeta}

═══════════════════════════════════════
ANALYSIS INSTRUCTIONS - DO THIS STEP BY STEP:
═══════════════════════════════════════

STEP 1: For EACH image, write down (mentally) what you see — BE EXTREMELY PRECISE:
- What is the dominant background? A dark solid color? A photo with overlay? A light gradient?
- Is there a card/box containing text? What shape? Rounded corners or sharp? Floating in center or anchored to bottom?
- Are there MULTIPLE separate cards/boxes? (e.g., one for headline at top, one for body at bottom)
- Is there a DEVICE MOCKUP (phone/tablet frame) showing content (like an article, app screenshot, etc.)? Where is it positioned? What percentage of the canvas does it occupy?
- Where is text positioned? Top-left? Center? Bottom-center?
- Is the headline UPPERCASE or mixed case? Bold or thin? What approximate font size relative to canvas width?
- Is there a wave/curve shape? At top or bottom? What percentage of the canvas height?
- Is there a diagonal cut or angular shape instead of a wave?
- Are there decorative elements? Accent lines? Corner shapes? Borders? Inner frames (a rectangle border inset from the edges)?
- Where is the logo? What size relative to the canvas?
- What specific hex colors do you see for: background, text, accent elements, cards? Match them to the brand palette.
- Is there any OVERLAY text on top of an image or mockup?
- Are there any visual separators between sections (lines, dots, icons)?
- Is there a semi-transparent overlay/gradient over part of the canvas?

STEP 2: Map each image to a ROLE: "cover", "content", "bullets", "cta"

STEP 3: For each role, create precise layout_params based on WHAT YOU ACTUALLY SEE.

═══════════════════════════════════════
OUTPUT FORMAT - Return ONLY this JSON (no markdown, no backticks, no explanation):
═══════════════════════════════════════

{
  "name": "${cat.name}",
  "description": "one sentence describing this visual style",
  "id_hint": "snake_case_id",
  "source_example_ids": [],
  "visual_signature": {
    "theme_variant": "DESCRIBE: e.g. dark_navy_gradient, light_clinical_cards, warm_earth_editorial",
    "primary_bg_mode": "solid | gradient | photo_overlay",
    "card_style": "none | rounded_floating | sharp_bottom | full_width_strip | rounded_bottom | multi_card",
    "decorative_shape": "wave_bottom | wave_top | diagonal_cut | none | horizontal_bar",
    "accent_usage": "minimal | moderate | strong",
    "text_on_dark_bg": true,
    "has_device_mockup": false,
    "has_inner_frame": false
  },
  "layout_params": {
    "cover": {
      "bg": {
        "type": "solid | gradient | photo_overlay",
        "colors": ["#hex1", "#hex2"],
        "gradient_angle": 180,
        "overlay_opacity": 0.6
      },
      "shape": {
        "type": "wave | diagonal | none",
        "position": "bottom | top",
        "height_pct": 18,
        "color": "#hex",
        "flip": false
      },
      "card": {
        "enabled": false,
        "style": "rounded | sharp | pill",
        "position": "center | bottom | top",
        "bg_color": "#hex",
        "border_radius": 24,
        "shadow": "none | soft | strong",
        "padding": 48,
        "width_pct": 85,
        "border": "none | 1px solid #hex"
      },
      "secondary_card": {
        "enabled": false,
        "position": "top | bottom",
        "bg_color": "#hex",
        "border_radius": 16,
        "padding": 32,
        "width_pct": 85,
        "content_type": "headline | body | label"
      },
      "device_mockup": {
        "enabled": false,
        "type": "phone | tablet",
        "position": "center | right | left",
        "width_pct": 55,
        "offset_y_pct": 10,
        "border_color": "#hex",
        "border_width": 8,
        "border_radius": 32,
        "show_notch": true,
        "content_bg": "#hex",
        "shadow": "none | soft | strong"
      },
      "text": {
        "alignment": "left | center | right",
        "vertical_position": "top | center | bottom",
        "headline_size": 62,
        "headline_weight": 900,
        "headline_uppercase": true,
        "headline_letter_spacing": 0.02,
        "headline_color": "#hex",
        "body_size": 30,
        "body_weight": 400,
        "body_italic": false,
        "body_color": "#hex",
        "text_shadow": "none | subtle | strong",
        "max_width_pct": 90
      },
      "decorations": {
        "accent_bar": { "enabled": true, "position": "above_headline | below_headline | above_body", "width": 60, "height": 6, "color": "#hex" },
        "corner_accents": { "enabled": false, "color": "#hex", "size": 120 },
        "border": { "enabled": false, "color": "#hex", "width": 2, "radius": 0, "inset": 20 },
        "divider_line": { "enabled": false, "color": "#hex", "width": "60%", "position": "between_headline_body" },
        "inner_frame": { "enabled": false, "color": "#hex", "width": 2, "inset": 30, "radius": 0 }
      },
      "logo": { "position": "bottom-center | top-left | top-right | bottom-right", "opacity": 1, "size": 48, "bg_circle": false },
      "padding": { "x": 70, "y": 80 }
    },
    "content": { "...same structure as cover..." },
    "bullets": {
      "...same structure as cover plus...",
      "bullet_style": {
        "type": "numbered_circle | checkmark | dash | arrow | custom_icon",
        "accent_color": "#hex",
        "number_bg_color": "#hex",
        "number_text_color": "#ffffff",
        "size": 36,
        "container": { "enabled": false, "bg_color": "#hex", "border_radius": 16, "padding": 36 }
      }
    },
    "cta": {
      "...same structure as cover plus...",
      "cta_icons": {
        "enabled": true,
        "style": "emoji | minimal_outline | filled_circle",
        "items": [
          { "icon": "❤️", "label": "Curta" },
          { "icon": "💬", "label": "Comente" },
          { "icon": "🔄", "label": "Compartilhe" },
          { "icon": "📌", "label": "Salve" }
        ],
        "icon_size": 48,
        "label_color": "#hex"
      }
    }
  },
  "formats": {
    "carousel": {
      "slide_count_range": [4, 9],
      "cta_policy": "optional",
      "text_limits": { "headline_chars": [35, 60], "body_chars": [140, 260], "bullets_max": 5 }
    },
    "post": { "text_limits": { "headline_chars": [35, 60], "body_chars": [140, 260] } },
    "story": { "text_limits": { "headline_chars": [25, 45], "body_chars": [90, 160] } }
  },
  "notes": ["observation 1", "observation 2"]
}

═══════════════════════════════════════
CRITICAL RULES:
═══════════════════════════════════════

1. LOOK AT THE ACTUAL IMAGES. Do not guess or use defaults. Every value must come from what you SEE.

2. COLORS: Use the EXACT hex colors from the brand palette (${paletteStr}). 
   - bg.colors[0] = the dominant background color you see
   - bg.colors[1] = secondary gradient color (if gradient) or same as [0] for solid
   - text.headline_color and text.body_color = the ACTUAL text colors visible in the images
   - card.bg_color = the EXACT background color of text boxes (often white #FFFFFF)

3. STRUCTURE: Each role MUST have DIFFERENT structural characteristics if the reference images show different layouts.

4. SHAPES: Only set shape.type="wave" if you ACTUALLY SEE a curved/wave shape. If you see a diagonal cut, use "diagonal". If the background is plain, use "none".

5. CARDS: Only set card.enabled=true if you see a visible rectangular container around the text. If text sits directly on the background, card.enabled=false.

6. DEVICE MOCKUPS: If you see a phone/tablet frame showing content (article, app screen, etc.), set device_mockup.enabled=true. This is a common pattern in healthcare/tech content marketing. The mockup is rendered as a visible frame with rounded corners, optional notch, and shadow.

7. SECONDARY CARDS: If you see MULTIPLE separate text boxes, use secondary_card to describe the additional card.

8. INNER FRAME: If you see a decorative border/frame set INWARD from the canvas edges, set decorations.inner_frame.enabled=true.

9. TEXT SHADOW: If text is on a photo or dark gradient, set text_shadow="subtle" or "strong" for readability.

10. The "name" MUST be exactly "${cat.name}".

11. Every layout_params role (cover, content, bullets, cta) MUST have the FULL structure shown above. Do NOT abbreviate with "...same structure...". Write out every field completely.`;
}
