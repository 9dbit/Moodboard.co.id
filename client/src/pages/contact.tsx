import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, Mail, MessageSquare, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMetaTags } from "@/hooks/use-meta-tags";
import { apiRequest } from "@/lib/queryClient";

export default function Contact() {
  useMetaTags({
    title: "Hubungi Kami | Moodboard Studio",
    description: "Hubungi tim Moodboard Studio untuk pertanyaan, dukungan teknis, atau informasi kerjasama. Kami siap membantu studio arsitektur dan desain interior Anda.",
    keywords: "contact, hubungi kami, moodboard studio, support, customer service",
    canonical: "https://moodboard.co.id/contact",
    ogUrl: "https://moodboard.co.id/contact",
  });
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setSendError(null);
    setReceipt(null);
    try {
      const response = await apiRequest("POST", "/api/contact", { requestId, name, email, subject, message });
      const result = await response.json();
      if (!result.received || !result.reference) throw new Error("The server did not confirm receipt. Please try again.");
      setReceipt(result.reference);
      toast({ title: "Message received", description: "Your message has been saved for the support team." });
      setName(""); setEmail(""); setSubject(""); setMessage("");
      setRequestId(crypto.randomUUID());
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Please try again.";
      const match = raw.match(/\{.*\}$/s);
      let detail = "Your message could not be saved. Please try again; your text is still here.";
      try { if (match) detail = JSON.parse(match[0]).message || detail; } catch {}
      setSendError(detail);
    } finally { setIsSending(false); }
  };

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

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Button>
        </Link>

        <h1 className="font-serif text-3xl font-bold mb-2" data-testid="text-page-title">Contact Us</h1>
        <p className="text-muted-foreground mb-8">Send a support, account access, or privacy request. For ChatGPT connection issues, include the account email you intended to connect and the error you saw. Do not include passwords, API keys, or private download links.</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card className="glass">
              <CardContent className="pt-6 pb-6">
                <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSending}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Name</label>
                      <Input
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setRequestId(crypto.randomUUID()); }}
                        required
                        maxLength={120}
                        disabled={isSending}
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Email</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setRequestId(crypto.randomUUID()); }}
                        required
                        maxLength={254}
                        disabled={isSending}
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Subject</label>
                    <Input
                      placeholder="How can we help?"
                      value={subject}
                      onChange={(e) => { setSubject(e.target.value); setRequestId(crypto.randomUUID()); }}
                      required
                      maxLength={200}
                      disabled={isSending}
                      data-testid="input-contact-subject"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Message</label>
                    <Textarea
                      placeholder="Tell us more about your inquiry..."
                      value={message}
                      onChange={(e) => { setMessage(e.target.value); setRequestId(crypto.randomUUID()); }}
                      required
                      minLength={10}
                      maxLength={10000}
                      disabled={isSending}
                      className="min-h-[120px]"
                      data-testid="input-contact-message"
                    />
                  </div>
                  {sendError && <p role="alert" className="text-sm text-destructive" data-testid="contact-send-error">{sendError}</p>}
                  {receipt && <p role="status" className="text-sm text-muted-foreground" data-testid="contact-receipt">Message received. Reference: {receipt}</p>}
                  <Button type="submit" disabled={isSending} className="w-full sm:w-auto" data-testid="button-send-message">
                    {isSending ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" style={{ color: "hsl(24 85% 52%)" }} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Support inbox</h3>
                    <p className="text-sm text-muted-foreground">Send your message using this form.</p>
                    <p className="text-xs text-muted-foreground mt-1">You receive a reference when it has been saved.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" style={{ color: "hsl(24 85% 52%)" }} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Reply details</h3>
                    <p className="text-sm text-muted-foreground">Include an email address where we can reach you.</p>
                    <p className="text-xs text-muted-foreground mt-1">Keep your message reference for follow-up.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" style={{ color: "hsl(24 85% 52%)" }} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">ChatGPT help</h3>
                    <p className="text-sm text-muted-foreground"><Link href="/chatgpt" className="underline">Read the connection and PDF export guide.</Link></p>
                    <p className="text-xs text-muted-foreground mt-1">You can manage or revoke connections from your Moodboard Profile.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
              <Link href="/terms" className="text-xs text-muted-foreground hover:underline">Terms of Service</Link>
              <Link href="/faq" className="text-xs text-muted-foreground hover:underline">FAQ</Link>
              <Link href="/blog" className="text-xs text-muted-foreground hover:underline">Blog</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
