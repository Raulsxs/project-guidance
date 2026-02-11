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
    fullContent?: string;
  };
  contentType: "post" | "story" | "carousel";
  contentStyle?: "news" | "quote" | "tip" | "educational" | "curiosity";
  brandId?: string | null;
  visualMode?: "brand_strict" | "brand_guided" | "free";
  templateSetId?: string | null;
  slideCount?: number | null; // null = auto
  includeCta?: boolean; // default true
  tone?: string;
  targetAudience?: string;
  manualBriefing?: {
    headline?: string;
    body?: string;
    bullets?: string[];
    notes?: string;
  } | null;
}

interface StyleGuide {
  style_preset?: string;
  brand_tokens?: {
    palette_roles?: Record<string, string>;
    typography?: Record<string, unknown>;
    logo?: { preferred_position?: string; watermark_opacity?: number };
  };
  formats?: Record<string, {
    recommended_templates?: string[];
    layout_rules?: Record<string, unknown>;
    text_limits?: { headline_chars?: number[]; body_chars?: number[]; bullets_max?: number };
    slide_roles?: string[];
    role_to_template?: Record<string, string>;
    cta_policy?: "never" | "optional" | "always";
    cta_templates?: string[];
    slide_count_range?: [number, number];
  }>;
  visual_patterns?: string[];
  confidence?: string;
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
  style_guide: StyleGuide | null;
  style_guide_version: number;
}

// ══════ DEFAULT STYLE GUIDE (for free mode) ══════

const DEFAULT_STYLE_GUIDE: StyleGuide = {
  style_preset: "clean_minimal",
  brand_tokens: {
    palette_roles: { primary: "#667eea", secondary: "#764ba2", accent: "#f093fb" },
    typography: { headline_weight: 800, body_weight: 400 },
    logo: { preferred_position: "none", watermark_opacity: 0 },
  },
  formats: {
    post: {
      recommended_templates: ["generic_free"],
      text_limits: { headline_chars: [35, 60], body_chars: [140, 260] },
    },
    story: {
      recommended_templates: ["generic_free"],
      text_limits: { headline_chars: [25, 45], body_chars: [90, 160] },
    },
    carousel: {
      recommended_templates: ["generic_free"],
      slide_roles: ["cover", "context", "insight", "insight", "closing"],
      text_limits: { headline_chars: [35, 60], body_chars: [160, 260], bullets_max: 5 },
      cta_policy: "optional",
      slide_count_range: [3, 10],
    },
  },
  confidence: "high",
};

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
    style_guide_version: brand.style_guide_version || 0,
  };
}

// ══════ PROMPT BUILDING ══════

const stylePrompts: Record<string, { systemAddition: string; captionGuide: string; structure: string }> = {
  news: {
    systemAddition: "Crie conteúdo informativo e profissional sobre a notícia/tendência. Aborde o assunto com autoridade e dados concretos extraídos da fonte original.",
    captionGuide: "Legenda informativa com: gancho (pergunta/dado impactante), contexto do setor, 3 aprendizados práticos, 1 recomendação acionável e CTA leve. 900–1600 caracteres. Emojis com moderação.",
    structure: "cover(gancho provocativo) → context(por que importa + dados) → insight1(passo prático/bullets) → insight2(armadilha ou mito vs verdade) → closing(takeaway + CTA leve)",
  },
  quote: {
    systemAddition: "Crie uma frase inspiracional ou reflexiva conectada ao tema. NÃO inclua CTAs. O conteúdo deve ser autossuficiente, profundo e memorável.",
    captionGuide: "Legenda reflexiva e curta. 250–500 caracteres. SEM CTA, SEM 'saiba mais'. Apenas reflexão profunda conectada ao tema.",
    structure: "cover(frase principal impactante) → context(complemento reflexivo) → insight1(perspectiva diferente) → insight2(aplicação pessoal) → closing(assinatura/marca, SEM CTA)",
  },
  tip: {
    systemAddition: "Crie dicas práticas, acionáveis e diretas baseadas no conteúdo da fonte. Seja útil e concreto.",
    captionGuide: "Legenda com tom prático e direto. 900–1600 caracteres. Inclua mini-resumo das dicas + exemplo real de aplicação.",
    structure: "cover(problema/pergunta provocativa) → context(por que essa dica importa + contexto do artigo) → insight1(dica 1 com bullets detalhados) → insight2(dica 2 ou checklist com exemplos) → closing(resumo + CTA leve)",
  },
  educational: {
    systemAddition: "Explique conceitos de forma didática, acessível e com analogias simples. Use os dados da fonte para embasar.",
    captionGuide: "Legenda didática e acessível. 900–1600 caracteres. Use analogias simples, exemplos concretos e linguagem clara.",
    structure: "cover(pergunta 'O que é X?') → context(por que todo gestor precisa saber + dados da fonte) → insight1(como funciona na prática com exemplo) → insight2(comparação ou caso real) → closing(resumo + CTA educativo)",
  },
  curiosity: {
    systemAddition: "Crie conteúdo que desperte curiosidade com dados surpreendentes e fatos pouco conhecidos extraídos da fonte.",
    captionGuide: "Legenda que surpreende. 900–1600 caracteres. Comece com dado impactante da fonte, depois contextualize.",
    structure: "cover('Você sabia?' + dado surpreendente da fonte) → context(contexto do dado + origem) → insight1(implicação prática + o que muda) → insight2(o que poucos sabem + exemplo) → closing(reflexão + CTA)",
  },
};

function buildBrandContextBlock(tokens: BrandTokens, styleGuide: StyleGuide | null): string {
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
  if (styleGuide?.visual_patterns && styleGuide.visual_patterns.length > 0) {
    parts.push(`Padrões visuais detectados:\n${styleGuide.visual_patterns.map((p) => `  • ${p}`).join("\n")}`);
  }
  parts.push(`══════ FIM ══════`);
  return parts.join("\n");
}

function resolveSlideCount(
  contentType: string,
  requestedCount: number | null | undefined,
  formatConfig: StyleGuide["formats"] extends Record<string, infer V> ? V : never,
): number {
  if (contentType !== "carousel") return 1;
  // User specified a fixed number
  if (requestedCount && requestedCount >= 3 && requestedCount <= 10) return requestedCount;
  // Template set defines a range - use midpoint
  const range = (formatConfig as any)?.slide_count_range as [number, number] | undefined;
  if (range && range.length === 2) {
    return Math.round((range[0] + range[1]) / 2);
  }
  // Default
  return 5;
}

function getTextLimits(styleGuide: StyleGuide | null, contentType: string): { headline: number[]; body: number[]; bulletsMax: number } {
  const formatGuide = styleGuide?.formats?.[contentType];
  return {
    headline: formatGuide?.text_limits?.headline_chars || [35, 60],
    body: formatGuide?.text_limits?.body_chars || (contentType === "story" ? [90, 160] : [160, 260]),
    bulletsMax: formatGuide?.text_limits?.bullets_max || 5,
  };
}

function getTemplatesForFormat(styleGuide: StyleGuide | null, contentType: string, visualMode: string): string[] {
  if (visualMode === "free") return ["generic_free"];
  const formatGuide = styleGuide?.formats?.[contentType];
  const recommended = formatGuide?.recommended_templates;
  if (recommended && recommended.length > 0) return recommended;
  if (contentType === "story") return ["story_cover", "story_tip"];
  return ["wave_cover", "wave_text_card", "wave_bullets", "wave_text_card", "wave_closing"];
}

function buildSlideRoles(
  contentType: string,
  slideCount: number,
  formatConfig: any,
  includeCta: boolean,
): string[] {
  if (contentType !== "carousel") return ["cover"];
  
  // Use template set roles if they match the count exactly
  if (formatConfig?.slide_roles && formatConfig.slide_roles.length === slideCount) {
    const roles = [...formatConfig.slide_roles];
    // Strip closing/cta role if CTA is disabled
    if (!includeCta && roles.length > 0 && roles[roles.length - 1] === "closing") {
      roles[roles.length - 1] = "insight";
    }
    return roles;
  }
  
  // Build roles dynamically
  const roles: string[] = ["cover"];
  const contentSlots = includeCta ? slideCount - 2 : slideCount - 1;
  
  if (contentSlots > 0) {
    roles.push("context");
    for (let i = 1; i < contentSlots; i++) {
      roles.push("insight");
    }
  }
  
  if (includeCta) {
    roles.push("closing");
  }
  
  return roles;
}

function getBackgroundStyle(styleGuide: StyleGuide | null, contentType: string): string {
  const rules = styleGuide?.formats?.[contentType]?.layout_rules as Record<string, unknown> | undefined;
  return (rules?.background_style as string) || "gradient";
}

function buildImagePromptForSlide(basePrompt: string, tokens: BrandTokens | null, visualMode: string): string {
  if (visualMode === "brand_strict") return "";
  if (visualMode === "free" || !tokens) {
    return `${basePrompt}. Professional healthcare image. No text. Ultra high resolution.`;
  }
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
      templateSetId = null,
      slideCount: requestedSlideCount = null,
      includeCta = true,
      tone = "profissional e engajador",
      targetAudience = "gestores de saúde",
      manualBriefing = null,
    } = await req.json() as GenerateContentRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ══════ BRAND LOADING ══════
    let brandTokens: BrandTokens | null = null;
    let brandContext = "";
    const effectiveMode = brandId ? visualMode : "free";
    let activeStyleGuide: StyleGuide = DEFAULT_STYLE_GUIDE;
    let resolvedTemplateSetId: string | null = null;
    let templateSetName: string | null = null;

    if (brandId && effectiveMode !== "free") {
      console.log(`[generate-content] Loading brand: ${brandId}, mode: ${effectiveMode}`);
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("name, palette, visual_tone, do_rules, dont_rules, fonts, logo_url, style_guide, style_guide_version, default_template_set_id")
        .eq("id", brandId)
        .single();

      if (brandError) {
        console.error("[generate-content] Brand error:", brandError);
      } else if (brand) {
        const { data: examples } = await supabase
          .from("brand_examples")
          .select("image_url, description, content_type, type, subtype")
          .eq("brand_id", brandId)
          .limit(8);
        brandTokens = buildBrandTokens(brand, examples || []);

        // ══════ HARD LOCK: Use ONLY the selected template set ══════
        const tsId = templateSetId || (brand as any).default_template_set_id;
        if (tsId) {
          const { data: tsData } = await supabase
            .from("brand_template_sets")
            .select("template_set, name")
            .eq("id", tsId)
            .single();

          if (tsData?.template_set) {
            const ts = tsData.template_set as any;
            resolvedTemplateSetId = tsId;
            templateSetName = tsData.name;
            
            // HARD LOCK: Build style guide EXCLUSIVELY from the template set
            // Do NOT merge with brand base style guide - use template set as the sole source
            activeStyleGuide = {
              style_preset: ts.style_preset || brand.style_guide?.style_preset || "clean_minimal",
              brand_tokens: {
                ...(brand.style_guide?.brand_tokens || {}),
                // Override with template set typography/logo if present
                ...(ts.formats?.[contentType]?.typography ? { typography: ts.formats[contentType].typography } : {}),
                ...(ts.formats?.[contentType]?.logo ? { logo: ts.formats[contentType].logo } : {}),
              },
              // Use ONLY the template set formats - no fallback to brand base
              formats: ts.formats || {},
              visual_patterns: ts.visual_patterns || brand.style_guide?.visual_patterns || [],
              confidence: ts.confidence || "high",
            };

            console.log(`[generate-content] HARD-LOCK template set: "${tsData.name}" (${tsId}). Using ONLY this set's rules.`);
          }
        } else if (brand.style_guide) {
          // No template set selected - use brand base style guide
          activeStyleGuide = brand.style_guide as StyleGuide;
        }

        brandContext = buildBrandContextBlock(brandTokens, activeStyleGuide);
        console.log(`[generate-content] Brand loaded: ${brandTokens.name}, ${brandTokens.palette.length} colors, mode=${effectiveMode}, style_guide_v${brand.style_guide_version || 0}`);
      }
    }

    const styleConfig = stylePrompts[contentStyle] || stylePrompts.news;
    
    // ══════ RESOLVE SLIDE COUNT & CTA ══════
    const formatConfig = activeStyleGuide?.formats?.[contentType];
    const ctaPolicy = (formatConfig as any)?.cta_policy as string | undefined;
    
    // Resolve CTA: honor the user toggle, but override if template set policy says "never"
    const effectiveIncludeCta = ctaPolicy === "never" ? false : (ctaPolicy === "always" ? true : includeCta);
    
    const slideCount = resolveSlideCount(contentType, requestedSlideCount, formatConfig);
    const textLimits = getTextLimits(activeStyleGuide, contentType);
    const templatePool = getTemplatesForFormat(activeStyleGuide, contentType, effectiveMode);
    const slideRoles = buildSlideRoles(contentType, slideCount, formatConfig, effectiveIncludeCta);

    // ══════ SOURCE CONTEXT ══════
    const fullContent = trend.fullContent || "";
    let sourceBlock: string;
    if (fullContent) {
      sourceBlock = `══════ CONTEÚDO COMPLETO DA FONTE (use como base principal) ══════\n${fullContent.substring(0, 12000)}\n══════ FIM DO CONTEÚDO COMPLETO ══════`;
    } else if (manualBriefing && (manualBriefing.headline || manualBriefing.body || manualBriefing.notes)) {
      const parts: string[] = ["══════ BRIEFING MANUAL (use como base principal) ══════"];
      if (manualBriefing.headline) parts.push(`Headline sugerida: ${manualBriefing.headline}`);
      if (manualBriefing.body) parts.push(`Corpo/contexto: ${manualBriefing.body}`);
      if (manualBriefing.bullets && manualBriefing.bullets.length > 0) parts.push(`Pontos-chave:\n${manualBriefing.bullets.filter(Boolean).map(b => `  • ${b}`).join("\n")}`);
      if (manualBriefing.notes) parts.push(`Notas adicionais: ${manualBriefing.notes}`);
      parts.push("══════ FIM DO BRIEFING ══════");
      sourceBlock = parts.join("\n");
    } else {
      sourceBlock = `══════ FONTE ORIGINAL ══════\nTítulo: ${trend.title}\nDescrição: ${trend.description || "Sem descrição detalhada disponível."}\n══════ FIM DA FONTE ══════`;
    }

    // ══════ TEMPLATE SET ENFORCEMENT BLOCK ══════
    let templateSetEnforcementBlock = "";
    if (templateSetName && resolvedTemplateSetId) {
      templateSetEnforcementBlock = `
══════ ESTILO SELECIONADO: "${templateSetName}" ══════
REGRAS OBRIGATÓRIAS: Use APENAS as regras deste estilo.
${formatConfig ? `CONFIGURAÇÃO DO FORMATO: ${JSON.stringify(formatConfig)}` : ""}
PROIBIDO: Usar elementos visuais, tom ou estrutura típicos de OUTROS estilos da marca.
Cada slide DEVE usar os templates definidos por este estilo. NÃO misture templates de estilos diferentes.
══════ FIM DO ESTILO ══════`;
    }

    // ══════ CTA INSTRUCTION ══════
    const ctaInstruction = effectiveIncludeCta
      ? "O último slide (closing) deve ter um CTA natural e contextual, NÃO genérico como 'curta comente compartilhe'. Use algo específico ao tema."
      : "NÃO inclua CTA final. O último slide deve ser um insight ou conclusão, NÃO um 'curta comente compartilhe'.";

    // ══════ SYSTEM PROMPT ══════
    const systemPrompt = `Você é um especialista sênior em marketing digital para o setor de saúde. Você cria conteúdos para Instagram que são criativos, informativos e PROFUNDAMENTE conectados com a fonte original.

${styleConfig.systemAddition}

REGRAS ABSOLUTAS:
- Linguagem: ${tone}. Público: ${targetAudience}.
- NUNCA invente dados, estatísticas ou números que não estejam na fonte. Se não houver dados numéricos, use linguagem qualitativa.
- Use ganchos criativos: pergunta provocativa, contraste, mini-história, analogia, mito vs verdade, checklist.
- Emojis com moderação (máx 3 por slide).
- ${ctaInstruction}
- illustrationPrompt deve descrever APENAS backgrounds/ilustrações abstratas, NUNCA texto renderizado.
- NUNCA invente dados médicos específicos, nomes de medicamentos ou procedimentos que não estejam na fonte.
- O conteúdo deve demonstrar que você LEVE o artigo inteiro e extraiu os pontos mais relevantes.
${templateSetEnforcementBlock}
${brandContext}`;

    // ══════ USER PROMPT ══════
    const formatLabel = contentType === "post" ? "post para feed (1 slide, 1080x1350)" : contentType === "story" ? "story (1 slide, 1080x1920)" : `carrossel com EXATAMENTE ${slideCount} slides (1080x1350 cada)`;

    const slideRolesStr = contentType === "carousel"
      ? `Cada slide TEM um papel (role): ${slideRoles.join(", ")}.\nEstrutura: ${styleConfig.structure}`
      : `1 slide com role "cover".`;

    // Build template assignments using role_to_template from the template set if available
    const roleToTemplate = (formatConfig as any)?.role_to_template as Record<string, string> | undefined;
    const templateAssignments = contentType === "carousel"
      ? slideRoles.map((role, i) => {
          if (roleToTemplate && roleToTemplate[role]) {
            return `Slide ${i + 1} (${role}): ${roleToTemplate[role]}`;
          }
          const tpl = i === 0 ? templatePool[0] : i === slideCount - 1 ? (templatePool[templatePool.length - 1] || templatePool[0]) : (templatePool[Math.min(i, templatePool.length - 1)] || templatePool[1] || templatePool[0]);
          return `Slide ${i + 1} (${role}): ${tpl}`;
        }).join("\n")
      : `Template: ${templatePool[0]}.`;

    const userPrompt = `Crie um ${formatLabel} do Instagram.
ESTILO: ${contentStyle.toUpperCase()}

${sourceBlock}

Tema: ${trend.theme}
Palavras-chave: ${trend.keywords?.join(", ") || "não especificadas"}

${slideRolesStr}
${templateAssignments}

COMPRIMENTOS OBRIGATÓRIOS (respeite rigorosamente):
- caption: ${contentStyle === "quote" ? "250–500" : "900–1600"} caracteres
  ${contentStyle !== "quote" ? "Estrutura da caption: gancho provocativo → contexto do artigo → 3 aprendizados práticos → 1 recomendação acionável → CTA leve" : ""}
- headline: ${textLimits.headline[0]}–${textLimits.headline[1]} caracteres (impactante, criativo)
- body: ${textLimits.body[0]}–${textLimits.body[1]} caracteres (denso e informativo, NÃO genérico)
- speakerNotes: 2–3 frases (insight extra criativo, NÃO vai para arte)
- sourceSummary: 4–6 linhas resumindo a fonte original com os pontos-chave
- keyInsights: 3–5 insights PRÁTICOS extraídos da fonte (não genéricos)

QUALIDADE DO TEXTO:
- Headlines devem ser ganchos criativos (pergunta, contraste, dado surpreendente)
- Body deve conter informação DENSA extraída da fonte, não frases genéricas
- Bullets devem ser acionáveis e específicos
- sourceSummary deve demonstrar leitura profunda do artigo
- keyInsights devem ser conclusões práticas, não obviedades

Retorne EXATAMENTE este JSON (sem markdown, sem backticks):
{
  "title": "título curto e chamativo (máx 60 chars)",
  "caption": "legenda completa. ${styleConfig.captionGuide}",
  "hashtags": ["8–15 hashtags relevantes e específicas do nicho"],
  "sourceSummary": "resumo de 4-6 linhas da fonte original com pontos-chave específicos",
  "keyInsights": ["insight prático 1", "insight prático 2", "insight prático 3"],
  "angle": "ângulo editorial escolhido",
  "audienceTakeaway": "valor concreto que o público leva",
  "slides": [
    {
      "role": "${slideRoles[0]}",
      "template": "${templatePool[0]}",
      "headline": "${textLimits.headline[0]}-${textLimits.headline[1]} chars, gancho criativo",
      "body": "${textLimits.body[0]}-${textLimits.body[1]} chars, texto denso com informação real da fonte",
      "bullets": ["opcional: items acionáveis para slides insight/context"],
      "speakerNotes": "2-3 frases com insight extra criativo",
      "illustrationPrompt": "descrição em inglês de background abstrato SEM TEXTO. Ex: 'Abstract soft blue gradient with subtle medical cross pattern, clean minimalist healthcare aesthetic'"
    }
  ]
}

${contentType === "carousel" ? `Crie EXATAMENTE ${slideCount} slides com roles: ${slideRoles.join(", ")}.` : "Crie exatamente 1 slide."}`;

    console.log(`[generate-content] Generating ${contentStyle} ${contentType}, mode=${effectiveMode}${brandTokens ? `, brand=${brandTokens.name}` : ""}, slideCount=${slideCount}, includeCta=${effectiveIncludeCta}, templateSet=${templateSetName || 'none'}, fullContent=${fullContent.length}chars...`);

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
      const role = slide.role || slideRoles[i] || (i === 0 ? "cover" : i === (generated.slides.length - 1) ? "closing" : "insight");
      
      // HARD LOCK: determine template from the SELECTED template set only
      let template: string;
      if (effectiveMode === "free") {
        template = "generic_free";
      } else if (roleToTemplate && roleToTemplate[role]) {
        template = roleToTemplate[role];
      } else {
        template = slide.template || templatePool[Math.min(i, templatePool.length - 1)];
      }

      return {
        role,
        template,
        headline: slide.headline || "",
        body: slide.body || "",
        bullets: slide.bullets || [],
        speakerNotes: slide.speakerNotes || "",
        illustrationPrompt: slide.illustrationPrompt || slide.imagePrompt || "",
        imagePrompt: slide.illustrationPrompt || slide.imagePrompt || "",
        templateHint: template,
      };
    });

    // ══════ IMAGE GENERATION (conditional on background_style) ══════
    const bgStyle = getBackgroundStyle(activeStyleGuide, contentType);
    const shouldGenerateImages = effectiveMode !== "brand_strict" && bgStyle === "image";

    if (shouldGenerateImages) {
      console.log(`[generate-content] Generating background images for ${processedSlides.length} slides (mode=${effectiveMode}, bgStyle=${bgStyle})...`);
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
      console.log(`[generate-content] Skipping AI image generation: mode=${effectiveMode}, bgStyle=${bgStyle}. Templates handle layout.`);
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
      templateSetId: resolvedTemplateSetId,
      slideCount,
      includeCta: effectiveIncludeCta,
      brandSnapshot: brandTokens ? {
        name: brandTokens.name,
        palette: brandTokens.palette,
        fonts: brandTokens.fonts,
        visual_tone: brandTokens.visual_tone,
        logo_url: brandTokens.logo_url,
        style_guide: activeStyleGuide,
        style_guide_version: brandTokens.style_guide_version,
      } : null,
    };

    console.log(`[generate-content] SUCCESS: brandId=${brandId || 'null'}, templateSet=${templateSetName || 'none'}, palette=${brandTokens?.palette?.length ?? 0}, mode=${effectiveMode}, slides=${processedSlides.length}, includeCta=${effectiveIncludeCta}`);

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
