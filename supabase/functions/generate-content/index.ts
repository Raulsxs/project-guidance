import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════ TYPES ══════

interface GenerateContentRequest {
  trend: {
    title: string;
    description: string;
    theme: string;
    keywords: string[];
  };
  contentType: "post" | "story" | "carousel";
  contentStyle?: "news" | "quote" | "tip" | "educational" | "curiosity";
  brandId?: string | null;
  visualMode?: "brand_strict" | "brand_guided" | "free";
  tone?: string;
  targetAudience?: string;
}

interface BrandTokens {
  name: string;
  palette: { name: string; hex: string; role?: string }[];
  fonts: { headings: string; body: string };
  visual_tone: string;
  logo_url: string | null;
  do_rules: string | null;
  dont_rules: string | null;
  image_style: string;
  example_descriptions: string[];
  style_guide?: any;
}

// ══════ PALETTE NORMALIZATION ══════

function normalizePalette(raw: unknown): { name: string; hex: string; role?: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item: unknown, i: number) => {
      if (typeof item === "string") {
        const hex = item.startsWith("#") ? item : `#${item}`;
        return { name: `cor${i + 1}`, hex };
      }
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        const hex = typeof obj.hex === "string"
          ? (obj.hex.startsWith("#") ? obj.hex : `#${obj.hex}`)
          : "#000000";
        return {
          name: typeof obj.name === "string" ? obj.name : `cor${i + 1}`,
          hex,
          role: typeof obj.role === "string" ? obj.role : undefined,
        };
      }
      return { name: `cor${i + 1}`, hex: "#000000" };
    }).filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c.hex));
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => typeof v === "string")
      .map(([role, hex]) => ({
        name: role,
        hex: (hex as string).startsWith("#") ? (hex as string) : `#${hex as string}`,
        role,
      }))
      .filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c.hex));
  }
  return [];
}

function buildBrandTokens(brand: any, examples: any[]): BrandTokens {
  return {
    name: brand.name,
    palette: normalizePalette(brand.palette),
    fonts: brand.fonts || { headings: "Inter", body: "Inter" },
    visual_tone: brand.visual_tone || "clean",
    logo_url: brand.logo_url || null,
    do_rules: brand.do_rules || null,
    dont_rules: brand.dont_rules || null,
    image_style: brand.visual_tone || "clean",
    example_descriptions: examples.filter((e: any) => e.description).map((e: any) => e.description),
    style_guide: brand.style_guide || null,
  };
}

// ══════ PROMPT BUILDING ══════

const stylePrompts: Record<string, { systemAddition: string; captionGuide: string; structure: string }> = {
  news: {
    systemAddition: "Crie conteúdo informativo e profissional sobre a notícia/tendência. Aborde o assunto com autoridade e dados concretos.",
    captionGuide: "Legenda informativa, com contexto e dados do setor. 900–1400 caracteres. Use emojis com moderação.",
    structure: "cover(gancho provocativo) → context(por que importa) → insight1(passo prático/bullets) → insight2(armadilha ou mito vs verdade) → closing(takeaway + CTA leve)",
  },
  quote: {
    systemAddition: "Crie uma frase inspiracional ou reflexiva. NÃO inclua CTAs. O conteúdo deve ser autossuficiente e profundo.",
    captionGuide: "Legenda reflexiva e curta. 250–500 caracteres. SEM CTA, SEM 'saiba mais'. Apenas reflexão.",
    structure: "cover(frase principal impactante) → context(complemento reflexivo) → insight1(perspectiva diferente) → insight2(aplicação pessoal) → closing(assinatura/marca, SEM CTA)",
  },
  tip: {
    systemAddition: "Crie dicas práticas, acionáveis e diretas. Seja útil e concreto.",
    captionGuide: "Legenda com tom prático e direto. 900–1400 caracteres. Inclua mini-resumo das dicas.",
    structure: "cover(problema/pergunta provocativa) → context(por que essa dica importa) → insight1(dica 1 com bullets) → insight2(dica 2 ou checklist) → closing(resumo + CTA leve)",
  },
  educational: {
    systemAddition: "Explique conceitos de forma didática, acessível e com analogias simples.",
    captionGuide: "Legenda didática e acessível. 900–1400 caracteres. Use analogias simples e linguagem clara.",
    structure: "cover(pergunta 'O que é X?') → context(por que todo gestor precisa saber) → insight1(como funciona na prática) → insight2(exemplo real ou comparação) → closing(resumo + CTA educativo)",
  },
  curiosity: {
    systemAddition: "Crie conteúdo que desperte curiosidade com dados surpreendentes e fatos pouco conhecidos.",
    captionGuide: "Legenda que surpreende. 900–1400 caracteres. Comece com dado impactante.",
    structure: "cover('Você sabia?' + dado surpreendente) → context(contexto do dado) → insight1(implicação prática) → insight2(o que poucos sabem) → closing(reflexão + CTA)",
  },
};

function buildBrandContextBlock(tokens: BrandTokens): string {
  const parts: string[] = [];
  parts.push(`\n══════ IDENTIDADE VISUAL: "${tokens.name}" ══════`);
  parts.push(`Tom visual: ${tokens.visual_tone}`);
  if (tokens.palette.length > 0) {
    parts.push(`Paleta: ${tokens.palette.map((c) => `${c.name}=${c.hex}`).join(", ")}`);
  }
  if (tokens.fonts) {
    parts.push(`Fontes: Títulos=${tokens.fonts.headings}, Corpo=${tokens.fonts.body}`);
  }
  if (tokens.do_rules) parts.push(`✅ REGRAS: ${tokens.do_rules}`);
  if (tokens.dont_rules) parts.push(`🚫 PROIBIDO: ${tokens.dont_rules}`);
  if (tokens.example_descriptions.length > 0) {
    parts.push(`Referências:\n${tokens.example_descriptions.map((d) => `  • ${d}`).join("\n")}`);
  }
  parts.push(`══════ FIM ══════`);
  return parts.join("\n");
}

function getSlideCount(contentType: string): number {
  if (contentType === "carousel") return 5;
  if (contentType === "story") return 1;
  return 1; // post
}

function getTemplatesForMode(visualMode: string, contentType: string, styleGuide?: any): string[] {
  if (visualMode === "free") {
    return contentType === "story" ? ["generic_free"] : ["generic_free"];
  }
  if (contentType === "story") {
    return ["story_cover", "story_tip"];
  }
  const recommended = styleGuide?.recommended_templates;
  if (recommended && recommended.length > 0) return recommended;
  return ["wave_cover", "wave_text_card", "wave_bullets", "wave_text_card", "wave_closing"];
}

function buildImagePromptForSlide(basePrompt: string, tokens: BrandTokens | null, visualMode: string): string {
  if (visualMode === "brand_strict" || !tokens) return "";
  if (visualMode === "free") return `${basePrompt}. Professional healthcare image. No text. Ultra high resolution.`;

  // brand_guided: background/illustration only
  const colors = tokens.palette.map((c) => c.hex).join(", ");
  return [
    `Background/illustration for healthcare content. Brand colors: ${colors}. Style: ${tokens.visual_tone}.`,
    `${basePrompt}`,
    "NO TEXT ON IMAGE. Abstract or photographic background only.",
    "Ultra high resolution, premium quality.",
  ].join(" ");
}

// ══════ MAIN ══════

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      trend,
      contentType,
      contentStyle = "news",
      brandId = null,
      visualMode = brandId ? "brand_guided" : "free",
      tone = "profissional e engajador",
      targetAudience = "gestores de saúde",
    } = await req.json() as GenerateContentRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ══════ BRAND LOADING ══════
    let brandTokens: BrandTokens | null = null;
    let brandContext = "";
    const effectiveMode = brandId ? visualMode : "free";

    if (brandId && effectiveMode !== "free") {
      console.log(`[generate-content] Loading brand: ${brandId}, mode: ${effectiveMode}`);
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("name, palette, visual_tone, do_rules, dont_rules, fonts, logo_url, style_guide")
        .eq("id", brandId)
        .single();

      if (brandError) {
        console.error("[generate-content] Brand error:", brandError);
      } else if (brand) {
        const { data: examples } = await supabase
          .from("brand_examples")
          .select("image_url, description, content_type")
          .eq("brand_id", brandId)
          .limit(5);
        brandTokens = buildBrandTokens(brand, examples || []);
        brandContext = buildBrandContextBlock(brandTokens);
        console.log(`[generate-content] Brand loaded: ${brandTokens.name}, ${brandTokens.palette.length} colors, mode=${effectiveMode}`);
      }
    }

    const styleConfig = stylePrompts[contentStyle] || stylePrompts.news;
    const slideCount = getSlideCount(contentType);
    const templatePool = getTemplatesForMode(effectiveMode, contentType, brandTokens?.style_guide);

    // ══════ SYSTEM PROMPT ══════
    const systemPrompt = `Você é um especialista sênior em marketing digital para o setor de saúde. Você cria conteúdos para Instagram que são criativos, informativos e conectados com a fonte original.

${styleConfig.systemAddition}

REGRAS ABSOLUTAS:
- Linguagem: ${tone}. Público: ${targetAudience}.
- NUNCA invente dados, estatísticas ou números que não estejam na fonte.
- Use ganchos criativos: pergunta provocativa, contraste, mini-história, analogia, mito vs verdade, checklist.
- Emojis com moderação (máx 3 por slide).
- ${contentStyle === "quote" ? "SEM CTAs, SEM 'saiba mais', SEM links." : "CTA apenas no slide final, leve e natural."}
- illustrationPrompt deve descrever APENAS backgrounds/ilustrações, NUNCA texto renderizado.
${brandContext}`;

    // ══════ USER PROMPT ══════
    const formatLabel = contentType === "post" ? "post para feed (1 slide, 1080x1350)" : contentType === "story" ? "story (1 slide, 1080x1920)" : `carrossel com ${slideCount} slides (1080x1350 cada)`;

    const slideRoles = contentType === "carousel"
      ? `Cada slide TEM um papel (role): cover, context, insight, insight, closing.\nEstrutura: ${styleConfig.structure}`
      : contentType === "story"
        ? `1 slide com role "cover".`
        : `1 slide com role "cover".`;

    const templateInstructions = contentType === "carousel"
      ? `Templates disponíveis: ${templatePool.join(", ")}.\nSlide 1 (cover): ${templatePool[0]}.\nSlides 2-4 (content): ${templatePool[1] || templatePool[0]}.\nSlide 5 (closing): ${templatePool[4] || templatePool[0]}.`
      : `Template: ${templatePool[0]}.`;

    const userPrompt = `Crie um ${formatLabel} do Instagram.
ESTILO: ${contentStyle.toUpperCase()}

══════ FONTE ORIGINAL (use como base, NÃO invente) ══════
Título: ${trend.title}
Descrição: ${trend.description || "Sem descrição detalhada disponível."}
Tema: ${trend.theme}
Palavras-chave: ${trend.keywords?.join(", ") || "não especificadas"}
══════ FIM DA FONTE ══════

${slideRoles}
${templateInstructions}

COMPRIMENTOS OBRIGATÓRIOS:
- caption: ${contentStyle === "quote" ? "250–500" : "900–1400"} caracteres
- headline: 35–60 caracteres
- body: ${contentType === "story" ? "90–160" : "160–260"} caracteres
- speakerNotes: 2–3 frases (criativo, insights extras, NÃO vai para arte)
- sourceSummary: 4–6 linhas resumindo a fonte original
- keyInsights: 3–5 pontos-chave extraídos da fonte

Retorne EXATAMENTE este JSON (sem markdown, sem backticks):
{
  "title": "título curto e chamativo (máx 60 chars)",
  "caption": "legenda completa com emojis. ${styleConfig.captionGuide}",
  "hashtags": ["até 15 hashtags relevantes"],
  "sourceSummary": "resumo de 4-6 linhas da fonte original que justifica o conteúdo",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "angle": "ângulo editorial escolhido (ex: 'mito vs verdade', 'checklist prático')",
  "audienceTakeaway": "o que o público leva de valor após ver este conteúdo",
  "slides": [
    {
      "role": "cover|context|insight|closing",
      "template": "${templatePool[0]}",
      "headline": "35-60 chars, gancho criativo",
      "body": "${contentType === "story" ? "90-160" : "160-260"} chars, texto de apoio rico",
      "bullets": ["opcional: items de lista para slides insight"],
      "speakerNotes": "2-3 frases com insight extra (não vai para arte)",
      "illustrationPrompt": "descrição em inglês de background/ilustração SEM TEXTO. Ex: 'Abstract blue gradient with subtle medical icons, clean minimalist style'"
    }
  ]
}

${contentType === "carousel" ? `Crie EXATAMENTE ${slideCount} slides com roles: cover, context, insight, insight, closing.` : "Crie exatamente 1 slide."}`;

    console.log(`[generate-content] Generating ${contentStyle} ${contentType}, mode=${effectiveMode}${brandTokens ? `, brand=${brandTokens.name}` : ""}...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[generate-content] AI error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content generated");

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response from AI");

    const generated = JSON.parse(jsonMatch[0]);

    // ══════ POST-PROCESS SLIDES ══════
    const processedSlides = (generated.slides || []).map((slide: any, i: number) => {
      const role = slide.role || (i === 0 ? "cover" : i === (generated.slides.length - 1) ? "closing" : "insight");
      const template = effectiveMode === "free"
        ? "generic_free"
        : (slide.template || templatePool[Math.min(i, templatePool.length - 1)]);

      return {
        role,
        template,
        headline: slide.headline || "",
        body: slide.body || "",
        bullets: slide.bullets || [],
        speakerNotes: slide.speakerNotes || "",
        illustrationPrompt: slide.illustrationPrompt || slide.imagePrompt || "",
        // Legacy compat
        imagePrompt: slide.illustrationPrompt || slide.imagePrompt || "",
        templateHint: template,
      };
    });

    // ══════ IMAGE GENERATION (only for brand_guided and free modes) ══════
    if (effectiveMode === "brand_guided" || effectiveMode === "free") {
      console.log(`[generate-content] Generating background images for ${processedSlides.length} slides (mode=${effectiveMode})...`);
      for (let i = 0; i < processedSlides.length; i++) {
        const slide = processedSlides[i];
        const prompt = buildImagePromptForSlide(slide.illustrationPrompt, brandTokens, effectiveMode);
        if (!prompt) continue;

        try {
          const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (imageUrl) {
              processedSlides[i].previewImage = imageUrl;
              console.log(`[generate-content] Background image generated for slide ${i + 1}`);
            }
          } else {
            console.error(`[generate-content] Image generation failed for slide ${i + 1}: ${imgResponse.status}`);
          }
        } catch (imgError) {
          console.error(`[generate-content] Image error slide ${i + 1}:`, imgError);
        }
      }
    } else {
      console.log(`[generate-content] BRAND_STRICT mode: skipping AI image generation, templates only.`);
    }

    // ══════ RESPONSE ══════
    const result = {
      title: generated.title || trend.title,
      caption: generated.caption || "",
      hashtags: generated.hashtags || [],
      sourceSummary: generated.sourceSummary || "",
      keyInsights: generated.keyInsights || [],
      angle: generated.angle || "",
      audienceTakeaway: generated.audienceTakeaway || "",
      slides: processedSlides,
      contentType,
      contentStyle,
      visualMode: effectiveMode,
      trendTitle: trend.title,
      brandId: brandId || null,
      brandSnapshot: brandTokens ? {
        name: brandTokens.name,
        palette: brandTokens.palette,
        fonts: brandTokens.fonts,
        visual_tone: brandTokens.visual_tone,
        logo_url: brandTokens.logo_url,
        style_guide: brandTokens.style_guide,
      } : null,
    };

    console.log(`[generate-content] SUCCESS: brandId=${brandId || 'null'}, palette=${brandTokens?.palette?.length ?? 0}, mode=${effectiveMode}, slides=${processedSlides.length}, sourceSummary=${(result.sourceSummary || '').length}chars`);

    return new Response(JSON.stringify({ success: true, content: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-content] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
