import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  tone?: string;
  targetAudience?: string;
  generateImages?: boolean;
}

// Standardized Brand Tokens Schema
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
}

// Style-specific prompts
const stylePrompts: Record<string, { systemAddition: string; userGuide: string; slideGuide: string }> = {
  news: {
    systemAddition: "Crie conteúdo informativo e profissional sobre a notícia/tendência.",
    userGuide: "Abordagem: informativa, atualização do setor. Inclua dados e contexto relevante.",
    slideGuide: "Estrutura: abertura impactante, desenvolvimento com dados, conclusão com insight. Pode incluir CTA se relevante."
  },
  quote: {
    systemAddition: "Crie uma frase inspiracional ou reflexiva. NÃO inclua CTAs como 'Saiba mais' ou 'Clique no link'. O conteúdo deve ser autossuficiente.",
    userGuide: "Abordagem: motivacional, reflexiva, inspiradora. Frase de impacto que ressoe com o público. SEM CALL-TO-ACTION.",
    slideGuide: "Estrutura: frase principal poderosa, pode ter complemento reflexivo. NÃO use 'Saiba mais', 'Leia mais', 'Clique'. Slide final deve ser a assinatura/marca, não um CTA."
  },
  tip: {
    systemAddition: "Crie dicas práticas e acionáveis. Seja direto e útil.",
    userGuide: "Abordagem: prática, acionável, direta. Dicas que podem ser aplicadas imediatamente.",
    slideGuide: "Estrutura: problema/contexto rápido, dicas numeradas ou em bullets, fechamento motivador. Seja conciso."
  },
  educational: {
    systemAddition: "Explique conceitos de forma didática e acessível. Use linguagem simples.",
    userGuide: "Abordagem: didática, explicativa, acessível. Ensine algo de forma clara.",
    slideGuide: "Estrutura: o que é, por que importa, como funciona, exemplo prático. Use analogias simples."
  },
  curiosity: {
    systemAddition: "Crie conteúdo que desperte curiosidade e engaje. Use dados surpreendentes.",
    userGuide: "Abordagem: surpreendente, engajadora. Use estatísticas interessantes e fatos pouco conhecidos.",
    slideGuide: "Estrutura: gancho surpreendente ('Você sabia?'), revelação do dado, contexto, reflexão final."
  }
};

// Normalize any palette format into { name, hex, role? }[]
function normalizePalette(raw: unknown): { name: string; hex: string; role?: string }[] {
  if (!raw) return [];

  // Case A: array of strings ["#a4d3eb", "#10559a"]
  if (Array.isArray(raw)) {
    return raw.map((item: unknown, i: number) => {
      if (typeof item === "string") {
        const hex = item.startsWith("#") ? item : `#${item}`;
        return { name: `cor${i + 1}`, hex };
      }
      // Case B: array of objects { hex, name?, role? }
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

  // Case C: object { primary: "#...", accent: "#...", ... }
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
  const palette = normalizePalette(brand.palette);

  return {
    name: brand.name,
    palette,
    fonts: brand.fonts || { headings: "Inter", body: "Inter" },
    visual_tone: brand.visual_tone || "clean",
    logo_url: brand.logo_url || null,
    do_rules: brand.do_rules || null,
    dont_rules: brand.dont_rules || null,
    image_style: brand.visual_tone || "clean",
    example_descriptions: examples
      .filter((e: any) => e.description)
      .map((e: any) => e.description),
  };
}

function buildBrandContextForPrompt(tokens: BrandTokens): string {
  const parts: string[] = [];
  parts.push(`\n\n══════ IDENTIDADE VISUAL OBRIGATÓRIA: "${tokens.name}" ══════`);
  parts.push(`Tom visual: ${tokens.visual_tone}`);

  if (tokens.palette.length > 0) {
    const colors = tokens.palette.map((c) => `${c.name} ${c.hex}`).join(", ");
    parts.push(`Paleta de cores (USAR ESTAS CORES): ${colors}`);
  }

  if (tokens.fonts) {
    parts.push(`Fontes: Títulos=${tokens.fonts.headings}, Corpo=${tokens.fonts.body}`);
  }

  if (tokens.do_rules) {
    parts.push(`✅ OBRIGATÓRIO: ${tokens.do_rules}`);
  }

  if (tokens.dont_rules) {
    parts.push(`🚫 PROIBIDO: ${tokens.dont_rules}`);
  }

  if (tokens.example_descriptions.length > 0) {
    parts.push(`Referências de estilo:\n${tokens.example_descriptions.map((d) => `  • ${d}`).join("\n")}`);
  }

  parts.push(`══════ FIM DA IDENTIDADE VISUAL ══════`);
  return parts.join("\n");
}

function buildImagePromptWithBrand(basePrompt: string, tokens: BrandTokens, contentStyle: string): string {
  const colorHexes = tokens.palette.map((c) => c.hex).filter(Boolean).join(", ");

  let styleGuide = "Professional healthcare marketing image for Instagram.";
  if (contentStyle === "quote") {
    styleGuide = "Inspirational, minimalist background. Soft gradients or abstract patterns. Premium aesthetic.";
  } else if (contentStyle === "tip") {
    styleGuide = "Clean, organized, professional. Icons or visual metaphors for tips.";
  } else if (contentStyle === "curiosity") {
    styleGuide = "Eye-catching, intriguing image that sparks curiosity. Bold colors.";
  }

  // Structured prompt with rigid brand blocks
  const parts = [
    "=== BRAND TOKENS (DO NOT INVENT, USE EXACTLY) ===",
    `Visual style: ${tokens.visual_tone}`,
    `Color palette: ${colorHexes || "not specified - use professional defaults"}`,
    `Image style: ${tokens.image_style}`,
    tokens.do_rules ? `Rules to follow: ${tokens.do_rules}` : "",
    "",
    "=== MANDATORY RULES ===",
    `- Use ONLY these brand colors as dominant: ${colorHexes}`,
    `- Style must be: ${tokens.visual_tone}`,
    `- ${styleGuide}`,
    "- NO text overlays on the image",
    "- Ultra high resolution, professional quality",
    "",
    "=== NEGATIVES (FORBIDDEN) ===",
    tokens.dont_rules ? `- ${tokens.dont_rules}` : "",
    "- No watermarks, no stock photo feel",
    "- No generic clip art",
    "- No text or words on the image",
    "",
    "=== OUTPUT ===",
    "Generate ONLY background/illustration. No text overlays.",
    `${basePrompt}`,
    "",
    "Style: Editorial photography, premium magazine quality, high-end aesthetic.",
  ];

  return parts.filter(Boolean).join("\n");
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
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", claimsData.claims.sub);

    const { 
      trend, 
      contentType, 
      contentStyle = "news",
      brandId = null,
      tone = "profissional e engajador", 
      targetAudience = "gestores de saúde", 
      generateImages = true 
    } = await req.json() as GenerateContentRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ══════ BRAND LOADING & SNAPSHOT ══════
    let brandTokens: BrandTokens | null = null;
    let brandContext = "";
    let brandStyleGuide: any = null;

    if (brandId) {
      console.log(`[generate-content] Loading brand: ${brandId}`);

      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("name, palette, visual_tone, do_rules, dont_rules, fonts, logo_url, style_guide")
        .eq("id", brandId)
        .single();

      if (brandError) {
        console.error("[generate-content] Error fetching brand:", brandError);
      } else if (brand) {
        const { data: examples } = await supabase
          .from("brand_examples")
          .select("image_url, description, content_type")
          .eq("brand_id", brandId)
          .limit(5);

        brandTokens = buildBrandTokens(brand, examples || []);
        brandContext = buildBrandContextForPrompt(brandTokens);
        brandStyleGuide = brand.style_guide || null;
        console.log(`[generate-content] Brand tokens built: ${brandTokens.name}, ${brandTokens.palette.length} colors, tone=${brandTokens.visual_tone}, hasStyleGuide=${!!brandStyleGuide}`);
      }
    }

    const styleConfig = stylePrompts[contentStyle] || stylePrompts.news;
    const slideCount = contentType === "carousel" ? 5 : contentType === "story" ? 3 : 1;
    
    const systemPrompt = `Você é um especialista em marketing digital para o setor de saúde. 
${styleConfig.systemAddition}

Regras:
- Use linguagem ${tone}
- Público-alvo: ${targetAudience}
- Inclua emojis relevantes (moderadamente)
- Crie hashtags estratégicas
- Mantenha textos concisos e impactantes
- ${contentStyle === "quote" ? "NÃO inclua CTAs ou links. A frase deve ser autossuficiente." : "Foque em agregar valor e gerar engajamento"}
${brandContext}`;

    const userPrompt = `Crie um ${contentType === "post" ? "post para feed" : contentType === "story" ? "story" : `carrossel com ${slideCount} slides`} do Instagram.

ESTILO: ${contentStyle.toUpperCase()}
${styleConfig.userGuide}

Baseado em:
Título: ${trend.title}
Descrição: ${trend.description}
Tema: ${trend.theme}
Palavras-chave: ${trend.keywords?.join(", ") || "não especificadas"}

${styleConfig.slideGuide}

Retorne exatamente neste formato JSON:
{
  "title": "título curto e chamativo",
  "caption": "legenda completa com emojis${contentStyle === "quote" ? "" : " e call-to-action se apropriado"}",
  "hashtags": ["hashtag1", "hashtag2", "...até 15 hashtags"],
  "slides": [
    {
      "headline": "texto principal do slide",
      "body": "texto de apoio (máximo 2 linhas)",
      "imagePrompt": "descrição detalhada em inglês para gerar imagem profissional. ${brandTokens ? `MUST USE brand colors: ${brandTokens.palette.map(c => c.hex).join(', ')}. Style: ${brandTokens.visual_tone}.` : ''} NO TEXT ON IMAGE."
    }
  ]
}

Para ${contentType === "carousel" ? `carrossel, crie exatamente ${slideCount} slides` : contentType === "story" ? `story, crie ${slideCount} slides verticais` : "post, crie 1 slide"}.
${contentStyle === "quote" ? "IMPORTANTE: O último slide NÃO deve ter CTA." : ""}`;

    console.log(`[generate-content] Generating ${contentStyle} ${contentType}${brandId ? ` with brand ${brandTokens?.name}` : ' without brand'}...`);

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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[generate-content] AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content generated");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from AI");
    }

    const generatedContent = JSON.parse(jsonMatch[0]);

    // ══════ TEMPLATE HINTS + CONDITIONAL IMAGE GENERATION ══════
    const useDeterministicRender = !!brandStyleGuide;
    
    if (useDeterministicRender) {
      // Brand has a style guide → use deterministic templates, skip AI image generation
      console.log(`[generate-content] Using deterministic templates (style_preset=${brandStyleGuide.style_preset})`);
      const recommended = brandStyleGuide.recommended_templates || ["wave_cover", "wave_text_card"];
      
      generatedContent.slides = generatedContent.slides.map((slide: any, i: number) => ({
        ...slide,
        templateHint: i === 0 ? recommended[0] : (i === generatedContent.slides.length - 1 ? recommended[0] : recommended[1] || recommended[0]),
        // No previewImage — will be rendered deterministically on the client
      }));
    } else if (generateImages && generatedContent.slides && generatedContent.slides.length > 0) {
      // No style guide → fall back to AI image generation
      console.log(`[generate-content] Generating AI images for ${generatedContent.slides.length} slides (no style guide)...`);
      
      const slidesWithImages = await Promise.all(
        generatedContent.slides.map(async (slide: { headline: string; body: string; imagePrompt: string }, index: number) => {
          if (!slide.imagePrompt) return slide;
          
          try {
            console.log(`[generate-content] Generating image for slide ${index + 1}...`);
            
            let finalPrompt: string;

            if (brandTokens) {
              finalPrompt = buildImagePromptWithBrand(slide.imagePrompt, brandTokens, contentStyle);
            } else {
              let styleGuide = "Professional healthcare marketing image for Instagram.";
              if (contentStyle === "quote") styleGuide = "Inspirational, minimalist background. Premium aesthetic.";
              else if (contentStyle === "tip") styleGuide = "Clean, organized, professional image.";
              else if (contentStyle === "curiosity") styleGuide = "Eye-catching, intriguing image. Bold colors.";

              finalPrompt = `${styleGuide} ${slide.imagePrompt}. Clean, modern, high-end aesthetic. No text overlays. Ultra high resolution.`;
            }

            const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{ role: "user", content: finalPrompt }],
                modalities: ["image", "text"],
              }),
            });

            if (!imageResponse.ok) {
              console.error(`[generate-content] Image generation failed for slide ${index + 1}:`, imageResponse.status);
              return slide;
            }

            const imageData = await imageResponse.json();
            const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (imageUrl) {
              console.log(`[generate-content] Image generated for slide ${index + 1}`);
              return { ...slide, previewImage: imageUrl };
            }

            return slide;
          } catch (imgError) {
            console.error(`[generate-content] Error generating image for slide ${index + 1}:`, imgError);
            return slide;
          }
        })
      );

      generatedContent.slides = slidesWithImages;
    }

    // ══════ RESPONSE WITH BRAND SNAPSHOT ══════
    console.log(`[generate-content] Returning brandId=${brandId || 'null'}, palette size=${brandTokens?.palette?.length ?? 0}, deterministic=${useDeterministicRender}`);

    return new Response(JSON.stringify({
      success: true,
      content: {
        ...generatedContent,
        contentType,
        contentStyle,
        trendTitle: trend.title,
        brandId: brandId || null,
        brandSnapshot: brandTokens || null,
        styleGuide: brandStyleGuide || null,
        useDeterministicRender,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-content] error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
