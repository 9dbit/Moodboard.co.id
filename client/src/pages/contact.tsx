import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, Mail, MessageSquare, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMetaTags } from "@/hooks/use-meta-tags";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
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
        <p className="text-muted-foreground mb-8">We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card className="glass">
              <CardContent className="pt-6 pb-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Name</label>
                      <Input
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Email</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Subject</label>
                    <Input
                      placeholder="How can we help?"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      data-testid="input-contact-subject"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Message</label>
                    <Textarea
                      placeholder="Tell us more about your inquiry..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      className="min-h-[120px]"
                      data-testid="input-contact-message"
                    />
                  </div>
                  <Button type="submit" className="w-full sm:w-auto" data-testid="button-send-message">
                    Send Message
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
                    <h3 className="font-medium text-sm mb-1">Email</h3>
                    <p className="text-sm text-muted-foreground">support@moodboardstudio.com</p>
                    <p className="text-xs text-muted-foreground mt-1">We respond within 24 hours</p>
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
                    <h3 className="font-medium text-sm mb-1">WhatsApp</h3>
                    <p className="text-sm text-muted-foreground">+62 812 3456 7890</p>
                    <p className="text-xs text-muted-foreground mt-1">Mon-Fri, 9AM-5PM WIB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" style={{ color: "hsl(24 85% 52%)" }} />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Location</h3>
                    <p className="text-sm text-muted-foreground">Jakarta, Indonesia</p>
                    <p className="text-xs text-muted-foreground mt-1">Remote-first team</p>
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
