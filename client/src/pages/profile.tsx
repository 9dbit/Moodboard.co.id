import { useClerk, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import type { Project } from "@shared/schema";

export default function Profile() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();

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
                <AvatarImage src={user?.imageUrl || ""} />
                <AvatarFallback className="text-2xl">
                  {user?.firstName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h1 className="text-xl font-semibold" data-testid="text-profile-name">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User"}
                </h1>
                {user?.primaryEmailAddress?.emailAddress && (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1" data-testid="text-profile-email">
                    <Mail className="w-3.5 h-3.5" />
                    {user.primaryEmailAddress.emailAddress}
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
