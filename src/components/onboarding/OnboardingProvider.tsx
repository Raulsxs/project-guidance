import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  route?: string;
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
  // === BOAS-VINDAS ===
  {
    id: "welcome",
    title: "Bem-vindo ao TrendPulse! 🎉",
    description: "Vamos fazer um tour completo por todas as funcionalidades da plataforma. Você vai aprender a gerar conteúdos incríveis para redes sociais usando inteligência artificial!",
    position: "center",
    route: "/dashboard",
  },

  // === DASHBOARD ===
  {
    id: "sidebar",
    title: "📍 Menu de Navegação",
    description: "Este é o menu principal. Daqui você acessa todos os módulos: Dashboard, Studio IA, Calendário, Conteúdos, Brand Kit, Galeria de Estilos e seu Perfil. Cada módulo tem uma função específica no seu fluxo de criação.",
    target: "[data-onboarding='sidebar-nav']",
    position: "right",
    route: "/dashboard",
  },
  {
    id: "stats",
    title: "📊 Painel de Estatísticas",
    description: "Acompanhe em tempo real quantos conteúdos você criou, quantos foram aprovados e quantos estão agendados. Essas métricas ajudam a medir sua produtividade e planejar sua estratégia de conteúdo.",
    target: "[data-onboarding='stats-cards']",
    position: "bottom",
    route: "/dashboard",
  },
  {
    id: "scrape",
    title: "🔍 Buscar Tendências",
    description: "Clique aqui para buscar as últimas notícias e tendências do setor de saúde em fontes confiáveis. A IA faz o scraping automático e traz os temas mais relevantes para você criar conteúdo.",
    target: "[data-onboarding='scrape-button']",
    position: "bottom",
    route: "/dashboard",
  },
  {
    id: "trends",
    title: "📰 Grade de Tendências",
    description: "Aqui aparecem todas as tendências encontradas. Cada card mostra o título, resumo, fonte e relevância. Você pode filtrar por tema, fonte, data, salvar favoritos e gerar conteúdo diretamente a partir de qualquer tendência.",
    target: "[data-onboarding='trends-grid']",
    position: "top",
    route: "/dashboard",
  },
  {
    id: "generate",
    title: "⚡ Gerar Conteúdo com IA",
    description: "Ao clicar em 'Gerar' em uma tendência, você escolhe: formato (Post, Story ou Carrossel), estilo (Notícia, Dica, Frase Inspiradora...), marca, template visual e número de slides. A IA gera textos e imagens automaticamente!",
    target: "[data-onboarding='trend-card']",
    position: "right",
    route: "/dashboard",
  },

  // === STUDIO IA ===
  {
    id: "studio-intro",
    title: "🎨 Studio IA — Criador Manual",
    description: "O Studio IA é onde você monta conteúdos do zero, slide a slide, com controle total. Escolha a marca, template, formato, escreva os textos e gere imagens com IA. Perfeito para conteúdos personalizados que não partem de tendências.",
    position: "center",
    route: "/studio",
  },

  // === CALENDÁRIO ===
  {
    id: "calendar-intro",
    title: "📅 Calendário Editorial",
    description: "O Calendário mostra todos os seus conteúdos agendados em visão semanal ou mensal. Arraste conteúdos aprovados do backlog para agendar em dias e horários específicos. Ideal para planejar sua estratégia de publicação e manter consistência.",
    position: "center",
    route: "/calendar",
  },

  // === MEUS CONTEÚDOS ===
  {
    id: "contents-intro",
    title: "📄 Meus Conteúdos",
    description: "Aqui ficam todos os conteúdos que você gerou. Filtre por status (Rascunho, Aprovado, Agendado), busque por título e acesse cada conteúdo para editar textos, trocar imagens, aprovar, baixar como PNG/ZIP ou agendar a publicação.",
    position: "center",
    route: "/contents",
  },

  // === BRAND KIT ===
  {
    id: "brands-intro",
    title: "🎯 Brand Kit — Identidade Visual",
    description: "No Brand Kit, você cadastra suas marcas com logo, paleta de cores, fontes, regras do que fazer e não fazer. A IA analisa exemplos visuais que você sobe para aprender o estilo da marca e gerar conteúdos visualmente consistentes.",
    position: "center",
    route: "/brands",
  },

  // === GALERIA DE ESTILOS ===
  {
    id: "styles-intro",
    title: "✨ Galeria de Estilos",
    description: "A Galeria oferece templates visuais prontos criados pela plataforma. Você pode favoritar os que mais combinam com sua marca e usá-los como base na geração de conteúdos, garantindo variedade visual sem perder a identidade.",
    position: "center",
    route: "/styles",
  },

  // === PERFIL ===
  {
    id: "profile-intro",
    title: "👤 Meu Perfil",
    description: "Configure seu nome, empresa, idioma, tom de voz preferido e público-alvo. Essas preferências personalizam a geração de conteúdos pela IA, garantindo textos alinhados com seu posicionamento e audiência.",
    position: "center",
    route: "/profile",
  },

  // === FINALIZAÇÃO ===
  {
    id: "complete",
    title: "Tudo Pronto! 🚀",
    description: "Agora você conhece todas as funcionalidades do TrendPulse! Comece buscando tendências no Dashboard, gere conteúdos com IA, edite no Studio, organize no Calendário e baixe para publicar. Você pode refazer este tour a qualquer momento pelo menu lateral.",
    position: "center",
    route: "/dashboard",
  },
];

const STORAGE_KEY = "trendpulse_onboarding_completed";

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed && location.pathname === "/dashboard") {
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Navigate to the correct route when step changes
  useEffect(() => {
    if (!isActive) return;
    const step = ONBOARDING_STEPS[currentStep];
    if (step?.route && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [isActive, currentStep, navigate, location.pathname]);

  const startOnboarding = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    const firstRoute = ONBOARDING_STEPS[0].route;
    if (firstRoute && location.pathname !== firstRoute) {
      navigate(firstRoute);
    }
  }, [navigate, location.pathname]);

  const nextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsActive(false);
    setCurrentStep(0);
    navigate("/dashboard");
  }, [navigate]);

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
