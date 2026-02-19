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
    } = await req.json();

    if (!slide) throw new Error("slide object is required");

    const language = requestLanguage || "pt-BR";

    // ══════ STYLE GALLERY MODE (takes priority over brand) ══════
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
            error: `Estilo "${galleryStyle.name}" não possui referências para o formato "${formatKey}". Gere o pack de imagens primeiro na Galeria de Estilos.`,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const role = slide.role || "content";
      const roleRefs = formatRefs?.[role] || formatRefs?.["content"] || [];
      const allFormatRefs = Object.values(formatRefs || {}).flat();
      const selectedRefs = roleRefs.length > 0 ? roleRefs : allFormatRefs;

      console.log(`[generate-slide-images] STYLE_GALLERY mode: style="${galleryStyle.name}", format=${formatKey}, role=${role}, refs=${selectedRefs.length}`);

      // Lock text before image generation
      const lockedText = await lockText(LOVABLE_API_KEY, slide, language);
      console.log(`[generate-slide-images] Text locked: headline="${lockedText.locked_headline?.substring(0, 40)}...", glossary=[${lockedText.glossary_applied.join(",")}]`);

      const contentParts: any[] = [];
      for (const imgUrl of selectedRefs.slice(0, 6)) {
        contentParts.push({ type: "image_url", image_url: { url: imgUrl } });
      }

      const prompt = buildPrompt(
        { ...slide, headline: lockedText.locked_headline, body: lockedText.locked_body, bullets: lockedText.locked_bullets },
        slideIndex || 0, totalSlides || 1,
        null, undefined, articleContent, contentFormat,
        null, null, galleryStyle.name, language,
      );
      contentParts.push({ type: "text", text: prompt });

      // Generate + self-check loop
      const result = await generateWithSelfCheck(
        LOVABLE_API_KEY, contentParts, lockedText.locked_headline, language
      );

      if (!result.base64Image) {
        return new Response(JSON.stringify({
          success: true, imageUrl: null,
          debug: { styleGalleryId, styleName: galleryStyle.name, referencesUsedCount: selectedRefs.length, mode: "style_gallery" },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const imageUrl = await uploadBase64ToStorage(supabaseAdmin, result.base64Image, contentId || "draft", slideIndex || 0);
      return new Response(JSON.stringify({
        success: true, imageUrl,
        debug: {
          styleGalleryId, styleName: galleryStyle.name,
          referencesUsedCount: selectedRefs.length, mode: "style_gallery",
          image_model: "google/gemini-2.5-flash-image",
          image_generation_ms: Date.now() - t0,
          text_locked: true, self_check_retried: result.retried,
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
    console.log(`[generate-slide-images] Slide ${(slideIndex || 0) + 1}/${totalSlides || "?"}, refs=${referenceImageUrls.length}, fallback=${fallbackLabels[fallbackLevel]}, templateSet="${templateSetName || 'none'}", categoryId=${resolvedCategoryId || 'none'}`);

    if (templateSetId && referenceImageUrls.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Sem exemplos de referência para o estilo "${templateSetName || 'selecionado'}". Cadastre pelo menos 3 exemplos neste pilar/formato.`,
        debug: { templateSetId, templateSetName, categoryId: resolvedCategoryId, referencesUsedCount: 0, fallbackLevel: "none" },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════ TEXT LOCK: correct spelling before image generation ══════
    const lockedText = await lockText(LOVABLE_API_KEY, slide, language);
    console.log(`[generate-slide-images] Text locked: headline="${lockedText.locked_headline?.substring(0, 40)}...", glossary=[${lockedText.glossary_applied.join(",")}]`);

    // ══════ EXTRACT STYLE GUIDE ══════
    const styleGuide = templateSetData?.template_set?.layout_params || null;
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

    // Use locked text in the prompt
    const prompt = buildPrompt(
      { ...slide, headline: lockedText.locked_headline, body: lockedText.locked_body, bullets: lockedText.locked_bullets },
      slideIndex || 0, totalSlides || 1,
      brandInfo, undefined, articleContent, contentFormat,
      rules, visualSignature, templateSetName, language,
    );
    contentParts.push({ type: "text", text: prompt });

    // ══════ GENERATE WITH SELF-CHECK ══════
    const result = await generateWithSelfCheck(
      LOVABLE_API_KEY, contentParts, lockedText.locked_headline, language
    );

    if (!result.base64Image) {
      return new Response(JSON.stringify({
        success: true, imageUrl: null,
        debug: { templateSetId, templateSetName, categoryId: resolvedCategoryId, referencesUsedCount: referenceImageUrls.length, referenceExampleIds, fallbackLevel: fallbackLabels[fallbackLevel] },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = await uploadBase64ToStorage(supabaseAdmin, result.base64Image, contentId || "draft", slideIndex || 0);
    console.log(`[generate-slide-images] ✅ Slide ${(slideIndex || 0) + 1} uploaded${result.retried ? " (after self-check retry)" : ""}`);

    return new Response(JSON.stringify({
      success: true, imageUrl,
      debug: {
        templateSetId, templateSetName, categoryId: resolvedCategoryId,
        referencesUsedCount: referenceImageUrls.length, referenceExampleIds,
        fallbackLevel: fallbackLabels[fallbackLevel],
        image_model: "google/gemini-2.5-flash-image",
        image_generation_ms: Date.now() - t0,
        generated_at: new Date().toISOString(),
        text_locked: true,
        self_check_retried: result.retried,
        locked_headline: lockedText.locked_headline,
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

// ══════ TEXT LOCK: spelling correction + standardization ══════

async function lockText(
  apiKey: string,
  slide: any,
  language: string,
): Promise<{
  locked_headline: string;
  locked_body: string;
  locked_bullets: string[];
  locked_cta: string;
  language: string;
  glossary_applied: string[];
}> {
  const rawHeadline = sanitizeText(slide.headline || "");
  const rawBody = sanitizeText(slide.body || "");
  const rawBullets = (slide.bullets || []).map((b: string) => sanitizeText(b));
  const rawCta = slide.role === "cta" ? sanitizeText(slide.body || "") : "";

  // If no text at all, skip the API call
  if (!rawHeadline && !rawBody && rawBullets.length === 0) {
    return {
      locked_headline: rawHeadline,
      locked_body: rawBody,
      locked_bullets: rawBullets,
      locked_cta: rawCta,
      language,
      glossary_applied: [],
    };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um corretor ortográfico estrito para ${language}. Sua ÚNICA tarefa é:
1. Corrigir erros de ortografia e acentuação (á, é, í, ó, ú, ã, õ, ç, ê, â).
2. Padronizar termos recorrentes: "Tendência" (com ê), "Carrossel", "Inteligência Artificial", "Ressonância".
3. Manter caixa alta (UPPERCASE) se o original estiver em caixa alta.
4. Remover URLs, domínios, "Artigo fonte:", "Estilo/Pilar:", metadados técnicos.
5. NÃO traduzir, NÃO reescrever, NÃO mudar estilo ou sentido.
6. NÃO adicionar texto novo.

Responda APENAS com JSON válido no formato:
{"locked_headline":"...","locked_body":"...","locked_bullets":["..."],"locked_cta":"...","glossary_applied":["termo1","termo2"]}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              headline: rawHeadline,
              body: rawBody,
              bullets: rawBullets,
              cta: rawCta,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[lockText] API error ${response.status}, using raw text`);
      return {
        locked_headline: rawHeadline,
        locked_body: rawBody,
        locked_bullets: rawBullets,
        locked_cta: rawCta,
        language,
        glossary_applied: [],
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[lockText] No JSON found in response, using raw text");
      return {
        locked_headline: rawHeadline,
        locked_body: rawBody,
        locked_bullets: rawBullets,
        locked_cta: rawCta,
        language,
        glossary_applied: [],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      locked_headline: parsed.locked_headline || rawHeadline,
      locked_body: parsed.locked_body || rawBody,
      locked_bullets: parsed.locked_bullets || rawBullets,
      locked_cta: parsed.locked_cta || rawCta,
      language,
      glossary_applied: parsed.glossary_applied || [],
    };
  } catch (err) {
    console.warn("[lockText] Error, falling back to raw text:", err);
    return {
      locked_headline: rawHeadline,
      locked_body: rawBody,
      locked_bullets: rawBullets,
      locked_cta: rawCta,
      language,
      glossary_applied: [],
    };
  }
}

// ══════ GENERATE WITH SELF-CHECK ══════

async function generateWithSelfCheck(
  apiKey: string,
  contentParts: any[],
  expectedHeadline: string,
  language: string,
): Promise<{ base64Image: string | null; retried: boolean }> {
  let retried = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const base64Image = await callImageModel(apiKey, contentParts, attempt);

    if (!base64Image) {
      return { base64Image: null, retried: false };
    }

    // Skip self-check if headline is too short or empty
    if (!expectedHeadline || expectedHeadline.length < 5) {
      return { base64Image, retried };
    }

    // Self-check: only on first attempt
    if (attempt === 0) {
      const checkResult = await selfCheck(apiKey, base64Image, expectedHeadline, language);
      if (checkResult.pass) {
        console.log(`[selfCheck] ✅ Headline matches (similarity=${checkResult.similarity})`);
        return { base64Image, retried: false };
      }

      console.warn(`[selfCheck] ⚠️ Headline divergence detected (similarity=${checkResult.similarity}). Expected: "${expectedHeadline.substring(0, 40)}", Got: "${checkResult.extractedText?.substring(0, 40)}". Retrying...`);
      retried = true;

      // Reinforce the prompt for retry
      const lastPart = contentParts[contentParts.length - 1];
      if (lastPart?.type === "text") {
        contentParts[contentParts.length - 1] = {
          type: "text",
          text: lastPart.text + `\n\n⚠️ ATENÇÃO CRÍTICA: Na tentativa anterior o texto do headline saiu ERRADO. O headline DEVE ser EXATAMENTE: "${expectedHeadline}". Copie LETRA POR LETRA, incluindo acentos. QUALQUER alteração é INACEITÁVEL.`,
        };
      }
      continue;
    }

    // Second attempt: return whatever we got
    return { base64Image, retried: true };
  }

  return { base64Image: null, retried };
}

async function callImageModel(apiKey: string, contentParts: any[], attempt: number): Promise<string | null> {
  // Retry logic for transient errors
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
        console.warn(`[generate-slide-images] Empty/invalid JSON response on attempt ${attempt + 1}, retrying...`);
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

// ══════ SELF-CHECK: multimodal headline verification ══════

async function selfCheck(
  apiKey: string,
  base64Image: string,
  expectedHeadline: string,
  language: string,
): Promise<{ pass: boolean; similarity: number; extractedText?: string }> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: base64Image } },
              {
                type: "text",
                text: `Leia a imagem e extraia EXATAMENTE o texto do headline principal (o título grande). Responda APENAS com JSON: {"headline":"texto exato que você lê na imagem"}. Não invente, não corrija — copie exatamente o que está escrito.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[selfCheck] API error ${response.status}, skipping check`);
      return { pass: true, similarity: -1 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[selfCheck] No JSON in response, skipping");
      return { pass: true, similarity: -1 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const extracted = (parsed.headline || "").trim();

    // Normalize for comparison: lowercase, remove extra spaces, punctuation
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-záàâãéèêíïóôõúüç0-9\s]/gi, "").replace(/\s+/g, " ").trim();
    const a = normalize(expectedHeadline);
    const b = normalize(extracted);

    // Simple similarity: character overlap ratio
    const similarity = a.length === 0 ? (b.length === 0 ? 1 : 0) : levenshteinSimilarity(a, b);

    return {
      pass: similarity >= 0.75,
      similarity: Math.round(similarity * 100) / 100,
      extractedText: extracted,
    };
  } catch (err) {
    console.warn("[selfCheck] Error, skipping:", err);
    return { pass: true, similarity: -1 };
  }
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ══════ HELPERS ══════

/** Strip URLs, domains, and internal metadata from text before sending to AI */
function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    // Remove full URLs
    .replace(/https?:\/\/[^\s)]+/gi, "")
    // Remove www. domains
    .replace(/www\.[^\s)]+/gi, "")
    // Remove utm_ params remnants
    .replace(/utm_[a-z_]+=\S*/gi, "")
    // Remove bare domains (.com, .br, .org etc)
    .replace(/\b\S+\.(com|br|org|net|io|dev|app|biz|info)\b/gi, "")
    // Remove "Artigo fonte: ..." lines
    .replace(/Artigo\s+fonte:\s*[^\n]*/gi, "")
    // Remove "Fonte: ..." lines  
    .replace(/^Fonte:\s*[^\n]*/gim, "")
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
  language?: string,
): string {
  const headline = slide.headline || "";
  const body = slide.body || "";
  const bullets = slide.bullets || [];

  // Truncate for image space
  const MAX_BODY_CHARS = 180;
  const truncatedBody = body.length > MAX_BODY_CHARS
    ? body.substring(0, MAX_BODY_CHARS).replace(/\s+\S*$/, "…")
    : body;

  const MAX_HEADLINE_CHARS = 80;
  const truncatedHeadline = headline.length > MAX_HEADLINE_CHARS
    ? headline.substring(0, MAX_HEADLINE_CHARS).replace(/\s+\S*$/, "…")
    : headline;

  const textParts: string[] = [];
  if (truncatedHeadline) textParts.push(truncatedHeadline);
  if (truncatedBody) textParts.push(truncatedBody);
  if (bullets.length > 0) textParts.push(bullets.slice(0, 5).join("\n"));

  const slideText = textParts.join("\n\n");

  const articleSnippet = articleContent ? sanitizeText(articleContent.substring(0, 400)) : "";

  // Build style constraints
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
