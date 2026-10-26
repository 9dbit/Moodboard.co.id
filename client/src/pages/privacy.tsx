import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useMetaTags } from "@/hooks/use-meta-tags";

export default function Privacy() {
  useMetaTags({
    title: "Privacy Policy | Moodboard Studio",
    description: "Kebijakan privasi Moodboard Studio. Pelajari bagaimana kami mengumpulkan, menggunakan, dan melindungi data Anda saat menggunakan platform moodboard profesional kami.",
    keywords: "privacy policy, kebijakan privasi, moodboard studio, data protection",
    canonical: "https://moodboard.co.id/privacy",
    ogUrl: "https://moodboard.co.id/privacy",
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

        <h1 className="font-serif text-3xl font-bold mb-2" data-testid="text-page-title">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 8, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you use Moodboard Studio, we collect information you provide directly to us, including your name, email address, and profile information through our authentication system. We also collect data related to your usage of our platform, including project data, imported images, and interaction patterns to improve our services.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Provide, maintain, and improve our moodboard creation services</li>
              <li>Process and manage your projects, pins, and exported presentations</li>
              <li>Generate AI-powered descriptions for your images and projects</li>
              <li>Send you technical notices, updates, and support communications</li>
              <li>Monitor and analyze trends, usage, and activities on our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">3. Image Storage & Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Images imported from Pinterest, Behance, Dribbble, or other sources are stored on our secure cloud infrastructure. We process images for display optimization and AI description generation. We do not claim ownership of your imported content. You retain all rights to your original creative work and curated selections.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">4. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We may share information with third-party service providers who assist in operating our platform, including cloud hosting, AI processing (OpenAI), and analytics services. When you use the share feature, your moodboard becomes accessible via a unique link to anyone who has it.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure authentication, and regular security audits. However, no method of electronic transmission or storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to access, update, or delete your personal information at any time. You can delete your projects and associated data through your dashboard. For account deletion requests, please contact us through our Contact page.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">7. Cookies & Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to maintain your session and preferences (such as dark/light mode). We may use analytics cookies to understand how our platform is used. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">8. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">9. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this privacy policy, please visit our <Link href="/contact" className="underline" style={{ color: "hsl(24 85% 52%)" }}>Contact page</Link> or email us at support@moodboardstudio.com.
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
              <Link href="/terms" className="text-xs text-muted-foreground hover:underline">Terms of Service</Link>
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
