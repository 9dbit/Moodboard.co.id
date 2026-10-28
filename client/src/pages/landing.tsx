import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { HeroBanner } from "@/components/hero-banner";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  FileText,
  Share2,
  ArrowRight,
  CheckCircle2,
  Palette,
  LayoutGrid,
  Zap,
  Download,
  Image,
  Monitor,
  Star,
  Globe,
  ClipboardPaste,
  ExternalLink,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { SiPinterest, SiBehance, SiDribbble } from "react-icons/si";
import { useMetaTags } from "@/hooks/use-meta-tags";
import { FREE_PUBLIC_BETA, PUBLIC_BETA_LABEL } from "@shared/release-policy";
import { ChevronLeft, ChevronRight, Rocket, Wand2 } from "lucide-react";

export default function Landing() {
  useMetaTags({
    title: "Moodboard Studio — Platform Moodboard Profesional untuk Arsitek & Desainer Interior",
    description: "Ubah board Pinterest menjadi presentasi desain profesional dalam hitungan menit. Import otomatis, AI descriptions, multi-layout canvas, PDF export berkualitas tinggi. Gratis selama beta publik.",
    keywords: "moodboard, arsitektur, desain interior, presentasi desain, pinterest import, moodboard builder, studio arsitektur, desainer interior, PDF export, AI description",
    ogTitle: "Moodboard Studio — Moodboard Profesional dalam Hitungan Menit",
    ogDescription: "Buat, edit, dan ekspor moodboard desain interior dan arsitektur. Gratis selama beta publik Moodboard Studio.",
    ogUrl: "https://moodboard.co.id",
    canonical: "https://moodboard.co.id",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem("affiliate_ref", refCode);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <BrandLogo className="w-8 h-8 rounded-lg" />
            <span className="font-serif text-lg font-semibold tracking-tight" data-testid="text-brand-name">
              Moodboard Studio
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground transition-colors" data-testid="link-features">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors" data-testid="link-how-it-works">
              How It Works
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors" data-testid="link-pricing">
              Public Beta
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/sign-in">
              <Button variant="outline" data-testid="button-login">
                Log In
              </Button>
            </a>
            <a href="/sign-up" className="hidden sm:block">
              <Button data-testid="button-get-started">
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative pb-24 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, hsl(24 85% 52%) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, hsl(24 85% 52%) 0%, transparent 70%)" }} />

        <div className="relative w-full">
          <HeroBanner />
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              Turn design references into
              <span className="block" style={{ color: "hsl(24 85% 52%)" }}>client-ready Moodboard Presentation</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed mb-8">
              A studio-grade moodboard builder that turns your design inspirations
              into professional, export-ready presentations with AI-powered descriptions.
            </p>
            <div className="flex flex-wrap items-center justify-start gap-3 mb-8">
              <a href="/sign-up">
                <Button size="lg" data-testid="button-hero-cta">
                  Start Creating Free
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
              <a href="#features">
                <Button size="lg" variant="outline" data-testid="button-hero-features">
                  Explore Features
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-6">
              {[PUBLIC_BETA_LABEL, "No credit card", "AI-powered"].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "hsl(24 85% 52%)" }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 max-w-4xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12">
              {[
                { icon: Image, label: "Multi-layout canvas", desc: "Masonry, grid, vertical & landscape" },
                { icon: LayoutGrid, label: "Multi-page layout", desc: "Organize across multiple pages" },
                { icon: Sparkles, label: "AI descriptions", desc: "Auto-generate pin descriptions" },
                { icon: Download, label: "PDF export ready", desc: "Client-ready presentations" },
              ].map((item, i) => (
                <Card key={i} className="p-4" data-testid={`badge-feature-${i}`}>
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mb-2">
                    <item.icon className="w-5 h-5" style={{ color: "hsl(24 85% 52%)" }} />
                  </div>
                  <p className="text-sm font-semibold mb-0.5">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{item.desc}</p>
                </Card>
              ))}
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-md blur-2xl" />
              <Card className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: "hsl(24 85% 52%)" }}>Import from anywhere</p>
                    <h3 className="text-xl font-bold mb-2">Paste a URL, get a moodboard</h3>
                    <p className="text-sm text-muted-foreground mb-4">Copy & paste board or project URLs from your favorite platforms. We extract all images automatically.</p>
                    <div className="flex items-center justify-start gap-2 text-xs text-muted-foreground">
                      <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                      <span>Simply paste the URL and we handle the rest</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    {[
                      { icon: SiPinterest, name: "Pinterest", color: "#E60023" },
                      { icon: SiBehance, name: "Behance", color: "#1769FF" },
                      { icon: SiDribbble, name: "Dribbble", color: "#EA4C89" },
                      { icon: Globe, name: "Any Portfolio URL", color: "hsl(24 85% 52%)" },
                    ].map((src, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-md bg-muted/50 border border-border/40" data-testid={`badge-source-${i}`}>
                        <src.icon className="w-5 h-5 shrink-0" style={{ color: src.color }} />
                        <span className="text-sm font-medium">{src.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <Badge variant="secondary" className="text-xs font-medium tracking-wider uppercase mb-4">
              Layout Options
            </Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Multiple canvas layouts to match your vision
            </h2>
            <p className="text-muted-foreground text-lg">
              Choose from masonry, square, vertical, or landscape layouts. Each canvas is fully customizable for your project needs.
            </p>
          </div>

          <div className="mb-6">
            <Card className="hover-elevate group" data-testid="card-layout-cover">
              <div className="relative p-4 pb-0 flex flex-col items-center">
                <img
                  src="/images/layout-cover.png"
                  alt="Professional cover page layout"
                  className="w-full h-auto max-h-[400px] object-contain rounded-sm transition-transform duration-500 group-hover:scale-[1.02]"
                  data-testid="img-layout-cover"
                />
              </div>
              <div className="p-4 pt-3">
                <p className="font-semibold text-base">Cover Page</p>
                <p className="text-muted-foreground text-sm">Professional cover with studio branding, hero image, and project details</p>
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { src: "/images/layout-masonry.png", label: "Masonry Layout", desc: "Dynamic heights for a natural, Pinterest-style flow" },
              { src: "/images/layout-square.png", label: "Square Grid", desc: "Uniform tiles for a clean, organized presentation" },
              { src: "/images/layout-landscape.png", label: "Landscape / 3 Columns", desc: "Panoramic views for exteriors and wide spaces" },
              { src: "/images/layout-vertical.png", label: "Vertical / 5 Columns", desc: "Tall images for interiors, facades, and details" },
            ].map((layout, i) => (
              <Card key={i} className="hover-elevate group" data-testid={`card-layout-${i}`}>
                <div className="relative p-3 pb-0 flex flex-col items-center">
                  <img
                    src={layout.src}
                    alt={`${layout.label} layout example`}
                    className="w-full h-auto max-h-[300px] object-contain rounded-sm transition-transform duration-500 group-hover:scale-[1.02]"
                    data-testid={`img-layout-${i}`}
                  />
                </div>
                <div className="p-3 pt-2">
                  <p className="font-semibold text-sm">{layout.label}</p>
                  <p className="text-muted-foreground text-xs">{layout.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <Badge variant="secondary" className="text-xs font-medium tracking-wider uppercase mb-4">
              Studio Features
            </Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything your studio needs
            </h2>
            <p className="text-muted-foreground text-lg">
              From Pinterest import to client-ready PDF export, all in one professional workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: LayoutGrid, title: "Pinterest Import", desc: "Paste a Pinterest board URL and import all pins automatically with smart filtering and caching." },
              { icon: Sparkles, title: "AI Descriptions", desc: "Generate professional image captions and project descriptions powered by AI in one click." },
              { icon: Palette, title: "Color Palette", desc: "Auto-extract dominant colors from each image. Visualize your project's color story at a glance." },
              { icon: FileText, title: "PDF Export", desc: "Export print-ready PDFs in A4, A3, or A2 with cover pages, signatures, and studio branding." },
              { icon: Share2, title: "Share & Present", desc: "Generate shareable preview links. Send presentations via WhatsApp or email to clients." },
              { icon: Zap, title: "Lead Tracking", desc: "Label projects as Hot, Warm, or Cold. Track your design pipeline and follow up with clients." },
              { icon: Monitor, title: "Multi-Layout Canvas", desc: "Choose between grid and masonry layouts. Adjust columns, spacing, and image aspect ratios." },
              { icon: Image, title: "Cover Pages", desc: "Professional cover pages with studio logo, project details, and full-bleed hero images." },
              { icon: Star, title: "Drag & Drop Editor", desc: "Reorder images, approve or reject selections, and organize pages with intuitive drag-and-drop." },
            ].map((feature, i) => (
              <Card key={i} className="hover-elevate glass group" data-testid={`card-feature-${i}`}>
                <CardContent className="pt-6 pb-6">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5" style={{ color: "hsl(24 85% 52%)" }} />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <Badge variant="secondary" className="text-xs font-medium tracking-wider uppercase mb-4">
              How It Works
            </Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              From inspiration to presentation in minutes
            </h2>
            <p className="text-muted-foreground text-lg">
              Three simple steps to create stunning design presentations your clients will love.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
            {[
              {
                step: "01",
                title: "Import & Curate",
                desc: "Paste your Pinterest board URL. We import all images, filter out noise, and organize them into a beautiful canvas.",
              },
              {
                step: "02",
                title: "Edit & Describe",
                desc: "Drag, reorder, and approve your selections. Let AI generate professional captions or write your own.",
              },
              {
                step: "03",
                title: "Export & Share",
                desc: "Export as print-ready PDF with cover page and studio branding. Share a live preview link with your client.",
              },
            ].map((item, i) => (
              <Card key={i} className="glass relative overflow-visible" data-testid={`card-step-${i}`}>
                <div className="absolute -top-4 left-6">
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {item.step}
                  </div>
                </div>
                <CardContent className="pt-10 pb-6">
                  <h3 className="font-semibold text-base mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 via-transparent to-primary/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-md overflow-hidden glass">
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10" />
                <img
                  src="/images/hero-studio.png"
                  alt="Design studio workspace"
                  className="w-full h-auto object-cover"
                  data-testid="img-studio"
                />
              </div>
            </div>
            <div className="space-y-6">
              <Badge variant="secondary" className="text-xs font-medium tracking-wider uppercase">
                Built for Professionals
              </Badge>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
                Designed for design studios
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Every feature is built with architecture and interior design studios in mind.
                Your presentations look professional from the first click.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Studio logo branding",
                  "16 professional fonts",
                  "Multi-page layouts",
                  "Client signature area",
                  "Cover page design",
                  "Dark mode support",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(24 85% 52%)" }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/sign-up">
                <Button size="lg" data-testid="button-try-free">
                  Try Free for 7 Days
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-10">
            <Badge variant="secondary" className="text-xs font-medium tracking-wider uppercase mb-4">
              {FREE_PUBLIC_BETA ? PUBLIC_BETA_LABEL : "Moodboard Studio"}
            </Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Create and present during the free beta
            </h2>
            <p className="text-muted-foreground text-lg">
              Moodboard Studio is free during the public beta. No credit card is required, and new paid purchases are paused.
            </p>
          </div>
          <Card className="glass max-w-4xl border-primary/30" data-testid="card-free-public-beta">
            <CardContent className="p-6 sm:p-8">
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                {[
                  { title: "Save your references", text: "Organize selected images into private moodboards." },
                  { title: "Refine the presentation", text: "Edit layouts, design briefs, and captions." },
                  { title: "Export a PDF", text: "Prepare a presentation from your saved references." },
                ].map(item => <div key={item.title}>
                  <CheckCircle2 className="w-5 h-5 text-primary mb-2" />
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>)}
              </div>
              <div className="flex flex-wrap gap-3 mb-5">
                <a href="/sign-up"><Button data-testid="button-join-public-beta">Join the free beta<ArrowRight className="w-4 h-4 ml-1" /></Button></a>
                <a href="/chatgpt"><Button variant="outline" data-testid="button-beta-chatgpt-guide">Use with ChatGPT</Button></a>
              </div>
              <p className="text-xs text-muted-foreground">Reference and export limits apply. ChatGPT access depends on your OpenAI account and plan. Any future Moodboard pricing will be announced before you choose a paid offering.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6 text-left">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Ready to impress your clients?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl">
            Join design studios already creating professional moodboard presentations.
          </p>
          <a href="/sign-up">
            <Button size="lg" data-testid="button-bottom-cta">
              Start Creating Free
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </a>
        </div>
      </section>

      <PromoBannerSlider />

      <LandingBanners />

      <section className="py-16 border-t border-border/50" data-testid="section-affiliate-program">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-10">
            <Badge variant="secondary" className="mb-3">Partner With Us</Badge>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Affiliate Program
            </h2>
            <p className="text-muted-foreground max-w-2xl">
              Invite fellow designers to explore Moodboard Studio. During the free public beta, new paid purchases are paused; existing referral records remain available in your account.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            <Card>
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                  <Share2 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Share Your Link</h3>
                <p className="text-xs text-muted-foreground">
                  Use your referral link to introduce Moodboard Studio to your network.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Studios Sign Up</h3>
                <p className="text-xs text-muted-foreground">
                  Invite designers to create an account and try the free public beta.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Review Your Referrals</h3>
                <p className="text-xs text-muted-foreground">
                  View existing referral activity and prior commission records in your affiliate dashboard.
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Sign up or log in to access your account and existing affiliate records.
            </p>
            <a href="/sign-up">
              <Button data-testid="button-affiliate-signup">
                Sign Up / Login
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BrandLogo className="w-6 h-6 rounded-lg" />
                <span className="font-serif text-sm font-medium">Moodboard Studio</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/privacy" className="text-xs text-muted-foreground hover:underline" data-testid="link-footer-privacy">Privacy Policy</Link>
                <Link href="/terms" className="text-xs text-muted-foreground hover:underline" data-testid="link-footer-terms">Terms of Service</Link>
                <Link href="/faq" className="text-xs text-muted-foreground hover:underline" data-testid="link-footer-faq">FAQ</Link>
                <Link href="/contact" className="text-xs text-muted-foreground hover:underline" data-testid="link-footer-contact">Contact</Link>
                <Link href="/blog" className="text-xs text-muted-foreground hover:underline" data-testid="link-footer-blog">Blog</Link>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Moodboard Studio. Built for architecture & interior studios.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PromoBannerSlider() {
  const [current, setCurrent] = useState(0);

  const slides = [
    {
      id: "beta",
      icon: Sparkles,
      title: PUBLIC_BETA_LABEL,
      description: "Moodboard Studio gratis selama beta publik. Buat, edit, dan ekspor moodboard Anda. Akses ChatGPT mengikuti akun dan paket OpenAI Anda.",
      gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    },
    {
      id: "speed",
      icon: Rocket,
      title: "Speed Up Your Deal with Client",
      description: "Moodboard Studio is the solution for speed up your deal with client. Create professional presentations in minutes, not hours.",
      gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    },
    {
      id: "ai",
      icon: Wand2,
      title: "Fully AI Generated Description",
      description: "Biarkan AI menulis deskripsi profesional untuk setiap gambar di moodboard Anda. Hemat waktu, tingkatkan kualitas presentasi.",
      gradient: "from-purple-500/20 via-pink-500/10 to-transparent",
    },
  ];

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];
  const SlideIcon = slide.icon;

  return (
    <section className="py-12 border-t border-border/50" data-testid="section-promo-banners">
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative">
          <Card className="overflow-visible">
            <CardContent className="p-0">
              <div className={`relative rounded-xl overflow-hidden bg-gradient-to-r ${slide.gradient}`}>
                <div className="p-8 sm:p-10 min-h-[200px] flex flex-col justify-center">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <SlideIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight mb-2" data-testid={`text-promo-title-${slide.id}`}>
                        {slide.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                        {slide.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <a href="/sign-up">
                      <Button data-testid={`button-promo-cta-${slide.id}`}>
                        Join the free beta
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="absolute top-1/2 -translate-y-1/2 -left-4 z-10">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full bg-background/80 backdrop-blur-sm"
              onClick={prev}
              data-testid="button-promo-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 -right-4 z-10">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full bg-background/80 backdrop-blur-sm"
              onClick={next}
              data-testid="button-promo-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-start gap-2 mt-4">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-primary w-6" : "bg-muted-foreground/30"}`}
              data-testid={`button-promo-dot-${i}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingBanners() {
  const { data: banners = [] } = useQuery<any[]>({
    queryKey: ["/api/affiliate/banners"],
  });

  const landingBanners = banners.filter((b: any) =>
    b.position === "landing" || b.position === "both"
  );

  if (landingBanners.length === 0) return null;

  return (
    <section className="py-12 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {landingBanners.map((b: any) => (
            <a
              key={b.id}
              href={b.linkUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              data-testid={`landing-banner-${b.id}`}
            >
              <Card className="overflow-visible hover-elevate h-full">
                <CardContent className="p-4 flex flex-col gap-3">
                  {b.imageUrl && (
                    <img src={b.imageUrl} alt={b.title} className="w-full h-32 object-cover rounded-md" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary mt-auto">
                    <span>Learn more</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
