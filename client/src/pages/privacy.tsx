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
        <p className="text-sm text-muted-foreground mb-8">Last updated: October 28, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We store information you provide to use Moodboard Studio, including your account name and email address, optional profile details, project briefs and layouts, reference images and source links, captions, and uploaded logos. We also store subscription and transaction records when applicable, support messages you submit, and operational records used to run and protect the service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Provide, maintain, and improve our moodboard creation services</li>
              <li>Process and manage your projects, pins, and exported presentations</li>
              <li>Generate AI-powered descriptions for your images and projects</li>
              <li>Handle account access, subscriptions, and support requests</li>
              <li>Diagnose errors, enforce access permissions, and limit abusive requests</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">3. Image Storage & Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Uploaded and imported reference images are stored on cloud infrastructure and processed for display and PDF export. When you request AI image descriptions, relevant images and instructions are sent to the AI provider for that task. We do not claim ownership of imported images; you remain responsible for holding the rights needed to use them.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">4. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We use service providers for hosting, database and file storage, AI processing through OpenAI, and account email delivery when configured. Relevant data is processed by these providers to perform the requested service. If you enable a share link on the website, anyone who has that link can view the shared moodboard while the link remains valid. Connecting ChatGPT does not enable public sharing of your boards.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use HTTPS, hashed account passwords, and account-based access checks for private boards and reference images. Connection tokens are stored as hashes and checked against the permissions you approved. No method of electronic transmission or storage is completely secure.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">6. ChatGPT Connections</h2>
            <p className="text-muted-foreground leading-relaxed">
              Connecting ChatGPT requires signing in on Moodboard Studio and approving access. Depending on the permissions requested, ChatGPT can read the connected account's boards and reference images, create or edit boards and captions, and generate PDF exports. It can receive board briefs and settings, reference titles, captions and source links, image content you request it to inspect, and temporary PDF download links. Other users' private accounts are not included in this authorization. Your Moodboard password is never shared with ChatGPT.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You can revoke connections from your <Link href="/profile" className="underline">Profile</Link>; resetting your password also invalidates existing connection credentials. Revocation stops future access through that connection. Information already received by ChatGPT or downloaded by a recipient remains subject to that recipient's settings and policies, including OpenAI's policies for ChatGPT.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">7. Retention and Your Choices</h2>
            <p className="text-muted-foreground leading-relaxed">
              Saved boards and references are kept so you can return to them. Deleting a project or reference through the website removes its dashboard record. Stored image files and operational records can remain after that action. For account deletion, stored-file removal, access or correction requests, use our <Link href="/contact" className="underline">Contact page</Link> so we can verify the account and handle your request.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Import previews expire after 30 minutes. Server-generated PDF exports expire 24 hours after the export request and are removed during scheduled cleanup; individual download links expire after 15 minutes. Anyone who receives a valid PDF link can use it until it expires, so share it only with intended recipients. A new link can be requested while its export remains available. Copies you download are under your control.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              OAuth access tokens last one hour, refresh tokens up to 30 days, and pending authorization requests up to 10 minutes. Expired authorization records are cleaned during application maintenance. Support messages are retained to handle your request; you may request their removal through the Contact page.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">8. Cookies & Browser Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to maintain your signed-in session and interface state. Browser storage remembers preferences such as the theme and editor description mode, and referral or promotion codes when you use those links or offers. You can clear cookies and browser storage in your browser settings; doing so may sign you out or reset preferences.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              Send privacy questions, access requests, or deletion requests through our <Link href="/contact" className="underline" style={{ color: "hsl(24 85% 52%)" }}>Contact page</Link>. The form shows a reference after your message has been saved. Include an email address where we can reply, but do not include passwords or API keys.
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
