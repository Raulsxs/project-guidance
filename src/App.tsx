import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ContentPreview from "./pages/ContentPreview";
import DownloadPage from "./pages/Download";
import Contents from "./pages/Contents";
import Profile from "./pages/Profile";
import CustomTemplates from "./pages/CustomTemplates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OnboardingProvider>
          <OnboardingOverlay />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/content/:id" element={<ContentPreview />} />
            <Route path="/download/:id" element={<DownloadPage />} />
            <Route path="/contents" element={<Contents />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/templates" element={<CustomTemplates />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </OnboardingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
