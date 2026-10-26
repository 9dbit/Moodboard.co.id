import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useMetaTags } from "@/hooks/use-meta-tags";

export default function Terms() {
  useMetaTags({
    title: "Terms of Service | Moodboard Studio",
    description: "Syarat dan ketentuan penggunaan Moodboard Studio. Aturan berlangganan, penggunaan layanan, hak kekayaan intelektual, dan kebijakan pembatalan.",
    keywords: "terms of service, syarat ketentuan, moodboard studio, subscription",
    canonical: "https://moodboard.co.id/terms",
    ogUrl: "https://moodboard.co.id/terms",
  });
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <BrandLogo className="w-8 h-8 rounded-lg" />
              <span className="font-serif text-lg font-semibold tracking-tight">Moodboard Studio</span>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Button>
        </Link>

        <h1 className="font-serif text-3xl font-bold mb-2" data-testid="text-page-title">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 8, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Moodboard Studio, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform. These terms apply to all users, including visitors, registered users, and subscribers.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Moodboard Studio is a web-based platform that enables architecture and interior design professionals to create, edit, and export moodboard presentations. Our services include image import from external sources, AI-powered description generation, multi-layout canvas editing, PDF export, and share link generation.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">4. Subscription Plans & Payments</h2>
            <p className="text-muted-foreground leading-relaxed">
              Moodboard Studio offers a free trial period and paid subscription plans. Free trial users are limited to 3 projects with a light watermark on exports. Paid plans (Studio Lite and Studio Pro) offer expanded project limits and additional features. Subscription fees are billed monthly and are non-refundable unless otherwise required by law.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of all content you create or import into Moodboard Studio, including moodboards, project configurations, and uploaded logos. The Moodboard Studio platform, including its design, code, features, and branding, is our intellectual property and is protected by applicable laws.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">6. Content & Image Usage</h2>
            <p className="text-muted-foreground leading-relaxed">
              When importing images from external platforms (Pinterest, Behance, Dribbble, etc.), you are responsible for ensuring you have appropriate rights or licenses to use those images. Moodboard Studio acts as a tool for organizing and presenting images and does not claim ownership or verify copyright of imported content. You agree to use imported content in compliance with the source platform's terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">7. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our AI description features generate text based on image analysis. While we strive for accuracy, AI-generated descriptions may not always be perfect. You are responsible for reviewing and editing AI-generated content before sharing with clients or using in professional contexts.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">8. Prohibited Uses</h2>
            <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Attempt to reverse-engineer, decompile, or hack any part of the platform</li>
              <li>Upload or import content that infringes on others' intellectual property rights</li>
              <li>Use automated scripts or bots to access the service beyond normal usage</li>
              <li>Resell or redistribute the service without written permission</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Moodboard Studio is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability shall not exceed the amount you paid for the service in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to terminate or suspend your account at any time for violation of these terms. Upon termination, your right to use the service ceases immediately. You may export your data before account termination.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these terms at any time. Material changes will be communicated via email or platform notification. Continued use after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">12. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these terms, please visit our <Link href="/contact" className="underline" style={{ color: "hsl(24 85% 52%)" }}>Contact page</Link> or email us at support@moodboardstudio.com.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <BrandLogo className="w-6 h-6 rounded-lg" />
                <span className="font-serif text-sm font-medium">Moodboard Studio</span>
              </div>
            </Link>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/privacy" className="text-xs text-muted-foreground hover:underline">Privacy Policy</Link>
              <Link href="/faq" className="text-xs text-muted-foreground hover:underline">FAQ</Link>
              <Link href="/contact" className="text-xs text-muted-foreground hover:underline">Contact</Link>
              <Link href="/blog" className="text-xs text-muted-foreground hover:underline">Blog</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
