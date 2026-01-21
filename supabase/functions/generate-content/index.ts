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
  tone?: string;
  targetAudience?: string;
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

    console.log("Authenticated user:", claimsData.claims.sub);

    const { trend, contentType, tone = "profissional e engajador", targetAudience = "gestores de saúde", generateImages = true } = await req.json() as GenerateContentRequest & { generateImages?: boolean };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const slideCount = contentType === "carousel" ? 5 : contentType === "story" ? 3 : 1;
    
    const systemPrompt = `Você é um especialista em marketing digital para o setor de saúde. Seu objetivo é criar conteúdo engajador para Instagram focado em gestão em saúde.

Regras:
- Use linguagem ${tone}
- Público-alvo: ${targetAudience}
- Inclua emojis relevantes
- Crie hashtags estratégicas
- Mantenha textos concisos e impactantes
- Foque em agregar valor e gerar engajamento`;

    const userPrompt = `Crie um ${contentType === "post" ? "post para feed" : contentType === "story" ? "story" : "carrossel com ${slideCount} slides"} do Instagram sobre:

Título: ${trend.title}
Descrição: ${trend.description}
Tema: ${trend.theme}
Palavras-chave: ${trend.keywords?.join(", ") || "não especificadas"}

Retorne exatamente neste formato JSON:
{
  "title": "título curto e chamativo",
  "caption": "legenda completa com emojis e call-to-action",
  "hashtags": ["hashtag1", "hashtag2", "...até 15 hashtags"],
  "slides": [
    {
      "headline": "texto principal do slide",
      "body": "texto de apoio (máximo 2 linhas)",
      "imagePrompt": "descrição detalhada em inglês para gerar imagem profissional relacionada ao tema"
    }
  ]
}

Para ${contentType === "carousel" ? `carrossel, crie exatamente ${slideCount} slides` : contentType === "story" ? `story, crie ${slideCount} slides verticais` : "post, crie 1 slide"}.`;

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
            
            const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image-preview",
                messages: [
                  {
                    role: "user",
                    content: `Professional healthcare marketing image for Instagram. Style: Editorial photography, premium magazine quality. ${slide.imagePrompt}. Clean, modern, high-end aesthetic. No text overlays.`,
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
