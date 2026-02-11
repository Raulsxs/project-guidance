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

    const { brandId } = await req.json();
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

    // Load examples
    const { data: examples } = await supabase
      .from("brand_examples")
      .select("id, image_url, type, subtype, description")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!examples || examples.length === 0) {
      throw new Error("No brand examples found. Upload examples first.");
    }

    // Build example descriptions for the AI
    const exampleDescriptions = examples.map((ex: any, i: number) =>
      `${i + 1}. [${ex.type}${ex.subtype ? '/' + ex.subtype : ''}] ${ex.description || 'sem descrição'} (id: ${ex.id})`
    ).join("\n");

    const paletteStr = Array.isArray(brand.palette)
      ? (brand.palette as string[]).join(", ")
      : "não definida";

    const styleGuideStr = brand.style_guide
      ? `\nStyle Guide atual (v${brand.style_guide_version}):\n${JSON.stringify(brand.style_guide, null, 2).substring(0, 2000)}`
      : "\nNenhum style guide definido.";

    const systemPrompt = `Você é um especialista em design de conteúdo para Instagram. Sua tarefa é analisar exemplos de referência de uma marca e agrupá-los em "Template Sets" coerentes.

Cada Template Set representa um estilo visual distinto que pode ser aplicado na geração de conteúdo. Por exemplo, uma clínica pode ter:
- "Caso Clínico" (fotos de procedimentos, antes/depois)
- "Artigos Científicos" (layouts informativos com dados)
- "Frases Motivacionais" (fundos minimalistas com tipografia)

REGRAS:
- Crie entre 1 e 4 Template Sets baseado nos exemplos.
- Cada Template Set deve cobrir pelo menos 1 formato (post/story/carousel).
- Use os padrões visuais OBSERVADOS nos exemplos, não invente.
- Agrupe exemplos que compartilham estilo visual similar.
- O template_set JSON deve seguir a estrutura especificada.`;

    const userPrompt = `Marca: ${brand.name}
Paleta: ${paletteStr}
Tom visual: ${brand.visual_tone || "clean"}
Fontes: ${JSON.stringify(brand.fonts)}
${brand.do_rules ? `Regras positivas: ${brand.do_rules}` : ""}
${brand.dont_rules ? `Regras negativas: ${brand.dont_rules}` : ""}
${styleGuideStr}

EXEMPLOS DE REFERÊNCIA:
${exampleDescriptions}

Analise os exemplos acima e crie Template Sets agrupando-os por estilo visual.

Retorne EXATAMENTE este JSON (sem markdown, sem backticks):
{
  "template_sets": [
    {
      "name": "Nome descritivo do template set",
      "description": "Descrição curta de quando usar",
      "id_hint": "snake_case_identifier",
      "source_example_ids": ["id1", "id2"],
      "formats": {
        "post": {
          "recommended_templates": ["wave_cover", "wave_text_card"],
          "layout_rules": {
            "wave_height_pct": 20,
            "safe_margin_px": 96,
            "footer_height_px": 140,
            "background_style": "solid"
          },
          "typography": {
            "headline_weight": 800,
            "body_weight": 400,
            "uppercase_headlines": false,
            "headline_alignment": "left"
          },
          "logo": {
            "preferred_position": "top-right",
            "watermark_opacity": 0.35
          },
          "text_limits": {
            "headline_chars": [35, 60],
            "body_chars": [140, 260]
          }
        },
        "story": {
          "recommended_templates": ["story_cover", "story_tip"],
          "layout_rules": {
            "safe_top_px": 220,
            "safe_bottom_px": 260,
            "safe_side_px": 90,
            "background_style": "gradient"
          },
          "typography": {
            "headline_weight": 800,
            "body_weight": 400,
            "uppercase_headlines": false,
            "headline_alignment": "center"
          },
          "logo": {
            "preferred_position": "top-right",
            "watermark_opacity": 0.35
          },
          "text_limits": {
            "headline_chars": [25, 45],
            "body_chars": [90, 160]
          }
        },
        "carousel": {
          "recommended_templates": ["wave_cover", "wave_text_card", "wave_bullets", "wave_closing"],
          "slide_roles": ["cover", "context", "insight", "insight", "closing"],
          "role_to_template": {
            "cover": "wave_cover",
            "context": "wave_text_card",
            "insight": "wave_bullets",
            "closing": "wave_closing"
          },
          "layout_rules": {
            "wave_height_pct": 20,
            "safe_margin_px": 96,
            "footer_height_px": 140,
            "background_style": "solid"
          },
          "typography": {
            "headline_weight": 800,
            "body_weight": 400,
            "uppercase_headlines": false,
            "headline_alignment": "left"
          },
          "logo": {
            "preferred_position": "top-right",
            "watermark_opacity": 0.35
          },
          "text_limits": {
            "headline_chars": [35, 60],
            "body_chars": [160, 260],
            "bullets_max": 5
          }
        }
      },
      "notes": ["padrão visual observado 1", "padrão visual observado 2"]
    }
  ]
}

Crie entre 1 e 4 template sets. Inclua APENAS formatos que os exemplos cobrem. Ajuste layout_rules, typography e logo baseado nos padrões REAIS observados nos exemplos.`;

    console.log(`[generate-template-sets] Generating for brand ${brand.name}, ${examples.length} examples...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Persist template sets
    const insertedSets = [];
    for (const ts of templateSets) {
      const { data: inserted, error: insertError } = await supabase
        .from("brand_template_sets")
        .insert({
          brand_id: brandId,
          name: ts.name,
          description: ts.description || null,
          status: "active",
          source_example_ids: ts.source_example_ids || [],
          template_set: {
            id_hint: ts.id_hint,
            formats: ts.formats,
            notes: ts.notes || [],
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

    // If brand has no default, set the first one
    if (insertedSets.length > 0) {
      const { data: currentBrand } = await supabase
        .from("brands")
        .select("default_template_set_id")
        .eq("id", brandId)
        .single();

      if (!currentBrand?.default_template_set_id) {
        await supabase
          .from("brands")
          .update({ default_template_set_id: insertedSets[0].id })
          .eq("id", brandId);
      }
    }

    console.log(`[generate-template-sets] Created ${insertedSets.length} template sets for brand ${brand.name}`);

    return new Response(JSON.stringify({
      success: true,
      count: insertedSets.length,
      templateSets: insertedSets,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-template-sets] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
