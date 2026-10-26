import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
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

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#e86f19",
    colorForeground: "#211a16",
    colorMutedForeground: "#74675f",
    colorDanger: "#b91c1c",
    colorBackground: "#fffaf6",
    colorInput: "#ffffff",
    colorInputForeground: "#211a16",
    colorNeutral: "#ded5cf",
    fontFamily: "Montserrat, sans-serif",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: { background: "#fffaf6", borderRadius: "1rem", width: "440px", maxWidth: "100%", overflow: "hidden" },
    card: { boxShadow: "none", border: "0", background: "transparent" },
    footer: { boxShadow: "none", border: "0", background: "transparent" },
    headerTitle: { color: "#211a16" },
    headerSubtitle: { color: "#74675f" },
    socialButtonsBlockButtonText: { color: "#211a16" },
    formFieldLabel: { color: "#211a16" },
    footerActionLink: { color: "#c9570b" },
    footerActionText: { color: "#74675f" },
    dividerText: { color: "#74675f" },
    identityPreviewEditButton: { color: "#c9570b" },
    formFieldSuccessText: { color: "#16794b" },
    alertText: { color: "#991b1b" },
    logoBox: { height: "52px" },
    logoImage: { maxHeight: "52px" },
    socialButtonsBlockButton: { borderColor: "#ded5cf" },
    formButtonPrimary: { background: "#e86f19", color: "#ffffff" },
    formFieldInput: { background: "#ffffff", color: "#211a16", borderColor: "#ded5cf" },
    footerAction: { background: "transparent" },
    dividerLine: { background: "#ded5cf" },
    alert: { background: "#fef2f2", borderColor: "#fecaca" },
    otpCodeFieldInput: { background: "#ffffff", color: "#211a16", borderColor: "#ded5cf" },
    formFieldRow: { color: "#211a16" },
    main: { color: "#211a16" },
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        client.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in"><Dashboard /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
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
      <Route path="/login"><Redirect to="/sign-in" /></Route>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to Moodboard Studio" } },
        signUp: { start: { title: "Create your account", subtitle: "Start creating professional moodboards" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <ChatWidget />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
