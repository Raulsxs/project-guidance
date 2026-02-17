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

  const t0 = Date.now();
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const {
      brandId, slide, slideIndex, totalSlides, contentFormat,
      articleUrl, articleContent, contentId,
      templateSetId, categoryId,
    } = await req.json();

    if (!slide) throw new Error("slide object is required");
    if (!brandId) throw new Error("brandId is required");

    // ══════ LOAD BRAND ══════
    const { data: brandInfo } = await supabase
      .from("brands")
      .select("name, palette, fonts, visual_tone, do_rules, dont_rules, logo_url")
      .eq("id", brandId)
      .single();

    // ══════ LOAD TEMPLATE SET (for style_guide and category filtering) ══════
    let templateSetData: any = null;
    let resolvedCategoryId: string | null = categoryId || null;
    let templateSetName: string | null = null;

    if (templateSetId) {
      const { data: tsData } = await supabase
        .from("brand_template_sets")
        .select("id, name, category_id, category_name, template_set, visual_signature")
        .eq("id", templateSetId)
        .single();

      if (tsData) {
        templateSetData = tsData;
        templateSetName = tsData.name;
        if (!resolvedCategoryId && tsData.category_id) {
          resolvedCategoryId = tsData.category_id;
        }
      }
    }

    // ══════ LOAD REFERENCE IMAGES (filtered by category/pilar) ══════
    const contentTypeFilter = contentFormat === "carousel" ? "carrossel"
      : contentFormat === "story" ? "story"
      : "post";

    let referenceImageUrls: string[] = [];
    let referenceExampleIds: string[] = [];
    let fallbackLevel = 0;

    // Level 0: category_id + content type
    if (resolvedCategoryId) {
      const { data: catExamples } = await supabase
        .from("brand_examples")
        .select("id, image_url")
        .eq("brand_id", brandId)
        .eq("category_id", resolvedCategoryId)
        .in("type", [contentTypeFilter, "carrossel"])
        .order("created_at", { ascending: false })
        .limit(12);

      if (catExamples && catExamples.length >= 3) {
        referenceImageUrls = catExamples.map((e: any) => e.image_url).filter(Boolean);
        referenceExampleIds = catExamples.map((e: any) => e.id);
        fallbackLevel = 0;
      } else {
        // Level 1: category_id only (any content type)
        const { data: catAllExamples } = await supabase
          .from("brand_examples")
          .select("id, image_url")
          .eq("brand_id", brandId)
          .eq("category_id", resolvedCategoryId)
          .order("created_at", { ascending: false })
          .limit(12);

        if (catAllExamples && catAllExamples.length >= 3) {
          referenceImageUrls = catAllExamples.map((e: any) => e.image_url).filter(Boolean);
          referenceExampleIds = catAllExamples.map((e: any) => e.id);
          fallbackLevel = 1;
        }
      }
    }

    // Level 2: brand + content type (last resort)
    if (referenceImageUrls.length < 3) {
      const { data: brandExamples } = await supabase
        .from("brand_examples")
        .select("id, image_url")
        .eq("brand_id", brandId)
        .in("type", [contentTypeFilter, "carrossel"])
        .order("created_at", { ascending: false })
        .limit(12);

      if (brandExamples && brandExamples.length > 0) {
        referenceImageUrls = brandExamples.map((e: any) => e.image_url).filter(Boolean);
        referenceExampleIds = brandExamples.map((e: any) => e.id);
        fallbackLevel = 2;
      }
    }

    const fallbackLabels = ["exact_category", "category_any_type", "brand_wide"];
    console.log(`[generate-slide-images] Slide ${(slideIndex || 0) + 1}/${totalSlides || "?"}, refs=${referenceImageUrls.length}, fallback=${fallbackLabels[fallbackLevel]}, templateSet="${templateSetName || 'none'}", categoryId=${resolvedCategoryId || 'none'}`);

    // F) If template set was selected but no references found, return error
    if (templateSetId && referenceImageUrls.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Sem exemplos de referência para o estilo "${templateSetName || 'selecionado'}". Cadastre pelo menos 3 exemplos neste pilar/formato.`,
        debug: { templateSetId, templateSetName, categoryId: resolvedCategoryId, referencesUsedCount: 0, fallbackLevel: "none" },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════ EXTRACT STYLE GUIDE FROM TEMPLATE SET ══════
    const styleGuide = templateSetData?.template_set?.layout_params || null;
    const rules = templateSetData?.template_set?.rules || null;
    const visualSignature = templateSetData?.visual_signature || templateSetData?.template_set?.visual_signature || null;

    // ══════ BUILD MULTIMODAL REQUEST ══════
    const contentParts: any[] = [];

    // Add reference images (max 6 to reduce payload)
    for (const imgUrl of referenceImageUrls.slice(0, 6)) {
      contentParts.push({
        type: "image_url",
        image_url: { url: imgUrl },
      });
    }

    // Build prompt (articleUrl is intentionally NOT passed to avoid URLs in image)
    const prompt = buildPrompt(
      slide, slideIndex || 0, totalSlides || 1,
      brandInfo, undefined, articleContent, contentFormat,
      rules, visualSignature, templateSetName,
    );
    contentParts.push({ type: "text", text: prompt });

    // Retry logic for transient errors (502, 503, 429)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000 + Math.random() * 2000;
        console.log(`[generate-slide-images] Retry ${attempt}/2 after ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      });

      if (response.ok) {
        const responseText = await response.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.warn(`[generate-slide-images] Empty/invalid JSON response on attempt ${attempt + 1}, retrying...`);
          lastError = new Error("Empty response from AI");
          continue;
        }
        const base64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!base64Image) {
          return new Response(JSON.stringify({
            success: true, imageUrl: null,
            debug: { templateSetId, templateSetName, categoryId: resolvedCategoryId, referencesUsedCount: referenceImageUrls.length, referenceExampleIds, fallbackLevel: fallbackLabels[fallbackLevel] },
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const imageUrl = await uploadBase64ToStorage(supabaseAdmin, base64Image, contentId || "draft", slideIndex || 0);
        console.log(`[generate-slide-images] ✅ Slide ${(slideIndex || 0) + 1} uploaded`);

        return new Response(JSON.stringify({
          success: true, imageUrl,
          debug: {
            templateSetId, templateSetName, categoryId: resolvedCategoryId,
            referencesUsedCount: referenceImageUrls.length, referenceExampleIds,
            fallbackLevel: fallbackLabels[fallbackLevel],
            image_model: "google/gemini-2.5-flash-image",
            image_generation_ms: Date.now() - t0,
            generated_at: new Date().toISOString(),
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = response.status;
      if (status === 402) throw new Error("Insufficient credits.");
      
      if (status === 429 || status === 502 || status === 503) {
        const errText = await response.text();
        console.warn(`[generate-slide-images] Retryable error ${status} on attempt ${attempt + 1}`);
        lastError = new Error(`AI error: ${status}`);
        continue;
      }

      const errText = await response.text();
      console.error(`[generate-slide-images] Non-retryable error ${status}:`, errText.substring(0, 200));
      throw new Error(`AI image error: ${status}`);
    }

    throw lastError || new Error("Max retries exceeded");

  } catch (error) {
    console.error("[generate-slide-images] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════ HELPERS ══════

/** Strip URLs, domains, and internal metadata from text before sending to AI */
function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    // Remove full URLs
    .replace(/https?:\/\/[^\s)]+/gi, "")
    // Remove www. domains
    .replace(/www\.[^\s)]+/gi, "")
    // Remove utm_ params remnants
    .replace(/utm_[a-z_]+=\S*/gi, "")
    // Remove bare domains (.com, .br, .org etc)
    .replace(/\b\S+\.(com|br|org|net|io|dev|app|biz|info)\b/gi, "")
    // Remove internal metadata labels
    .replace(/Estilo\/Pilar:\s*"?[^"\n]+"?/gi, "")
    .replace(/Template(Set)?Id:\s*\S+/gi, "")
    .replace(/Role:\s*\S+/gi, "")
    .replace(/SetId:\s*\S+/gi, "")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ══════ PROMPT BUILDER ══════

function buildPrompt(
  slide: any,
  slideIndex: number,
  totalSlides: number,
  brandInfo: any,
  articleUrl?: string,
  articleContent?: string,
  contentFormat?: string,
  rules?: any,
  visualSignature?: any,
  templateSetName?: string | null,
): string {
  const headline = sanitizeText(slide.headline || "");
  const body = sanitizeText(slide.body || "");
  const bullets = (slide.bullets || []).map((b: string) => sanitizeText(b));

  // D) Se body for longo, resumir automaticamente
  const MAX_BODY_CHARS = 180;
  const truncatedBody = body.length > MAX_BODY_CHARS
    ? body.substring(0, MAX_BODY_CHARS).replace(/\s+\S*$/, "…")
    : body;

  // Headline max 2 lines (~80 chars)
  const MAX_HEADLINE_CHARS = 80;
  const truncatedHeadline = headline.length > MAX_HEADLINE_CHARS
    ? headline.substring(0, MAX_HEADLINE_CHARS).replace(/\s+\S*$/, "…")
    : headline;

  const textParts: string[] = [];
  if (truncatedHeadline) textParts.push(truncatedHeadline);
  if (truncatedBody) textParts.push(truncatedBody);
  if (bullets.length > 0) textParts.push(bullets.slice(0, 5).join("\n"));

  const slideText = textParts.join("\n\n");

  // Sanitize article content
  const articleSnippet = articleContent ? sanitizeText(articleContent.substring(0, 400)) : "";

  // Build style constraints from rules/visual_signature
  let styleConstraints = "";
  if (rules || visualSignature) {
    const parts: string[] = [];
    if (rules?.waves === false) parts.push("NÃO use ondas/curvas no design.");
    if (rules?.waves === true) parts.push("Inclua curva ondulada decorativa.");
    if (rules?.phone_mockup === true) parts.push("Inclua mockup de celular quando aplicável.");
    if (rules?.phone_mockup === false) parts.push("NÃO use mockup de celular.");
    if (rules?.body_in_card === true) parts.push("O texto principal deve estar dentro de um card/caixa.");
    if (rules?.body_in_card === false) parts.push("Texto direto sobre o fundo, SEM card.");
    if (rules?.inner_frame === true) parts.push("Use moldura interna decorativa.");
    if (rules?.uppercase_headlines === true) parts.push("Headlines em CAIXA ALTA.");
    if (visualSignature?.primary_bg_mode) parts.push(`Fundo: ${visualSignature.primary_bg_mode}.`);
    if (visualSignature?.card_style && visualSignature.card_style !== "none") parts.push(`Estilo de card: ${visualSignature.card_style}.`);
    if (visualSignature?.decorative_shape && visualSignature.decorative_shape !== "none") parts.push(`Forma decorativa: ${visualSignature.decorative_shape}.`);
    styleConstraints = parts.length > 0 ? `\n\nREGRAS DE ESTILO (obrigatórias):\n${parts.join("\n")}` : "";
  }

  return `Crie o slide ${slideIndex + 1} de ${totalSlides} de um carrossel de Instagram sobre este conteúdo, seguindo EXATAMENTE o mesmo estilo visual das imagens de referência anexadas.

Texto do slide (em PT-BR, escreva exatamente como está, com acentos e ortografia corretos):
${slideText}
${articleSnippet ? `\nContexto adicional:\n${articleSnippet}` : ""}
${styleConstraints}

REGRAS OBRIGATÓRIAS:
- Replique EXATAMENTE o estilo, layout, cores, tipografia, mockups, cards, faixas, shapes e elementos estruturais das referências.
- O texto DEVE estar em português do Brasil com acentos corretos (á, é, í, ó, ú, ã, õ, ç). NUNCA troque acentos por caracteres estranhos.
- Headline: máximo 2 linhas de texto.
- Body: se for longo, resuma mantendo o sentido — nunca corte no meio de uma palavra.
- Safe area OBRIGATÓRIA: margem mínima de 80px em TODAS as bordas. NENHUM texto pode ser cortado.
- O slide deve ter formato portrait (4:5, 1080×1350px).
- Use APENAS referências do mesmo estilo visual — não misture com outros estilos.
- Consistência de série: mantenha a mesma família tipográfica, estilo de layout, margens e detalhes ao longo de todos os slides do carrossel.
- Se as referências incluem mockup de celular, cards, faixas, ondas ou shapes decorativos, REPLIQUE esses elementos.

PROIBIÇÕES ABSOLUTAS (violar qualquer uma é INACEITÁVEL):
- NUNCA inclua URLs, links, domínios, endereços web, QR codes ou nomes de sites.
- NUNCA escreva "Artigo fonte", "Fonte:", "www.", ".com", ".br" ou qualquer referência a sites.
- NUNCA inclua metadados como "Estilo/Pilar:", "Template:", "Role:", "SetId:", "TemplateSetId:" na imagem.
- NUNCA inclua @handles de redes sociais inventados.
- NUNCA inclua texto em inglês — TODO texto deve ser em português.
- O ÚNICO texto permitido na imagem é o headline, body e bullets fornecidos acima.

Responda APENAS com a imagem gerada. Sem texto adicional fora da arte.`;
}

// ══════ STORAGE UPLOAD ══════

async function uploadBase64ToStorage(
  supabaseAdmin: any,
  base64Data: string,
  contentId: string,
  slideIndex: number,
): Promise<string> {
  const base64Clean = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  const mimeMatch = base64Data.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fileName = `ai-slides/${contentId}/slide-${slideIndex}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("generated-images")
    .upload(fileName, bytes.buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[generate-slide-images] Upload error:", uploadError);
    throw new Error("Failed to upload generated image");
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("generated-images")
    .getPublicUrl(fileName);

  return publicUrl;
}
