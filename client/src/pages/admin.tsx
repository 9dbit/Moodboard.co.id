import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  DollarSign,
  Database,
  Settings,
  BarChart3,
  ArrowLeft,
  Download,
  Clock,
  Crown,
  Megaphone,
  Plus,
  Trash2,
  Link2,
  Eye,
  Search,
  CreditCard,
  Globe,
  Key,
  FileText,
  TrendingUp,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Copy,
  Check,
} from "lucide-react";

type AdminTab = "dashboard" | "users" | "finance" | "database" | "settings" | "affiliate";

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionTier: string | null;
  trialExpiresAt: string | null;
  whatsappNumber: string | null;
  companyName: string | null;
  createdAt: string | null;
  projectCount: number;
  clientCount: number;
  clients: Array<{
    projectId: number;
    projectName: string;
    clientCompany: string | null;
    clientOwnerName: string | null;
    clientPhone: string | null;
    clientEmail: string | null;
  }>;
}

interface AdminStats {
  users: { total: number; trial: number; lite: number; pro: number };
  projects: { total: number };
  finance: { totalRevenue: number; monthlyRevenue: number; transactionCount: number };
  affiliate: { totalCodes: number; totalClicks: number; totalSignups: number; totalConversions: number };
}

interface AffiliateBanner {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: string | null;
  isActive: boolean | null;
}

interface AffiliateCodeAdmin {
  id: number;
  userId: string;
  code: string;
  label: string | null;
  clicks: number | null;
  signups: number | null;
  conversions: number | null;
  isActive: boolean | null;
  userName: string;
  userEmail: string;
}

function AdminLoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json();
        setError(data.message || "Invalid email or password");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" style={{ fontFamily: "Montserrat" }}>
      <Card className="max-w-sm w-full">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">Moodboard Studio Control Panel</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  className="pl-9"
                  required
                  data-testid="input-admin-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-9"
                  required
                  data-testid="input-admin-password"
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-login-error">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-admin-login">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: adminCheck, isLoading: adminLoading, refetch: refetchAdmin } = useQuery<{ isAdmin: boolean; email?: string }>({
    queryKey: ["/api/admin/check"],
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/logout"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
    },
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return <AdminLoginPage onLogin={() => refetchAdmin()} />;
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "finance", label: "Finance", icon: DollarSign },
    { id: "affiliate", label: "Affiliate", icon: Megaphone },
    { id: "database", label: "Database", icon: Database },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft />
          </Button>
          <h1 className="text-lg font-bold" style={{ fontFamily: "Montserrat" }}>
            Admin Panel
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary">
              {adminCheck?.email || "Admin"}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              title="Logout"
              data-testid="button-admin-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
              className="gap-2 whitespace-nowrap"
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "finance" && <FinanceTab />}
        {activeTab === "affiliate" && <AffiliateTab />}
        {activeTab === "database" && <DatabaseTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

function DashboardTab() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) return <LoadingState />;
  if (!stats) return null;

  const cards = [
    { label: "Total Users", value: stats.users.total, icon: Users, color: "text-blue-500" },
    { label: "Trial Users", value: stats.users.trial, icon: Clock, color: "text-amber-500" },
    { label: "Studio Lite", value: stats.users.lite, icon: Crown, color: "text-emerald-500" },
    { label: "Studio Pro", value: stats.users.pro, icon: Crown, color: "text-purple-500" },
    { label: "Total Projects", value: stats.projects.total, icon: FileText, color: "text-indigo-500" },
    { label: "Total Revenue", value: `Rp ${(stats.finance.totalRevenue || 0).toLocaleString("id-ID")}`, icon: DollarSign, color: "text-green-500" },
    { label: "Monthly Revenue", value: `Rp ${(stats.finance.monthlyRevenue || 0).toLocaleString("id-ID")}`, icon: TrendingUp, color: "text-orange-500" },
    { label: "Transactions", value: stats.finance.transactionCount, icon: CreditCard, color: "text-rose-500" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Affiliate Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Active Codes</p>
                <p className="text-lg font-bold">{stats.affiliate.totalCodes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Clicks</p>
                <p className="text-lg font-bold">{stats.affiliate.totalClicks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Signups</p>
                <p className="text-lg font-bold">{stats.affiliate.totalSignups}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversions</p>
                <p className="text-lg font-bold">{stats.affiliate.totalConversions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <DistributionBar label="Trial" count={stats.users.trial} total={stats.users.total} color="bg-amber-500" />
              <DistributionBar label="Studio Lite" count={stats.users.lite} total={stats.users.total} color="bg-emerald-500" />
              <DistributionBar label="Studio Pro" count={stats.users.pro} total={stats.users.total} color="bg-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DistributionBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [extendUserId, setExtendUserId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState("7");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const extendTrialMutation = useMutation({
    mutationFn: async ({ userId, days }: { userId: string; days: number }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/extend-trial`, { days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setExtendUserId(null);
      toast({ title: "Trial extended successfully" });
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/subscription`, { subscriptionTier: tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Subscription updated" });
    },
  });

  if (isLoading) return <LoadingState />;

  const filtered = (users || []).filter((u) => {
    const matchesSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      u.companyName?.toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === "all" || u.subscriptionTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const getTierBadge = (tier: string | null) => {
    switch (tier) {
      case "studio_pro": return <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 no-default-hover-elevate no-default-active-elevate">Pro</Badge>;
      case "studio_lite": return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 no-default-hover-elevate no-default-active-elevate">Lite</Badge>;
      default: return <Badge variant="secondary">Trial</Badge>;
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-tier-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="studio_lite">Studio Lite</SelectItem>
            <SelectItem value="studio_pro">Studio Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead>Trial Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <>
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {u.whatsappNumber && <p className="text-xs text-muted-foreground">{u.whatsappNumber}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.companyName || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.subscriptionTier || "trial"}
                        onValueChange={(val) => updateTierMutation.mutate({ userId: u.id, tier: val })}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="studio_lite">Studio Lite</SelectItem>
                          <SelectItem value="studio_pro">Studio Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{u.projectCount}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                        data-testid={`button-expand-clients-${u.id}`}
                      >
                        <Eye className="w-3 h-3" />
                        {u.clientCount}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.trialExpiresAt ? new Date(u.trialExpiresAt).toLocaleDateString() : "Not set"}
                    </TableCell>
                    <TableCell>
                      <Dialog open={extendUserId === u.id} onOpenChange={(open) => !open && setExtendUserId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setExtendUserId(u.id)}
                            data-testid={`button-extend-trial-${u.id}`}
                          >
                            <Clock className="w-3 h-3" />
                            Extend
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Extend Trial - {u.email}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="text-sm text-muted-foreground">Days to add</label>
                              <Input
                                type="number"
                                value={extendDays}
                                onChange={(e) => setExtendDays(e.target.value)}
                                min="1"
                                data-testid="input-extend-days"
                              />
                            </div>
                            <Button
                              onClick={() => extendTrialMutation.mutate({ userId: u.id, days: parseInt(extendDays) || 7 })}
                              disabled={extendTrialMutation.isPending}
                              data-testid="button-confirm-extend"
                            >
                              {extendTrialMutation.isPending ? "Extending..." : `Extend by ${extendDays} days`}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                  {expandedUser === u.id && u.clients.length > 0 && (
                    <TableRow key={`${u.id}-clients`}>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="p-2">
                          <p className="text-xs font-medium mb-2 text-muted-foreground">Client Details</p>
                          <div className="grid gap-2">
                            {u.clients.map((c, i) => (
                              <div key={i} className="text-xs bg-background rounded-md p-2 flex flex-wrap gap-4">
                                <span><strong>Project:</strong> {c.projectName}</span>
                                <span><strong>Company:</strong> {c.clientCompany || "-"}</span>
                                <span><strong>Contact:</strong> {c.clientOwnerName || "-"}</span>
                                <span><strong>Phone:</strong> {c.clientPhone || "-"}</span>
                                <span><strong>Email:</strong> {c.clientEmail || "-"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function FinanceTab() {
  const { data, isLoading } = useQuery<{ transactions: any[]; stats: any }>({
    queryKey: ["/api/admin/finance"],
  });

  if (isLoading) return <LoadingState />;

  const stats = data?.stats || { totalRevenue: 0, monthlyRevenue: 0, transactionCount: 0 };
  const txs = data?.transactions || [];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">Rp {(stats.totalRevenue || 0).toLocaleString("id-ID")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Monthly Revenue</p>
            <p className="text-2xl font-bold">Rp {(stats.monthlyRevenue || 0).toLocaleString("id-ID")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold">{stats.transactionCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs">{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{tx.userId}</TableCell>
                    <TableCell className="text-sm font-medium">Rp {(tx.amount || 0).toLocaleString("id-ID")}</TableCell>
                    <TableCell>
                      <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{tx.paymentMethod || "-"}</TableCell>
                    <TableCell className="text-xs">{tx.description || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AffiliateTab() {
  const { toast } = useToast();
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerDesc, setBannerDesc] = useState("");
  const [bannerImg, setBannerImg] = useState("");
  const [bannerLink, setBannerLink] = useState("");
  const [bannerPosition, setBannerPosition] = useState("landing");
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [feePercentage, setFeePercentage] = useState("");
  const [feeLoaded, setFeeLoaded] = useState(false);

  const { data: feeData } = useQuery<{ value: string }>({
    queryKey: ["/api/admin/settings", "affiliate_fee_percentage"],
  });

  useEffect(() => {
    if (feeData && !feeLoaded) {
      setFeePercentage(feeData.value || "10");
      setFeeLoaded(true);
    }
  }, [feeData, feeLoaded]);

  const saveFee = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/admin/settings", {
        key: "affiliate_fee_percentage",
        value: feePercentage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Affiliate fee percentage saved" });
    },
  });

  const { data: codes, isLoading: codesLoading } = useQuery<AffiliateCodeAdmin[]>({
    queryKey: ["/api/admin/affiliate/codes"],
  });

  const { data: banners, isLoading: bannersLoading } = useQuery<AffiliateBanner[]>({
    queryKey: ["/api/admin/affiliate/banners"],
  });

  const createCodeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/affiliate/codes", {
        code: newCode,
        label: newCodeLabel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliate/codes"] });
      setShowCodeForm(false);
      setNewCode("");
      setNewCodeLabel("");
      toast({ title: "Affiliate code created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/affiliate/codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliate/codes"] });
      toast({ title: "Code deleted" });
    },
  });

  const createBannerMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/affiliate/banners", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliate/banners"] });
      setShowBannerForm(false);
      setBannerTitle("");
      setBannerDesc("");
      setBannerImg("");
      setBannerLink("");
      toast({ title: "Banner created" });
    },
  });

  const toggleBannerMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/affiliate/banners/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliate/banners"] });
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/affiliate/banners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliate/banners"] });
      toast({ title: "Banner deleted" });
    },
  });

  if (codesLoading || bannersLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Affiliate Fee Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-xs">
            <Input
              type="number"
              min="0"
              max="100"
              value={feePercentage}
              onChange={(e) => setFeePercentage(e.target.value)}
              className="w-24"
              data-testid="input-admin-affiliate-fee"
            />
            <span className="text-sm text-muted-foreground">% commission</span>
            <Button
              size="sm"
              onClick={() => saveFee.mutate()}
              disabled={saveFee.isPending}
              data-testid="button-save-affiliate-fee"
            >
              {saveFee.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Affiliate Codes</CardTitle>
          <Button size="sm" className="gap-1" onClick={() => setShowCodeForm(true)} data-testid="button-add-affiliate-code">
            <Plus className="w-3 h-3" />
            Create Code
          </Button>
        </CardHeader>
        <CardContent>
          {showCodeForm && (
            <div className="border rounded-md p-4 mb-4 space-y-3">
              <Input
                placeholder="Code (e.g. STUDIO2026)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                data-testid="input-admin-affiliate-code"
              />
              <Input
                placeholder="Label (optional, e.g. Instagram Campaign)"
                value={newCodeLabel}
                onChange={(e) => setNewCodeLabel(e.target.value)}
                data-testid="input-admin-affiliate-label"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createCodeMutation.mutate()}
                  disabled={!newCode || newCode.length < 3 || createCodeMutation.isPending}
                  data-testid="button-save-admin-affiliate-code"
                >
                  {createCodeMutation.isPending ? "Creating..." : "Create"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowCodeForm(false); setNewCode(""); setNewCodeLabel(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {(codes || []).length === 0 && !showCodeForm ? (
            <p className="text-center text-muted-foreground py-6">No affiliate codes yet. Create one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Tracking Link</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Signups</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(codes || []).map((c) => (
                  <TableRow key={c.id} data-testid={`affiliate-code-${c.id}`}>
                    <TableCell className="font-mono font-bold text-sm">{c.code}</TableCell>
                    <TableCell className="text-sm">{c.label || "-"}</TableCell>
                    <TableCell>
                      <code className="text-[10px] bg-muted px-2 py-0.5 rounded">
                        {window.location.origin}/api/affiliate/track/{c.code}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm">{c.clicks || 0}</TableCell>
                    <TableCell className="text-sm">{c.signups || 0}</TableCell>
                    <TableCell className="text-sm">{c.conversions || 0}</TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "default" : "secondary"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteCodeMutation.mutate(c.id)}
                        data-testid={`button-delete-code-${c.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Marketing Banners</CardTitle>
          <Button size="sm" className="gap-1" onClick={() => setShowBannerForm(true)} data-testid="button-add-banner">
            <Plus className="w-3 h-3" />
            Add Banner
          </Button>
        </CardHeader>
        <CardContent>
          {showBannerForm && (
            <Card className="mb-4 border-dashed">
              <CardContent className="pt-4 space-y-3">
                <Input
                  placeholder="Banner Title"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  data-testid="input-banner-title"
                />
                <Textarea
                  placeholder="Banner Description"
                  value={bannerDesc}
                  onChange={(e) => setBannerDesc(e.target.value)}
                  className="resize-none"
                  data-testid="input-banner-description"
                />
                <Input
                  placeholder="Image URL"
                  value={bannerImg}
                  onChange={(e) => setBannerImg(e.target.value)}
                  data-testid="input-banner-image"
                />
                <Input
                  placeholder="Link URL"
                  value={bannerLink}
                  onChange={(e) => setBannerLink(e.target.value)}
                  data-testid="input-banner-link"
                />
                <Select value={bannerPosition} onValueChange={setBannerPosition}>
                  <SelectTrigger data-testid="select-banner-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landing">Landing Page</SelectItem>
                    <SelectItem value="dashboard">User Dashboard</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => createBannerMutation.mutate({
                      title: bannerTitle,
                      description: bannerDesc,
                      imageUrl: bannerImg,
                      linkUrl: bannerLink,
                      position: bannerPosition,
                    })}
                    disabled={!bannerTitle || createBannerMutation.isPending}
                    data-testid="button-save-banner"
                  >
                    {createBannerMutation.isPending ? "Saving..." : "Save Banner"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowBannerForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(banners || []).length === 0 && !showBannerForm ? (
            <p className="text-center text-muted-foreground py-6">No banners yet</p>
          ) : (
            <div className="grid gap-3">
              {(banners || []).map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-md border" data-testid={`banner-${b.id}`}>
                  {b.imageUrl && (
                    <img src={b.imageUrl} alt={b.title} className="w-20 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.description}</p>
                    <p className="text-xs text-muted-foreground">{b.position}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={b.isActive ? "default" : "outline"}
                      onClick={() => toggleBannerMutation.mutate({ id: b.id, isActive: !b.isActive })}
                    >
                      {b.isActive ? "Active" : "Inactive"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteBannerMutation.mutate(b.id)}
                      data-testid={`button-delete-banner-${b.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DatabaseTab() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Export all users with: WhatsApp, email, company name, subscription tier, trial expiry
          </p>
          <a href="/api/admin/export/users" download>
            <Button className="gap-2 w-full" data-testid="button-export-users">
              <Download className="w-4 h-4" />
              Export Users CSV
            </Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Client Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Export all clients with: user info, project name, client company, contact details
          </p>
          <a href="/api/admin/export/clients" download>
            <Button className="gap-2 w-full" data-testid="button-export-clients">
              <Download className="w-4 h-4" />
              Export Clients CSV
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
  });

  const [chatScript, setChatScript] = useState("");
  const [pgApiKey, setPgApiKey] = useState("");
  const [pgSecretKey, setPgSecretKey] = useState("");
  const [pgCallbackUrl, setPgCallbackUrl] = useState("");
  const [pgEnv, setPgEnv] = useState<"sandbox" | "production">("sandbox");
  const [initialized, setInitialized] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  if (!initialized && settings) {
    setChatScript(settings.chat_widget_script || "");
    setPgApiKey(settings.payment_gateway_api_key || "");
    setPgSecretKey(settings.payment_gateway_secret_key || "");
    setPgCallbackUrl(settings.payment_gateway_callback_url || "");
    setPgEnv((settings.payment_gateway_env as "sandbox" | "production") || "sandbox");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("PUT", "/api/admin/settings", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Setting saved" });
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Chat Widget (chatvice.app)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste your chatvice.app embed script below. It will be injected into the app header for all users.
          </p>
          <Textarea
            placeholder={'<script src="https://chatvice.app/widget/..." async></script>'}
            value={chatScript}
            onChange={(e) => setChatScript(e.target.value)}
            className="font-mono text-xs min-h-[120px]"
            data-testid="input-chat-widget-script"
          />
          <Button
            onClick={() => saveMutation.mutate({ key: "chat_widget_script", value: chatScript })}
            disabled={saveMutation.isPending}
            data-testid="button-save-chat-widget"
          >
            {saveMutation.isPending ? "Saving..." : "Save Chat Widget Script"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            12Pay Payment Gateway
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure your 12Pay credentials. The server key is used to create payment requests and verify webhook signatures. The client key is optional (for frontend Snap.js if needed).
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Key className="w-3 h-3" /> Server Key (used for API calls)
              </label>
              <Input
                type="password"
                placeholder="SB-Mid-server-xxxx or Mid-server-xxxx"
                value={pgSecretKey}
                onChange={(e) => setPgSecretKey(e.target.value)}
                data-testid="input-pg-secret-key"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Key className="w-3 h-3" /> Client Key (optional, for Snap.js)
              </label>
              <Input
                placeholder="SB-Mid-client-xxxx or Mid-client-xxxx"
                value={pgApiKey}
                onChange={(e) => setPgApiKey(e.target.value)}
                data-testid="input-pg-api-key"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                Environment
              </label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={pgEnv === "sandbox" ? "default" : "outline"}
                  onClick={() => setPgEnv("sandbox")}
                  data-testid="button-pg-env-sandbox"
                >
                  Sandbox
                </Button>
                <Button
                  size="sm"
                  variant={pgEnv === "production" ? "default" : "outline"}
                  onClick={() => setPgEnv("production")}
                  data-testid="button-pg-env-production"
                >
                  Production
                </Button>
              </div>
            </div>
          </div>

          <Button
            onClick={() => {
              saveMutation.mutate({ key: "payment_gateway_api_key", value: pgApiKey });
              saveMutation.mutate({ key: "payment_gateway_secret_key", value: pgSecretKey });
              saveMutation.mutate({ key: "payment_gateway_env", value: pgEnv });
            }}
            disabled={saveMutation.isPending}
            data-testid="button-save-payment-config"
          >
            {saveMutation.isPending ? "Saving..." : "Save 12Pay Configuration"}
          </Button>

          <div className="border-t pt-3 mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Configure this as your Notification URL in the 12Pay dashboard:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted p-2 rounded-md flex-1 break-all">
                {window.location.origin}/api/payment/webhook
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-8 w-8 p-0"
                data-testid="button-copy-webhook-url"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/payment/webhook`);
                  setWebhookCopied(true);
                  setTimeout(() => setWebhookCopied(false), 2000);
                }}
              >
                {webhookCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current mode: <span className="font-semibold">{pgEnv === "production" ? "Production" : "Sandbox"}</span> — API base: <span className="font-mono">{pgEnv === "production" ? "https://api.12pay.co.id" : "https://sandbox.12pay.co.id"}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
