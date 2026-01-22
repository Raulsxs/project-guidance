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
  tone?: string;
  targetAudience?: string;
  generateImages?: boolean;
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

    console.log("Authenticated user:", claimsData.claims.sub);

    const { 
      trend, 
      contentType, 
      contentStyle = "news",
      tone = "profissional e engajador", 
      targetAudience = "gestores de saúde", 
      generateImages = true 
    } = await req.json() as GenerateContentRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
- ${contentStyle === "quote" ? "NÃO inclua CTAs ou links. A frase deve ser autossuficiente." : "Foque em agregar valor e gerar engajamento"}`;

    const userPrompt = `Crie um ${contentType === "post" ? "post para feed" : contentType === "story" ? "story" : "carrossel com ${slideCount} slides"} do Instagram.

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
      "headline": "texto principal do slide (${contentStyle === "quote" ? "a frase inspiracional" : "chamada principal"})",
      "body": "texto de apoio (máximo 2 linhas)${contentStyle === "quote" ? " - pode ser vazio para frases" : ""}",
      "imagePrompt": "descrição detalhada em inglês para gerar imagem profissional relacionada ao tema"
    }
  ]
}

Para ${contentType === "carousel" ? `carrossel, crie exatamente ${slideCount} slides` : contentType === "story" ? `story, crie ${slideCount} slides verticais` : "post, crie 1 slide"}.
${contentStyle === "quote" ? "IMPORTANTE: O último slide NÃO deve ter CTA. Pode ser a assinatura da marca ou uma frase de fechamento." : ""}`;

    console.log(`Generating ${contentStyle} content for ${contentType}...`);

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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content generated");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from AI");
    }

    const generatedContent = JSON.parse(jsonMatch[0]);

    // Generate images for all slides if enabled
    if (generateImages && generatedContent.slides && generatedContent.slides.length > 0) {
      console.log(`Generating images for ${generatedContent.slides.length} slides...`);
      
      const slidesWithImages = await Promise.all(
        generatedContent.slides.map(async (slide: { headline: string; body: string; imagePrompt: string }, index: number) => {
          if (!slide.imagePrompt) return slide;
          
          try {
            console.log(`Generating image for slide ${index + 1}...`);
            
            // Adapt image style based on content style
            let imageStyleGuide = "Professional healthcare marketing image for Instagram.";
            if (contentStyle === "quote") {
              imageStyleGuide = "Inspirational, minimalist background image. Soft gradients or abstract patterns. Premium aesthetic.";
            } else if (contentStyle === "tip") {
              imageStyleGuide = "Clean, organized, professional image. Icons or visual metaphors for tips.";
            } else if (contentStyle === "curiosity") {
              imageStyleGuide = "Eye-catching, intriguing image that sparks curiosity. Bold colors.";
            }
            
            const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [
                  {
                    role: "user",
                    content: `${imageStyleGuide} Style: Editorial photography, premium magazine quality. ${slide.imagePrompt}. Clean, modern, high-end aesthetic. No text overlays.`,
                  },
                ],
                modalities: ["image", "text"],
              }),
            });

            if (!imageResponse.ok) {
              console.error(`Image generation failed for slide ${index + 1}:`, imageResponse.status);
              return slide;
            }

            const imageData = await imageResponse.json();
            const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (imageUrl) {
              console.log(`Image generated for slide ${index + 1}`);
              return { ...slide, previewImage: imageUrl };
            }

            return slide;
          } catch (imgError) {
            console.error(`Error generating image for slide ${index + 1}:`, imgError);
            return slide;
          }
        })
      );

      generatedContent.slides = slidesWithImages;
    }

    return new Response(JSON.stringify({
      success: true,
      content: {
        ...generatedContent,
        contentType,
        contentStyle,
        trendTitle: trend.title,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-content error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
