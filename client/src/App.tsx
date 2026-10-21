import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";
import { LazyMotion } from "motion/react";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Visitors never need the dashboard or the payment page up front, so each is its
// own chunk fetched only when its route is opened.
const Admin = lazy(() => import("@/pages/Admin"));
const Pay = lazy(() => import("@/pages/Pay"));

// The animation engine arrives after first paint; `strict` makes any stray
// full-size `motion.` component a dev error instead of a silent bundle bloat.
const loadMotionFeatures = () => import("@/lib/motionFeatures").then(mod => mod.default);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/en" component={Home} />
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
          <LazyMotion features={loadMotionFeatures} strict>
            <Toaster position="top-center" richColors />
            <Router />
          </LazyMotion>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
