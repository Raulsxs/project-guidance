import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Health sector news sources to scrape
const HEALTH_SOURCES = [
  {
    name: "Saúde Business",
    url: "https://saudebusiness.com/",
    searchQuery: "tendências saúde hospitalar 2025",
  },
  {
    name: "Portal Hospitais Brasil",
    url: "https://portalhospitaisbrasil.com.br/",
    searchQuery: "inovação hospitalar tecnologia saúde",
  },
  {
    name: "Medicina S/A",
    url: "https://medicinasa.com.br/",
    searchQuery: "gestão hospitalar tendências",
  },
];

interface TrendData {
  title: string;
  description: string;
  source: string;
  source_url: string;
  theme: string;
  keywords: string[];
  relevance_score: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Database not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const allTrends: TrendData[] = [];

    console.log("Starting trend scraping from health sources...");

    // Search for health trends using Firecrawl
    for (const source of HEALTH_SOURCES) {
      try {
        console.log(`Searching: ${source.searchQuery}`);
        
        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: source.searchQuery,
            limit: 5,
            lang: "pt",
            country: "BR",
            tbs: "qdr:w", // Last week
            scrapeOptions: {
              formats: ["markdown"],
            },
          }),
        });

        if (!searchResponse.ok) {
          console.error(`Search failed for ${source.name}:`, await searchResponse.text());
          continue;
        }

        const searchData = await searchResponse.json();
        console.log(`Found ${searchData.data?.length || 0} results for ${source.name}`);

        if (searchData.data && Array.isArray(searchData.data)) {
          for (const result of searchData.data) {
            if (result.title && result.url) {
              allTrends.push({
                title: result.title,
                description: result.description || result.markdown?.substring(0, 300) || "",
                source: source.name,
                source_url: result.url,
                theme: detectTheme(result.title + " " + (result.description || "")),
                keywords: extractKeywords(result.title + " " + (result.description || "")),
                relevance_score: Math.floor(Math.random() * 30) + 70, // 70-99
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error scraping ${source.name}:`, error);
      }
    }

    console.log(`Total trends found: ${allTrends.length}`);

    // Use AI to enrich and validate trends
    if (allTrends.length > 0 && LOVABLE_API_KEY) {
      try {
        console.log("Enriching trends with AI...");
        
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em tendências do setor de saúde brasileiro. 
                Analise as tendências fornecidas e retorne um JSON válido com as seguintes melhorias:
                - Ajuste o theme para uma das categorias: "Tecnologia", "Gestão", "Inovação", "Sustentabilidade", "RH", "Finanças", "Qualidade"
                - Melhore a description para ser mais informativa (máx 200 caracteres)
                - Adicione keywords relevantes (3-5 palavras)
                - Ajuste relevance_score (70-99) baseado na atualidade e impacto
                
                Retorne APENAS o JSON válido, sem markdown ou explicações.`
              },
              {
                role: "user",
                content: JSON.stringify(allTrends.slice(0, 10)) // Process max 10 at a time
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const enrichedContent = aiData.choices?.[0]?.message?.content;
          
          if (enrichedContent) {
            try {
              const enrichedTrends = JSON.parse(enrichedContent.replace(/```json\n?|\n?```/g, ""));
              if (Array.isArray(enrichedTrends)) {
                allTrends.splice(0, enrichedTrends.length, ...enrichedTrends);
                console.log("Trends enriched successfully");
              }
            } catch (parseError) {
              console.error("Failed to parse AI response:", parseError);
            }
          }
        }
      } catch (aiError) {
        console.error("AI enrichment failed:", aiError);
      }
    }

    // Insert new trends into database
    let insertedCount = 0;
    for (const trend of allTrends) {
      // Check if trend already exists (by source_url)
      const { data: existing } = await supabase
        .from("trends")
        .select("id")
        .eq("source_url", trend.source_url)
        .single();

      if (!existing) {
        const { error: insertError } = await supabase.from("trends").insert({
          title: trend.title.substring(0, 255),
          description: trend.description.substring(0, 500),
          source: trend.source,
          source_url: trend.source_url,
          theme: trend.theme,
          keywords: trend.keywords,
          relevance_score: trend.relevance_score,
          is_active: true,
          scraped_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          insertedCount++;
        }
      }
    }

    console.log(`Inserted ${insertedCount} new trends`);

    return new Response(
      JSON.stringify({
        success: true,
        found: allTrends.length,
        inserted: insertedCount,
        message: `Scraped ${allTrends.length} trends, inserted ${insertedCount} new`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scraping error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Scraping failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function detectTheme(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("telemedicina") || lowerText.includes("ia") || lowerText.includes("inteligência artificial") || lowerText.includes("digital")) {
    return "Tecnologia";
  }
  if (lowerText.includes("sustentab") || lowerText.includes("esg") || lowerText.includes("ambiental")) {
    return "Sustentabilidade";
  }
  if (lowerText.includes("gestão") || lowerText.includes("administra") || lowerText.includes("eficiência")) {
    return "Gestão";
  }
  if (lowerText.includes("inovaç") || lowerText.includes("startup") || lowerText.includes("disrupt")) {
    return "Inovação";
  }
  if (lowerText.includes("burnout") || lowerText.includes("colaborador") || lowerText.includes("rh") || lowerText.includes("recursos humanos")) {
    return "RH";
  }
  if (lowerText.includes("custo") || lowerText.includes("financ") || lowerText.includes("investimento")) {
    return "Finanças";
  }
  if (lowerText.includes("qualidade") || lowerText.includes("acreditação") || lowerText.includes("segurança do paciente")) {
    return "Qualidade";
  }
  
  return "Gestão"; // Default
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  const relevantTerms = [
    "telemedicina", "ia", "inteligência artificial", "esg", "sustentabilidade",
    "burnout", "saúde mental", "gestão hospitalar", "inovação", "transformação digital",
    "experiência do paciente", "eficiência operacional", "tecnologia", "startup",
    "acreditação", "qualidade", "segurança", "custos", "investimento"
  ];
  
  for (const term of relevantTerms) {
    if (lowerText.includes(term) && keywords.length < 5) {
      keywords.push(term);
    }
  }
  
  return keywords.length > 0 ? keywords : ["saúde", "hospitalar"];
}
