import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Check,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo, brandLogoSrc } from "@/components/brand-logo";
import { StudioLogo } from "@/components/studio-logo";
import type { Project, Pin } from "@shared/schema";

const PAPER_RATIOS: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 },
};

const IMAGE_ASPECT_RATIOS: Record<string, number | null> = {
  square: 1,
  portrait_3_5: 3 / 5,
  portrait_9_16: 9 / 16,
  landscape_5_3: 5 / 3,
  landscape_16_9: 16 / 9,
  original: null,
};

const FONT_CSS_MAP: Record<string, string> = {
  Montserrat: "'Montserrat', sans-serif",
  Inter: "'Inter', sans-serif",
  Poppins: "'Poppins', sans-serif",
  "Open Sans": "'Open Sans', sans-serif",
  Roboto: "'Roboto', sans-serif",
  "DM Sans": "'DM Sans', sans-serif",
  "Plus Jakarta Sans": "'Plus Jakarta Sans', sans-serif",
  "Space Grotesk": "'Space Grotesk', sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Courier New": "'Courier New', Courier, monospace",
  "EB Garamond": "'EB Garamond', Garamond, serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  "Playfair Display": "'Playfair Display', serif",
  Lora: "'Lora', serif",
  "Libre Baskerville": "'Libre Baskerville', serif",
  "Source Serif 4": "'Source Serif 4', serif",
};

function getFontCss(f: string) {
  return FONT_CSS_MAP[f] || "'Montserrat', sans-serif";
}

function isBackgroundDark(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function getPaperStyle(paperSize: string, orientation: string) {
  const base = PAPER_RATIOS[paperSize] || PAPER_RATIOS.A3;
  const isLandscape = orientation === "horizontal";
  const w = isLandscape ? base.h : base.w;
  const h = isLandscape ? base.w : base.h;
  return { aspectRatio: `${w} / ${h}`, w, h };
}

function getGridLayout(isLandscape: boolean, imageLayout: string, gridColumns: number = 3, paperSize: string = "A3") {
  const cols = Math.max(2, Math.min(5, gridColumns));
  const imageAspect = IMAGE_ASPECT_RATIOS[imageLayout];
  const base = PAPER_RATIOS[paperSize] || PAPER_RATIOS.A3;
  const paperW = isLandscape ? base.h : base.w;
  const paperH = isLandscape ? base.w : base.h;
  if (imageAspect === null) {
    const contentH = paperH * 0.82;
    const colW = (paperW * 0.76) / cols;
    const estRowH = colW * 1.0;
    const gapEst = 0.015 * paperW;
    const rows = Math.max(2, Math.floor((contentH + gapEst) / (estRowH + gapEst)));
    return { cols, rows, perPage: cols * rows, useGrid: false };
  }
  const contentW = paperW * 0.76;
  const contentH = paperH * 0.82;
  const gapFraction = 0.015 * paperW;
  const cellW = (contentW - gapFraction * (cols - 1)) / cols;
  const cellH = cellW / imageAspect;
  const rows = Math.max(2, Math.floor((contentH + gapFraction) / (cellH + gapFraction)));
  return { cols, rows, perPage: cols * rows, useGrid: true };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size));
  }
  return pages;
}

const FONT_SIZE_RATIOS = {
  small: { desc: 0.00686, hint: 0.00539 },
  normal: { desc: 0.0085, hint: 0.007 },
  large: { desc: 0.0252, hint: 0.0204 },
};

function computeFontSizes(containerWidth: number, size: string) {
  const ratios = FONT_SIZE_RATIOS[size as keyof typeof FONT_SIZE_RATIOS] || FONT_SIZE_RATIOS.normal;
  const descPx = Math.max(3.5, Math.min(16, containerWidth * ratios.desc));
  return { desc: `${descPx}px` };
}

function ShareCoverPage({ project, paper, coverImageSrc }: { project: Project; paper: ReturnType<typeof getPaperStyle>; coverImageSrc: string | null }) {
  const coverRef = useRef<HTMLDivElement>(null);
  const [coverWidth, setCoverWidth] = useState(640);
  const isFull = project.coverImageStyle === "full";
  const bgColor = project.canvasBackground || "#ffffff";
  const dark = isBackgroundDark(bgColor);
  const autoTitleColor = dark ? "#e4e4e7" : "#27272a";
  const autoDescColor = dark ? "#71717a" : "#a1a1aa";
  const txtPrimary = project.coverTitleColor || autoTitleColor;
  const txtDesc = project.coverDescColor || autoDescColor;
  const txtSecondary = dark ? "#a1a1aa" : "#52525b";
  const txtMuted = dark ? "#71717a" : "#a1a1aa";
  const borderCol = dark ? "#3f3f46" : "#d4d4d8";
  const titleFontWeight = project.coverTitleWeight === "regular" ? "400" : project.coverTitleWeight === "italic" ? "400" : "700";
  const titleFontStyle = project.coverTitleWeight === "italic" ? "italic" : "normal";
  const titleTextTransform = (project.coverTitleTransform || "uppercase") as "uppercase" | "lowercase" | "none";

  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setCoverWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setCoverWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const ff = getFontCss(project.fontFamily || "Montserrat");

  if (isFull) {
    return (
      <div
        ref={coverRef}
        className="bg-zinc-900 w-full overflow-hidden relative"
        style={{ aspectRatio: paper.aspectRatio, fontFamily: ff }}
      >
        {coverImageSrc ? (
          <img
            src={coverImageSrc}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.background = "#27272a"; }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-zinc-800 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex">
          <div
            className="flex flex-col justify-between py-[5%] px-[5%]"
            style={{ width: "45%", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", background: "rgba(0,0,0,0.35)", boxShadow: "4px 0 20px rgba(0,0,0,0.2)" }}
          >
            <div>
              <StudioLogo
                src={project.studioLogoPath || brandLogoSrc}
                alt="Studio"
                className="object-contain mb-[8%]"
                style={{ height: `${Math.max(20, Math.min(50, coverWidth * 0.06))}px` }}
              />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="h-0.5 bg-primary mb-[6%]" style={{ width: `${Math.max(16, coverWidth * 0.04)}px` }} />
              <h1
                className="tracking-wide leading-tight mb-[3%]"
                style={{ fontSize: `${Math.max(14, Math.min(30, coverWidth * 0.038))}px`, textShadow: "0 2px 8px rgba(0,0,0,0.3)", color: project.coverTitleColor || "#e4e4e7", fontWeight: titleFontWeight, fontStyle: titleFontStyle, textTransform: titleTextTransform }}
              >
                {project.title || "Moodboard"}
              </h1>
              {project.descriptionAi && (
                <p className="leading-relaxed mt-[2%] italic" style={{ fontSize: `${Math.max(5, Math.min(9, coverWidth * 0.011))}px`, color: project.coverDescColor || "rgba(255,255,255,0.6)" }} >
                  {project.descriptionAi}
                </p>
              )}
              {project.clientOwnerName && (
                <p className="text-white/70 mt-[5%]" style={{ fontSize: `${Math.max(6, Math.min(11, coverWidth * 0.014))}px` }}>
                  Prepared for {project.clientOwnerName}
                  {project.clientCompany ? ` — ${project.clientCompany}` : ""}
                </p>
              )}
            </div>
            <div>
              {project.designerName && (
                <div className="mb-[6%]">
                  <p className="text-white/50" style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px` }}>
                    Project Designer by:
                  </p>
                  <p className="text-white/90 font-medium mt-[1%]" style={{ fontSize: `${Math.max(5, Math.min(10, coverWidth * 0.013))}px` }}>
                    {project.designerName}
                  </p>
                  <div className="border-b border-white/20 mt-[4%] mb-[2%]">
                    <div style={{ height: `${Math.max(10, Math.min(20, coverWidth * 0.025))}px` }} />
                  </div>
                  <p className="text-white/40 italic" style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px` }}>
                    {project.signatureField || "Signature"}
                  </p>
                </div>
              )}
              <div className="w-full h-px bg-white/20 mb-[3%]" />
              <div className="flex items-end justify-between gap-2">
                <p className="text-white/50" style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px` }}>
                  {new Date(project.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
                <p className="text-white/50 italic" style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px` }}>
                  created by {project.studioName || "Moodboard Studio"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={coverRef}
      className="w-full overflow-hidden"
      style={{ aspectRatio: paper.aspectRatio, fontFamily: ff, backgroundColor: project.canvasBackground || "#ffffff" }}
    >
      <div className="w-full h-full p-[4%] flex gap-[3%]">
        <div className="min-w-0 flex items-stretch" style={{ flex: "1.4" }}>
          {coverImageSrc ? (
            <img
              src={coverImageSrc}
              alt="Cover"
              className="w-full h-full object-cover"
              style={{ borderRadius: `${Math.max(6, coverWidth * 0.015)}px`, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
              onError={(e) => { (e.target as HTMLImageElement).style.background = "#e5e5e5"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ borderRadius: `${Math.max(6, coverWidth * 0.015)}px`, backgroundColor: dark ? "rgba(255,255,255,0.05)" : "#f4f4f5" }}>
              <ImageIcon className="w-12 h-12" style={{ color: txtMuted }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex flex-col justify-between py-[2%]" style={{ flex: "0.6" }}>
          <div>
            <StudioLogo src={project.studioLogoPath || brandLogoSrc} alt="Studio" className="object-contain mb-[8%]" style={{ height: `${Math.max(20, Math.min(50, coverWidth * 0.06))}px` }} />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-0.5 bg-primary mb-[6%]" style={{ width: `${Math.max(16, coverWidth * 0.04)}px` }} />
            <h1 className="tracking-wide leading-tight mb-[3%]" style={{ fontSize: `${Math.max(14, Math.min(30, coverWidth * 0.038))}px`, color: txtPrimary, fontWeight: titleFontWeight, fontStyle: titleFontStyle, textTransform: titleTextTransform }}>
              {project.title || "Moodboard"}
            </h1>
            {project.descriptionAi && (
              <p className="leading-relaxed mt-[2%] italic" style={{ fontSize: `${Math.max(5, Math.min(9, coverWidth * 0.011))}px`, color: txtDesc }}>
                {project.descriptionAi}
              </p>
            )}
            {project.clientOwnerName && (
              <p className="mt-[5%]" style={{ fontSize: `${Math.max(6, Math.min(11, coverWidth * 0.014))}px`, color: txtSecondary }}>
                Prepared for {project.clientOwnerName}{project.clientCompany ? ` — ${project.clientCompany}` : ""}
              </p>
            )}
          </div>
          <div>
            {project.designerName && (
              <div className="mb-[6%]">
                <p style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px`, color: txtMuted }}>Project Designer by:</p>
                <p className="font-medium mt-[1%]" style={{ fontSize: `${Math.max(5, Math.min(10, coverWidth * 0.013))}px`, color: txtSecondary }}>{project.designerName}</p>
                <div className="mt-[4%] mb-[2%]" style={{ borderBottom: `1px solid ${borderCol}` }}>
                  <div style={{ height: `${Math.max(10, Math.min(20, coverWidth * 0.025))}px` }} />
                </div>
                <p className="italic" style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px`, color: txtMuted }}>{project.signatureField || "Signature"}</p>
              </div>
            )}
            <div className="w-full h-px mb-[3%]" style={{ backgroundColor: borderCol }} />
            <div className="flex items-end justify-between gap-2">
              <p style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px`, color: txtMuted }}>
                {new Date(project.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
              <p className="italic" style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px`, color: txtMuted }}>
                created by {project.studioName || "Moodboard Studio"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareContentPage({ project, pagePins, layout, paper, pageIndex, pageDescription }: {
  project: Project;
  pagePins: Pin[];
  layout: ReturnType<typeof getGridLayout>;
  paper: ReturnType<typeof getPaperStyle>;
  pageIndex: number;
  pageDescription?: { title: string; description: string };
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(640);
  const gap = "clamp(6px, 1.5%, 12px)";
  const fontSize = (project.descriptionFontSize as string) || "normal";
  const borderRadius = "4px";
  const bgColor = project.canvasBackground || "#ffffff";
  const dark = isBackgroundDark(bgColor);
  const txtPrimary = dark ? "#e4e4e7" : "#27272a";
  const txtSecondary = dark ? "#a1a1aa" : "#52525b";
  const txtMuted = dark ? "#71717a" : "#a1a1aa";
  const borderCol = dark ? "#3f3f46" : "#d4d4d8";
  const descBg = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setCanvasWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setCanvasWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const fontSizes = computeFontSizes(canvasWidth, fontSize);

  const DESC_LONG_THRESHOLD = 60;
  type GridCell = { type: "image"; pin: Pin; idx: number } | { type: "desc-overflow"; pin: Pin };
  const gridCells: GridCell[] = [];
  if (layout.useGrid) {
    pagePins.forEach((pin, idx) => {
      gridCells.push({ type: "image", pin, idx });
      if (pin.descriptionCustomInput && pin.descriptionCustomInput.length > DESC_LONG_THRESHOLD) {
        gridCells.push({ type: "desc-overflow", pin });
      }
    });
  }

  return (
    <div
      ref={canvasRef}
      className="w-full overflow-hidden flex flex-col"
      style={{ aspectRatio: paper.aspectRatio, fontFamily: getFontCss(project.fontFamily || "Montserrat"), backgroundColor: project.canvasBackground || "#ffffff" }}
    >
      <div className="w-full h-full p-[3%] flex flex-col">
        {(project.studioName || project.projectName) && (
          <div className="flex items-center gap-2 mb-[2%] flex-shrink-0">
            <span className="font-semibold tracking-wide uppercase" style={{ fontSize: `${Math.max(8, Math.min(14, canvasWidth * 0.022))}px`, color: txtPrimary }}>
              {project.studioName || ""}
            </span>
            {project.projectName && (
              <>
                <span style={{ fontSize: `${Math.max(7, Math.min(12, canvasWidth * 0.018))}px`, color: txtMuted }}>/</span>
                <span style={{ fontSize: `${Math.max(7, Math.min(12, canvasWidth * 0.018))}px`, color: txtSecondary }}>
                  {project.projectName}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-[2%]">
          <div className="flex-shrink-0 flex flex-col justify-between" style={{ width: "20%" }}>
            <div>
              {pageDescription?.title && (
                <h3 className="font-bold leading-tight mb-[8%]" style={{ fontSize: `${Math.max(10, Math.min(20, canvasWidth * 0.028))}px`, color: txtPrimary }}>
                  {pageDescription.title}
                </h3>
              )}
              {pageDescription?.description && (
                <p style={{ fontSize: `${Math.max(6, Math.min(10, canvasWidth * 0.014))}px`, lineHeight: 1.3, color: txtSecondary }}>
                  {pageDescription.description}
                </p>
              )}
            </div>
            <div className="mt-auto">
              {project.clientOwnerName && (
                <p className="font-medium mb-[4%]" style={{ fontSize: `${Math.max(5, Math.min(8, canvasWidth * 0.012))}px`, color: txtSecondary }}>
                  {project.clientOwnerName}
                </p>
              )}
              <div className="mb-[6%] pb-[2%]" style={{ borderBottom: `1px solid ${borderCol}` }}>
                <p className="italic" style={{ fontSize: `${Math.max(5, Math.min(7, canvasWidth * 0.01))}px`, color: txtMuted }}>
                  {project.signatureField || "Signature"}
                </p>
                <div style={{ height: `${Math.max(12, Math.min(24, canvasWidth * 0.03))}px` }} />
              </div>
              <p style={{ fontSize: `${Math.max(4, Math.min(6, canvasWidth * 0.009))}px`, color: txtMuted }}>
                {new Date(project.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {layout.useGrid ? (
              <div
                className="w-full h-full grid"
                style={{
                  gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                  gap,
                }}
              >
                {gridCells.map((cell, cellIdx) => {
                  if (cell.type === "desc-overflow") {
                    return (
                      <div
                        key={`desc-${cell.pin.id}`}
                        className="relative flex flex-col items-start justify-center p-[6%]"
                        style={{ borderRadius, boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)", backgroundColor: descBg }}
                      >
                        <p style={{ fontSize: fontSizes.desc, lineHeight: 1.3, color: txtSecondary }}>
                          {cell.pin.descriptionCustomInput}
                        </p>
                      </div>
                    );
                  }
                  const pin = cell.pin;
                  const isLongDesc = pin.descriptionCustomInput && pin.descriptionCustomInput.length > DESC_LONG_THRESHOLD;
                  const hasShortDesc = pin.descriptionCustomInput && !isLongDesc;
                  return (
                    <div
                      key={pin.id}
                      className="relative flex flex-col"
                      style={{ borderRadius, boxShadow: "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)" }}
                    >
                      <div className="flex-1 min-h-0 relative overflow-hidden" style={{ borderRadius: hasShortDesc ? `${borderRadius} ${borderRadius} 0 0` : borderRadius }}>
                        <img
                          src={pin.imagePath || pin.imageUrl || ""}
                          alt={pin.title || "Pin"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.background = "#e5e5e5"; }}
                        />
                        {pin.approvalStatus && (
                          <div
                            className={`absolute top-[4%] right-[4%] rounded-sm flex items-center justify-center ${pin.approvalStatus === "approved" ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px`, height: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px` }}
                          >
                            {pin.approvalStatus === "approved" ? (
                              <Check className="text-white" style={{ width: "65%", height: "65%" }} />
                            ) : (
                              <XIcon className="text-white" style={{ width: "65%", height: "65%" }} />
                            )}
                          </div>
                        )}
                      </div>
                      {hasShortDesc && (
                        <div className="flex items-center px-[6%] py-[5%]" style={{ borderRadius: `0 0 ${borderRadius} ${borderRadius}`, backgroundColor: descBg }}>
                          <p style={{ fontSize: fontSizes.desc, lineHeight: 1.3, color: txtSecondary }}>
                            {pin.descriptionCustomInput}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ columnCount: layout.cols, columnGap: gap }} className="h-full">
                {pagePins.map((pin) => {
                  const hasDesc = !!pin.descriptionCustomInput;
                  return (
                    <div key={pin.id} className="break-inside-avoid mb-[clamp(6px,1.5%,12px)]" style={{ borderRadius, boxShadow: "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                      <div className="relative overflow-hidden" style={{ borderRadius: hasDesc ? `${borderRadius} ${borderRadius} 0 0` : borderRadius }}>
                        <img
                          src={pin.imagePath || pin.imageUrl || ""}
                          alt={pin.title || "Pin"}
                          className="w-full h-auto block"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.background = "#e5e5e5"; }}
                        />
                        {pin.approvalStatus && (
                          <div
                            className={`absolute top-[4%] right-[4%] rounded-sm flex items-center justify-center ${pin.approvalStatus === "approved" ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px`, height: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px` }}
                          >
                            {pin.approvalStatus === "approved" ? (
                              <Check className="text-white" style={{ width: "65%", height: "65%" }} />
                            ) : (
                              <XIcon className="text-white" style={{ width: "65%", height: "65%" }} />
                            )}
                          </div>
                        )}
                      </div>
                      {hasDesc && (
                        <div className="px-[6%] py-[4%]" style={{ borderRadius: `0 0 ${borderRadius} ${borderRadius}`, backgroundColor: descBg }}>
                          <p style={{ fontSize: fontSizes.desc, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", color: txtSecondary } as any}>
                            {pin.descriptionCustomInput}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {project.showFooter && (
          <div className="flex items-center justify-between mt-[1%] mx-[-1%] px-[3%] py-[0.7%] flex-shrink-0" style={{ backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: `${Math.max(5, Math.min(9, canvasWidth * 0.012))}px`, color: txtMuted }}>
              created by {project.studioName || "Moodboard Studio"}
            </p>
            <div className="flex items-center gap-2">
              <StudioLogo src={project.studioLogoPath || brandLogoSrc} alt="Logo" style={{ height: `${Math.max(10, Math.min(20, canvasWidth * 0.025))}px` }} className="object-contain" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SharePreview() {
  const { token } = useParams<{ token: string }>();
  const [activePage, setActivePage] = useState(0);

  const { data, isLoading, error } = useQuery<{ project: Project; pins: Pin[] }>({
    queryKey: ["/api/share", token],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <Skeleton className="w-full" style={{ aspectRatio: "420 / 297" }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-bold mb-2 text-zinc-800">Link Expired or Not Found</h2>
          <p className="text-sm text-zinc-500">This share link is no longer available.</p>
        </div>
      </div>
    );
  }

  const { project, pins } = data;
  const sortedPins = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
  const paperSize = project.paperSize || "A3";
  const orientation = project.orientation || "horizontal";
  const imageLayout = project.imageLayout || "original";
  const gridColumns = project.gridColumns || 3;
  const isLandscape = orientation === "horizontal";
  const paper = getPaperStyle(paperSize, orientation);
  const layout = getGridLayout(isLandscape, imageLayout, gridColumns, paperSize);

  const pages: Pin[][] = [];
  if (layout.useGrid) {
    const longDescThreshold = 60;
    const totalSlots = layout.perPage;
    let currentPagePins: Pin[] = [];
    let slotsUsed = 0;
    for (const pin of sortedPins) {
      const slotsNeeded = (pin.descriptionCustomInput && pin.descriptionCustomInput.length > longDescThreshold) ? 2 : 1;
      if (slotsUsed + slotsNeeded > totalSlots && currentPagePins.length > 0) {
        pages.push(currentPagePins);
        currentPagePins = [];
        slotsUsed = 0;
      }
      currentPagePins.push(pin);
      slotsUsed += slotsNeeded;
    }
    if (currentPagePins.length > 0) pages.push(currentPagePins);
  } else {
    const MAX_PAGES = 30;
    const chunked = chunkArray(sortedPins, layout.perPage);
    if (chunked.length > MAX_PAGES) {
      const adjustedPerPage = Math.ceil(sortedPins.length / MAX_PAGES);
      pages.push(...chunkArray(sortedPins, adjustedPerPage));
    } else {
      pages.push(...chunked);
    }
  }

  const totalContentPages = Math.max(1, Math.min(30, pages.length));
  const pageDescriptions = (project.pageDescriptions as Array<{ title: string; description: string }>) || [];
  const hasCover = project.showCover !== false;
  const totalPagesWithCover = totalContentPages + (hasCover ? 1 : 0);
  const isCoverPage = hasCover && activePage === 0;
  const contentPageIndex = hasCover ? activePage - 1 : activePage;
  const currentContentPage = Math.min(Math.max(0, contentPageIndex), totalContentPages - 1);
  const currentPins = pages[currentContentPage] || [];
  const coverPin = sortedPins[0] || null;
  const coverImageSrc = coverPin?.imagePath || coverPin?.imageUrl || null;

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="sticky top-0 z-50 bg-white/80 border-b border-zinc-200" style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {project.studioLogoPath ? (
              <img src={project.studioLogoPath} alt="Studio" className="h-6 object-contain" />
            ) : (
              <BrandLogo className="w-7 h-7 rounded-md" />
            )}
            <span className="font-serif text-sm font-semibold text-zinc-800" data-testid="text-share-studio">
              {project.studioName || "Moodboard Studio"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Design Presentation
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-zinc-800 mb-1" data-testid="text-share-title">
            {project.projectName || project.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            {project.designerName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {project.designerName}
              </span>
            )}
            {project.studioName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {project.studioName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(project.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        <div
          className="rounded-md shadow-xl border border-zinc-200 overflow-hidden mx-auto"
          style={{ maxWidth: isLandscape ? "960px" : "640px" }}
          data-testid="share-canvas"
        >
          {isCoverPage ? (
            <ShareCoverPage project={project} paper={paper} coverImageSrc={coverImageSrc} />
          ) : (
            <ShareContentPage
              project={project}
              pagePins={currentPins}
              layout={layout}
              paper={paper}
              pageIndex={currentContentPage}
              pageDescription={pageDescriptions[currentContentPage]}
            />
          )}
        </div>

        {totalPagesWithCover > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6" data-testid="share-pagination">
            <Button
              size="icon"
              variant="outline"
              disabled={activePage === 0}
              onClick={() => setActivePage((p) => Math.max(0, p - 1))}
              data-testid="button-share-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-zinc-600 font-medium tabular-nums" data-testid="text-share-page-num">
              {activePage + 1} / {totalPagesWithCover}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={activePage >= totalPagesWithCover - 1}
              onClick={() => setActivePage((p) => Math.min(totalPagesWithCover - 1, p + 1))}
              data-testid="button-share-next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {project.descriptionEnabled && project.descriptionAi && (
          <div className="mt-6 max-w-3xl mx-auto">
            <p className="text-zinc-500 text-sm leading-relaxed" data-testid="text-share-description">
              {project.descriptionAi}
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 mt-8 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {project.studioLogoPath ? (
                <img src={project.studioLogoPath} alt="Studio" className="h-5 object-contain" />
              ) : (
                <BrandLogo className="w-5 h-5 rounded-md" />
              )}
              <span className="font-serif text-xs font-medium text-zinc-600">{project.studioName || "Moodboard Studio"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              {project.clientCompany && <span>Prepared for: {project.clientCompany}</span>}
              {project.clientOwnerName && <span>{project.clientOwnerName}</span>}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
