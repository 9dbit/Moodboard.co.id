import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import {
  ArrowLeft,
  Mail,
  Calendar,
  FolderOpen,
  LogOut,
  User,
  Loader2,
  Link2,
} from "lucide-react";
import type { Project } from "@shared/schema";

interface ConnectedApp {
  id: string;
  name: string;
  scopes: string[] | string;
  created_at: string;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const connections = useQuery<ConnectedApp[]>({
    queryKey: ["/api/connections"], enabled: !!user, staleTime: 0,
  });
  const revokeConnection = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/connections/${encodeURIComponent(id)}`);
      const result = await response.json();
      if (!result.success) throw new Error("Access could not be revoked. Please try again.");
    },
    onSuccess: (_result, id) => {
      queryClient.setQueryData<ConnectedApp[]>(["/api/connections"], previous => previous?.filter(app => app.id !== id));
      toast({ title: "App access revoked", description: "The app can no longer access your Moodboard account." });
    },
    onError: () => toast({ title: "Could not revoke access", description: "Please try again.", variant: "destructive" }),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const totalProjects = projects.length;
  const categories = Array.from(new Set(projects.map(p => p.projectCategory || "architecture")));
  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "N/A";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <BrandLogo className="w-8 h-8 rounded-lg" />
            <span className="font-serif text-lg font-semibold tracking-tight">Profile</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4 mb-8">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user?.profileImageUrl || ""} />
                <AvatarFallback className="text-2xl">
                  {user?.firstName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h1 className="text-xl font-semibold" data-testid="text-profile-name">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User"}
                </h1>
                {user?.email && (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1" data-testid="text-profile-email">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-md border p-4 text-center">
                <FolderOpen className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold" data-testid="text-total-projects">{totalProjects}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </div>
              <div className="rounded-md border p-4 text-center">
                <User className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold" data-testid="text-categories-count">{categories.length}</p>
                <p className="text-xs text-muted-foreground">Categories Used</p>
              </div>
              <div className="rounded-md border p-4 text-center">
                <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-semibold mt-1" data-testid="text-join-date">{joinDate}</p>
                <p className="text-xs text-muted-foreground">Member Since</p>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">Active Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <Badge key={cat} variant="secondary" data-testid={`badge-category-${cat}`}>
                      {cat.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <section className="border-t pt-6 mb-8" aria-labelledby="connected-apps-title">
              <h2 id="connected-apps-title" className="font-medium mb-1 flex items-center gap-2"><Link2 className="w-4 h-4" />Connected apps</h2>
              <p className="text-sm text-muted-foreground mb-4">Manage apps you have allowed to access your moodboards. Revoking access disconnects the app from your account.</p>
              {connections.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin" />Loading connected apps…</p> : connections.isError ? <div role="alert" className="text-sm"><p>We could not load your connected apps.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => connections.refetch()}>Try again</Button></div> : !connections.data?.length ? <p className="text-sm text-muted-foreground" data-testid="connected-apps-empty">No apps are connected.</p> : <ul className="space-y-3" data-testid="connected-apps-list">
                {connections.data.map(app => {
                  const scopes = Array.isArray(app.scopes) ? app.scopes : (app.scopes || "").split(/\s+/).filter(Boolean);
                  const createdAt = new Date(app.created_at);
                  return <li key={app.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm break-words">{app.name || "Connected app"}</p>
                      <p className="text-xs text-muted-foreground">Connected{Number.isNaN(createdAt.getTime()) ? "" : ` ${createdAt.toLocaleDateString()}`}</p>
                      <div className="flex flex-wrap gap-1 mt-2" aria-label="Permissions">{scopes.map(scope => <Badge key={scope} variant="secondary" className="text-[10px]">{scope.replace(/[._:]/g, " ")}</Badge>)}</div>
                    </div>
                    <Button variant="outline" size="sm" disabled={revokeConnection.isPending} onClick={() => revokeConnection.mutate(app.id)} data-testid="button-revoke-app">
                      {revokeConnection.isPending && revokeConnection.variables === app.id ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Revoking…</> : "Revoke access"}
                    </Button>
                  </li>;
                })}
              </ul>}
              {revokeConnection.isError && <p className="mt-2 text-sm text-destructive" role="alert">App access could not be revoked. Please try again.</p>}
            </section>

            <div className="flex justify-center">
              <Button variant="outline" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} data-testid="button-profile-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
