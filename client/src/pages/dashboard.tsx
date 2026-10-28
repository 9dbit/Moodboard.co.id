import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Layers,
  Search,
  MoreVertical,
  Trash2,
  ExternalLink,
  Flame,
  Sun,
  Snowflake,
  FolderOpen,
  Image as ImageIcon,
  Calendar,
  LogOut,
  ArrowRight,
  ArrowLeft,
  FileText,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Maximize,
  Smartphone,
  Ratio,
  Link2,
  Upload,
  Loader2,
  Building,
  Sofa,
  Palette,
  Monitor,
  Paintbrush,
  Shirt,
  Box,
  User,
  Tag,
  Share2,
  Download,
  BookOpen,
  Shield,
  Megaphone,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@shared/schema";
import { PUBLIC_BETA_LABEL } from "@shared/release-policy";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const leadIcons: Record<string, any> = {
  hot: Flame,
  warm: Sun,
  cold: Snowflake,
};

const leadColors: Record<string, string> = {
  hot: "text-red-500",
  warm: "text-amber-500",
  cold: "text-blue-500",
};

const paperSizeOptions = [
  { value: "A4", label: "A4", desc: "210 x 297 mm", w: 32, h: 46 },
  { value: "A3", label: "A3", desc: "297 x 420 mm", w: 44, h: 62 },
  { value: "A2", label: "A2", desc: "420 x 594 mm", w: 56, h: 80 },
];

const orientationOptions = [
  { value: "horizontal", label: "Landscape", icon: RectangleHorizontal },
  { value: "vertical", label: "Portrait", icon: RectangleVertical },
];

const imageLayoutOptions = [
  { value: "square", label: "Square", ratio: "1:1", icon: Square },
  { value: "portrait_3_5", label: "Portrait", ratio: "3:5", icon: RectangleVertical },
  { value: "portrait_9_16", label: "Tall", ratio: "9:16", icon: Smartphone },
  { value: "landscape_5_3", label: "Landscape", ratio: "5:3", icon: RectangleHorizontal },
  { value: "landscape_16_9", label: "Wide", ratio: "16:9", icon: Maximize },
  { value: "original", label: "Original", ratio: "Auto", icon: Ratio },
];

const projectCategoryOptions = [
  { value: "architecture", label: "Architecture", icon: Building },
  { value: "interior", label: "Interior Design", icon: Sofa },
  { value: "graphic_design", label: "Graphic Design", icon: Palette },
  { value: "uiux", label: "UI/UX Design", icon: Monitor },
  { value: "painting", label: "Painting & Art", icon: Paintbrush },
  { value: "fashion", label: "Fashion", icon: Shirt },
  { value: "product_design", label: "Product Design", icon: Box },
  { value: "custom", label: "Custom", icon: Tag },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showNewProject, setShowNewProject] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newPaperSize, setNewPaperSize] = useState("A3");
  const [newOrientation, setNewOrientation] = useState("horizontal");
  const [newImageLayout, setNewImageLayout] = useState("original");
  const [newProjectCategory, setNewProjectCategory] = useState("architecture");
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [newImportUrls, setNewImportUrls] = useState("");
  const [filterLead, setFilterLead] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const [showBetaInfo, setShowBetaInfo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");
    if (paymentResult === "success") {
      toast({ title: "Payment return received", description: "The payment provider returned success. Your account updates after server confirmation; contact support for billing questions." });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/transactions"] });
      window.history.replaceState({}, "", "/dashboard");
    } else if (paymentResult === "failed") {
      toast({ title: "Payment failed", description: "Your payment could not be completed. New paid purchases are paused during the public beta; contact support for billing questions.", variant: "destructive" });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const createProject = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/projects", {
        title: newTitle || "Untitled Project",
        userId: user?.id,
        studioName: "Moodboard Studio",
        designerName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Designer",
        projectName: newTitle || "Untitled Project",
        paperSize: newPaperSize,
        orientation: newOrientation,
        imageLayout: newImageLayout,
        projectCategory: newProjectCategory === "custom" ? (customCategoryName.trim() || "custom") : newProjectCategory,
      });
      return await res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      const urls = newImportUrls.split("\n").map(u => u.trim()).filter(Boolean);
      const hadUrls = urls.length > 0;
      resetWizard();
      navigate(hadUrls ? `/editor/${project.id}?importing=1` : `/editor/${project.id}`);
      if (hadUrls) {
        toast({ title: "Project created. Importing images in the background..." });
        apiRequest("POST", `/api/projects/${project.id}/import`, { urls })
          .then(async (res) => {
            const data = await res.json();
            queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "pins"] });
            if (data.errors?.length > 0 && data.imported === 0) {
              toast({ title: "Import failed", description: data.errors[0], variant: "destructive" });
            } else if (data.errors?.length > 0) {
              toast({ title: `${data.imported} of ${data.total} images imported`, description: data.errors[0] });
            } else {
              toast({ title: `${data.imported} image(s) imported successfully` });
            }
          })
          .catch(() => {
            toast({ title: "Import failed. Try importing from the editor.", variant: "destructive" });
          });
      }
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted" });
    },
  });

  const resetWizard = () => {
    setShowNewProject(false);
    setWizardStep(0);
    setNewTitle("");
    setNewPaperSize("A3");
    setNewOrientation("horizontal");
    setNewImageLayout("original");
    setNewProjectCategory("architecture");
    setCustomCategoryName("");
    setNewImportUrls("");
  };

  const filteredProjects = projects
    .filter((p) => {
      const matchesLead = filterLead === "all" || p.leadStatus === filterLead;
      const matchesCategory = filterCategory === "all" || p.projectCategory === filterCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.projectName?.toLowerCase().includes(q) ||
        p.studioName?.toLowerCase().includes(q) ||
        p.clientCompany?.toLowerCase().includes(q) ||
        p.clientOwnerName?.toLowerCase().includes(q) ||
        p.designerName?.toLowerCase().includes(q) ||
        (p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toLowerCase().includes(q) : false);
      return matchesLead && matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      if (sortBy === "oldest") return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (sortBy === "az") return a.title.localeCompare(b.title);
      if (sortBy === "za") return b.title.localeCompare(a.title);
      return 0;
    });

  const groupedByCategory = filteredProjects.reduce<Record<string, typeof filteredProjects>>((acc, p) => {
    const cat = p.projectCategory || "architecture";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const categoryOrder = projectCategoryOptions.map(c => c.value);
  const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b));

  const canProceed = () => {
    if (wizardStep === 0) return !!newPaperSize;
    if (wizardStep === 1) return !!newOrientation;
    if (wizardStep === 2) return !!newImageLayout;
    if (wizardStep === 3) return !!newProjectCategory;
    return !!newTitle.trim();
  };

  return (
    <div className="min-h-screen bg-background dot-texture-bg">
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate("/"); }}
            className="flex items-center gap-2 cursor-pointer"
            data-testid="link-dashboard-logo"
          >
            <BrandLogo className="w-8 h-8 rounded-lg" />
            <span className="font-serif text-lg font-semibold tracking-tight" data-testid="text-dashboard-brand">
              Moodboard Studio
            </span>
          </a>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10 hidden sm:flex"
              onClick={() => setShowBetaInfo(true)}
              data-testid="button-beta-info"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Free beta
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="button-user-menu">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={user?.profileImageUrl || ""} />
                    <AvatarFallback className="text-xs">
                      {user?.firstName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user?.firstName || "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="button-profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/affiliate")} data-testid="button-affiliate">
                  <Megaphone className="w-4 h-4 mr-2" />
                  Affiliate
                </DropdownMenuItem>
                {adminCheck?.isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="button-admin-panel">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut({ redirectUrl: basePath || "/" })} data-testid="button-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
              Your Projects
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowNewProject(true)} data-testid="button-new-project">
            <Plus className="w-4 h-4 mr-1" />
            New Project
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, client, date..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-projects"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]" data-testid="select-filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {projectCategoryOptions.filter(o => o.value !== "custom").map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
              {(() => {
                const knownValues = new Set(projectCategoryOptions.map(o => o.value));
                const customCats = Array.from(new Set(projects.map(p => p.projectCategory).filter(c => c && !knownValues.has(c))));
                return customCats.map(cat => (
                  <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
          <Select value={filterLead} onValueChange={setFilterLead}>
            <SelectTrigger className="w-[130px]" data-testid="select-filter-lead">
              <SelectValue placeholder="All leads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leads</SelectItem>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="az">Name A-Z</SelectItem>
              <SelectItem value="za">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6 pb-6">
                  <Skeleton className="h-40 w-full rounded-lg mb-4" />
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-state">
              {searchQuery || filterLead !== "all" || filterCategory !== "all" ? "No matching projects" : "No projects yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || filterLead !== "all" || filterCategory !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first moodboard project to get started"}
            </p>
            {!searchQuery && filterLead === "all" && filterCategory === "all" && (
              <Button onClick={() => setShowNewProject(true)} data-testid="button-empty-create">
                <Plus className="w-4 h-4 mr-1" />
                Create First Project
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {sortedCategories.map((cat) => {
              const catInfo = projectCategoryOptions.find(c => c.value === cat);
              const CatIcon = catInfo?.icon || Building;
              const catProjects = groupedByCategory[cat];
              return (
                <div key={cat} data-testid={`category-group-${cat}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <CatIcon className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-base">{catInfo?.label || cat}</h2>
                    <span className="text-xs text-muted-foreground">({catProjects.length})</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {catProjects.map((project) => {
                      const LeadIcon = leadIcons[project.leadStatus || "warm"];
                      const leadColor = leadColors[project.leadStatus || "warm"];
                      return (
                        <div
                          key={project.id}
                          className="relative rounded-xl overflow-hidden cursor-pointer group"
                          style={{ aspectRatio: "4 / 3", boxShadow: "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)" }}
                          onClick={() => navigate(`/editor/${project.id}`)}
                          data-testid={`card-project-${project.id}`}
                        >
                          {(project as any).coverImageUrl ? (
                            <img
                              src={(project as any).coverImageUrl}
                              alt={project.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              data-testid={`img-cover-${project.id}`}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
                              <ImageIcon className="w-12 h-12 text-white/20" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                          <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {(project as any).pinCount > 0 && (
                              <div
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/90"
                                style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", background: "rgba(0,0,0,0.35)" }}
                                data-testid={`badge-pin-count-${project.id}`}
                              >
                                <Layers className="w-3 h-3" />
                                {(project as any).pinCount}
                              </div>
                            )}
                            {(project as any).pageCount > 0 && (
                              <div
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/90"
                                style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", background: "rgba(0,0,0,0.35)" }}
                                data-testid={`badge-page-count-${project.id}`}
                              >
                                <BookOpen className="w-3 h-3" />
                                {(project as any).pageCount} {(project as any).pageCount === 1 ? "page" : "pages"}
                              </div>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-white/90"
                                  style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", background: "rgba(0,0,0,0.35)" }}
                                  data-testid={`button-project-menu-${project.id}`}
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/editor/${project.id}`)}
                                  data-testid={`button-open-${project.id}`}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Open
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/editor/${project.id}?action=share`)}
                                  data-testid={`button-share-${project.id}`}
                                >
                                  <Share2 className="w-4 h-4 mr-2" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/editor/${project.id}?action=export`)}
                                  data-testid={`button-export-${project.id}`}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => deleteProject.mutate(project.id)}
                                  className="text-destructive"
                                  data-testid={`button-delete-${project.id}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div
                            className="absolute bottom-0 left-0 right-0 p-3"
                            style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "rgba(0,0,0,0.35)" }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm text-white truncate" data-testid={`text-project-title-${project.id}`}>
                                  {project.title}
                                </h3>
                                {((project as any).clientName || (project as any).clientInfo?.name) && (
                                  <p className="text-[11px] text-white/70 truncate mt-0.5">
                                    {(project as any).clientName || (project as any).clientInfo?.name}
                                  </p>
                                )}
                              </div>
                              {LeadIcon && (
                                <LeadIcon className={`w-4 h-4 shrink-0 mt-0.5 ${leadColor}`} />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-white/50 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }) : "—"}
                              </span>
                              {project.studioName && (
                                <span className="text-[10px] text-white/50 truncate">
                                  {project.studioName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <AffiliateSection />
      </main>

      <Dialog open={showNewProject} onOpenChange={(open) => { if (!open) resetWizard(); else setShowNewProject(true); }}>
        <DialogContent className="sm:max-w-lg glass-strong">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {wizardStep === 0 && "Choose Paper Size"}
              {wizardStep === 1 && "Choose Orientation"}
              {wizardStep === 2 && "Choose Image Format"}
              {wizardStep === 3 && "Project Category"}
              {wizardStep === 4 && "Create Your Moodboard"}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 0 && "Select the paper size for your moodboard presentation."}
              {wizardStep === 1 && "How should your moodboard be oriented?"}
              {wizardStep === 2 && "Pick the default image format for your moodboard."}
              {wizardStep === 3 && "What type of design project is this? AI will tailor its language accordingly."}
              {wizardStep === 4 && "Name your project and paste Pinterest or image links to get started."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 mb-2">
            {[0, 1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step <= wizardStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {wizardStep === 0 && (
            <div className="grid grid-cols-3 gap-3 pt-2" data-testid="step-paper-size">
              {paperSizeOptions.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setNewPaperSize(size.value)}
                  className={`
                    relative p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-2
                    ${newPaperSize === size.value
                      ? "border-primary bg-primary/10"
                      : "border-border/50 glass"
                    }
                  `}
                  data-testid={`button-size-${size.value}`}
                >
                  <div
                    className={`border-2 transition-colors ${
                      newPaperSize === size.value ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/50"
                    }`}
                    style={{ width: size.w, height: size.h }}
                  />
                  <div>
                    <span className="text-sm font-bold block">{size.label}</span>
                    <span className="text-[11px] text-muted-foreground">{size.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {wizardStep === 1 && (
            <div className="grid grid-cols-2 gap-3 pt-2" data-testid="step-orientation">
              {orientationOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNewOrientation(opt.value)}
                  className={`
                    relative p-5 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-3
                    ${newOrientation === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border/50 glass"
                    }
                  `}
                  data-testid={`button-orient-${opt.value}`}
                >
                  <div
                    className={`border-2 transition-colors ${
                      newOrientation === opt.value ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/50"
                    }`}
                    style={{
                      width: opt.value === "horizontal" ? 80 : 48,
                      height: opt.value === "horizontal" ? 56 : 72,
                    }}
                  />
                  <span className="text-sm font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {wizardStep === 2 && (
            <div className="grid grid-cols-3 gap-3 pt-2" data-testid="step-image-layout">
              {imageLayoutOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setNewImageLayout(opt.value)}
                    className={`
                      relative p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-2
                      ${newImageLayout === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border/50 glass"
                      }
                    `}
                    data-testid={`button-layout-${opt.value}`}
                  >
                    <Icon className={`w-6 h-6 ${newImageLayout === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <span className="text-xs font-semibold block">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.ratio}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="step-project-category">
                {projectCategoryOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setNewProjectCategory(opt.value)}
                      className={`
                        relative p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-2
                        ${newProjectCategory === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border/50 glass"
                        }
                      `}
                      data-testid={`button-category-${opt.value}`}
                    >
                      <Icon className={`w-6 h-6 ${newProjectCategory === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {newProjectCategory === "custom" && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Custom Category Name</label>
                  <Input
                    placeholder="e.g. Automotive Design, Hospitality, etc."
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    autoFocus
                    data-testid="input-custom-category"
                  />
                </div>
              )}
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4 pt-2" data-testid="step-project-name">
              <div className="p-3 rounded-xl glass flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{newPaperSize}</Badge>
                <Badge variant="secondary">{newOrientation === "horizontal" ? "Landscape" : "Portrait"}</Badge>
                <Badge variant="secondary">
                  {imageLayoutOptions.find((o) => o.value === newImageLayout)?.label} ({imageLayoutOptions.find((o) => o.value === newImageLayout)?.ratio})
                </Badge>
                <Badge variant="secondary">
                  {newProjectCategory === "custom" ? (customCategoryName.trim() || "Custom") : (projectCategoryOptions.find((o) => o.value === newProjectCategory)?.label || "Architecture")}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Project Name</label>
                <Input
                  placeholder="e.g. Tropical Modern Villa"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createProject.mutate()}
                  autoFocus
                  data-testid="input-new-project-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  Import Images
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  placeholder={"Paste Pinterest board link or image URLs:\nhttps://pin.it/abc123\nhttps://pinterest.com/user/board"}
                  value={newImportUrls}
                  onChange={(e) => setNewImportUrls(e.target.value)}
                  className="min-h-[80px] text-sm"
                  data-testid="input-wizard-import-urls"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports Pinterest board links, pin URLs, and direct image URLs. One per line.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {wizardStep > 0 ? (
              <Button variant="ghost" onClick={() => setWizardStep(wizardStep - 1)} data-testid="button-wizard-back">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={resetWizard} data-testid="button-cancel-project">
                Cancel
              </Button>
            )}

            {wizardStep < 4 ? (
              <Button
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={!canProceed()}
                data-testid="button-wizard-next"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => createProject.mutate()}
                disabled={createProject.isPending || !newTitle.trim()}
                data-testid="button-create-project"
              >
                {createProject.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    {newImportUrls.trim() ? "Creating & Importing..." : "Creating..."}
                  </>
                ) : (
                  newImportUrls.trim() ? "Create & Import" : "Create Project"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBetaInfo} onOpenChange={setShowBetaInfo}>
        <DialogContent className="max-w-lg" data-testid="dialog-beta-info">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {PUBLIC_BETA_LABEL}
            </DialogTitle>
            <DialogDescription>
              Create, edit, and export moodboards without a Moodboard subscription charge during the public beta.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">No new paid purchases are available during the beta. Existing projects and account records are retained. Reference-image and PDF export limits still apply.</p>
          <p className="text-sm text-muted-foreground">ChatGPT access depends on your OpenAI account and plan. Any future Moodboard pricing will be announced before you choose a paid offering.</p>
          <div className="flex flex-wrap gap-3">
            <a href="/chatgpt"><Button>ChatGPT connection guide</Button></a>
            <a href="/contact"><Button variant="outline">Support and billing questions</Button></a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AffiliateSection() {
  const { data: banners = [] } = useQuery<any[]>({
    queryKey: ["/api/affiliate/banners"],
  });

  const dashboardBanners = banners.filter((b: any) =>
    b.position === "dashboard" || b.position === "both"
  );

  if (dashboardBanners.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="grid gap-4">
        {dashboardBanners.map((b: any) => (
          <a
            key={b.id}
            href={b.linkUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            data-testid={`affiliate-banner-${b.id}`}
          >
            <Card className="overflow-visible hover-elevate">
              <CardContent className="p-4 flex items-center gap-4">
                {b.imageUrl && (
                  <img src={b.imageUrl} alt={b.title} className="w-24 h-16 object-cover rounded-md" />
                )}
                <div>
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.description}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0" />
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
