import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Editor from "@/pages/editor";
import SharePreview from "@/pages/share-preview";
import Profile from "@/pages/profile";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Faq from "@/pages/faq";
import Contact from "@/pages/contact";
import Blog from "@/pages/blog";
import Admin from "@/pages/admin";
import Affiliate from "@/pages/affiliate";
import NotFound from "@/pages/not-found";
import { ChatWidget } from "@/components/chat-widget";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import AuthPage, { ForgotPasswordPage, ResetPasswordPage } from "@/pages/auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function SessionStatus() {
  const { error, retry } = useAuth();
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
      {error ? <>
        <p role="alert" className="text-muted-foreground">{error.message}</p>
        <Button onClick={retry}>Try again</Button>
      </> : <><Loader2 className="w-7 h-7 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Opening your workspace…</p></>}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = useAuth();
  const [path] = useLocation();
  if (isLoading || error) return <SessionStatus />;
  if (!user) return <Redirect to={`/sign-in?returnTo=${encodeURIComponent(path)}`} />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, isLoading, error } = useAuth();
  if (isLoading || error) return <SessionStatus />;
  return user ? <Dashboard /> : <Landing />;
}

function Router() {
  return (
    <Switch>
      <Route path="/share/:token" component={SharePreview} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/faq" component={Faq} />
      <Route path="/contact" component={Contact} />
      <Route path="/blog" component={Blog} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/login" component={Admin} />
      <Route path="/login"><Redirect to={`/sign-in${window.location.search}`} /></Route>
      <Route path="/sign-in/*?"><AuthPage /></Route>
      <Route path="/sign-up/*?"><AuthPage register /></Route>
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/affiliate">
        <ProtectedRoute>
          <Affiliate />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route path="/editor/:id">
        <ProtectedRoute>
          <Editor />
        </ProtectedRoute>
      </Route>
      <Route path="/" component={HomeRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Toaster />
              <ChatWidget />
              <Router />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
