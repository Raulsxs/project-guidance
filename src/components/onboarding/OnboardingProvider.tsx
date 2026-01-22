import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position: "top" | "bottom" | "left" | "right" | "center";
  route?: string; // Route where this step should show
}

interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao TrendPulse! 🎉",
    description: "Vamos fazer um tour rápido pelas principais funcionalidades da plataforma para você começar a gerar conteúdo incrível.",
    position: "center",
    route: "/dashboard",
  },
  {
    id: "trends",
    title: "Tendências em Tempo Real",
    description: "Aqui você encontra as principais notícias e tendências do setor de saúde, atualizadas automaticamente.",
    target: "[data-onboarding='trends-grid']",
    position: "top",
    route: "/dashboard",
  },
  {
    id: "search-trends",
    title: "Buscar Novas Tendências",
    description: "Clique aqui para buscar as últimas notícias de fontes confiáveis do setor de saúde.",
    target: "[data-onboarding='scrape-button']",
    position: "bottom",
    route: "/dashboard",
  },
  {
    id: "generate",
    title: "Gere Conteúdo com IA",
    description: "Selecione uma tendência e escolha o formato (Post, Story ou Carrossel) e estilo (Notícia, Frase, Dica...) do conteúdo.",
    target: "[data-onboarding='trend-card']",
    position: "right",
    route: "/dashboard",
  },
  {
    id: "stats",
    title: "Acompanhe suas Métricas",
    description: "Visualize quantos conteúdos você criou, aprovou e agendou no painel de estatísticas.",
    target: "[data-onboarding='stats-cards']",
    position: "bottom",
    route: "/dashboard",
  },
  {
    id: "sidebar",
    title: "Navegue pela Plataforma",
    description: "Use o menu lateral para acessar seus conteúdos, perfil e templates personalizados.",
    target: "[data-onboarding='sidebar-nav']",
    position: "right",
    route: "/dashboard",
  },
  {
    id: "complete",
    title: "Tudo Pronto! 🚀",
    description: "Agora é só escolher uma tendência e começar a criar. Boa sorte!",
    position: "center",
    route: "/dashboard",
  },
];

const STORAGE_KEY = "trendpulse_onboarding_completed";

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed && location.pathname === "/dashboard") {
      // Start onboarding after a small delay for new users
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
    setHasCheckedStorage(true);
  }, [location.pathname]);

  const startOnboarding = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsActive(false);
    setCurrentStep(0);
  };

  const completeOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsActive(false);
    setCurrentStep(0);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        steps: ONBOARDING_STEPS,
        startOnboarding,
        nextStep,
        prevStep,
        skipOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
