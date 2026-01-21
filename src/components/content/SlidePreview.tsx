import { useState } from "react";
import { cn } from "@/lib/utils";
import { TemplateConfig, getTemplateForSlide } from "@/lib/templates";
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Slide {
  headline: string;
  body: string;
  imagePrompt: string;
  previewImage?: string;
}

interface SlidePreviewProps {
  slides: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  template: TemplateConfig;
  generatingImage?: boolean;
}

const SlidePreview = ({
  slides,
  currentSlide,
  setCurrentSlide,
  template,
  generatingImage,
}: SlidePreviewProps) => {
  const slideStyle = getTemplateForSlide(template, currentSlide, slides.length);
  const slide = slides[currentSlide];
  const hasImage = slide?.previewImage;

  return (
    <div className="flex justify-center">
      <div className="relative w-[320px]">
        {/* Phone Frame */}
        <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[2.5rem] p-2 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20" />
          
          <div className="bg-black rounded-[2rem] overflow-hidden aspect-[4/5] relative">
            {/* Background Image or Gradient */}
            {hasImage ? (
              <div className="absolute inset-0">
                <img 
                  src={slide.previewImage} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
                <div 
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
                  )}
                  style={{ opacity: slideStyle.overlay + 0.3 }}
                />
              </div>
            ) : (
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br",
                slideStyle.bg
              )}>
                {/* Pattern overlay for non-image slides */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div className="relative z-10 w-full h-full flex flex-col justify-end p-6 text-center">
              {/* Slide indicator */}
              <div className="absolute top-6 left-0 right-0 flex justify-center">
                <span className={cn(
                  "text-xs px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm",
                  hasImage ? "text-white" : slideStyle.text
                )}>
                  {currentSlide + 1} / {slides.length}
                </span>
              </div>

              {/* Loading indicator */}
              {generatingImage && currentSlide === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Gerando preview...</span>
                  </div>
                </div>
              )}

              {/* No image placeholder */}
              {!hasImage && !generatingImage && currentSlide !== slides.length - 1 && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 opacity-40">
                  <ImageIcon className={cn("w-12 h-12", slideStyle.text)} />
                  <span className={cn("text-xs", slideStyle.text)}>Preview com IA</span>
                </div>
              )}

              {/* Text content */}
              <div className="space-y-3 mb-2">
                <h3 className={cn(
                  "text-xl leading-tight",
                  template.fontStyle,
                  hasImage ? "text-white drop-shadow-lg" : slideStyle.text
                )}>
                  {slide?.headline}
                </h3>
                <p className={cn(
                  "text-sm leading-relaxed opacity-90",
                  hasImage ? "text-white/90 drop-shadow-md" : slideStyle.text === "text-foreground" ? "text-muted-foreground" : "text-white/80"
                )}>
                  {slide?.body}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  currentSlide === index
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2"
                )}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SlidePreview;
