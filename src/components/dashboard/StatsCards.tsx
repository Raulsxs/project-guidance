import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, FileText, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

interface StatsCardsProps {
  trendsCount?: number;
}

const StatsCards = ({ trendsCount = 0 }: StatsCardsProps) => {
  const stats: Stat[] = [
    {
      label: "Tendências Ativas",
      value: trendsCount,
      change: "Atualizadas hoje",
      changeType: "positive",
      icon: TrendingUp,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      label: "Conteúdos Gerados",
      value: 0,
      change: "Esta semana",
      changeType: "neutral",
      icon: FileText,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      label: "Prontos para Publicar",
      value: 0,
      change: "Aguardando revisão",
      changeType: "positive",
      icon: CheckCircle,
      iconColor: "text-success",
      iconBg: "bg-success/10",
    },
    {
      label: "Rascunhos",
      value: 0,
      change: "Continuar editando",
      changeType: "neutral",
      icon: Clock,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="shadow-card border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-heading font-bold text-foreground mt-1">
                  {stat.value}
                </p>
                {stat.change && (
                  <p
                    className={cn(
                      "text-xs mt-1",
                      stat.changeType === "positive" && "text-success",
                      stat.changeType === "negative" && "text-destructive",
                      stat.changeType === "neutral" && "text-muted-foreground"
                    )}
                  >
                    {stat.change}
                  </p>
                )}
              </div>
              <div className={cn("p-3 rounded-xl", stat.iconBg)}>
                <stat.icon className={cn("w-6 h-6", stat.iconColor)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
