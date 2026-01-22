import { useOnboarding } from "./OnboardingProvider";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const OnboardingTrigger = () => {
  const { startOnboarding, isActive } = useOnboarding();

  if (isActive) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={startOnboarding}
        >
          <HelpCircle className="w-5 h-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Ver tour da plataforma</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default OnboardingTrigger;
