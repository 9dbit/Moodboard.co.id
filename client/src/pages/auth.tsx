import { useEffect, useState, type FormEvent } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authRequest, useAuth } from "@/hooks/use-auth";

function returnDestination() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x1f\x7f]/.test(value) && !/^\/(sign-in|sign-up)/.test(value)
    ? value : "/";
}

export default function AuthPage({ register = false }: { register?: boolean }) {
  const { user, isLoading, signIn, signUp } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const destination = returnDestination();
  const otherRoute = `${register ? "/sign-in" : "/sign-up"}${destination !== "/" ? `?returnTo=${encodeURIComponent(destination)}` : ""}`;

  if (user && destination.startsWith("/oauth/consent?")) {
    window.location.replace(destination);
    return null;
  }
  if (user) return <Redirect to={destination} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (register) await signUp({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
      else await signIn(email.trim(), password);
      if (destination.startsWith("/oauth/consent?")) window.location.assign(destination);
      else navigate(destination, { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Moodboard Studio
        </Link>
        <Card className="rounded-2xl">
          <CardContent className="p-7 sm:p-8">
            <div className="mb-7 text-center">
              <BrandLogo className="h-14 w-14 rounded-xl mx-auto mb-5" />
              <h1 className="font-serif text-2xl font-semibold">{register ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{register ? "Start creating professional moodboards." : "Sign in to Moodboard Studio."}</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              {register && <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input id="first-name" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required disabled={pending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input id="last-name" autoComplete="family-name" placeholder="Optional" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} disabled={pending} />
                </div>
              </div>}
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" data-testid="input-auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required disabled={pending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" data-testid="input-auth-password" type="password" autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={register ? 12 : undefined} maxLength={128} required disabled={pending} aria-describedby={register ? "password-help" : undefined} />
                {register && <p id="password-help" className="text-xs text-muted-foreground">Use at least 12 characters.</p>}
              </div>
              {!register && <div className="text-right"><Link href="/forgot-password" className="text-sm text-primary hover:underline">Set or reset your password</Link></div>}
              {error && <p role="alert" className="text-sm text-destructive" data-testid="text-auth-error">{error}</p>}
              <Button className="w-full" type="submit" disabled={pending || isLoading} data-testid="button-auth-submit">
                {(pending || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {register ? "Create account" : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {register ? "Already have an account? " : "New to Moodboard Studio? "}
              <Link href={otherRoute} className="text-primary font-medium hover:underline">{register ? "Sign in" : "Create an account"}</Link>
            </p>
            {!register && <div className="mt-5 space-y-3 border-t pt-5 text-center text-xs text-muted-foreground leading-relaxed">
              <p>Existing account? Use an activation or password reset link to choose your password before your first sign in.</p>
              <p>Administrator credentials have a separate sign in. <Link href="/admin" className="text-primary font-medium hover:underline">Open admin sign in</Link></p>
            </div>}
            {register && <p className="mt-4 text-center text-xs text-muted-foreground leading-relaxed">
              By creating an account, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </p>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function RecoveryCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-5">
        <Link href="/sign-in" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <Card className="rounded-2xl">
          <CardContent className="p-7 sm:p-8">
            <BrandLogo className="h-14 w-14 rounded-xl mx-auto mb-5" />
            <h1 className="font-serif text-2xl font-semibold text-center">{title}</h1>
            <p className="mt-2 mb-7 text-sm text-muted-foreground text-center">{description}</p>
            {children}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await authRequest("/api/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <RecoveryCard title="Set or reset your password" description="Use the email address associated with your Moodboard Studio account.">
      {sent ? <div role="status" className="space-y-4 text-sm">
        <p>If an eligible account exists, you will receive a link to set your password. Check your inbox and spam folder.</p>
        <Link href="/sign-in" className="text-primary font-medium hover:underline">Return to sign in</Link>
      </div> : <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="recovery-email">Email address</Label>
          <Input id="recovery-email" data-testid="input-recovery-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending} data-testid="button-recovery-submit">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send password link
        </Button>
        <p className="text-xs text-muted-foreground leading-relaxed">If your account has no email address, contact the administrator to recover access to your existing projects.</p>
      </form>}
    </RecoveryCard>
  );
}

export function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // The one-time token stays out of URLs copied later or sent as referrers.
    if (token) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await authRequest("/api/auth/reset-password", { token, password });
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <RecoveryCard title={complete ? "Your password is ready" : "Choose your password"} description={complete ? "You can now sign in to your Moodboard Studio account." : "Set a password to access your account and projects."}>
      {complete ? <div role="status" className="space-y-4 text-sm">
        <p>Your password has been saved. Use your account email address to sign in.</p>
        <Link href="/sign-in" className="text-primary font-medium hover:underline" data-testid="link-reset-sign-in">Continue to sign in</Link>
      </div> : !token ? <div role="alert" className="space-y-4 text-sm">
        <p>This password link is missing or incomplete. Open the complete link provided to you, or request a new one.</p>
        <Link href="/forgot-password" className="text-primary font-medium hover:underline">Request a password link</Link>
      </div> : <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" data-testid="input-reset-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="reset-password-help" />
          <p id="reset-password-help" className="text-xs text-muted-foreground">Use at least 12 characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input id="confirm-password" data-testid="input-reset-confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending} data-testid="button-reset-submit">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save password
        </Button>
      </form>}
    </RecoveryCard>
  );
}
