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
    answer: "Moodboard Studio is a professional web-based moodboard builder designed specifically for architecture and interior design studios. It helps you transform Pinterest boards and other design inspirations into client-ready presentations with AI-powered descriptions, multi-layout canvases, and PDF export.",
  },
  {
    question: "How do I import images from Pinterest?",
    answer: "Simply paste your Pinterest board URL into the import dialog in the editor. Our system automatically scrapes the board, filters out profile pictures and irrelevant images, and imports high-resolution pins directly into your moodboard canvas. You can also import from Behance, Dribbble, and other portfolio websites.",
  },
  {
    question: "What layout options are available?",
    answer: "We offer four main layout modes: Square (uniform grid), Vertical/Portrait (3:4 ratio), Landscape/Wide (4:3 ratio), and Original/Masonry (preserves natural image proportions with dynamic heights). You can also choose between 1-6 columns and customize spacing, paper size (A4, A3, A2), and orientation (portrait or landscape).",
  },
  {
    question: "How does the AI description feature work?",
    answer: "Our AI uses OpenAI's GPT-4o-mini model to analyze your images and generate professional design descriptions. You can generate descriptions for individual images, all images at once, or create concept descriptions for entire pages using keywords. The AI understands architectural and interior design terminology.",
  },
  {
    question: "Can I export my moodboard as a PDF?",
    answer: "Yes! You can export high-quality PDFs in A4, A3, or A2 paper sizes. The PDF includes your cover page with studio logo, all moodboard pages with images and descriptions, client information, and signature areas. The export exactly matches what you see on the canvas.",
  },
  {
    question: "How does the sharing feature work?",
    answer: "Each project can generate a unique share link that displays your moodboard exactly as it appears on canvas. You can send this link via WhatsApp, email, or copy it directly. Recipients don't need an account to view the shared moodboard.",
  },
  {
    question: "What is the Free Trial?",
    answer: "The free trial gives you 7 days of full access to all features with a limit of 3 projects. Exported PDFs will have a light watermark during the trial period. No credit card is required to start.",
  },
  {
    question: "Can I use my own studio logo?",
    answer: "Absolutely! You can upload your studio logo in the project settings. The logo appears on the cover page, canvas header, and PDF exports, giving your presentations a professional, branded look.",
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
    answer: "Yes! We support unlimited undo/redo. Use Ctrl+Z to undo and Ctrl+Shift+Z or Ctrl+Y to redo. Every action including drag-and-drop reordering, image additions, deletions, and description changes can be undone.",
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
