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
      // Single category mode
      const cat = (categories || []).find((c: any) => c.id === categoryId);
      if (!cat) throw new Error("Category not found");
      categoriesToProcess = [cat];
    } else {
      // If manual categories exist, process each one
      const manualCats = (categories || []).filter((c: any) => c.name);
      if (manualCats.length > 0) {
        categoriesToProcess = manualCats;
      }
    }

    // Load ALL examples
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

    // ══════ PROCESS PER-CATEGORY or LEGACY ══════

    if (categoriesToProcess.length > 0) {
      // PER-CATEGORY MODE
      const insertedSets: any[] = [];

      for (const cat of categoriesToProcess) {
        const catExamples = allExamples.filter((ex: any) => ex.category_id === cat.id);
        if (catExamples.length === 0) {
          console.log(`[generate-template-sets] Skipping category "${cat.name}" — no examples`);
          continue;
        }

        const exampleDescriptions = catExamples.map((ex: any, i: number) =>
          `${i + 1}. [${ex.type}${ex.subtype ? '/' + ex.subtype : ''}] ${ex.description || 'sem descrição'} (id: ${ex.id})`
        ).join("\n");

        const result = await generateTemplateSetForCategory({
          brand, cat, exampleDescriptions, exampleCount: catExamples.length,
          paletteStr, LOVABLE_API_KEY, categoryIndex: categoriesToProcess.indexOf(cat),
          totalCategories: categoriesToProcess.length,
        });

        if (!result) continue;

        // UPSERT: archive existing active set for this category, then insert
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
            },
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[generate-template-sets] Insert error for "${cat.name}":`, insertError);
          continue;
        }
        insertedSets.push(inserted);
        console.log(`[generate-template-sets] Created set "${cat.name}" with visual_signature: ${JSON.stringify(result.visual_signature)}`);
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
    const exampleDescriptions = allExamples.map((ex: any, i: number) => {
      return `${i + 1}. [${ex.type}${ex.subtype ? '/' + ex.subtype : ''}] ${ex.description || 'sem descrição'} (id: ${ex.id})`;
    }).join("\n");

    const systemPrompt = buildLegacySystemPrompt();
    const userPrompt = buildLegacyUserPrompt(brand, paletteStr, exampleDescriptions);

    console.log(`[generate-template-sets] LEGACY mode for brand ${brand.name}, ${allExamples.length} examples...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from AI");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON from AI");

    const parsed = JSON.parse(jsonMatch[0]);
    const templateSets = parsed.template_sets || [];

    if (templateSets.length === 0) throw new Error("AI returned 0 template sets");

    // Archive existing active sets
    await supabase
      .from("brand_template_sets")
      .update({ status: "archived" })
      .eq("brand_id", brandId)
      .eq("status", "active");

    const insertedSets: any[] = [];
    for (const ts of templateSets) {
      const { data: inserted, error: insertError } = await supabase
        .from("brand_template_sets")
        .insert({
          brand_id: brandId,
          name: ts.name,
          description: ts.description || null,
          status: "active",
          source_example_ids: ts.source_example_ids || [],
          visual_signature: ts.visual_signature || null,
          template_set: {
            id_hint: ts.id_hint,
            formats: ts.formats,
            notes: ts.notes || [],
            visual_signature: ts.visual_signature || null,
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[generate-template-sets] Insert error:`, insertError);
        continue;
      }
      insertedSets.push(inserted);
    }

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

// ══════ PER-CATEGORY GENERATION ══════

interface GenerateForCategoryParams {
  brand: any;
  cat: { id: string; name: string; description: string | null };
  exampleDescriptions: string;
  exampleCount: number;
  paletteStr: string;
  LOVABLE_API_KEY: string;
  categoryIndex: number;
  totalCategories: number;
}

async function generateTemplateSetForCategory(params: GenerateForCategoryParams) {
  const { brand, cat, exampleDescriptions, paletteStr, LOVABLE_API_KEY, categoryIndex, totalCategories } = params;

  const systemPrompt = `Você é um especialista em design de conteúdo para Instagram. Analise exemplos de referência de UMA categoria específica de uma marca e crie UM Template Set coerente para essa categoria.

REGRA CRÍTICA: Você está criando o template set para a categoria "${cat.name}" (${categoryIndex + 1} de ${totalCategories} categorias).
Cada categoria DEVE ter um visual_signature DIFERENTE das outras. Se existem ${totalCategories} categorias, cada uma precisa de identidade visual própria.

DIFERENCIE os estilos assim:
- Categoria 1: tema escuro, sem card, texto direto no fundo, tipografia bold editorial
- Categoria 2: tema claro, card branco central, tipografia clean
- Categoria 3: tema gradiente, split layout, ícones e destaque de cor
- Categoria 4: tema neutro, overlay em foto, tipografia condensada

Adapte conforme o nome/tipo da categoria. Ex: "Caso Clínico" → cards brancos com fotos; "Artigos" → editorial escuro e bold.

O "visual_signature" é OBRIGATÓRIO e controla DIRETAMENTE como o renderer exibe os slides. Cada campo tem impacto visual real:
- theme_variant: controla cores de fundo (dark = palette[1] como bg, light = palette[0] como bg)
- primary_bg_mode: "solid" | "gradient" | "image"
- card_style: "none" (texto direto no fundo) | "center_card" (card branco central) | "split_card"
- cover_style: "dark_full_bleed" | "light_wave" | "photo_overlay"
- accent_usage: "minimal" | "moderate" | "strong"
- cta_style: "minimal_icons" | "bold_bar"`;

  const userPrompt = `Marca: ${brand.name}
Paleta: ${paletteStr}
Tom: ${brand.visual_tone || "clean"}
Fontes: ${JSON.stringify(brand.fonts)}
${brand.do_rules ? `Regras positivas: ${brand.do_rules}` : ""}
${brand.dont_rules ? `Regras negativas: ${brand.dont_rules}` : ""}

CATEGORIA: "${cat.name}"
${cat.description ? `Descrição: ${cat.description}` : ""}

EXEMPLOS DESTA CATEGORIA:
${exampleDescriptions}

Retorne EXATAMENTE este JSON (sem markdown, sem backticks):
{
  "name": "${cat.name}",
  "description": "quando usar este estilo",
  "id_hint": "snake_case_id",
  "source_example_ids": [],
  "visual_signature": {
    "theme_variant": "editorial_dark | clinical_cards | minimal_light | photo_overlay",
    "primary_bg_mode": "solid | gradient | image",
    "cover_style": "dark_full_bleed | light_wave | photo_overlay",
    "card_style": "none | center_card | split_card",
    "accent_usage": "minimal | moderate | strong",
    "cta_style": "minimal_icons | bold_bar"
  },
  "formats": {
    "post": {
      "recommended_templates": ["wave_cover"],
      "layout_rules": { "wave_height_pct": 20, "safe_margin_px": 60, "background_style": "solid" },
      "typography": { "headline_weight": 800, "body_weight": 400, "uppercase_headlines": false, "headline_alignment": "left" },
      "logo": { "preferred_position": "top-right", "watermark_opacity": 0.35 },
      "text_limits": { "headline_chars": [35, 60], "body_chars": [140, 260] }
    },
    "carousel": {
      "recommended_templates": ["wave_cover", "wave_text_card", "wave_bullets", "wave_closing"],
      "slide_roles": ["cover", "context", "insight", "insight", "cta"],
      "role_to_template": { "cover": "wave_cover", "context": "wave_text_card", "insight": "wave_bullets", "cta": "wave_closing" },
      "layout_rules": { "wave_height_pct": 20, "safe_margin_px": 60, "background_style": "solid" },
      "typography": { "headline_weight": 800, "body_weight": 400, "uppercase_headlines": false, "headline_alignment": "left" },
      "logo": { "preferred_position": "top-right", "watermark_opacity": 0.35 },
      "text_limits": { "headline_chars": [35, 60], "body_chars": [160, 260], "bullets_max": 5 },
      "slide_count_range": [4, 9],
      "cta_policy": "optional"
    },
    "story": {
      "recommended_templates": ["story_cover"],
      "layout_rules": { "safe_top_px": 220, "safe_bottom_px": 260, "background_style": "gradient" },
      "typography": { "headline_weight": 800, "body_weight": 400, "uppercase_headlines": false },
      "logo": { "preferred_position": "top-right", "watermark_opacity": 0.35 },
      "text_limits": { "headline_chars": [25, 45], "body_chars": [90, 160] }
    }
  },
  "notes": ["padrão observado 1", "padrão observado 2"]
}

IMPORTANTE:
- O "name" DEVE ser exatamente "${cat.name}"
- Adapte visual_signature, layout_rules e typography baseado nos padrões REAIS dos exemplos
- O visual_signature deve refletir a IDENTIDADE desta categoria específica`;

  console.log(`[generate-template-sets] Generating for category "${cat.name}"...`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`[generate-template-sets] AI error for "${cat.name}": ${response.status}`);
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`[generate-template-sets] Parse error for "${cat.name}":`, e);
    return null;
  }
}

// ══════ LEGACY PROMPTS ══════

function buildLegacySystemPrompt(): string {
  return `Você é um especialista em design de conteúdo para Instagram. Analise exemplos de referência e agrupe-os em Template Sets.

Cada Template Set DEVE incluir um "visual_signature" OBRIGATÓRIO que controla diretamente a renderização:
- theme_variant: "editorial_dark" | "clinical_cards" | "minimal_light" | "photo_overlay"
- primary_bg_mode: "solid" | "gradient" | "image"
- card_style: "none" | "center_card" | "split_card"
- cover_style: "dark_full_bleed" | "light_wave" | "photo_overlay"
- accent_usage: "minimal" | "moderate" | "strong"
- cta_style: "minimal_icons" | "bold_bar"

REGRA: Cada Template Set DEVE ter visual_signature DIFERENTE dos outros.`;
}

function buildLegacyUserPrompt(brand: any, paletteStr: string, exampleDescriptions: string): string {
  return `Marca: ${brand.name}
Paleta: ${paletteStr}
Tom: ${brand.visual_tone || "clean"}
Fontes: ${JSON.stringify(brand.fonts)}

EXEMPLOS:
${exampleDescriptions}

Retorne JSON (sem markdown):
{
  "template_sets": [
    {
      "name": "Nome do set",
      "description": "quando usar",
      "id_hint": "snake_case",
      "source_example_ids": [],
      "visual_signature": {
        "theme_variant": "editorial_dark",
        "primary_bg_mode": "solid",
        "cover_style": "dark_full_bleed",
        "card_style": "none",
        "accent_usage": "moderate",
        "cta_style": "minimal_icons"
      },
      "formats": {
        "post": { "recommended_templates": ["wave_cover"], "layout_rules": { "wave_height_pct": 20, "safe_margin_px": 60, "background_style": "solid" }, "typography": { "headline_weight": 800, "body_weight": 400 }, "logo": { "preferred_position": "top-right", "watermark_opacity": 0.35 }, "text_limits": { "headline_chars": [35, 60], "body_chars": [140, 260] } },
        "carousel": { "recommended_templates": ["wave_cover", "wave_text_card", "wave_bullets", "wave_closing"], "slide_roles": ["cover", "context", "insight", "insight", "cta"], "role_to_template": { "cover": "wave_cover", "context": "wave_text_card", "insight": "wave_bullets", "cta": "wave_closing" }, "layout_rules": { "wave_height_pct": 20, "safe_margin_px": 60, "background_style": "solid" }, "typography": { "headline_weight": 800, "body_weight": 400 }, "logo": { "preferred_position": "top-right", "watermark_opacity": 0.35 }, "text_limits": { "headline_chars": [35, 60], "body_chars": [160, 260], "bullets_max": 5 }, "slide_count_range": [4, 9], "cta_policy": "optional" },
        "story": { "recommended_templates": ["story_cover"], "layout_rules": { "safe_top_px": 220, "safe_bottom_px": 260, "background_style": "gradient" }, "typography": { "headline_weight": 800, "body_weight": 400 }, "logo": { "preferred_position": "top-right", "watermark_opacity": 0.35 }, "text_limits": { "headline_chars": [25, 45], "body_chars": [90, 160] } }
      },
      "notes": []
    }
  ]
}

Crie 1-4 template sets com visual_signature DIFERENTE entre si.`;
}
