import { cn } from "@/lib/utils";
import { templates, TemplateStyle } from "@/lib/templates";
import { Check, Palette } from "lucide-react";

interface TemplateSelectorProps {
  selectedTemplate: TemplateStyle;
  onSelectTemplate: (template: TemplateStyle) => void;
}

const TemplateSelector = ({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Palette className="w-4 h-4 text-primary" />
        Escolha um Template
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(templates).map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template.id)}
            className={cn(
              "relative p-3 rounded-lg border-2 transition-all text-left group",
              selectedTemplate === template.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            {/* Preview mini */}
            <div className="flex gap-1 mb-2">
              <div className={cn("w-4 h-6 rounded-sm bg-gradient-to-b", template.coverBg)} />
              <div className={cn("w-4 h-6 rounded-sm bg-gradient-to-b", template.contentBg)} />
              <div className={cn("w-4 h-6 rounded-sm bg-gradient-to-b", template.ctaBg)} />
            </div>
            
            <p className="text-xs font-medium text-foreground">{template.name}</p>
            <p className="text-xs text-muted-foreground">{template.description}</p>
            
            {selectedTemplate === template.id && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;
