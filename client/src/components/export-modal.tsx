import { getGridLayout, paginateMoodboard } from "@shared/layout-pagination";
import { useState, useCallback, useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { brandLogoSrc } from "@/components/brand-logo";
import { transparentLogo } from "@/lib/transparent-logo";
import { getPinDesc, isDescLong, type DescMode } from "@/lib/pin-description";
import {
  appendRasterizedShadowLayer,
  EXPORT_CARD_SURFACE,
  EXPORT_CARD_TEXT,
  prepareExportCard,
  waitForRasterizedShadowLayer,
} from "@/lib/export-card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  FileText,
  Loader2,
  Printer,
  Monitor,
  Zap,
} from "lucide-react";
import type { Project, Pin } from "@shared/schema";

export type ExportImageProblem = {
  pin: Pin;
  source: string;
  reason: string;
  preview: string;
  normalizedDataUrl?: string;
  repairable: boolean;
  position: number;
  width?: number;
  height?: number;
  fileSize?: number;
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

function getFontCssForPdf(fontFamily: string): string {
  return FONT_CSS_MAP[fontFamily] || "'Montserrat', sans-serif";
}

interface ExportModalProps {
  project: Project;
  pins: Pin[];
  descMode?: DescMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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


function chunkArray<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size));
  }
  return pages;
}

const QUALITY_PRESETS = [
  { value: "standard", label: "Standard", desc: "Fast download", icon: Zap, scale: 4, jpegQuality: 0.85 },
  { value: "hd", label: "Full HD", desc: "Sharp & clear", icon: Monitor, scale: 6, jpegQuality: 0.92 },
  { value: "print", label: "Print Ready", desc: "High resolution", icon: Printer, scale: 10, jpegQuality: 0.95 },
];

async function preloadAndConvertImages(
  pins: Pin[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<{ cache: Map<string, string>; failures: ExportImageProblem[] }> {
  const cache = new Map<string, string>();
  const failures: ExportImageProblem[] = [];
  const verifyBrowserImage = (url: string) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => finish(new Error("Image content timed out.")), 12000);
    const onAbort = () => finish(new DOMException("Export cancelled", "AbortError"));
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      image.onload = null;
      image.onerror = null;
      image.src = "";
      error ? reject(error) : resolve();
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Image content could not be decoded by this browser."));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) return onAbort();
    image.src = url;
  });
  // Health checks are intentionally serialized in pairs: mobile browsers cannot
  // safely hold a data URL/blob for every pin while a PDF is being assembled.
  for (let i = 0; i < pins.length; i += 2) {
    const batch = pins.slice(i, i + 2);
    onProgress?.(`Checking images ${i + 1}-${Math.min(i + 2, pins.length)} of ${pins.length}...`);
    await Promise.all(batch.map(async (pin) => {
      const rawSrc = pin.imagePath || pin.imageUrl || "";
      const position = pins.indexOf(pin) + 1;
      if (!rawSrc) {
        failures.push({ pin, source: "", reason: "This pin has no image source.", preview: "", repairable: false, position });
        return;
      }
      try {
        const response = await fetch(`/api/pins/${pin.id}/image-health`, { signal });
        if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
        const health = await response.json() as { status: string; repairable?: boolean; version?: string; width?: number; height?: number; fileSize?: number; message?: string };
        const contentUrl = health.version
          ? `/api/pins/${pin.id}/image-content?version=${encodeURIComponent(health.version)}`
          : "";
        if (health.status === "healthy") {
          try {
            await verifyBrowserImage(contentUrl);
            cache.set(rawSrc, contentUrl);
          } catch (error) {
            if (signal?.aborted) throw error;
            failures.push({
              pin,
              source: rawSrc,
              preview: contentUrl,
              reason: error instanceof Error ? error.message : "Image content could not be loaded.",
              repairable: true,
              position,
              width: health.width,
              height: health.height,
              fileSize: health.fileSize,
            });
          }
        } else failures.push({
          pin, source: rawSrc, preview: contentUrl,
          reason: health.status === "oversized"
            ? `This image is too large for reliable mobile export (${health.width || "?"}×${health.height || "?"}).`
            : health.message || `Image is ${health.status.replaceAll("_", " ")}.`,
          repairable: health.status === "oversized" && health.repairable === true,
          position,
          width: health.width, height: health.height, fileSize: health.fileSize,
        });
      } catch {
        if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
        failures.push({ pin, source: rawSrc, preview: "", reason: "The image health check could not be completed.", repairable: false, position });
      }
    }));
  }
  return { cache, failures };
}

export function ExportModal({ project, pins, open, onOpenChange, descMode = "auto" }: ExportModalProps) {
  const paperSize = project.paperSize || "A3";
  const orientation = project.orientation || "horizontal";
  const imageLayout = project.imageLayout || "original";
  const [showFooter, setShowFooter] = useState(project.showFooter ?? true);
  const [exportQuality, setExportQuality] = useState("hd");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [imageProblems, setImageProblems] = useState<ExportImageProblem[]>([]);
  const [excludedPinIds, setExcludedPinIds] = useState<number[]>([]);
  const [repairedImages, setRepairedImages] = useState<Record<number, string>>({});
  const [resolvingPinIds, setResolvingPinIds] = useState<number[]>([]);
  const [resumeAfterRecovery, setResumeAfterRecovery] = useState(false);
  const exportAttemptRef = useRef<AbortController | null>(null);
  const exportAttemptIdRef = useRef(0);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { toast } = useToast();

  const resolveImageProblem = useCallback(async (problem: ExportImageProblem, action: "repair" | "delete") => {
    if (action === "delete" && !window.confirm(`Delete “${problem.pin.title || "Untitled image"}” permanently from this project?`)) {
      return;
    }
    if (action === "repair" && !problem.repairable) {
      throw new Error("This image cannot be repaired automatically. Delete it or replace it in the editor.");
    }
    setResolvingPinIds((ids) => [...ids, problem.pin.id]);
    try {
    if (action === "delete") {
      const response = await fetch(`/api/pins/${problem.pin.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this image.");
      setExcludedPinIds((ids) => [...ids, problem.pin.id]);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "pins"] });
    } else {
      const repaired = await fetch(`/api/pins/${problem.pin.id}/image-repair`, { method: "POST" });
      if (!repaired.ok) throw new Error("Could not save the repaired image.");
      const uploaded = await repaired.json() as { url?: string };
      if (!uploaded.url) throw new Error("The repaired image was not saved.");
      setRepairedImages((images) => ({ ...images, [problem.pin.id]: uploaded.url! }));
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "pins"] });
    }
    setImageProblems((items) => items.filter((item) => item.pin.id !== problem.pin.id));
    setExportError(null);
    } finally {
      setResolvingPinIds((ids) => ids.filter((id) => id !== problem.pin.id));
    }
  }, [project.id]);

  const handleExport = useCallback(async () => {
    const exportPins = pins
      .filter((pin) => !excludedPinIds.includes(pin.id))
      .map((pin) => repairedImages[pin.id]
        ? { ...pin, imagePath: repairedImages[pin.id], imageUrl: repairedImages[pin.id] }
        : pin);
    if (exportPins.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    setExportProgress("Preparing images...");
    exportAttemptRef.current?.abort();
    const attemptController = new AbortController();
    const attemptId = ++exportAttemptIdRef.current;
    exportAttemptRef.current = attemptController;
    let container: HTMLDivElement | null = null;

    try {
      const logoSrc = await transparentLogo(project.studioLogoPath || brandLogoSrc);
      const inspected = await preloadAndConvertImages(exportPins, setExportProgress, attemptController.signal);
      if (inspected.failures.length) {
        setImageProblems(inspected.failures);
        setResumeAfterRecovery(true);
        setExportError("Some images need attention before this PDF can be exported.");
        return;
      }
      const imageCache = inspected.cache;

      setExportProgress("Loading PDF engine...");
      const { default: jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const isLandscape = orientation === "horizontal";
      const base = PAPER_RATIOS[paperSize] || PAPER_RATIOS.A3;
      const pdfW = isLandscape ? base.h : base.w;
      const pdfH = isLandscape ? base.w : base.h;

      const gridColumns = project.gridColumns || 3;
      const layout = getGridLayout(isLandscape, imageLayout, gridColumns, paperSize);
      const sortedPins = [...exportPins].sort((a, b) => (a.position || 0) - (b.position || 0));
      const pages = paginateMoodboard(sortedPins, layout, pin => isDescLong(pin, descMode));

      const qualityPreset = QUALITY_PRESETS.find(q => q.value === exportQuality) || QUALITY_PRESETS[1];
      const scale = qualityPreset.scale;
      const jpegQuality = qualityPreset.jpegQuality;
      const canvasWidthPx = pdfW * scale;
      const canvasHeightPx = pdfH * scale;

      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: [pdfW, pdfH],
      });

      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.zIndex = "-1";
      document.body.appendChild(container);

      const fontCss = getFontCssForPdf(project.fontFamily || "Montserrat");
      const hasCover = project.showCover !== false;

      const canvasBg = project.canvasBackground || "#ffffff";
      const bgHex = canvasBg.replace("#", "");
      const bgR = parseInt(bgHex.substring(0, 2), 16);
      const bgG = parseInt(bgHex.substring(2, 4), 16);
      const bgB = parseInt(bgHex.substring(4, 6), 16);
      const isBgDark = (bgR * 299 + bgG * 587 + bgB * 114) / 1000 < 128;

      const tc = isBgDark ? {
        pageBg: canvasBg,
        headerText: "#e4e4e7",
        slashColor: "#52525b",
        subText: "#a1a1aa",
        descText: "#a1a1aa",
        mutedColor: "#71717a",
        footerBg: "rgba(255,255,255,0.06)",
        footerText: "#a1a1aa",
        pageNumColor: "#71717a",
        sigColor: "#a1a1aa",
        borderColor: "#3f3f46",
        conceptTitle: "#e4e4e7",
        conceptDesc: "#a1a1aa",
        designerText: "#a1a1aa",
      } : {
        pageBg: canvasBg,
        headerText: "#27272a",
        slashColor: "#d4d4d8",
        subText: "#71717a",
        descText: "#52525b",
        mutedColor: "#a1a1aa",
        footerBg: "rgba(0,0,0,0.04)",
        footerText: "#71717a",
        pageNumColor: "#a1a1aa",
        sigColor: "#a1a1aa",
        borderColor: "#d4d4d8",
        conceptTitle: "#27272a",
        conceptDesc: "#52525b",
        designerText: "#52525b",
      };

      if (hasCover) {
        setExportProgress("Rendering cover page...");
        const cs = scale;
        const coverClamp = (min: number, val: number, max: number) => Math.max(min * cs, Math.min(max * cs, val));
        const coverEl = document.createElement("div");
        coverEl.style.width = `${canvasWidthPx}px`;
        coverEl.style.height = `${canvasHeightPx}px`;
         coverEl.style.position = "relative";
        coverEl.style.background = tc.pageBg;
        coverEl.style.overflow = "hidden";
        coverEl.style.display = "flex";
        coverEl.style.padding = `${canvasWidthPx * 0.04}px`;
        coverEl.style.boxSizing = "border-box";
        coverEl.style.fontFamily = fontCss;
        coverEl.style.gap = `${canvasWidthPx * 0.03}px`;

        const isFullCover = project.coverImageStyle === "full";
        const coverPin = sortedPins[0];

        if (isFullCover) {
          coverEl.style.position = "relative";
          coverEl.style.padding = "0";

          if (coverPin) {
            const bgImg = document.createElement("div");
            const imgSrc = coverPin.imagePath || coverPin.imageUrl || "";
            const resolvedCoverSrc = imageCache.get(imgSrc) || (imgSrc.startsWith("http") ? `/api/image-proxy?url=${encodeURIComponent(imgSrc)}` : imgSrc);
            bgImg.style.position = "absolute";
            bgImg.style.inset = "0";
            bgImg.style.width = "100%";
            bgImg.style.height = "100%";
            bgImg.style.backgroundImage = `url("${resolvedCoverSrc}")`;
            bgImg.style.backgroundSize = "cover";
            bgImg.style.backgroundPosition = "center";
            bgImg.style.backgroundRepeat = "no-repeat";
            coverEl.appendChild(bgImg);
          } else {
            const placeholder = document.createElement("div");
            placeholder.style.position = "absolute";
            placeholder.style.inset = "0";
            placeholder.style.width = "100%";
            placeholder.style.height = "100%";
            placeholder.style.background = "#27272a";
            coverEl.appendChild(placeholder);
          }

          const gradient = document.createElement("div");
          gradient.style.position = "absolute";
          gradient.style.inset = "0";
          gradient.style.background = "linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.3), transparent)";
          coverEl.appendChild(gradient);

          const glassPanel = document.createElement("div");
          glassPanel.style.position = "absolute";
          glassPanel.style.top = "0";
          glassPanel.style.left = "0";
          glassPanel.style.width = "45%";
          glassPanel.style.height = "100%";
          glassPanel.style.background = "rgba(0,0,0,0.35)";
          glassPanel.style.backdropFilter = "blur(16px)";
          glassPanel.style.display = "flex";
          glassPanel.style.flexDirection = "column";
          glassPanel.style.justifyContent = "space-between";
          glassPanel.style.padding = `${canvasWidthPx * 0.05}px`;
          glassPanel.style.boxSizing = "border-box";
          glassPanel.style.boxShadow = "4px 0 20px rgba(0,0,0,0.2)";

          const textColor = "#e4e4e7";
          const mutedColor = "rgba(255,255,255,0.5)";
          const descColor = "rgba(255,255,255,0.6)";

          const topDiv = document.createElement("div");
          {
            const logoImg = document.createElement("img");
            logoImg.src = logoSrc;
            logoImg.style.height = `${coverClamp(20, canvasWidthPx * 0.06, 50)}px`;
            logoImg.style.objectFit = "contain";

            logoImg.style.marginBottom = `${canvasWidthPx * 0.04}px`;
            topDiv.appendChild(logoImg);
          }
          glassPanel.appendChild(topDiv);

          const midDiv = document.createElement("div");
          midDiv.style.flex = "1";
          midDiv.style.display = "flex";
          midDiv.style.flexDirection = "column";
          midDiv.style.justifyContent = "center";

          const accentLine = document.createElement("div");
          accentLine.style.width = `${Math.max(16 * cs, canvasWidthPx * 0.04)}px`;
          accentLine.style.height = "2px";
          accentLine.style.background = "#ea580c";
          accentLine.style.marginBottom = `${canvasWidthPx * 0.03}px`;
          midDiv.appendChild(accentLine);

          const titleEl = document.createElement("h1");
          titleEl.textContent = project.title || "Moodboard";
          titleEl.style.fontWeight = (project.coverTitleWeight === "regular" ? "400" : project.coverTitleWeight === "italic" ? "400" : "700");
          titleEl.style.fontStyle = project.coverTitleWeight === "italic" ? "italic" : "normal";
          titleEl.style.color = project.coverTitleColor || textColor;
          titleEl.style.textTransform = project.coverTitleTransform || "uppercase";
          titleEl.style.letterSpacing = "0.05em";
          titleEl.style.lineHeight = "1.2";
          titleEl.style.fontSize = `${coverClamp(14, canvasWidthPx * 0.038, 30)}px`;
          titleEl.style.textShadow = "0 2px 8px rgba(0,0,0,0.3)";
          midDiv.appendChild(titleEl);

          if (project.descriptionAi) {
            const descEl = document.createElement("p");
            descEl.textContent = project.descriptionAi;
            descEl.style.color = project.coverDescColor || descColor;
            descEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.011, 9)}px`;
            descEl.style.lineHeight = "1.5";
            descEl.style.fontStyle = "italic";
            descEl.style.marginTop = `${canvasWidthPx * 0.01}px`;
            midDiv.appendChild(descEl);
          }
          if (project.clientOwnerName) {
            const clientEl = document.createElement("p");
            clientEl.textContent = `Prepared for ${project.clientOwnerName}${project.clientCompany ? ` — ${project.clientCompany}` : ""}`;
            clientEl.style.color = "rgba(255,255,255,0.7)";
            clientEl.style.fontSize = `${coverClamp(6, canvasWidthPx * 0.014, 11)}px`;
            clientEl.style.marginTop = `${canvasWidthPx * 0.025}px`;
            midDiv.appendChild(clientEl);
          }
          glassPanel.appendChild(midDiv);

          const bottomDiv = document.createElement("div");
          if (project.designerName) {
            const designerByEl = document.createElement("p");
            designerByEl.textContent = "Project Designer by:";
            designerByEl.style.color = mutedColor;
            designerByEl.style.fontSize = `${coverClamp(4, canvasWidthPx * 0.009, 7)}px`;
            bottomDiv.appendChild(designerByEl);
            const designerEl = document.createElement("p");
            designerEl.textContent = project.designerName;
            designerEl.style.color = "rgba(255,255,255,0.9)";
            designerEl.style.fontWeight = "500";
            designerEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.013, 10)}px`;
            designerEl.style.marginTop = `${canvasWidthPx * 0.003}px`;
            bottomDiv.appendChild(designerEl);
            const sigLine = document.createElement("div");
            sigLine.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
            sigLine.style.marginTop = `${canvasWidthPx * 0.02}px`;
            sigLine.style.height = `${coverClamp(10, canvasWidthPx * 0.025, 20)}px`;
            bottomDiv.appendChild(sigLine);
            const sigLabel = document.createElement("p");
            sigLabel.textContent = project.signatureField || "Signature";
            sigLabel.style.color = "rgba(255,255,255,0.4)";
            sigLabel.style.fontStyle = "italic";
            sigLabel.style.fontSize = `${coverClamp(4, canvasWidthPx * 0.009, 7)}px`;
            sigLabel.style.marginBottom = `${canvasWidthPx * 0.015}px`;
            bottomDiv.appendChild(sigLabel);
          }

          const divider = document.createElement("div");
          divider.style.width = "100%";
          divider.style.height = "1px";
          divider.style.background = "rgba(255,255,255,0.2)";
          divider.style.marginBottom = `${canvasWidthPx * 0.015}px`;
          bottomDiv.appendChild(divider);

          const footerRow = document.createElement("div");
          footerRow.style.display = "flex";
          footerRow.style.justifyContent = "space-between";
          footerRow.style.alignItems = "flex-end";
          const dateEl = document.createElement("p");
          dateEl.textContent = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
          dateEl.style.color = mutedColor;
          dateEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.011, 8)}px`;
          footerRow.appendChild(dateEl);
          const createdByEl = document.createElement("p");
          createdByEl.textContent = `created by ${project.studioName || "Moodboard Studio"}`;
          createdByEl.style.color = mutedColor;
          createdByEl.style.fontStyle = "italic";
          createdByEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.011, 8)}px`;
          footerRow.appendChild(createdByEl);
          bottomDiv.appendChild(footerRow);
          glassPanel.appendChild(bottomDiv);

          coverEl.appendChild(glassPanel);
          container.appendChild(coverEl);
        } else {
          const coverLeft = document.createElement("div");
          coverLeft.style.flex = "1.4";
          coverLeft.style.minWidth = "0";
          coverLeft.style.display = "flex";
          coverLeft.style.alignItems = "stretch";

          if (coverPin) {
            const coverImg = document.createElement("div");
            const imgSrc = coverPin.imagePath || coverPin.imageUrl || "";
            const resolvedSplitSrc = imageCache.get(imgSrc) || (imgSrc.startsWith("http") ? `/api/image-proxy?url=${encodeURIComponent(imgSrc)}` : imgSrc);
            coverImg.style.width = "100%";
            coverImg.style.height = "100%";
            coverImg.style.backgroundImage = `url("${resolvedSplitSrc}")`;
            coverImg.style.backgroundSize = "cover";
            coverImg.style.backgroundPosition = "center";
            coverImg.style.backgroundRepeat = "no-repeat";
            coverImg.style.borderRadius = `${Math.max(6 * cs, canvasWidthPx * 0.015)}px`;
            coverImg.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
             coverImg.dataset.exportShadowCard = "true";
            coverLeft.appendChild(coverImg);
          }

          const coverRight = document.createElement("div");
          coverRight.style.flex = "0.6";
          coverRight.style.minWidth = "0";
          coverRight.style.display = "flex";
          coverRight.style.flexDirection = "column";
          coverRight.style.justifyContent = "space-between";
          coverRight.style.paddingTop = `${canvasWidthPx * 0.02}px`;
          coverRight.style.paddingBottom = `${canvasWidthPx * 0.02}px`;

          const coverTopDiv = document.createElement("div");
          {
            const logoImg = document.createElement("img");
            logoImg.src = logoSrc;
            logoImg.style.height = `${coverClamp(20, canvasWidthPx * 0.06, 50)}px`;
            logoImg.style.objectFit = "contain";
            logoImg.style.marginBottom = `${canvasWidthPx * 0.04}px`;
            coverTopDiv.appendChild(logoImg);
          }
          coverRight.appendChild(coverTopDiv);

          const coverMid = document.createElement("div");
          coverMid.style.flex = "1";
          coverMid.style.display = "flex";
          coverMid.style.flexDirection = "column";
          coverMid.style.justifyContent = "center";

          const accentLine = document.createElement("div");
          accentLine.style.width = `${Math.max(16 * cs, canvasWidthPx * 0.04)}px`;
          accentLine.style.height = "2px";
          accentLine.style.background = "#ea580c";
          accentLine.style.marginBottom = `${canvasWidthPx * 0.03}px`;
          coverMid.appendChild(accentLine);

          const autoTitleColor = isBgDark ? "#e4e4e7" : "#27272a";
          const autoDescColor = isBgDark ? "#71717a" : "#a1a1aa";

          const titleEl = document.createElement("h1");
          titleEl.textContent = project.title || "Moodboard";
          titleEl.style.fontWeight = (project.coverTitleWeight === "regular" ? "400" : project.coverTitleWeight === "italic" ? "400" : "700");
          titleEl.style.fontStyle = project.coverTitleWeight === "italic" ? "italic" : "normal";
          titleEl.style.color = project.coverTitleColor || autoTitleColor;
          titleEl.style.textTransform = project.coverTitleTransform || "uppercase";
          titleEl.style.letterSpacing = "0.05em";
          titleEl.style.lineHeight = "1.2";
          titleEl.style.fontSize = `${coverClamp(14, canvasWidthPx * 0.038, 30)}px`;
          titleEl.style.marginBottom = `${canvasWidthPx * 0.015}px`;
          coverMid.appendChild(titleEl);

          if (project.descriptionAi) {
            const descEl = document.createElement("p");
            descEl.textContent = project.descriptionAi;
            descEl.style.color = project.coverDescColor || autoDescColor;
            descEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.011, 9)}px`;
            descEl.style.lineHeight = "1.5";
            descEl.style.fontStyle = "italic";
            descEl.style.marginTop = `${canvasWidthPx * 0.01}px`;
            coverMid.appendChild(descEl);
          }
          if (project.clientOwnerName) {
            const clientEl = document.createElement("p");
            clientEl.textContent = `Prepared for ${project.clientOwnerName}${project.clientCompany ? ` — ${project.clientCompany}` : ""}`;
            clientEl.style.color = isBgDark ? "#a1a1aa" : "#71717a";
            clientEl.style.fontSize = `${coverClamp(6, canvasWidthPx * 0.014, 11)}px`;
            clientEl.style.marginTop = `${canvasWidthPx * 0.025}px`;
            coverMid.appendChild(clientEl);
          }
          coverRight.appendChild(coverMid);

          const coverBottom = document.createElement("div");
          if (project.designerName) {
            const designerByEl = document.createElement("p");
            designerByEl.textContent = "Project Designer by:";
            designerByEl.style.color = isBgDark ? "#71717a" : "#a1a1aa";
            designerByEl.style.fontSize = `${coverClamp(4, canvasWidthPx * 0.009, 7)}px`;
            coverBottom.appendChild(designerByEl);

            const designerEl = document.createElement("p");
            designerEl.textContent = project.designerName;
            designerEl.style.color = isBgDark ? "#d4d4d8" : "#3f3f46";
            designerEl.style.fontWeight = "500";
            designerEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.013, 10)}px`;
            designerEl.style.marginTop = `${canvasWidthPx * 0.003}px`;
            coverBottom.appendChild(designerEl);

            const sigLine = document.createElement("div");
            sigLine.style.borderBottom = `1px solid ${isBgDark ? "#3f3f46" : "#d4d4d8"}`;
            sigLine.style.marginTop = `${canvasWidthPx * 0.02}px`;
            sigLine.style.marginBottom = `${canvasWidthPx * 0.005}px`;
            sigLine.style.height = `${coverClamp(10, canvasWidthPx * 0.025, 20)}px`;
            coverBottom.appendChild(sigLine);

            const sigLabel = document.createElement("p");
            sigLabel.textContent = project.signatureField || "Signature";
            sigLabel.style.color = isBgDark ? "#71717a" : "#a1a1aa";
            sigLabel.style.fontStyle = "italic";
            sigLabel.style.fontSize = `${coverClamp(4, canvasWidthPx * 0.009, 7)}px`;
            sigLabel.style.marginBottom = `${canvasWidthPx * 0.015}px`;
            coverBottom.appendChild(sigLabel);
          }

          const divider = document.createElement("div");
          divider.style.width = "100%";
          divider.style.height = "1px";
          divider.style.background = isBgDark ? "#3f3f46" : "#e4e4e7";
          divider.style.marginBottom = `${canvasWidthPx * 0.015}px`;
          coverBottom.appendChild(divider);

          const footerRow = document.createElement("div");
          footerRow.style.display = "flex";
          footerRow.style.justifyContent = "space-between";
          footerRow.style.alignItems = "flex-end";

          const dateEl = document.createElement("p");
          dateEl.textContent = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
          dateEl.style.color = isBgDark ? "#71717a" : "#a1a1aa";
          dateEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.011, 8)}px`;
          footerRow.appendChild(dateEl);

          const createdByEl = document.createElement("p");
          createdByEl.textContent = `created by ${project.studioName || "Moodboard Studio"}`;
          createdByEl.style.color = isBgDark ? "#71717a" : "#a1a1aa";
          createdByEl.style.fontStyle = "italic";
          createdByEl.style.fontSize = `${coverClamp(5, canvasWidthPx * 0.011, 8)}px`;
          footerRow.appendChild(createdByEl);

          coverBottom.appendChild(footerRow);
          coverRight.appendChild(coverBottom);

          coverEl.appendChild(coverLeft);
          coverEl.appendChild(coverRight);
          container.appendChild(coverEl);
        }

        await new Promise((r) => setTimeout(r, 500));
        appendRasterizedShadowLayer(coverEl, canvasWidthPx / (isLandscape ? 960 : 640));
        const coverCanvas = await Promise.race([
          html2canvas(coverEl, { scale: 1, useCORS: true, allowTaint: true, backgroundColor: tc.pageBg }),
          new Promise<HTMLCanvasElement>((_, reject) =>
            setTimeout(() => reject(new Error("Cover page render timeout")), 60000)
          ),
        ]);
        const coverImgData = coverCanvas.toDataURL("image/jpeg", jpegQuality);
        pdf.addImage(coverImgData, "JPEG", 0, 0, pdfW, pdfH);
        container.removeChild(coverEl);
      }

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        if (attemptController.signal.aborted) throw new DOMException("Export cancelled", "AbortError");
        setExportProgress(`Rendering page ${pageIdx + 1} of ${pages.length}...`);
        const pagePins = pages[pageIdx];

        const screenW = isLandscape ? 960 : 640;
        const screenScale = canvasWidthPx / screenW;
        const clamp = (min: number, val: number, max: number) => {
          const screenVal = canvasWidthPx > 0 ? val * (screenW / canvasWidthPx) : val;
          const screenClamped = Math.max(min, Math.min(max, screenVal));
          return screenClamped * (canvasWidthPx / screenW);
        };

        const pageEl = document.createElement("div");
        pageEl.style.width = `${canvasWidthPx}px`;
        pageEl.style.height = `${canvasHeightPx}px`;
        pageEl.style.position = "relative";
        pageEl.style.background = tc.pageBg;
        pageEl.style.overflow = "hidden";
        pageEl.style.display = "flex";
        pageEl.style.flexDirection = "column";
        pageEl.style.padding = `${canvasWidthPx * 0.03}px`;
        pageEl.style.boxSizing = "border-box";
        pageEl.style.fontFamily = getFontCssForPdf(project.fontFamily || "Montserrat");

        if (project.studioName || project.projectName) {
          const header = document.createElement("div");
          header.style.display = "flex";
          header.style.alignItems = "center";
          header.style.gap = `${canvasWidthPx * 0.01}px`;
          header.style.marginBottom = `${canvasWidthPx * 0.02}px`;
          header.style.flexShrink = "0";
          if (project.studioName) {
            const studioEl = document.createElement("span");
            studioEl.textContent = project.studioName;
            studioEl.style.fontWeight = "600";
            studioEl.style.color = tc.headerText;
            studioEl.style.textTransform = "uppercase";
            studioEl.style.letterSpacing = "0.05em";
            studioEl.style.fontSize = `${clamp(8, canvasWidthPx * 0.022, 14)}px`;
            header.appendChild(studioEl);
          }
          if (project.projectName) {
            const slash = document.createElement("span");
            slash.textContent = "/";
            slash.style.color = tc.slashColor;
            slash.style.fontSize = `${clamp(7, canvasWidthPx * 0.018, 12)}px`;
            header.appendChild(slash);
            const projEl = document.createElement("span");
            projEl.textContent = project.projectName;
            projEl.style.color = tc.subText;
            projEl.style.fontSize = `${clamp(7, canvasWidthPx * 0.018, 12)}px`;
            header.appendChild(projEl);
          }
          pageEl.appendChild(header);
        }

        const contentRow = document.createElement("div");
        contentRow.style.flex = "1";
        contentRow.style.minHeight = "0";
        contentRow.style.display = "flex";
        contentRow.style.gap = `${canvasWidthPx * 0.02}px`;

        const pageDescs = (project.pageDescriptions as Array<{ title: string; description: string }>) || [];
        const pageDesc = pageDescs[pageIdx];
        const conceptCol = document.createElement("div");
        conceptCol.style.width = "20%";
        conceptCol.style.flexShrink = "0";
        conceptCol.style.display = "flex";
        conceptCol.style.flexDirection = "column";
        conceptCol.style.justifyContent = "space-between";

        const conceptTop = document.createElement("div");
        if (pageDesc?.title) {
          const title = document.createElement("h3");
          title.textContent = pageDesc.title;
          title.style.fontWeight = "700";
          title.style.color = tc.conceptTitle;
          title.style.fontSize = `${clamp(10, canvasWidthPx * 0.028, 20)}px`;
          title.style.lineHeight = "1.2";
          title.style.marginBottom = `${canvasWidthPx * 0.02}px`;
          conceptTop.appendChild(title);
        }
        if (pageDesc?.description) {
          const desc = document.createElement("p");
          desc.textContent = pageDesc.description;
          desc.style.color = tc.conceptDesc;
          desc.style.fontSize = `${clamp(6, canvasWidthPx * 0.014, 10)}px`;
          desc.style.lineHeight = "1.3";
          conceptTop.appendChild(desc);
        }
        conceptCol.appendChild(conceptTop);

        const conceptBottom = document.createElement("div");
        if (project.clientOwnerName) {
          const designerEl = document.createElement("p");
          designerEl.textContent = project.clientOwnerName;
          designerEl.style.color = tc.designerText;
          designerEl.style.fontWeight = "500";
          designerEl.style.fontSize = `${clamp(5, canvasWidthPx * 0.012, 8)}px`;
          designerEl.style.marginBottom = `${canvasWidthPx * 0.008}px`;
          conceptBottom.appendChild(designerEl);
        }
        const sigLine = document.createElement("div");
        sigLine.style.borderBottom = `1px solid ${tc.borderColor}`;
        sigLine.style.marginBottom = `${canvasWidthPx * 0.012}px`;
        sigLine.style.paddingBottom = `${canvasWidthPx * 0.004}px`;
        const sigLabel = document.createElement("p");
        sigLabel.textContent = project.signatureField || "Signature";
        sigLabel.style.color = tc.sigColor;
        sigLabel.style.fontStyle = "italic";
        sigLabel.style.fontSize = `${clamp(5, canvasWidthPx * 0.01, 7)}px`;
        sigLine.appendChild(sigLabel);
        const sigSpace = document.createElement("div");
        sigSpace.style.height = `${clamp(12, canvasWidthPx * 0.03, 24)}px`;
        sigLine.appendChild(sigSpace);
        conceptBottom.appendChild(sigLine);

        const timestamp = document.createElement("p");
        timestamp.textContent = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        timestamp.style.color = tc.mutedColor;
        timestamp.style.fontSize = `${clamp(4, canvasWidthPx * 0.009, 6)}px`;
        conceptBottom.appendChild(timestamp);
        conceptCol.appendChild(conceptBottom);

        contentRow.appendChild(conceptCol);

        const imageContainer = document.createElement("div");
        imageContainer.style.flex = "1";
        imageContainer.style.minHeight = "0";
        imageContainer.style.overflow = "hidden";

        const screenGap = Math.max(6, Math.min(12, screenW * 0.015));
        const gapRatio = screenGap / screenW;
        const gapPx = canvasWidthPx * gapRatio;
        const gap = `${gapPx}px`;
        const borderRadiusPx = `${(4 / screenW) * canvasWidthPx}px`;

        const FONT_SIZE_RATIOS_PDF = {
          small: { desc: 0.00686 },
          normal: { desc: 0.0085 },
          large: { desc: 0.0252 },
        };
        const descFontSize = project.descriptionFontSize || "normal";
        const descRatio = FONT_SIZE_RATIOS_PDF[descFontSize as keyof typeof FONT_SIZE_RATIOS_PDF] || FONT_SIZE_RATIOS_PDF.normal;
        const screenDescPx = Math.max(3.5, Math.min(16, screenW * descRatio.desc));
        const descFontRatio = screenDescPx / screenW;
        const descFontPx = canvasWidthPx * descFontRatio;

        const addApprovalBadge = (parent: HTMLElement, pin: Pin) => {
          if (!pin.approvalStatus) return;
          const badge = document.createElement("div");
          badge.style.position = "absolute";
          badge.style.top = "4%";
          badge.style.right = "4%";
          badge.style.width = `${canvasWidthPx * 0.03}px`;
          badge.style.height = `${canvasWidthPx * 0.03}px`;
          badge.style.borderRadius = `${canvasWidthPx * 0.003}px`;
          badge.style.display = "flex";
          badge.style.alignItems = "center";
          badge.style.justifyContent = "center";
          badge.style.backgroundColor = pin.approvalStatus === "approved" ? "#10b981" : "#ef4444";
          badge.style.color = "#ffffff";
          badge.style.fontSize = `${canvasWidthPx * 0.02}px`;
          badge.style.fontWeight = "700";
          badge.textContent = pin.approvalStatus === "approved" ? "\u2713" : "\u2717";
          parent.appendChild(badge);
        };

        const addDescriptionEl = (parent: HTMLElement, pin: Pin) => {
          if (!getPinDesc(pin)) return;
          const descCard = document.createElement("div");
          // The card is an opaque white surface even when the page uses a color.
          // The caption stays transparent so it does not composite a second tint.
          parent.style.backgroundColor = EXPORT_CARD_SURFACE;
          descCard.style.backgroundColor = "transparent";
          const vPad = Math.max(4 * screenScale, canvasWidthPx * 0.012);
          const hPad = Math.max(3 * screenScale, canvasWidthPx * 0.01);
          descCard.style.width = "100%";
          descCard.style.alignSelf = "stretch";
          descCard.style.padding = `${vPad}px ${hPad}px`;
          descCard.style.borderBottomLeftRadius = borderRadiusPx;
          descCard.style.borderBottomRightRadius = borderRadiusPx;
          descCard.style.flexShrink = "0";
          descCard.style.display = "flex";
          descCard.style.alignItems = "flex-start";
          descCard.style.boxSizing = "border-box";
          const descEl = document.createElement("p");
          descEl.textContent = getPinDesc(pin);
          descEl.style.color = EXPORT_CARD_TEXT;
          descEl.style.fontSize = `${descFontPx}px`;
          descEl.style.lineHeight = "1.3";
          descEl.style.width = "100%";
          descEl.style.minWidth = "0";
          descEl.style.overflowWrap = "anywhere";
          descEl.style.margin = "0";
          descCard.appendChild(descEl);
          parent.appendChild(descCard);
        };

        const addShortDescriptionEl = (parent: HTMLElement, pin: Pin) => {
          if (!isDescLong(pin, descMode)) addDescriptionEl(parent, pin);
        };

        const createDescOverflowCell = (pin: Pin) => {
          const cell = document.createElement("div");
          cell.style.borderRadius = borderRadiusPx;
          cell.style.position = "relative";
          cell.style.display = "flex";
          cell.style.flexDirection = "column";
          cell.style.alignItems = "flex-start";
          cell.style.justifyContent = "center";
          cell.style.padding = "6%";
          prepareExportCard(cell);

          const arrowSize = clamp(12, canvasWidthPx * 0.025, 18);
          const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          arrowSvg.setAttribute("width", `${arrowSize}`);
          arrowSvg.setAttribute("height", `${arrowSize}`);
          arrowSvg.setAttribute("viewBox", "0 0 24 24");
          arrowSvg.setAttribute("fill", "none");
          arrowSvg.setAttribute("stroke", "#ea580c");
          arrowSvg.setAttribute("stroke-width", "2");
          arrowSvg.setAttribute("stroke-linecap", "round");
          arrowSvg.setAttribute("stroke-linejoin", "round");
          arrowSvg.style.position = "absolute";
          arrowSvg.style.top = "8%";
          arrowSvg.style.left = "6%";
          const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          arrowPath.setAttribute("d", "M19 12H5M12 19l-7-7 7-7");
          arrowSvg.appendChild(arrowPath);
          cell.appendChild(arrowSvg);

          const descEl = document.createElement("p");
          descEl.textContent = getPinDesc(pin);
          descEl.style.color = EXPORT_CARD_TEXT;
          descEl.style.fontSize = `${descFontPx}px`;
          descEl.style.lineHeight = "1.3";
          descEl.style.margin = "0";
          descEl.style.paddingTop = "12%";
          cell.appendChild(descEl);

          return cell;
        };

        if (layout.useGrid) {
          type GridCell = { type: "image"; pin: Pin } | { type: "desc-overflow"; pin: Pin } | { type: "empty" };
          const gridCells: GridCell[] = [];
          for (const pin of pagePins) {
            if (isDescLong(pin, descMode) && gridCells.length % layout.cols === layout.cols - 1) {
              gridCells.push({ type: "empty" });
            }
            gridCells.push({ type: "image", pin });
            if (isDescLong(pin, descMode)) {
              gridCells.push({ type: "desc-overflow", pin });
            }
          }
          const totalSlots = layout.cols * layout.rows;
          for (let i = gridCells.length; i < totalSlots; i++) {
            gridCells.push({ type: "empty" });
          }

          imageContainer.style.display = "grid";
          imageContainer.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
          imageContainer.style.gridTemplateRows = `repeat(${layout.rows}, minmax(0, 1fr))`;
          imageContainer.style.gap = gap;

          for (const gc of gridCells) {
            if (gc.type === "empty") {
              const emptyCell = document.createElement("div");
              imageContainer.appendChild(emptyCell);
              continue;
            }
            if (gc.type === "desc-overflow") {
              imageContainer.appendChild(createDescOverflowCell(gc.pin));
              continue;
            }
            const pin = gc.pin;
            const isLongDesc = isDescLong(pin, descMode);
            const hasShortDesc = !!getPinDesc(pin) && !isLongDesc;
            const cell = document.createElement("div");
            cell.style.overflow = "hidden";
            cell.style.borderRadius = borderRadiusPx;
            cell.style.position = "relative";
            cell.style.display = "flex";
            cell.style.flexDirection = "column";
            prepareExportCard(cell);
            const imgWrap = document.createElement("div");
            imgWrap.style.flex = "1";
            imgWrap.style.minHeight = "0";
            imgWrap.style.overflow = "hidden";
            imgWrap.style.borderRadius = hasShortDesc ? `${borderRadiusPx} ${borderRadiusPx} 0 0` : borderRadiusPx;
            imgWrap.style.position = "relative";
            const img = document.createElement("div");
            const rawSrc = pin.imagePath || pin.imageUrl || "";
            const resolvedSrc = imageCache.get(rawSrc) || (rawSrc.includes("pinimg.com") ? `/api/image-proxy?url=${encodeURIComponent(rawSrc)}` : rawSrc);
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.backgroundImage = `url("${resolvedSrc}")`;
            img.style.backgroundSize = "cover";
            img.style.backgroundPosition = "center";
            img.style.backgroundRepeat = "no-repeat";
            imgWrap.appendChild(img);
            addApprovalBadge(imgWrap, pin);
            cell.appendChild(imgWrap);
            addShortDescriptionEl(cell, pin);
            imageContainer.appendChild(cell);
          }
        } else {
          imageContainer.style.columnCount = String(layout.cols);
          imageContainer.style.columnGap = gap;

          for (const pin of pagePins) {
            const hasDesc = !!getPinDesc(pin);
            const cell = document.createElement("div");
            cell.style.breakInside = "avoid";
            cell.style.overflow = "hidden";
            cell.style.marginBottom = gap;
            cell.style.borderRadius = borderRadiusPx;
            cell.style.position = "relative";
            prepareExportCard(cell);

            const imgWrap = document.createElement("div");
            imgWrap.style.position = "relative";
            imgWrap.style.overflow = "hidden";
            imgWrap.style.borderRadius = hasDesc ? `${borderRadiusPx} ${borderRadiusPx} 0 0` : borderRadiusPx;
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            const rawSrc = pin.imagePath || pin.imageUrl || "";
            img.src = imageCache.get(rawSrc) || (rawSrc.includes("pinimg.com") ? `/api/image-proxy?url=${encodeURIComponent(rawSrc)}` : rawSrc);
            img.style.width = "100%";
            img.style.height = "auto";
            img.style.display = "block";
            imgWrap.appendChild(img);
            addApprovalBadge(imgWrap, pin);
            cell.appendChild(imgWrap);
            addDescriptionEl(cell, pin);
            imageContainer.appendChild(cell);
          }
        }

        contentRow.appendChild(imageContainer);
        pageEl.appendChild(contentRow);

        // Keep the designer/client sign-off row that appears below the editor
        // canvas. The concept column above has its own client signature field;
        // this row is the second, full-width approval row.
        const signatureRow = document.createElement("div");
        signatureRow.style.marginTop = `${canvasWidthPx * 0.02}px`;
        signatureRow.style.flexShrink = "0";
        signatureRow.style.display = "flex";
        signatureRow.style.alignItems = "flex-end";
        signatureRow.style.justifyContent = "space-between";
        signatureRow.style.gap = `${canvasWidthPx * (16 / screenW)}px`;

        const makeSignatureCell = (name: string, label: string) => {
          const cell = document.createElement("div");
          cell.style.width = `${Math.max(60 * (canvasWidthPx / screenW), canvasWidthPx * 0.2)}px`;

          const nameEl = document.createElement("p");
          nameEl.textContent = name;
          nameEl.style.margin = "0";
          nameEl.style.fontSize = `${clamp(4, canvasWidthPx * 0.009, 7)}px`;
          nameEl.style.color = tc.conceptDesc;
          cell.appendChild(nameEl);

          const line = document.createElement("div");
          line.style.borderBottom = `1px solid ${tc.borderColor}`;
          line.style.marginTop = `${canvasWidthPx * 0.012}px`;
          line.style.marginBottom = `${canvasWidthPx * 0.004}px`;
          cell.appendChild(line);

          const labelEl = document.createElement("p");
          labelEl.textContent = label;
          labelEl.style.margin = "0";
          labelEl.style.fontStyle = "italic";
          labelEl.style.fontSize = `${clamp(3, canvasWidthPx * 0.007, 6)}px`;
          labelEl.style.color = tc.mutedColor;
          cell.appendChild(labelEl);
          return cell;
        };

        signatureRow.appendChild(makeSignatureCell(project.designerName || "", "Project Designer"));
        signatureRow.appendChild(makeSignatureCell(project.clientOwnerName || "", "Client"));
        pageEl.appendChild(signatureRow);

        if (showFooter) {
          const footer = document.createElement("div");
          footer.style.display = "flex";
          footer.style.justifyContent = "space-between";
          footer.style.alignItems = "center";
          footer.style.marginTop = `${canvasWidthPx * 0.01}px`;
          footer.style.marginLeft = `-${canvasWidthPx * 0.03}px`;
          footer.style.marginRight = `-${canvasWidthPx * 0.03}px`;
          footer.style.padding = `${canvasWidthPx * 0.008}px ${canvasWidthPx * 0.03}px`;
          footer.style.backgroundColor = tc.footerBg;
          footer.style.flexShrink = "0";

          const leftText = document.createElement("p");
          leftText.textContent = `created by ${project.studioName || "Moodboard Studio"}`;
          leftText.style.color = tc.footerText;
          leftText.style.fontSize = `${canvasWidthPx * 0.009}px`;
          footer.appendChild(leftText);

          const rightWrapper = document.createElement("div");
          rightWrapper.style.display = "flex";
          rightWrapper.style.alignItems = "center";
          rightWrapper.style.gap = `${canvasWidthPx * 0.015}px`;

          const rightText = document.createElement("p");
          const totalPdfPages = pages.length + (hasCover ? 1 : 0);
          rightText.textContent = `${pageIdx + 1 + (hasCover ? 1 : 0)}/${totalPdfPages}`;
          rightText.style.color = tc.pageNumColor;
          rightText.style.fontSize = `${canvasWidthPx * 0.009}px`;
          rightWrapper.appendChild(rightText);

          {
            const logoImg = document.createElement("img");
            logoImg.src = logoSrc;
            logoImg.style.height = `${canvasWidthPx * 0.025}px`;
            logoImg.style.objectFit = "contain";
            rightWrapper.appendChild(logoImg);
          }

          footer.appendChild(rightWrapper);

          pageEl.appendChild(footer);
        }

        container.appendChild(pageEl);

        // Capture only after the actual font metrics have settled.
        await document.fonts.ready;

        await new Promise<void>((resolve) => {
          const images = pageEl.querySelectorAll("img");
          let loaded = 0;
          const total = images.length;
          if (total === 0) { resolve(); return; }

          const checkDone = () => {
            loaded++;
            if (loaded >= total) resolve();
          };

          images.forEach((img) => {
            if (img.complete) { checkDone(); return; }
            img.onload = checkDone;
            img.onerror = () => {
              img.style.background = "#e5e5e5";
              img.style.minHeight = "50px";
              checkDone();
            };
          });

          setTimeout(resolve, 8000);
        });

        await new Promise((r) => setTimeout(r, 200));
        const shadowLayer = appendRasterizedShadowLayer(pageEl, canvasWidthPx / screenW);
        if (shadowLayer) await waitForRasterizedShadowLayer(shadowLayer);

        const canvas = await Promise.race([
          html2canvas(pageEl, {
            scale: 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: tc.pageBg,
            width: canvasWidthPx,
            height: canvasHeightPx,
            logging: false,
          }),
          new Promise<HTMLCanvasElement>((_, reject) =>
            setTimeout(() => reject(new Error(`Page ${pageIdx + 1} render timeout`)), 60000)
          ),
        ]);
        if (attemptController.signal.aborted) throw new DOMException("Export cancelled", "AbortError");

        if (pageIdx > 0 || hasCover) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", jpegQuality), "JPEG", 0, 0, pdfW, pdfH);

        container.removeChild(pageEl);
      }

      setExportProgress("Saving PDF...");
      const filename = `${project.title || "moodboard"}-${paperSize}-${isLandscape ? "landscape" : "portrait"}.pdf`;
      pdf.save(filename);
      toast({ title: "PDF exported successfully" });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("PDF export error:", err);
      const isTimeout = err?.message?.includes("timeout") || err?.name === "AbortError";
      setExportError(isTimeout ? "Export timed out. Some images may be too large or unreachable." : "Export failed. There may be problematic images in your moodboard.");
    } finally {
      container?.remove();
      if (exportAttemptIdRef.current === attemptId) {
        exportAttemptRef.current = null;
        setIsExporting(false);
        setExportProgress("");
      }
    }
  }, [pins, excludedPinIds, repairedImages, project, showFooter, exportQuality, toast, isDark, descMode]);

  useEffect(() => {
    if (!resumeAfterRecovery || imageProblems.length > 0 || resolvingPinIds.length > 0 || isExporting) return;
    setResumeAfterRecovery(false);
    void handleExport();
  }, [resumeAfterRecovery, imageProblems.length, resolvingPinIds.length, isExporting, handleExport]);

  useEffect(() => {
    exportAttemptRef.current?.abort();
    setImageProblems([]);
    setExcludedPinIds([]);
    setRepairedImages({});
    setResolvingPinIds([]);
    setResumeAfterRecovery(false);
    setExportError(null);
  }, [open, project.id]);

  const orientationLabel = orientation === "horizontal" ? "Landscape" : "Portrait";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem)] sm:max-w-md border-0 p-0 overflow-x-hidden overflow-y-auto"
        overlayClassName="bg-transparent"
        style={{ background: "transparent", boxShadow: "none" }}
      >
        <div
          className="w-full min-w-0 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5 modal-glass-card"
        >
          <div>
            <DialogHeader className="p-0">
              <DialogTitle className="font-serif text-xl text-foreground">Export PDF</DialogTitle>
              <DialogDescription className="text-xs text-foreground/60">
                Export your moodboard as a high-quality PDF document.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div
            className="rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs text-foreground/60"
            style={{
              background: "hsl(var(--muted) / 0.35)",
              border: "1px solid hsl(var(--border) / 0.2)",
            }}
            data-testid="export-summary"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{pins.length} images</span>
            <span className="text-foreground/30">/</span>
            <span>{paperSize} {orientationLabel}</span>
            <span className="text-foreground/30">/</span>
            <span className="capitalize">{imageLayout === "original" ? "Original" : imageLayout.replace("_", " ")}</span>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block text-foreground/60 uppercase tracking-wider">Quality</label>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
              {QUALITY_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActive = exportQuality === preset.value;
                return (
                  <button
                    key={preset.value}
                    onClick={() => setExportQuality(preset.value)}
                    className="min-w-0 p-2.5 sm:p-3 rounded-lg text-center transition-all flex flex-col items-center gap-1"
                    style={{
                      background: isActive ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted) / 0.2)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: isActive ? "1.5px solid hsl(var(--primary) / 0.6)" : "1px solid hsl(var(--border) / 0.2)",
                    }}
                    data-testid={`button-quality-${preset.value}`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-foreground/50"}`} />
                    <span className={`text-xs font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{preset.label}</span>
                    <span className="text-[10px] text-foreground/50">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-4 rounded-lg p-3"
            style={{
              background: "hsl(var(--muted) / 0.2)",
              border: "1px solid hsl(var(--border) / 0.15)",
            }}
          >
            <div>
              <p className="text-sm font-medium text-foreground">Footer</p>
              <p className="text-[10px] text-foreground/50">Studio branding & page numbers</p>
            </div>
            <Switch
              checked={showFooter}
              onCheckedChange={setShowFooter}
              data-testid="switch-export-footer"
            />
          </div>

          {imageProblems.length > 0 && (
            <div
              className="w-full min-w-0 max-h-[42dvh] overflow-x-hidden overflow-y-auto rounded-lg p-3 space-y-3"
              style={{ background: "hsl(var(--destructive) / 0.08)", border: "1px solid hsl(var(--destructive) / 0.3)" }}
              data-testid="export-image-recovery"
            >
              <div>
                <p className="text-sm font-medium text-destructive">Images need attention</p>
                <p className="text-xs text-foreground/60 mt-1">
                  Repair saves a normalized copy to your project. Delete permanently removes the image from this project.
                </p>
              </div>
              {imageProblems.map((problem) => (
                <div key={problem.pin.id} className="w-full min-w-0 flex gap-3 items-start rounded-md p-2 bg-background/40">
                  {problem.preview ? (
                    <img
                      src={problem.preview}
                      alt={problem.pin.title || "Problematic image"}
                      className="w-14 h-14 rounded object-cover shrink-0 bg-muted"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded shrink-0 bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      Image {problem.position}: {problem.pin.title || "Untitled image"}
                    </p>
                    <p className="text-[11px] text-foreground/60 mt-1">{problem.reason}</p>
                    {problem.source && (
                      <p className="max-w-full text-[10px] text-foreground/40 mt-1 break-all line-clamp-2" title={problem.source}>
                        Source: {problem.source}
                      </p>
                    )}
                    {(problem.width || problem.fileSize) && (
                      <p className="text-[10px] text-foreground/45 mt-1">
                        {problem.width && problem.height ? `${problem.width}×${problem.height}px` : ""}
                        {problem.width && problem.fileSize ? " · " : ""}
                        {problem.fileSize ? `${(problem.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}
                      </p>
                    )}
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2 mt-2">
                      <Button
                        size="sm"
                        className="w-full min-w-0 h-auto min-h-9 whitespace-normal px-2 text-center"
                        disabled={!problem.repairable || resolvingPinIds.includes(problem.pin.id)}
                        onClick={() => resolveImageProblem(problem, "repair").catch((error) => toast({ title: "Could not repair image", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }))}
                        data-testid={`button-repair-image-${problem.pin.id}`}
                      >
                        {resolvingPinIds.includes(problem.pin.id) ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                        {problem.repairable ? "Optimize & repair" : "Cannot auto-repair"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full min-w-0 h-auto min-h-9 whitespace-normal px-2 text-center"
                        disabled={resolvingPinIds.includes(problem.pin.id)}
                        onClick={() => resolveImageProblem(problem, "delete").catch((error) => toast({ title: "Could not delete image", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }))}
                        data-testid={`button-delete-image-${problem.pin.id}`}
                      >
                        Delete permanently
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-foreground/50">
                Export continues automatically after every listed image is repaired or deleted. Your layout and quality settings are preserved.
              </p>
            </div>
          )}

          {exportError && imageProblems.length === 0 && (
            <div
              className="rounded-lg p-3 text-xs space-y-2"
              style={{
                background: "hsl(var(--destructive) / 0.1)",
                border: "1px solid hsl(var(--destructive) / 0.3)",
              }}
              data-testid="export-error"
            >
              <p className="text-destructive font-medium">{exportError}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { setExportError(null); handleExport(); }}
                  data-testid="button-export-retry"
                >
                  Retry Export
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExportError(null)}
                  data-testid="button-export-dismiss"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleExport}
            disabled={isExporting || pins.length === 0 || imageProblems.length > 0 || resolvingPinIds.length > 0}
            data-testid="button-export-submit"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {exportProgress || "Generating PDF..."}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                Export PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
