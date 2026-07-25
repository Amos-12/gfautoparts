import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
import { ThemeAwareStatusBar } from "@/components/Layout/ThemeAwareStatusBar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import InventoryPage from "./pages/InventoryPage";
import HelpPage from "./pages/HelpPage";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Configure safe area CSS variables for native platforms
const configureSafeAreas = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Disable overlay so content doesn't go behind status bar
      await StatusBar.setOverlaysWebView({ overlay: false });
      
      // Get status bar info and set CSS variable for safe area
      const info = await StatusBar.getInfo();
      if (info && typeof (info as any).height === 'number') {
        document.documentElement.style.setProperty('--safe-area-top', `${(info as any).height}px`);
      } else {
        // Fallback for Android - typical status bar height is 24-32dp
        document.documentElement.style.setProperty('--safe-area-top', '28px');
      }
      
      // Set bottom safe area for navigation bar (estimated)
      document.documentElement.style.setProperty('--safe-area-bottom', '24px');
    } catch (error) {
      console.error('Error configuring safe areas:', error);
      // Fallback values for safe areas
      document.documentElement.style.setProperty('--safe-area-top', '28px');
      document.documentElement.style.setProperty('--safe-area-bottom', '24px');
    }
  }
};

configureSafeAreas();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Theme-aware status bar for Android */}
        <ThemeAwareStatusBar />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/seller" element={<SellerDashboard />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
