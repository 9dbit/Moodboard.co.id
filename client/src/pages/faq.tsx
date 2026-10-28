import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useMetaTags } from "@/hooks/use-meta-tags";

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="glass">
      <button
        className="w-full text-left px-6 py-4 flex items-start justify-between gap-4"
        onClick={() => setOpen(!open)}
        data-testid={`faq-toggle-${question.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="font-medium text-sm" data-testid={`text-faq-q-${question.slice(0, 15).replace(/\s/g, "-").toLowerCase()}`}>{question}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 mt-0.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <CardContent className="pt-0 pb-4 px-6">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-faq-a-${question.slice(0, 15).replace(/\s/g, "-").toLowerCase()}`}>{answer}</p>
        </CardContent>
      </div>
    </Card>
  );
}

const faqData = [
  {
    question: "What is Moodboard Studio?",
    answer: "Moodboard Studio helps architecture and interior design studios organize selected references into saved moodboards, edit layouts and captions, and export PDF presentations. You can work in the website editor or connect your account to the Moodboard Studio ChatGPT plugin.",
  },
  {
    question: "How do I add reference images?",
    answer: "Upload your reference images in the website editor or provide selected direct HTTPS image URLs. The website also offers a Pinterest import flow for supported public boards; availability depends on the source website. The ChatGPT plugin adds selected image URLs and does not search Pinterest or import whole Pinterest boards. Use images you have permission to use.",
  },
  {
    question: "What layout options are available?",
    answer: "Choose original proportions, square, portrait, tall, landscape, or wide image layouts, with 2–5 columns. Boards support A4, A3, and A2 paper sizes and portrait or landscape orientation. The website editor offers additional presentation controls; the server PDF uses a compact template.",
  },
  {
    question: "How does the AI description feature work?",
    answer: "When you request AI descriptions on the website, relevant images and instructions are sent to OpenAI to suggest design text. Review and edit the results before using them professionally. In ChatGPT, you can ask to inspect an existing reference and save a caption based on visible details.",
  },
  {
    question: "Can I export my moodboard as a PDF?",
    answer: "Yes. The website editor offers browser PDF export for its presentation styling. ChatGPT can generate a complete PDF using a compact server template, which can differ from the website theme. Server exports require 1–500 available references and respect file-size limits. Temporary exports expire 24 hours after the request, and each download link lasts 15 minutes. Read the ChatGPT guide for details.",
  },
  {
    question: "How does the sharing feature work?",
    answer: "Each project can generate a unique share link that displays your moodboard exactly as it appears on canvas. You can send this link via WhatsApp, email, or copy it directly. Recipients don't need an account to view the shared moodboard.",
  },
  {
    question: "Is Moodboard Studio free during the public beta?",
    answer: "Yes. Moodboard Studio is free during the public beta and new paid purchases are paused. No credit card is required for the beta. Operational limits still apply, including reference-image and PDF export limits. ChatGPT access is separate and depends on your OpenAI account and plan. Any future Moodboard pricing will be announced before you choose a paid offering.",
  },
  {
    question: "Can I use my own studio logo?",
    answer: "You can upload a studio logo and configure branding in the website editor. Website and browser-export styling can differ from the compact ChatGPT server PDF template; check the output before sharing it.",
  },
  {
    question: "What fonts are available?",
    answer: "We offer 16 professional fonts including Montserrat, Playfair Display, Inter, Roboto, Lato, Open Sans, Raleway, Merriweather, Poppins, Nunito, Work Sans, DM Sans, Source Sans Pro, Cormorant Garamond, Libre Baskerville, and Josefin Sans.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use encrypted connections (HTTPS), secure authentication, and industry-standard cloud storage for all your data. Your projects and images are private and only accessible through your account or share links you explicitly create.",
  },
  {
    question: "Can I undo changes in the editor?",
    answer: "The website editor keeps an undo/redo history for supported editing actions. Use Ctrl+Z to undo and Ctrl+Shift+Z or Ctrl+Y to redo while working in the editor. ChatGPT changes are saved to your account; ask for the specific correction you want rather than relying on browser undo for those changes.",
  },
  {
    question: "Does Moodboard Studio support dark mode?",
    answer: "Yes, Moodboard Studio fully supports dark mode. You can toggle between light and dark themes at any time. Both modes are designed to look professional and reduce eye strain during long editing sessions.",
  },
];

export default function Faq() {
  useMetaTags({
    title: "FAQ | Moodboard Studio",
    description: "Pertanyaan yang sering diajukan tentang Moodboard Studio. Pelajari cara import Pinterest, layout options, AI descriptions, PDF export, dan fitur lainnya.",
    keywords: "FAQ, pertanyaan, moodboard studio, bantuan, help, tutorial",
    canonical: "https://moodboard.co.id/faq",
    ogUrl: "https://moodboard.co.id/faq",
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

        <h1 className="font-serif text-3xl font-bold mb-2" data-testid="text-page-title">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-8">Everything you need to know about Moodboard Studio.</p>

        <div className="space-y-3">
          {faqData.map((faq, i) => (
            <FaqItem key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Still have questions?</p>
          <Link href="/contact">
            <Button data-testid="button-contact-us">Contact Us</Button>
          </Link>
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
              <Link href="/contact" className="text-xs text-muted-foreground hover:underline">Contact</Link>
              <Link href="/blog" className="text-xs text-muted-foreground hover:underline">Blog</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
