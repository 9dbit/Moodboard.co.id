import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, ArrowRight, Calendar, Clock, User } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useMetaTags } from "@/hooks/use-meta-tags";
import blogImgPresentasi from "../assets/images/blog-moodboard-presentasi.png";
import blogImgPinterest from "../assets/images/blog-pinterest-moodboard.png";
import blogImgPerbandingan from "../assets/images/blog-perbandingan-platform.png";
import blogImgInterior from "../assets/images/blog-presentasi-interior.png";
import blogImgArsitektur from "../assets/images/blog-arsitektur-modern.png";

const blogPosts = [
  {
    id: "moodboard-presentasi-profesional",
    title: "Moodboard untuk Presentasi Profesional: Panduan Lengkap untuk Arsitek & Desainer Interior",
    excerpt: "Pelajari cara membuat moodboard yang memukau klien Anda. Dari konsep hingga presentasi akhir, panduan lengkap ini akan membantu studio Anda tampil lebih profesional.",
    date: "8 Februari 2026",
    readTime: "8 min",
    author: "Moodboard Studio",
    category: "Tutorial",
    image: blogImgPresentasi,
    content: `
## Mengapa Moodboard Penting untuk Studio Arsitektur?

Moodboard bukan sekadar kumpulan gambar — ini adalah alat komunikasi visual yang paling efektif antara desainer dan klien. Dalam dunia arsitektur dan desain interior, **presentasi moodboard yang profesional** bisa menjadi pembeda antara memenangkan atau kehilangan proyek.

### Apa Itu Moodboard?

Moodboard adalah kolase visual yang mengkombinasikan gambar, warna, tekstur, dan elemen desain lainnya untuk mengkomunikasikan visi desain. Untuk studio arsitektur dan interior, moodboard membantu:

- **Menyelaraskan visi** antara desainer dan klien sejak awal proyek
- **Menghemat waktu** dengan menghindari revisi berulang di tahap selanjutnya
- **Mempresentasikan konsep** dengan cara yang mudah dipahami non-desainer
- **Dokumentasi referensi** yang bisa dirujuk selama proses desain berlangsung

### Masalah dengan Moodboard Tradisional

Banyak desainer masih menggunakan metode manual: screenshot Pinterest, copy-paste ke PowerPoint atau Canva, lalu format satu per satu. Proses ini **memakan waktu berjam-jam** dan hasilnya sering terlihat tidak konsisten.

### Solusi: Moodboard Studio

Dengan **Moodboard Studio**, Anda cukup:
1. Paste URL board Pinterest Anda
2. Pilih layout yang sesuai (masonry, grid, portrait, landscape)
3. Biarkan AI menghasilkan deskripsi profesional
4. Export sebagai PDF siap presentasi

**Hasilnya?** Moodboard profesional dalam hitungan menit, bukan jam.

### Tips Membuat Moodboard yang Memukau

1. **Konsistensi visual** — Gunakan palet warna yang kohesif
2. **Hierarchy yang jelas** — Tempatkan gambar utama lebih besar
3. **Deskripsi yang informatif** — Jelaskan mengapa setiap elemen dipilih
4. **Branding studio** — Sertakan logo dan identitas studio Anda
5. **Layout yang rapi** — Gunakan grid atau masonry yang terstruktur

Dengan fitur multi-layout canvas, 16 font profesional, dan AI description, Moodboard Studio membantu studio Anda menghasilkan presentasi berkelas dunia.
    `,
  },
  {
    id: "pinterest-moodboard-instan",
    title: "Pinterest ke Moodboard Instan: Cara Tercepat Membuat Presentasi Desain dari Board Pinterest",
    excerpt: "Ubah board Pinterest Anda menjadi presentasi desain profesional hanya dalam beberapa klik. Tidak perlu download gambar satu per satu lagi.",
    date: "7 Februari 2026",
    readTime: "6 min",
    author: "Moodboard Studio",
    category: "Tips & Tricks",
    image: blogImgPinterest,
    content: `
## Dari Pinterest ke Presentasi dalam 5 Menit

Setiap desainer pasti punya board Pinterest yang penuh inspirasi. Masalahnya? **Mengubah board Pinterest menjadi presentasi profesional** biasanya memakan waktu lama.

### Cara Lama (Yang Menyita Waktu)

1. Buka Pinterest, screenshot satu per satu
2. Download gambar resolusi tinggi secara manual
3. Buka PowerPoint/Canva/InDesign
4. Paste gambar, atur ukuran, tambahkan deskripsi
5. Format ulang, perbaiki spacing, tambahkan logo
6. Export PDF

**Total waktu: 2-4 jam per presentasi**

### Cara Baru dengan Moodboard Studio

1. Copy URL board Pinterest
2. Paste di Moodboard Studio
3. Sistem otomatis mengimpor semua gambar
4. Pilih layout yang Anda suka
5. Klik "AI Describe All" untuk deskripsi otomatis
6. Export PDF

**Total waktu: 5-10 menit**

### Fitur Import yang Powerful

- **Auto-scraping**: Import semua gambar dari board Pinterest secara otomatis
- **Smart filtering**: Filter otomatis menghapus avatar, ikon, dan gambar yang tidak relevan
- **High-res import**: Mengambil versi resolusi tertinggi yang tersedia
- **Multi-source**: Tidak hanya Pinterest — juga Behance, Dribbble, dan website portfolio lainnya

### Mengapa Desainer Memilih Moodboard Studio?

Dibandingkan dengan cara manual atau platform lain, Moodboard Studio unggul karena:
- **Instant import** dari Pinterest (tanpa download manual)
- **AI-powered descriptions** yang memahami terminologi arsitektur
- **Multi-layout canvas** dengan 4 mode layout berbeda
- **PDF export** yang match 1:1 dengan tampilan canvas
- **Harga terjangkau** mulai Rp 88K/bulan
    `,
  },
  {
    id: "perbandingan-platform-moodboard",
    title: "Moodboard Studio vs Canva vs Milanote vs Pinterest Sections: Perbandingan Lengkap 2026",
    excerpt: "Perbandingan detail fitur, harga, dan kemudahan penggunaan antara Moodboard Studio dengan platform populer lainnya untuk membuat presentasi moodboard.",
    date: "6 Februari 2026",
    readTime: "10 min",
    author: "Moodboard Studio",
    category: "Comparison",
    image: blogImgPerbandingan,
    content: `
## Platform Moodboard Terbaik untuk Arsitek & Desainer Interior

Memilih platform yang tepat untuk membuat moodboard bisa membingungkan. Berikut perbandingan detail antara platform-platform populer:

### 1. Moodboard Studio

**Kelebihan:**
- Dirancang khusus untuk arsitek & desainer interior
- Import langsung dari Pinterest, Behance, Dribbble
- AI description yang memahami terminologi desain
- Multi-layout canvas (masonry, grid, portrait, landscape)
- PDF export presisi tinggi, identik dengan tampilan canvas
- Cover page profesional dengan logo studio
- 16 font profesional
- Fitur approval (check/reject) per gambar
- Drag-and-drop editor dengan unlimited undo/redo
- Lead tracking untuk pipeline klien
- **Harga: Gratis 7 hari, mulai Rp 88K/bulan**

**Cocok untuk:** Studio arsitektur & interior yang butuh workflow cepat dari inspirasi ke presentasi

---

### 2. Canva

**Kelebihan:**
- Template sangat banyak
- Familiar bagi banyak orang
- Fitur kolaborasi

**Kekurangan untuk desainer:**
- Tidak bisa import langsung dari Pinterest
- Tidak ada AI description untuk gambar arsitektur
- Template moodboard terlalu generic
- Harus download gambar dulu, lalu upload satu per satu
- Tidak ada fitur approval per gambar
- Export tidak selalu match dengan tampilan editor
- **Harga: Gratis terbatas, Pro mulai $12.99/bulan**

---

### 3. Milanote

**Kelebihan:**
- Interface drag-and-drop yang bagus
- Cocok untuk brainstorming
- Web clipper extension

**Kekurangan untuk desainer:**
- Tidak support multi-layout canvas
- Tidak ada AI description
- Import Pinterest tidak langsung (perlu extension)
- Export PDF terbatas
- Tidak ada cover page atau branding studio
- **Harga: Gratis 100 notes, Pro mulai $9.99/bulan**

---

### 4. Pinterest Sections

**Kelebihan:**
- Gratis
- Tempat natural untuk mengumpulkan inspirasi

**Kekurangan untuk presentasi:**
- Bukan alat presentasi — hanya gallery
- Tidak bisa export PDF
- Tidak ada deskripsi profesional
- Tidak ada branding atau logo
- Tidak bisa dikustom layout-nya
- Tidak cocok untuk dikirim ke klien secara profesional
- **Harga: Gratis**

---

### Tabel Perbandingan

| Fitur | Moodboard Studio | Canva | Milanote | Pinterest |
|---|---|---|---|---|
| Import Pinterest | Langsung URL | Manual | Extension | N/A |
| AI Description | Ya (GPT-4) | Tidak | Tidak | Tidak |
| Multi-Layout | 4 mode | Template | Freeform | Grid only |
| PDF Export | High-quality | Ya | Terbatas | Tidak |
| Cover Page | Ya + logo | Manual | Tidak | Tidak |
| Approval System | Ya | Tidak | Tidak | Tidak |
| Undo/Redo | Unlimited | Ya | Ya | Tidak |
| Lead Tracking | Ya | Tidak | Tidak | Tidak |
| Harga/bulan | Rp 88K | $12.99 | $9.99 | Gratis |

### Kesimpulan

Jika Anda seorang arsitek atau desainer interior yang sering menggunakan Pinterest untuk referensi desain dan membutuhkan presentasi profesional untuk klien, **Moodboard Studio adalah pilihan terbaik**. Platform ini dirancang khusus untuk workflow Anda: dari Pinterest board ke PDF presentasi dalam hitungan menit.

Canva dan Milanote bagus untuk desain umum, tapi tidak memiliki fitur spesifik yang dibutuhkan oleh studio arsitektur dan desain interior.
    `,
  },
  {
    id: "tips-presentasi-desain-interior",
    title: "7 Tips Presentasi Desain Interior yang Memikat Klien: Dari Moodboard hingga Final Presentation",
    excerpt: "Rahasia membuat presentasi desain interior yang tidak hanya indah secara visual, tapi juga meyakinkan klien untuk menyetujui konsep Anda.",
    date: "5 Februari 2026",
    readTime: "7 min",
    author: "Moodboard Studio",
    category: "Tips & Tricks",
    image: blogImgInterior,
    content: `
## Seni Presentasi yang Meyakinkan Klien

Sebagai desainer interior, kemampuan presentasi sama pentingnya dengan kemampuan desain. Moodboard yang bagus harus bisa "berbicara" sendiri kepada klien.

### Tip 1: Mulai dengan Narrative yang Kuat

Jangan langsung tunjukkan gambar. Mulai dengan cerita: apa mood yang ingin dicapai? Apa lifestyle klien? Konsep apa yang mendasari pilihan desain?

Gunakan fitur **AI Cover Description** di Moodboard Studio untuk menghasilkan narrative yang profesional berdasarkan keyword proyek Anda.

### Tip 2: Gunakan Layout yang Sesuai

- **Masonry layout** untuk proyek dengan banyak referensi berbeda ukuran
- **Square grid** untuk presentasi yang clean dan terstruktur
- **Portrait layout** untuk interior dengan elemen vertikal dominan (curtain, tall furniture)
- **Landscape layout** untuk eksterior, fasad, dan ruang luas

### Tip 3: Tambahkan Deskripsi pada Setiap Gambar

Klien non-desainer sering tidak memahami mengapa sebuah gambar dipilih. Deskripsi singkat membantu mereka memahami visi Anda. Dengan AI description, proses ini menjadi otomatis.

### Tip 4: Konsistensi Visual

Pastikan semua gambar dalam satu presentasi memiliki tone dan mood yang selaras. Gunakan fitur **approval** (check/cross) untuk menandai gambar mana yang masuk final selection.

### Tip 5: Professional Branding

Selalu sertakan logo studio, nama proyek, dan informasi klien. Cover page yang profesional memberikan kesan pertama yang kuat. Moodboard Studio menyediakan cover page otomatis dengan hero image, signature area, dan studio branding.

### Tip 6: Multi-Page untuk Proyek Kompleks

Untuk proyek besar, pisahkan moodboard menjadi beberapa halaman berdasarkan ruang atau konsep: Living Room, Bedroom, Material Palette, Color Story, dll. Gunakan fitur **page template suggestions** yang menyesuaikan dengan kategori proyek.

### Tip 7: Sediakan Format yang Mudah Diakses

Export sebagai PDF untuk presentasi formal, atau gunakan **share link** untuk preview online yang bisa dibuka dari WhatsApp atau email. Pastikan format yang Anda kirim match dengan tampilan asli di canvas — ini yang membedakan Moodboard Studio dari tools lain.

### Bonus: Workflow Presentasi Efisien

1. Kumpulkan inspirasi di Pinterest
2. Import ke Moodboard Studio (5 menit)
3. Atur layout dan halaman (10 menit)
4. Generate AI descriptions (2 menit)
5. Review dan approval (5 menit)
6. Export PDF atau share link (1 menit)

**Total: Kurang dari 25 menit** untuk presentasi profesional yang siap kirim ke klien.
    `,
  },
  {
    id: "moodboard-arsitektur-modern",
    title: "Cara Membuat Moodboard Arsitektur Modern: Teknik, Referensi, dan Tools Terbaik",
    excerpt: "Panduan step-by-step membuat moodboard arsitektur modern dengan teknik kurasi yang tepat dan tools digital yang efisien untuk workflow studio Anda.",
    date: "4 Februari 2026",
    readTime: "9 min",
    author: "Moodboard Studio",
    category: "Tutorial",
    image: blogImgArsitektur,
    content: `
## Moodboard Arsitektur: Lebih dari Sekadar Gambar Cantik

Dalam arsitektur modern, moodboard berfungsi sebagai jembatan antara ide konseptual dan realisasi desain. Moodboard yang baik tidak hanya menampilkan gambar-gambar indah, tapi juga mengkomunikasikan material, skala, suasana, dan pengalaman ruang.

### Elemen Penting Moodboard Arsitektur

1. **Referensi Fasad & Eksterior** — Tampilan bangunan, material eksterior, proporsi
2. **Material Palette** — Beton ekspos, kayu, baja, kaca, batu alam
3. **Interior Atmosphere** — Pencahayaan, suasana ruang, furniture reference
4. **Landscape & Context** — Lingkungan sekitar, vegetasi, hardscape
5. **Detail & Texture** — Close-up material, pattern, finishing

### Sumber Referensi Terbaik

- **Pinterest** — Platform terpopuler untuk inspirasi desain. Buat board per proyek, lalu import langsung ke Moodboard Studio
- **Behance** — Portfolio profesional dengan proyek-proyek high-end
- **Dribbble** — Desain UI/UX dan grafis, cocok untuk referensi visual
- **ArchDaily** — Referensi arsitektur teknis dan fotografis
- **Dezeen** — Proyek kontemporer dari seluruh dunia

### Workflow Moodboard Arsitektur yang Efisien

**Tahap 1: Kurasi (30-60 menit)**
Kumpulkan referensi di Pinterest. Buat board khusus untuk setiap proyek. Fokus pada mood, material, dan spatial quality yang ingin dicapai.

**Tahap 2: Import & Organize (5-10 menit)**
Paste URL board Pinterest ke Moodboard Studio. Sistem akan auto-import semua gambar. Hapus yang tidak relevan, atur urutan.

**Tahap 3: Layout & Description (10-15 menit)**
Pilih layout yang sesuai. Untuk arsitektur modern, **masonry** atau **landscape** layout biasanya paling efektif. Gunakan AI untuk generate deskripsi.

**Tahap 4: Finalisasi (5 menit)**
Tambahkan cover page, studio logo, informasi klien. Review approval status setiap gambar. Export atau share.

### Kenapa Moodboard Studio Lebih Baik dari PowerPoint?

| Aspek | PowerPoint/Keynote | Moodboard Studio |
|---|---|---|
| Import Pinterest | Manual (screenshot) | Auto (paste URL) |
| Layout | Manual resize | Auto multi-layout |
| Deskripsi | Ketik manual | AI-generated |
| Branding | Buat template sendiri | Cover page otomatis |
| Konsistensi | Sulit dijaga | Otomatis terjaga |
| Waktu | 2-4 jam | 15-25 menit |

### Kesimpulan

Moodboard arsitektur modern membutuhkan tools yang memahami workflow desainer. Dengan Moodboard Studio, Anda bisa fokus pada **kreativitas dan kurasi**, sementara platform menangani formatting, layout, dan deskripsi secara otomatis.

Mulai **gratis selama 7 hari** — tidak perlu kartu kredit.
    `,
  },
];

export default function Blog() {
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const activePost = blogPosts.find((p) => p.id === selectedPost);
  useMetaTags({
    title: activePost ? `${activePost.title} | Moodboard Studio Blog` : "Blog | Moodboard Studio — Tips & Tutorial Moodboard Profesional",
    description: activePost ? activePost.excerpt : "Tips, tutorial, dan insights seputar moodboard, presentasi desain arsitektur & interior. Panduan lengkap untuk studio profesional.",
    keywords: activePost ? `${activePost.category}, moodboard, desain interior, arsitektur, ${activePost.title.split(" ").slice(0, 3).join(", ")}` : "blog, moodboard, tips desain, tutorial, arsitektur, desain interior",
    ogTitle: activePost ? activePost.title : "Blog | Moodboard Studio",
    ogDescription: activePost ? activePost.excerpt : "Tips, tutorial, dan insights seputar moodboard dan presentasi desain profesional.",
    canonical: activePost ? `https://moodboard.co.id/blog/${activePost.id}` : "https://moodboard.co.id/blog",
    ogUrl: activePost ? `https://moodboard.co.id/blog/${activePost.id}` : "https://moodboard.co.id/blog",
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="outline" size="sm" data-testid="button-login">Log In</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        {activePost ? (
          <div>
            <Button variant="ghost" size="sm" className="mb-6" onClick={() => setSelectedPost(null)} data-testid="button-back-blog">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Blog
            </Button>

            {activePost.image && (
              <div className="rounded-md overflow-hidden mb-6">
                <img src={activePost.image} alt={activePost.title} className="w-full h-auto object-cover" style={{ maxHeight: 360 }} data-testid="img-post-hero" />
              </div>
            )}
            <Badge variant="secondary" className="text-xs mb-3">{activePost.category}</Badge>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-3" data-testid="text-post-title">{activePost.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {activePost.date}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {activePost.readTime} read
              </div>
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {activePost.author}
              </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none">
              {activePost.content.split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                if (trimmed.startsWith("## ")) return <h2 key={i} className="font-serif text-xl font-semibold mt-8 mb-3">{trimmed.slice(3)}</h2>;
                if (trimmed.startsWith("### ")) return <h3 key={i} className="font-serif text-lg font-semibold mt-6 mb-2">{trimmed.slice(4)}</h3>;
                if (trimmed.startsWith("- **")) {
                  const parts = trimmed.slice(2);
                  return <li key={i} className="text-muted-foreground leading-relaxed ml-4" dangerouslySetInnerHTML={{ __html: parts.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>") }} />;
                }
                if (trimmed.startsWith("- ")) return <li key={i} className="text-muted-foreground leading-relaxed ml-4">{trimmed.slice(2)}</li>;
                if (trimmed.startsWith("1. ") || trimmed.startsWith("2. ") || trimmed.startsWith("3. ") || trimmed.startsWith("4. ") || trimmed.startsWith("5. ") || trimmed.startsWith("6. ") || trimmed.startsWith("7. ")) {
                  return <li key={i} className="text-muted-foreground leading-relaxed ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: trimmed.slice(3).replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>") }} />;
                }
                if (trimmed.startsWith("|")) {
                  if (trimmed.startsWith("|---") || trimmed.startsWith("| ---")) return null;
                  const cells = trimmed.split("|").filter(Boolean).map((c) => c.trim());
                  const isHeader = i > 0 && activePost.content.split("\n")[i + 1]?.trim().startsWith("|---");
                  return (
                    <div key={i} className={`grid gap-2 py-1.5 px-2 text-xs ${isHeader ? "font-semibold border-b border-border" : "text-muted-foreground"}`} style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
                      {cells.map((cell, ci) => <span key={ci} dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />)}
                    </div>
                  );
                }
                return <p key={i} className="text-muted-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>") }} />;
              })}
            </div>

            <div className="mt-12 p-6 rounded-md bg-primary/5 border border-primary/20">
              <h3 className="font-serif text-lg font-semibold mb-2">Siap membuat moodboard profesional?</h3>
              <p className="text-sm text-muted-foreground mb-4">Coba Moodboard Studio gratis selama 7 hari. Tanpa kartu kredit.</p>
              <Link href="/sign-up">
                <Button data-testid="button-blog-cta">
                  Mulai Gratis
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Home
              </Button>
            </Link>

            <h1 className="font-serif text-3xl font-bold mb-2" data-testid="text-page-title">Blog</h1>
            <p className="text-muted-foreground mb-8">Tips, tutorial, dan insights seputar moodboard, presentasi desain, dan workflow studio.</p>

            <div className="space-y-4">
              {blogPosts.map((post) => (
                <Card
                  key={post.id}
                  className="hover-elevate cursor-pointer glass"
                  onClick={() => setSelectedPost(post.id)}
                  data-testid={`card-blog-${post.id}`}
                >
                  <CardContent className="pt-0 pb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {post.image && (
                        <div className="sm:w-48 shrink-0 rounded-md overflow-hidden mt-6">
                          <img src={post.image} alt={post.title} className="w-full h-32 sm:h-full object-cover" data-testid={`img-blog-${post.id}`} />
                        </div>
                      )}
                      <div className="pt-6 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge variant="secondary" className="text-xs">{post.category}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {post.date}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.readTime}
                          </span>
                        </div>
                        <h2 className="font-serif text-lg font-semibold mb-2">{post.title}</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">{post.excerpt}</p>
                        <div className="mt-3 flex items-center gap-1 text-sm font-medium" style={{ color: "hsl(24 85% 52%)" }}>
                          Baca selengkapnya
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
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
              <Link href="/contact" className="text-xs text-muted-foreground hover:underline">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
