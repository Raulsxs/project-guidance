import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TrendCard, { Trend } from "@/components/dashboard/TrendCard";
import TrendFilters, { FilterState } from "@/components/dashboard/TrendFilters";
import StatsCards from "@/components/dashboard/StatsCards";
import GenerateContentModal from "@/components/dashboard/GenerateContentModal";
import { mockTrends } from "@/data/mockTrends";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    sources: [],
    themes: [],
    dateRange: "all",
  });
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter trends based on search and filters
  const filteredTrends = mockTrends.filter((trend) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !trend.title.toLowerCase().includes(query) &&
        !trend.summary.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Source filter
    if (filters.sources.length > 0 && !filters.sources.includes(trend.source)) {
      return false;
    }

    // Theme filter
    if (filters.themes.length > 0 && !filters.themes.includes(trend.theme)) {
      return false;
    }

    // Date range filter
    if (filters.dateRange !== "all") {
      const trendDate = new Date(trend.publishedAt);
      const now = new Date();
      const diffHours = (now.getTime() - trendDate.getTime()) / (1000 * 60 * 60);

      switch (filters.dateRange) {
        case "24h":
          if (diffHours > 24) return false;
          break;
        case "7d":
          if (diffHours > 24 * 7) return false;
          break;
        case "30d":
          if (diffHours > 24 * 30) return false;
          break;
      }
    }

    return true;
  });

  const handleGenerateContent = (trend: Trend) => {
    setSelectedTrend(trend);
    setIsModalOpen(true);
  };

  const handleViewDetails = (trend: Trend) => {
    navigate(`/trend/${trend.id}`);
  };

  const handleGenerate = async (trendId: string, format: string) => {
    setIsGenerating(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setIsGenerating(false);
    setIsModalOpen(false);
    
    toast.success("Conteúdo gerado com sucesso!", {
      description: "Você será redirecionado para o preview.",
    });

    // Navigate to preview page
    navigate(`/preview/${trendId}?format=${format}`);
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
              Dashboard de Tendências
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitore as principais notícias e gere conteúdo para suas redes sociais
            </p>
          </div>
          <Button variant="outline" className="gap-2 w-fit">
            <RefreshCw className="w-4 h-4" />
            Atualizar Tendências
          </Button>
        </div>

        {/* Stats */}
        <StatsCards />

        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tendências..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <TrendFilters filters={filters} onFilterChange={setFilters} />
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{filteredTrends.length}</span> tendências
          </p>
        </div>

        {/* Trends Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTrends.map((trend) => (
            <TrendCard
              key={trend.id}
              trend={trend}
              onGenerateContent={handleGenerateContent}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredTrends.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhuma tendência encontrada com os filtros aplicados.
            </p>
          </div>
        )}

        {/* Generate Content Modal */}
        <GenerateContentModal
          trend={selectedTrend}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
