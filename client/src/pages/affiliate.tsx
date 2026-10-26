import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Check,
  Share2,
  MousePointerClick,
  UserPlus,
  DollarSign,
  Link2,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Megaphone,
  Layers,
  User,
  LogOut,
  Shield,
  ArrowLeft,
} from "lucide-react";

export default function AffiliatePage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: affiliateData, isLoading } = useQuery<{
    code: any;
    stats: { clicks: number; signups: number; conversions: number; referrals: number } | null;
    feePercentage: string;
  }>({
    queryKey: ["/api/affiliate/me"],
  });

  const { data: banners = [] } = useQuery<any[]>({
    queryKey: ["/api/affiliate/banners"],
  });

  const generateCode = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/affiliate/me", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/me"] });
      toast({ title: "Affiliate code generated!" });
    },
    onError: () => {
      toast({ title: "Failed to generate code", variant: "destructive" });
    },
  });

  const copyCode = () => {
    if (affiliateData?.code?.code) {
      navigator.clipboard.writeText(affiliateData.code.code);
      setCopied(true);
      toast({ title: "Code copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = () => {
    if (affiliateData?.code?.code) {
      const link = `${window.location.origin}/api/affiliate/track/${affiliateData.code.code}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({ title: "Referral link copied!" });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 glass-strong">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-32 h-5" />
            </div>
          </div>
        </header>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const code = affiliateData?.code;
  const stats = affiliateData?.stats;
  const feePct = affiliateData?.feePercentage || "10";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); navigate("/"); }}
              className="flex items-center gap-2 cursor-pointer"
              data-testid="link-affiliate-logo"
            >
              <BrandLogo className="w-8 h-8 rounded-lg" />
              <span className="font-serif text-lg font-semibold tracking-tight">
                Moodboard Studio
              </span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="button-affiliate-user-menu">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={user?.imageUrl || ""} />
                    <AvatarFallback className="text-xs">
                      {user?.firstName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user?.firstName || "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/")} data-testid="button-goto-dashboard">
                  <Layers className="w-4 h-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="button-goto-profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                {adminCheck?.isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="button-goto-admin">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} data-testid="button-affiliate-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-affiliate-title">
          Affiliate Program
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Earn {feePct}% commission for every successful referral. Share your link and start earning passive income.
        </p>
      </div>

      {!code ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Join the Affiliate Program</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Generate your unique affiliate code to start sharing and earning commissions. Every subscription through your link earns you {feePct}% commission.
            </p>
            <Button
              onClick={() => generateCode.mutate()}
              disabled={generateCode.isPending}
              data-testid="button-generate-affiliate-code"
            >
              {generateCode.isPending ? "Generating..." : "Generate My Affiliate Code"}
              <Sparkles className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Your Promo Code</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono tracking-widest" data-testid="text-affiliate-code">
                      {code.code}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={copyCode}
                      data-testid="button-copy-affiliate-code"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {feePct}% Commission
                </Badge>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">Referral Link</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/api/affiliate/track/${code.code}`}
                    className="font-mono text-xs"
                    data-testid="input-affiliate-link"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={copyLink}
                    data-testid="button-copy-affiliate-link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-5 text-center">
                <MousePointerClick className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold" data-testid="text-affiliate-clicks">{stats?.clicks || 0}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5 text-center">
                <UserPlus className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold" data-testid="text-affiliate-signups">{stats?.signups || 0}</p>
                <p className="text-xs text-muted-foreground">Sign Ups</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5 text-center">
                <TrendingUp className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold" data-testid="text-affiliate-conversions">{stats?.conversions || 0}</p>
                <p className="text-xs text-muted-foreground">Conversions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5 text-center">
                <DollarSign className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold" data-testid="text-affiliate-earnings">
                  {stats?.conversions ? `${stats.conversions}x` : "0"}
                </p>
                <p className="text-xs text-muted-foreground">Earned Rewards</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const link = `${window.location.origin}/api/affiliate/track/${code.code}`;
                const text = `Check out Moodboard Studio - professional moodboard builder for architects & designers! ${link}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
              data-testid="button-share-whatsapp"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share via WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const link = `${window.location.origin}/api/affiliate/track/${code.code}`;
                const subject = "Try Moodboard Studio";
                const body = `Hi,\n\nI recommend Moodboard Studio for creating professional moodboard presentations.\n\nSign up here: ${link}\n\nBest regards`;
                window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
              }}
              data-testid="button-share-email"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Share via Email
            </Button>
          </div>
        </>
      )}

      {banners.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Promotional Banners
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Download and share these banners on your social media to promote Moodboard Studio.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((b: any) => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  {b.imageUrl && (
                    <img
                      src={b.imageUrl}
                      alt={b.title}
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                  )}
                  <p className="font-medium text-sm">{b.title}</p>
                  {b.description && (
                    <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
