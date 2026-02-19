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
      styleGalleryId,
      language: requestLanguage,
      backgroundOnly, // NEW: when true, generate background without any text
    } = await req.json();

    if (!slide) throw new Error("slide object is required");

    const language = requestLanguage || "pt-BR";
    const isBgOnly = !!backgroundOnly;

    console.log(`[generate-slide-images] backgroundOnly=${isBgOnly}, slideIndex=${slideIndex}`);

    // ══════ STYLE GALLERY MODE ══════
    if (styleGalleryId) {
      const { data: galleryStyle } = await supabaseAdmin
        .from("system_template_sets")
        .select("name, reference_images, preview_images, supported_formats, style_prompt")
        .eq("id", styleGalleryId)
        .single();

      if (!galleryStyle) {
        return new Response(JSON.stringify({
          success: false,
          error: `Estilo da galeria não encontrado (ID: ${styleGalleryId}).`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const refImages = galleryStyle.reference_images as Record<string, Record<string, string[]>> | null;
      const formatKey = contentFormat === "carousel" ? "carousel" : contentFormat === "story" ? "story" : "post";

      const formatRefs = refImages?.[formatKey];
      if (!formatRefs || Object.values(formatRefs).flat().length === 0) {
        const fallbackRefs = refImages?.["post"];
        if (!fallbackRefs || Object.values(fallbackRefs).flat().length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Estilo "${galleryStyle.name}" não possui referências para o formato "${formatKey}".`,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const role = slide.role || "content";
      const roleRefs = formatRefs?.[role] || formatRefs?.["content"] || [];
      const allFormatRefs = Object.values(formatRefs || {}).flat();
      const selectedRefs = roleRefs.length > 0 ? roleRefs : allFormatRefs;

      console.log(`[generate-slide-images] STYLE_GALLERY mode: style="${galleryStyle.name}", format=${formatKey}, role=${role}, refs=${selectedRefs.length}`);

      const contentParts: any[] = [];
      for (const imgUrl of selectedRefs.slice(0, 6)) {
        contentParts.push({ type: "image_url", image_url: { url: imgUrl } });
      }

      const prompt = isBgOnly
        ? buildBackgroundOnlyPrompt(slide, slideIndex || 0, totalSlides || 1, null, contentFormat, null, null, galleryStyle.name, language)
        : buildPrompt(
            { ...slide, headline: sanitizeText(slide.headline || ""), body: sanitizeText(slide.body || ""), bullets: (slide.bullets || []).map((b: string) => sanitizeText(b)) },
            slideIndex || 0, totalSlides || 1,
            null, undefined, articleContent, contentFormat,
            null, null, galleryStyle.name, language,
          );
      contentParts.push({ type: "text", text: prompt });

      const result = await generateImage(LOVABLE_API_KEY, contentParts);

      if (!result) {
        return new Response(JSON.stringify({
          success: true, imageUrl: null, bgImageUrl: null,
          debug: { styleGalleryId, styleName: galleryStyle.name, referencesUsedCount: selectedRefs.length, mode: "style_gallery", backgroundOnly: isBgOnly },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const imageUrl = await uploadBase64ToStorage(supabaseAdmin, result, contentId || "draft", slideIndex || 0);
      return new Response(JSON.stringify({
        success: true,
        imageUrl: isBgOnly ? null : imageUrl,
        bgImageUrl: isBgOnly ? imageUrl : null,
        debug: {
          styleGalleryId, styleName: galleryStyle.name,
          referencesUsedCount: selectedRefs.length, mode: "style_gallery",
          image_model: "google/gemini-2.5-flash-image",
          image_generation_ms: Date.now() - t0,
          backgroundOnly: isBgOnly,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!brandId) throw new Error("brandId is required");

    // ══════ LOAD BRAND ══════
    const { data: brandInfo } = await supabase
      .from("brands")
      .select("name, palette, fonts, visual_tone, do_rules, dont_rules, logo_url")
      .eq("id", brandId)
      .single();

    // ══════ LOAD TEMPLATE SET ══════
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

    // ══════ LOAD REFERENCE IMAGES ══════
    const contentTypeFilter = contentFormat === "carousel" ? "carrossel"
      : contentFormat === "story" ? "story"
      : "post";

    let referenceImageUrls: string[] = [];
    let referenceExampleIds: string[] = [];
    let fallbackLevel = 0;

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
    console.log(`[generate-slide-images] Slide ${(slideIndex || 0) + 1}/${totalSlides || "?"}, refs=${referenceImageUrls.length}, fallback=${fallbackLabels[fallbackLevel]}, templateSet="${templateSetName || 'none'}", bgOnly=${isBgOnly}`);

    if (templateSetId && referenceImageUrls.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Sem exemplos de referência para o estilo "${templateSetName || 'selecionado'}". Cadastre pelo menos 3 exemplos neste pilar/formato.`,
        debug: { templateSetId, templateSetName, categoryId: resolvedCategoryId, referencesUsedCount: 0, fallbackLevel: "none" },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════ EXTRACT STYLE GUIDE ══════
    const rules = templateSetData?.template_set?.rules || null;
    const visualSignature = templateSetData?.visual_signature || templateSetData?.template_set?.visual_signature || null;

    // ══════ BUILD MULTIMODAL REQUEST ══════
    const contentParts: any[] = [];

    for (const imgUrl of referenceImageUrls.slice(0, 6)) {
      contentParts.push({
        type: "image_url",
        image_url: { url: imgUrl },
      });
    }

    const prompt = isBgOnly
      ? buildBackgroundOnlyPrompt(slide, slideIndex || 0, totalSlides || 1, brandInfo, contentFormat, rules, visualSignature, templateSetName, language)
      : buildPrompt(
          { ...slide, headline: sanitizeText(slide.headline || ""), body: sanitizeText(slide.body || ""), bullets: (slide.bullets || []).map((b: string) => sanitizeText(b)) },
          slideIndex || 0, totalSlides || 1,
          brandInfo, undefined, articleContent, contentFormat,
          rules, visualSignature, templateSetName, language,
        );
    contentParts.push({ type: "text", text: prompt });

    // ══════ GENERATE IMAGE ══════
    const base64Image = await generateImage(LOVABLE_API_KEY, contentParts);

    if (!base64Image) {
      return new Response(JSON.stringify({
        success: true, imageUrl: null, bgImageUrl: null,
        debug: { templateSetId, templateSetName, categoryId: resolvedCategoryId, referencesUsedCount: referenceImageUrls.length, referenceExampleIds, fallbackLevel: fallbackLabels[fallbackLevel], backgroundOnly: isBgOnly },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = await uploadBase64ToStorage(supabaseAdmin, base64Image, contentId || "draft", slideIndex || 0);
    console.log(`[generate-slide-images] ✅ Slide ${(slideIndex || 0) + 1} uploaded (bgOnly=${isBgOnly})`);

    return new Response(JSON.stringify({
      success: true,
      imageUrl: isBgOnly ? null : imageUrl,
      bgImageUrl: isBgOnly ? imageUrl : null,
      debug: {
        templateSetId, templateSetName, categoryId: resolvedCategoryId,
        referencesUsedCount: referenceImageUrls.length, referenceExampleIds,
        fallbackLevel: fallbackLabels[fallbackLevel],
        image_model: "google/gemini-2.5-flash-image",
        image_generation_ms: Date.now() - t0,
        generated_at: new Date().toISOString(),
        backgroundOnly: isBgOnly,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[generate-slide-images] error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════ GENERATE IMAGE (simple, no self-check for bg-only) ══════

async function generateImage(apiKey: string, contentParts: any[]): Promise<string | null> {
  let lastError: Error | null = null;
  for (let retry = 0; retry < 3; retry++) {
    if (retry > 0) {
      const delay = retry * 3000 + Math.random() * 2000;
      console.log(`[generate-slide-images] Retry ${retry}/2 after ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
        console.warn(`[generate-slide-images] Empty/invalid JSON response, retrying...`);
        lastError = new Error("Empty response from AI");
        continue;
      }
      return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
    }

    const status = response.status;
    if (status === 402) throw new Error("Insufficient credits.");
    if (status === 429 || status === 502 || status === 503) {
      await response.text();
      console.warn(`[generate-slide-images] Retryable error ${status} on retry ${retry + 1}`);
      lastError = new Error(`AI error: ${status}`);
      continue;
    }

    const errText = await response.text();
    console.error(`[generate-slide-images] Non-retryable error ${status}:`, errText.substring(0, 200));
    throw new Error(`AI image error: ${status}`);
  }

  throw lastError || new Error("Max retries exceeded");
}

// ══════ HELPERS ══════

/** Strip URLs, domains, and internal metadata from text */
function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/www\.[^\s)]+/gi, "")
    .replace(/utm_[a-z_]+=\S*/gi, "")
    .replace(/\b\S+\.(com|br|org|net|io|dev|app|biz|info)\b/gi, "")
    .replace(/Artigo\s+fonte:\s*[^\n]*/gi, "")
    .replace(/^Fonte:\s*[^\n]*/gim, "")
    .replace(/Estilo\/Pilar:\s*"?[^"\n]+"?/gi, "")
    .replace(/Template(Set)?Id:\s*\S+/gi, "")
    .replace(/Role:\s*\S+/gi, "")
    .replace(/SetId:\s*\S+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ══════ BACKGROUND-ONLY PROMPT ══════

function buildBackgroundOnlyPrompt(
  slide: any,
  slideIndex: number,
  totalSlides: number,
  brandInfo: any,
  contentFormat?: string,
  rules?: any,
  visualSignature?: any,
  templateSetName?: string | null,
  language?: string,
): string {
  const role = slide.role || "content";
  const isStory = contentFormat === "story";
  const dimensions = isStory ? "1080×1920" : "1080×1350";
  const aspectRatio = isStory ? "9:16" : "4:5";

  // Build style constraints from rules/visual signature
  let styleConstraints = "";
  if (rules || visualSignature) {
    const parts: string[] = [];
    if (rules?.waves === false) parts.push("NÃO use ondas/curvas.");
    if (rules?.waves === true) parts.push("Inclua curva ondulada decorativa.");
    if (rules?.phone_mockup === true) parts.push("Inclua mockup de celular quando aplicável.");
    if (rules?.phone_mockup === false) parts.push("NÃO use mockup de celular.");
    if (rules?.body_in_card === true) parts.push("Área de card/caixa para texto futuro (overlay).");
    if (rules?.inner_frame === true) parts.push("Use moldura interna decorativa.");
    if (visualSignature?.primary_bg_mode) parts.push(`Fundo: ${visualSignature.primary_bg_mode}.`);
    if (visualSignature?.card_style && visualSignature.card_style !== "none") parts.push(`Estilo de card: ${visualSignature.card_style}.`);
    if (visualSignature?.decorative_shape && visualSignature.decorative_shape !== "none") parts.push(`Forma decorativa: ${visualSignature.decorative_shape}.`);
    styleConstraints = parts.length > 0 ? `\nREGRAS DE ESTILO:\n${parts.join("\n")}` : "";
  }

  // Describe the role so AI knows what kind of background to generate
  const roleDescriptions: Record<string, string> = {
    cover: "Este é o slide de CAPA — fundo impactante, área limpa na parte inferior para headline grande.",
    context: "Slide de contexto — fundo com elementos visuais sutis, área ampla para texto.",
    insight: "Slide de insight — fundo que comunica destaque/importância.",
    bullets: "Slide de bullets/tópicos — fundo limpo com área para lista de itens.",
    cta: "Slide de CTA (chamada para ação) — fundo que convida à interação, área para botão/texto.",
    content: "Slide de conteúdo — fundo equilibrado com área para texto.",
  };

  return `Gere APENAS o BACKGROUND/arte visual do slide ${slideIndex + 1} de ${totalSlides} de um carrossel de Instagram.

ATENÇÃO ABSOLUTA: Esta imagem deve conter ZERO TEXTO. Nenhuma letra, nenhuma palavra, nenhum número, nenhum caractere.

${roleDescriptions[role] || roleDescriptions.content}

REQUISITOS:
- Formato: ${aspectRatio} portrait (${dimensions}px)
- Replique EXATAMENTE o estilo visual, cores, gradientes, formas, shapes e elementos decorativos das imagens de referência anexadas.
- Reserve uma "safe area" de texto: área limpa (sem elementos visuais complexos) na parte inferior do slide (~40% da altura) para sobreposição de texto futuro.
- Use gradiente escuro sutil na parte inferior para garantir contraste com texto branco.
- Mantenha consistência visual entre todos os slides do carrossel.
${styleConstraints}

PROIBIÇÕES ABSOLUTAS:
- NENHUM texto de qualquer tipo (nem título, nem subtítulo, nem número, nem bullet, nem palavra).
- NENHUMA letra do alfabeto em nenhum idioma.
- NENHUM URL, domínio, @handle, hashtag.
- NENHUM número de slide (1/8, 2/8 etc).
- NENHUM logo com texto.
- NENHUM QR code.
- Se as referências contêm texto, IGNORE o texto e replique APENAS os elementos visuais/decorativos.

A imagem deve ser PURAMENTE visual: formas, gradientes, ilustrações, ícones sem texto, mockups, padrões, fotos.

Responda APENAS com a imagem gerada.`;
}

// ══════ LEGACY PROMPT (with text) ══════

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
  language?: string,
): string {
  const headline = slide.headline || "";
  const body = slide.body || "";
  const bullets = slide.bullets || [];

  const MAX_BODY_CHARS = 180;
  const truncatedBody = body.length > MAX_BODY_CHARS
    ? body.substring(0, MAX_BODY_CHARS).replace(/\s+\S*$/, "…")
    : body;

  const MAX_HEADLINE_CHARS = 80;
  const truncatedHeadline = headline.length > MAX_HEADLINE_CHARS
    ? headline.substring(0, MAX_HEADLINE_CHARS).replace(/\s+\S*$/, "…")
    : headline;

  const articleSnippet = articleContent ? sanitizeText(articleContent.substring(0, 400)) : "";

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

  const lang = language || "pt-BR";

  return `Crie o slide ${slideIndex + 1} de ${totalSlides} de um carrossel de Instagram sobre este conteúdo, seguindo EXATAMENTE o mesmo estilo visual das imagens de referência anexadas.

TEXTO DO SLIDE (idioma: ${lang}):
Copie o texto EXATAMENTE como fornecido abaixo. NÃO traduza, NÃO reescreva, NÃO corrija, NÃO mude letras ou acentos. Se não couber, reduza o tamanho da fonte e quebre a linha, mas mantenha o texto IDÊNTICO caractere por caractere.

---HEADLINE---
${truncatedHeadline}
---BODY---
${truncatedBody}
${bullets.length > 0 ? `---BULLETS---\n${bullets.slice(0, 5).join("\n")}` : ""}
---FIM DO TEXTO---

${articleSnippet ? `\nContexto adicional (NÃO incluir na imagem):\n${articleSnippet}` : ""}
${styleConstraints}

REGRAS OBRIGATÓRIAS:
- Replique EXATAMENTE o estilo, layout, cores, tipografia, mockups, cards, faixas, shapes e elementos estruturais das referências.
- O texto DEVE ser copiado LITERALMENTE — cada letra, cada acento (á, é, í, ó, ú, ã, õ, ç, ê, â) deve ser idêntico ao fornecido acima.
- Headline: máximo 2 linhas de texto. Se não couber, reduza a fonte.
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
- NUNCA inclua texto em outro idioma que não ${lang} — TODO texto deve ser em ${lang}.
- O ÚNICO texto permitido na imagem é o headline, body e bullets fornecidos acima entre ---HEADLINE--- e ---FIM DO TEXTO---.
- NUNCA altere a ortografia do texto fornecido. Se está escrito "VELOCIDADE", não escreva "VEICICIDADE".

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
