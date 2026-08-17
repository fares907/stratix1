import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Regular site visitors never need the dashboard's Table/Select/Card UI code
// (Recharts, etc.) — splitting it into its own chunk keeps the public
// homepage's bundle smaller without touching build.rollupOptions manually.
const Admin = lazy(() => import("@/pages/Admin"));
// Only visitors who are settling an invoice load this, so it stays out of the
// homepage bundle like the dashboard does.
const Pay = lazy(() => import("@/pages/Pay"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin">
        <Suspense fallback={null}>
          <Admin />
        </Suspense>
      </Route>
      <Route path="/pay">
        <Suspense fallback={null}>
          <Pay />
        </Suspense>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
