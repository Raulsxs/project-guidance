import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TrendingUp,
  LayoutDashboard,
  FileText,
  User,
  Palette,
  LogOut,
  Sparkles,
  Wand2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingTrigger from "@/components/onboarding/OnboardingTrigger";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Wand2, label: "Studio IA", href: "/studio" },
  { icon: CalendarDays, label: "Calendário", href: "/calendar" },
  { icon: FileText, label: "Meus Conteúdos", href: "/contents" },
  { icon: Palette, label: "Brand Kit", href: "/brands" },
  { icon: Sparkles, label: "Galeria de Estilos", href: "/styles" },
  { icon: User, label: "Meu Perfil", href: "/profile" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.success("Você saiu da conta");
      navigate("/auth");
    }
  };

  return (
    <aside className="w-64 min-h-screen sticky top-0 h-screen gradient-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-heading font-bold text-sidebar-foreground">
            TrendPulse
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" data-onboarding="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Pro Banner */}
      <div className="p-4">
        <div className="bg-sidebar-accent rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-sidebar-primary" />
            <span className="text-sm font-semibold text-sidebar-foreground">
              IA Disponível
            </span>
          </div>
          <p className="text-xs text-sidebar-foreground/60 mb-3">
            Gere conteúdos ilimitados com nossa IA avançada
          </p>
          <div className="h-2 bg-sidebar-border rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-sidebar-primary rounded-full" />
          </div>
          <p className="text-xs text-sidebar-foreground/50 mt-1">
            75/100 gerações usadas este mês
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <OnboardingTrigger />
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 px-4 py-3 h-auto text-sm text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
