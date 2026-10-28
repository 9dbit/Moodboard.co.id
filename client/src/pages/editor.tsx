import { getGridLayout, paginateMoodboard } from "@shared/layout-pagination";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useIsMutating } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo, brandLogoSrc } from "@/components/brand-logo";
import { StudioLogo } from "@/components/studio-logo";
import { ScaledPagePreview } from "@/components/scaled-page-preview";
import { getPinDesc, isDescLong, type DescMode } from "@/lib/pin-description";
import { EXPORT_CARD_SURFACE, EXPORT_CARD_TEXT } from "@/lib/export-card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Layers,
  Plus,
  Sparkles,
  FileText,
  Share2,
  Upload,
  Link2,
  Trash2,
  GripVertical,
  X,
  Eye,
  EyeOff,
  Flame,
  Sun,
  Snowflake,
  Image as ImageIcon,
  Tag,
  MessageSquare,
  Palette,
  Download,
  Copy,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Loader2,
  Shuffle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Type,
  AlignLeft,
  AlignJustify,
  LayoutGrid,
  Check,
  XIcon,
  Minus,
  PenLine,
  ChevronRight,
  PanelLeft,
  Columns,
  SlidersHorizontal,
  Filter,
  MoveHorizontal,
  Undo2,
  Redo2,
  Menu,
  RefreshCw,
  AlertTriangle,
  ScanSearch,
  CopyX,
  Eraser,
} from "lucide-react";
import type { Project, Pin } from "@shared/schema";
import { ExportModal } from "@/components/export-modal";
import { ShareModal } from "@/components/share-modal";
import { PinDetailSheet } from "@/components/pin-detail-sheet";
import { ImageLightbox } from "@/components/image-lightbox";
import { useUndoRedo } from "@/hooks/use-undo-redo";

function normalizeImageUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const pinMatch = u.pathname.match(/\/(?:\d+x\d*|originals)\/(.+)$/i);
    if (pinMatch) return pinMatch[1].toLowerCase();
    return u.pathname.toLowerCase();
  } catch {
    const lastSlash = url.lastIndexOf("/");
    return lastSlash >= 0 ? url.slice(lastSlash + 1).toLowerCase() : url.toLowerCase();
  }
}

function findDuplicatePins(pins: Pin[]): Map<string, Pin[]> {
  const groups = new Map<string, Pin[]>();
  for (const pin of pins) {
    const key = normalizeImageUrl(pin.imagePath || pin.imageUrl || "");
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(pin);
  }
  const duplicates = new Map<string, Pin[]>();
  groups.forEach((group, key) => { if (group.length > 1) duplicates.set(key, group); });
  return duplicates;
}

const shotTypes = ["facade", "interior", "detail", "lighting", "furniture", "landscape", "material"];

const PAGE_CATEGORY_TEMPLATES: Record<string, string[]> = {
  architecture: [
    "Facade Concept", "Landscape Design", "Exterior Material", "Lighting Design",
    "Floor Plan", "Section & Elevation", "Interior Overview", "Structural Detail",
    "Roof Design", "Entrance & Gate", "Pool & Water Feature", "Garden & Greenery",
    "Night View", "Aerial View", "Site Plan", "Construction Detail",
  ],
  interior: [
    "Living Room", "Kitchen & Dining", "Master Bedroom", "Bathroom Design",
    "Material Palette", "Color Scheme", "Furniture Selection", "Lighting Plan",
    "Ceiling Design", "Wall Treatment", "Flooring", "Window & Curtain",
    "Walk-in Closet", "Home Office", "Kids Room", "Outdoor Living",
  ],
  graphic_design: [
    "Brand Identity", "Logo Concept", "Color Palette", "Typography",
    "Print Design", "Packaging", "Social Media", "Web Design",
    "Illustration Style", "Photography Direction", "Icon Set", "Pattern & Texture",
  ],
  uiux: [
    "User Flow", "Wireframe", "Visual Style", "Component Library",
    "Color System", "Typography Scale", "Icon Style", "Navigation Pattern",
    "Mobile Layout", "Desktop Layout", "Animation Reference", "Dark Mode",
  ],
  painting: [
    "Color Study", "Composition", "Texture Reference", "Style Inspiration",
    "Subject Matter", "Medium Technique", "Light & Shadow", "Abstract Concept",
    "Portrait Reference", "Landscape Reference", "Still Life", "Figurative",
  ],
  fashion: [
    "Silhouette", "Color Palette", "Fabric & Textile", "Pattern & Print",
    "Accessories", "Styling Reference", "Mood & Aesthetic", "Collection Overview",
    "Detail & Trim", "Footwear", "Hair & Makeup", "Editorial Look",
  ],
  product_design: [
    "Form Study", "Material Exploration", "Color & Finish", "Ergonomics",
    "Mechanism Detail", "Packaging", "User Interaction", "Manufacturing",
    "Prototype Reference", "Market Research", "Competitor Analysis", "Lifestyle Context",
  ],
};

const FONT_FAMILIES: { value: string; label: string; css: string }[] = [
  { value: "Montserrat", label: "Montserrat", css: "'Montserrat', sans-serif" },
  { value: "Inter", label: "Inter", css: "'Inter', sans-serif" },
  { value: "Poppins", label: "Poppins", css: "'Poppins', sans-serif" },
  { value: "Open Sans", label: "Open Sans", css: "'Open Sans', sans-serif" },
  { value: "Roboto", label: "Roboto", css: "'Roboto', sans-serif" },
  { value: "DM Sans", label: "DM Sans", css: "'DM Sans', sans-serif" },
  { value: "Plus Jakarta Sans", label: "Jakarta Sans", css: "'Plus Jakarta Sans', sans-serif" },
  { value: "Space Grotesk", label: "Space Grotesk", css: "'Space Grotesk', sans-serif" },
  { value: "Arial", label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { value: "Courier New", label: "Courier New", css: "'Courier New', Courier, monospace" },
  { value: "EB Garamond", label: "Garamond", css: "'EB Garamond', Garamond, serif" },
  { value: "Times New Roman", label: "Times New Roman", css: "'Times New Roman', Times, serif" },
  { value: "Playfair Display", label: "Playfair Display", css: "'Playfair Display', serif" },
  { value: "Lora", label: "Lora", css: "'Lora', serif" },
  { value: "Libre Baskerville", label: "Libre Baskerville", css: "'Libre Baskerville', serif" },
  { value: "Source Serif 4", label: "Source Serif", css: "'Source Serif 4', serif" },
];

function getFontCss(fontFamily: string): string {
  const found = FONT_FAMILIES.find((f) => f.value === fontFamily);
  return found?.css || "'Montserrat', sans-serif";
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

function getPaperStyle(paperSize: string, orientation: string) {
  const base = PAPER_RATIOS[paperSize] || PAPER_RATIOS.A3;
  const isLandscape = orientation === "horizontal";
  const w = isLandscape ? base.h : base.w;
  const h = isLandscape ? base.w : base.h;
  return { aspectRatio: `${w} / ${h}`, w, h };
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
  const hintPx = Math.max(3, Math.min(13, containerWidth * ratios.hint));
  return { desc: `${descPx}px`, hint: `${hintPx}px` };
}

function getBorderRadius(cols: number, isThumbnail: boolean): string {
  if (isThumbnail) return "1px";
  return "4px";
}

function isBackgroundDark(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function SidebarSection({ title, icon: Icon, id, openSections, onToggle, children }: { title: string; icon: any; id: string; openSections: Set<string>; onToggle: (id: string) => void; children: React.ReactNode }) {
  const isOpen = openSections.has(id);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen, children]);

  return (
    <div>
      <button
        className={`flex items-center gap-3 w-full px-4 py-3 text-base font-bold rounded-lg transition-colors duration-300 ${
          isOpen
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onToggle(id)}
        data-testid={`sidebar-section-${id}`}
      >
        <Icon className={`w-6 h-6 transition-colors duration-300 ${isOpen ? "text-primary" : ""}`} />
        <span className="flex-1 text-left tracking-wide">{title}</span>
        <ChevronRight className={`w-5 h-5 transition-transform duration-500 ease-in-out ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <div
        style={{
          maxHeight: isOpen ? `${contentHeight + 20}px` : "0px",
          transition: "max-height 0.5s ease-in-out, opacity 0.4s ease-in-out",
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
        }}
      >
        <div ref={contentRef} className="px-4 pb-3 pt-2 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function SinglePageCanvas({
  project,
  pagePins,
  layout,
  paper,
  isLandscape,
  pageIndex,
  totalPages,
  onSelectPin,
  onDeletePin,
  onUpdatePinDescription,
  onToggleApproval,
  onAddDescription,
  onReorderPins,
  onMovePin,
  allPinIds,
  pageDescription,
  isThumbnail = false,
  brokenPinIds,
  onImageError,
  onImageLoad,
  onRefetchPin,
  onOpenLightbox,
  descMode = "auto" as DescMode,
}: {
  project: Project;
  pagePins: Pin[];
  layout: ReturnType<typeof getGridLayout>;
  paper: ReturnType<typeof getPaperStyle>;
  isLandscape: boolean;
  pageIndex: number;
  totalPages: number;
  onSelectPin?: (pin: Pin) => void;
  onDeletePin?: (id: number) => void;
  onUpdatePinDescription?: (pinId: number, desc: string) => void;
  onToggleApproval?: (pinId: number, status: string | null) => void;
  onAddDescription?: (pin: Pin) => void;
  onReorderPins?: (pinIds: number[]) => void;
  onMovePin?: (pinId: number, direction: "left" | "right") => void;
  allPinIds?: number[];
  pageDescription?: { title: string; description: string };
  isThumbnail?: boolean;
  brokenPinIds?: Set<number>;
  onImageError?: (pinId: number) => void;
  onImageLoad?: (pinId: number) => void;
  onRefetchPin?: (pinId: number) => void;
  onOpenLightbox?: (pin: Pin) => void;
  descMode?: DescMode;
}) {
  const gap = isThumbnail ? "2px" : "clamp(6px, 1.5%, 12px)";
  const padding = isThumbnail ? "p-[3%]" : "p-[3%]";
  const fontSize = (project.descriptionFontSize as string) || "normal";
  const imageLayout = project.imageLayout || "original";
  const borderRadius = getBorderRadius(layout.cols, isThumbnail);
  const canvasBg = project.canvasBackground || "#ffffff";
  const isDarkBg = isBackgroundDark(canvasBg);
  const txtPrimary = isDarkBg ? "#e4e4e7" : "#27272a";
  const txtSecondary = isDarkBg ? "#a1a1aa" : "#52525b";
  const txtMuted = isDarkBg ? "#71717a" : "#a1a1aa";
  const borderCol = isDarkBg ? "#3f3f46" : "#d4d4d8";
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(640);
  const [activePinPopover, setActivePinPopover] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragPinIdRef = useRef<number | null>(null);
  const touchDragRef = useRef<{ pinId: number; startY: number; startX: number; longPressTimer: ReturnType<typeof setTimeout> | null; isDragging: boolean }>({ pinId: 0, startY: 0, startX: 0, longPressTimer: null, isDragging: false });
  const pinElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleTouchStart = useCallback((pinId: number, e: React.TouchEvent) => {
    if (isThumbnail) return;
    const touch = e.touches[0];
    touchDragRef.current = { pinId, startY: touch.clientY, startX: touch.clientX, longPressTimer: null, isDragging: false };
    touchDragRef.current.longPressTimer = setTimeout(() => {
      touchDragRef.current.isDragging = true;
      dragPinIdRef.current = pinId;
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, [isThumbnail]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const td = touchDragRef.current;
    if (!td.isDragging && td.longPressTimer) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - td.startX);
      const dy = Math.abs(touch.clientY - td.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(td.longPressTimer);
        td.longPressTimer = null;
        return;
      }
    }
    if (!td.isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    let found = -1;
    pinElementsRef.current.forEach((div, idx) => {
      if (div === el || div.contains(el)) found = idx;
    });
    setDragOverIndex(found >= 0 ? found : null);
  }, []);

  const handleTouchEnd = useCallback(() => {
    const td = touchDragRef.current;
    if (td.longPressTimer) { clearTimeout(td.longPressTimer); td.longPressTimer = null; }
    if (td.isDragging && dragOverIndex !== null) {
      const fromId = td.pinId;
      const targetIdx = dragOverIndex;
      const ids = pagePins.map((p) => p.id);
      const fromIdx = ids.indexOf(fromId);
      if (fromIdx !== -1 && fromIdx !== targetIdx) {
        const targetPinId = ids[targetIdx];
        ids.splice(fromIdx, 1);
        const toIdx = ids.indexOf(targetPinId);
        ids.splice(toIdx, 0, fromId);
        onReorderPins?.(ids);
      }
    }
    td.isDragging = false;
    dragPinIdRef.current = null;
    setDragOverIndex(null);
  }, [dragOverIndex, pagePins, onReorderPins]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setCanvasWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const fontSizes = computeFontSizes(canvasWidth, fontSize);
  const isMobile = canvasWidth < 500;

  type GridCell = { type: "image"; pin: Pin; idx: number } | { type: "desc-overflow"; pin: Pin; sourceIdx: number } | { type: "empty"; slotIdx: number };
  const gridCells: GridCell[] = [];
  if (layout.useGrid && !isThumbnail) {
    let colPos = 0;
    pagePins.forEach((pin, idx) => {
      const isLong = isDescLong(pin, descMode);
      // If this pin has a long desc and would place its image in the last column,
      // insert a padding empty cell so the image+desc land at the start of the next row.
      if (isLong && colPos === layout.cols - 1) {
        gridCells.push({ type: "empty", slotIdx: gridCells.length });
        colPos = 0;
      }
      gridCells.push({ type: "image", pin, idx });
      colPos = (colPos + 1) % layout.cols;
      if (isLong) {
        gridCells.push({ type: "desc-overflow", pin, sourceIdx: idx });
        colPos = (colPos + 1) % layout.cols;
      }
    });
    const totalSlots = layout.cols * layout.rows;
    const isPortraitLayout = imageLayout === "portrait_3_5" || imageLayout === "portrait_9_16";
    if (isPortraitLayout && gridCells.length < totalSlots) {
      const remaining = gridCells.length % layout.cols;
      if (remaining > 0) {
        const emptyCount = layout.cols - remaining;
        const insertAt = gridCells.length - remaining;
        const emptySlots: GridCell[] = Array.from({ length: emptyCount }, (_, i) => ({ type: "empty" as const, slotIdx: gridCells.length + i }));
        gridCells.splice(insertAt, 0, ...emptySlots);
      }
    }
    while (gridCells.length < totalSlots) {
      gridCells.push({ type: "empty", slotIdx: gridCells.length });
    }
  }

  return (
    <div
      ref={canvasRef}
      className="w-full overflow-hidden flex flex-col"
      style={{ aspectRatio: paper.aspectRatio, fontFamily: getFontCss(project.fontFamily || "Montserrat"), backgroundColor: canvasBg, color: txtSecondary }}
    >
      <div className={`w-full h-full ${padding} flex flex-col`}>
        {(project.studioName || project.projectName) && (
          <div className="flex items-center gap-[0.5%] mb-[2%] flex-shrink-0">
            <span
              className="font-semibold tracking-wide uppercase truncate"
              style={{ color: txtPrimary, fontSize: isThumbnail ? `${Math.max(2, canvasWidth * 0.022)}px` : `${Math.max(8, Math.min(14, canvasWidth * 0.022))}px` }}
            >
              {project.studioName || ""}
            </span>
            {project.projectName && (
              <>
                <span style={{ color: txtMuted, fontSize: isThumbnail ? `${Math.max(2, canvasWidth * 0.018)}px` : `${Math.max(7, Math.min(12, canvasWidth * 0.018))}px` }}>/</span>
                <span className="truncate" style={{ color: txtSecondary, fontSize: isThumbnail ? `${Math.max(2, canvasWidth * 0.018)}px` : `${Math.max(7, Math.min(12, canvasWidth * 0.018))}px` }}>
                  {project.projectName}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-[2%]">
          {isThumbnail ? (
            <div className="flex-shrink-0 overflow-hidden" style={{ width: "20%" }}>
              {pageDescription?.title && (
                <div className="rounded-sm mb-[6%]" style={{ height: `${Math.max(1, canvasWidth * 0.02)}px`, width: "80%", backgroundColor: txtPrimary }} />
              )}
              {pageDescription?.description && (
                <>
                  <div className="rounded-sm mb-[4%]" style={{ height: `${Math.max(0.5, canvasWidth * 0.008)}px`, width: "90%", backgroundColor: txtMuted }} />
                  <div className="rounded-sm mb-[4%]" style={{ height: `${Math.max(0.5, canvasWidth * 0.008)}px`, width: "60%", backgroundColor: txtMuted }} />
                </>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 flex flex-col justify-between" style={{ width: "20%" }}>
              <div>
                {pageDescription?.title && (
                  <h3
                    className="font-bold leading-tight mb-[8%]"
                    style={{ fontSize: `${Math.max(10, Math.min(20, canvasWidth * 0.028))}px`, color: txtPrimary }}
                  >
                    {pageDescription.title}
                  </h3>
                )}
                {pageDescription?.description && (
                  <p
                    style={{ fontSize: `${Math.max(6, Math.min(10, canvasWidth * 0.014))}px`, lineHeight: 1.3, color: txtSecondary }}
                  >
                    {pageDescription.description}
                  </p>
                )}
                {(!pageDescription?.title && !pageDescription?.description) && (
                  <p
                    className="italic"
                    style={{ fontSize: `${Math.max(6, Math.min(10, canvasWidth * 0.014))}px`, lineHeight: 1.3, color: txtMuted }}
                  >
                    Click "Edit" below to add page title &amp; description
                  </p>
                )}
              </div>
              <div className="mt-auto">
                {project.clientOwnerName && (
                  <p
                    className="font-medium mb-[4%]"
                    style={{ fontSize: `${Math.max(5, Math.min(8, canvasWidth * 0.012))}px`, color: txtSecondary }}
                  >
                    {project.clientOwnerName}
                  </p>
                )}
                <div className="border-b mb-[6%] pb-[2%]" style={{ borderColor: borderCol }}>
                  <p
                    className="italic"
                    style={{ fontSize: `${Math.max(5, Math.min(7, canvasWidth * 0.01))}px`, color: txtMuted }}
                  >
                    {project.signatureField || "Signature"}
                  </p>
                  <div style={{ height: `${Math.max(12, Math.min(24, canvasWidth * 0.03))}px` }} />
                </div>
                <p
                  style={{ fontSize: `${Math.max(4, Math.min(6, canvasWidth * 0.009))}px`, color: txtMuted }}
                >
                  {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          )}

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
                {(isThumbnail ? pagePins.map((pin, idx) => ({ type: "image" as const, pin, idx })) : gridCells).map((cell, cellIdx) => {
                  if (cell.type === "empty") {
                    return (
                      <div
                        key={`empty-${cell.slotIdx}`}
                        className={`relative border-2 border-dashed border-border/30 rounded-md flex items-center justify-center transition-colors ${dragOverIndex === cell.slotIdx ? "border-primary bg-primary/5" : ""}`}
                        style={{ borderRadius }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIndex(cell.slotIdx); }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverIndex(null);
                          const fromId = dragPinIdRef.current;
                          dragPinIdRef.current = null;
                          if (fromId == null) return;
                          const ids = pagePins.map((p) => p.id);
                          const fromIdx = ids.indexOf(fromId);
                          if (fromIdx !== -1) {
                            ids.splice(fromIdx, 1);
                            ids.push(fromId);
                            onReorderPins?.(ids);
                          }
                        }}
                        data-testid={`empty-slot-${cell.slotIdx}`}
                      />
                    );
                  }
                  if (cell.type === "desc-overflow") {
                    return (
                      <div
                        key={`desc-${cell.pin.id}`}
                        className="relative flex flex-col items-start justify-center p-[6%]"
                        style={{ borderRadius, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", backgroundColor: EXPORT_CARD_SURFACE }}
                        data-testid={`pin-desc-overflow-${cell.pin.id}`}
                      >
                        <div className="absolute top-[8%] left-[6%]" style={{ color: "hsl(24, 85%, 52%)" }}>
                          <ArrowLeft style={{ width: `${Math.max(12, Math.min(18, canvasWidth * 0.025))}px`, height: `${Math.max(12, Math.min(18, canvasWidth * 0.025))}px` }} />
                        </div>
                        <p
                          className="mt-[12%]"
                          style={{ fontSize: fontSizes.desc, lineHeight: 1.3, color: EXPORT_CARD_TEXT }}
                        >
                          {getPinDesc(cell.pin)}
                        </p>
                      </div>
                    );
                  }
                  const pin = cell.pin;
                  const idx = cell.idx;
                  const pinDesc = getPinDesc(pin);
                  const isLongDesc = !isThumbnail && isDescLong(pin, descMode);
                  return (
                  <div
                    key={pin.id}
                    ref={(el) => { if (el) pinElementsRef.current.set(idx, el); else pinElementsRef.current.delete(idx); }}
                    className={`relative flex flex-col ${isThumbnail ? "" : "group cursor-pointer"} ${!isThumbnail && dragOverIndex === idx ? "ring-2 ring-primary ring-offset-1 scale-[1.02]" : ""}`}
                    style={{ borderRadius, backgroundColor: EXPORT_CARD_SURFACE, willChange: dragPinIdRef.current === pin.id ? "transform, opacity" : "auto", transform: dragPinIdRef.current === pin.id && dragOverIndex !== null ? "scale(0.93)" : undefined, opacity: dragPinIdRef.current === pin.id && dragOverIndex !== null ? 0.5 : 1, transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease, box-shadow 0.18s ease", boxShadow: isThumbnail ? "none" : dragOverIndex === idx ? "0 8px 24px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.15)" : "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)" }}
                    onClick={() => !isThumbnail && !isMobile && onOpenLightbox?.(pin)}
                    draggable={!isThumbnail && !isMobile}
                    onDragStart={(e) => { dragPinIdRef.current = pin.id; e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIndex(idx); }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverIndex(null);
                      const fromId = dragPinIdRef.current;
                      dragPinIdRef.current = null;
                      if (fromId == null || fromId === pin.id) return;
                      const ids = pagePins.map((p) => p.id);
                      const fromIdx = ids.indexOf(fromId);
                      if (fromIdx === -1) return;
                      ids.splice(fromIdx, 1);
                      const toIdx = ids.indexOf(pin.id);
                      ids.splice(toIdx, 0, fromId);
                      onReorderPins?.(ids);
                    }}
                    onDragEnd={() => { dragPinIdRef.current = null; setDragOverIndex(null); }}
                    onTouchStart={(e) => handleTouchStart(pin.id, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    data-testid={isThumbnail ? undefined : `pin-card-${pin.id}`}
                  >
                    <div className="flex-1 min-h-0 relative overflow-hidden" style={{ borderRadius: (!isThumbnail && pinDesc && !isLongDesc) ? `${borderRadius} ${borderRadius} 0 0` : borderRadius }}>
                      {brokenPinIds?.has(pin.id) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: isDarkBg ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                          <AlertTriangle style={{ width: `${Math.max(16, Math.min(28, canvasWidth * 0.035))}px`, height: `${Math.max(16, Math.min(28, canvasWidth * 0.035))}px`, color: "hsl(24, 85%, 52%)", opacity: 0.7 }} />
                        </div>
                      ) : (
                        <img
                          src={pin.imagePath || pin.imageUrl || ""}
                          alt={pin.title || "Pin"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          draggable={false}
                          onError={() => onImageError?.(pin.id)}
                          onLoad={() => onImageLoad?.(pin.id)}
                        />
                      )}
                      {!isThumbnail && pin.approvalStatus && (
                        <div
                          className={`absolute top-[4%] right-[4%] rounded-sm flex items-center justify-center ${
                            pin.approvalStatus === "approved"
                              ? "bg-emerald-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px`, height: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px` }}
                        >
                          {pin.approvalStatus === "approved" ? (
                            <Check className="text-white" style={{ width: "65%", height: "65%" }} />
                          ) : (
                            <XIcon className="text-white" style={{ width: "65%", height: "65%" }} />
                          )}
                        </div>
                      )}
                      {isThumbnail && pin.approvalStatus && (
                        <div
                          className={`absolute top-[4%] right-[4%] rounded-sm ${
                            pin.approvalStatus === "approved" ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          style={{ width: "4px", height: "4px" }}
                        />
                      )}
                      {!isThumbnail && (
                        isMobile ? (
                          <Popover open={activePinPopover === pin.id} onOpenChange={(open) => setActivePinPopover(open ? pin.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                className="absolute inset-0 w-full h-full bg-transparent flex items-end justify-end p-1"
                                onClick={(e) => { e.stopPropagation(); }}
                                data-testid={`button-pin-actions-${pin.id}`}
                              >
                                <span className="bg-black/40 backdrop-blur-sm rounded-sm p-0.5 flex items-center justify-center">
                                  <Layers className="w-3 h-3 text-white" />
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1.5" side="top" align="center" sideOffset={4}>
                              <div className="flex gap-0.5">
                                {brokenPinIds?.has(pin.id) && (
                                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onRefetchPin?.(pin.id); setActivePinPopover(null); }} data-testid={`button-reload-pin-${pin.id}`}>
                                    <RefreshCw className="w-4 h-4 text-orange-500" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "approved" ? null : "approved"); setActivePinPopover(null); }} data-testid={`button-approve-pin-${pin.id}`}>
                                  <Check className="w-4 h-4 text-emerald-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "rejected" ? null : "rejected"); setActivePinPopover(null); }} data-testid={`button-reject-pin-${pin.id}`}>
                                  <XIcon className="w-4 h-4 text-red-500" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onAddDescription?.(pin); setActivePinPopover(null); }} data-testid={`button-add-desc-pin-${pin.id}`}>
                                  <PenLine className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelectPin?.(pin); setActivePinPopover(null); }} data-testid={`button-detail-pin-${pin.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDeletePin?.(pin.id); setActivePinPopover(null); }} data-testid={`button-delete-pin-${pin.id}`}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className={`absolute inset-0 ${brokenPinIds?.has(pin.id) ? "bg-black/20" : "bg-black/0 group-hover:bg-black/30"} transition-colors flex items-center justify-center`}>
                            <div className={`${brokenPinIds?.has(pin.id) ? "visible" : "invisible group-hover:visible"} grid grid-cols-3 gap-1`} style={{ width: `${Math.max(90, Math.min(160, canvasWidth * 0.2))}px` }}>
                              {brokenPinIds?.has(pin.id) && (
                                <button className="col-span-3 rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onRefetchPin?.(pin.id); }} data-testid={`button-reload-pin-${pin.id}`}>
                                  <RefreshCw className="text-orange-500" style={{ width: "50%", height: "50%", maxWidth: 18, maxHeight: 18 }} />
                                </button>
                              )}
                              {(() => { const sortedIdx = allPinIds ? allPinIds.indexOf(pin.id) : -1; return sortedIdx > 0; })() ? (
                                <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onMovePin?.(pin.id, "left"); }} data-testid={`button-move-left-${pin.id}`}>
                                  <ArrowLeft style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                                </button>
                              ) : <div />}
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "approved" ? null : "approved"); }} data-testid={`button-approve-pin-${pin.id}`}>
                                <Check className="text-emerald-600" style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "rejected" ? null : "rejected"); }} data-testid={`button-reject-pin-${pin.id}`}>
                                <XIcon className="text-red-500" style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onAddDescription?.(pin); }} data-testid={`button-add-desc-pin-${pin.id}`}>
                                <PenLine style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onDeletePin?.(pin.id); }} data-testid={`button-delete-pin-${pin.id}`}>
                                <Trash2 className="text-red-500" style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onMovePin?.(pin.id, "right"); }} data-testid={`button-move-right-${pin.id}`}>
                                <ChevronRight style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    {!isThumbnail && pinDesc && !isLongDesc && (
                      <div
                        className="flex-shrink-0 flex items-start"
                        style={{ padding: `${Math.max(4, canvasWidth * 0.012)}px ${Math.max(3, canvasWidth * 0.01)}px`, borderBottomLeftRadius: borderRadius, borderBottomRightRadius: borderRadius, backgroundColor: "transparent", alignItems: "flex-start" }}
                      >
                        <p
                          style={{
                            fontSize: fontSizes.desc,
                            lineHeight: 1.3,
                            color: EXPORT_CARD_TEXT,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {pinDesc}
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="w-full h-full overflow-hidden"
                style={{
                  columnCount: layout.cols,
                  WebkitColumnCount: layout.cols,
                  columnGap: gap,
                  columnFill: "auto",
                }}
              >
                {pagePins.map((pin, idx) => (
                  <div
                    key={pin.id}
                    ref={(el) => { if (el) pinElementsRef.current.set(idx, el); else pinElementsRef.current.delete(idx); }}
                    className={`break-inside-avoid ${isThumbnail ? "mb-[2px]" : "group cursor-pointer"} ${!isThumbnail && dragOverIndex === idx ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    style={{ ...((!isThumbnail ? { marginBottom: gap } : undefined) as any), backgroundColor: EXPORT_CARD_SURFACE, willChange: dragPinIdRef.current === pin.id ? "transform, opacity" : "auto", transform: dragPinIdRef.current === pin.id && dragOverIndex !== null ? "scale(0.93)" : undefined, opacity: dragPinIdRef.current === pin.id && dragOverIndex !== null ? 0.5 : 1, transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease, box-shadow 0.18s ease", borderRadius, boxShadow: isThumbnail ? "none" : dragOverIndex === idx ? "0 8px 24px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.15)" : "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)" }}
                    onClick={() => !isThumbnail && !isMobile && onOpenLightbox?.(pin)}
                    draggable={!isThumbnail && !isMobile}
                    onDragStart={(e) => { dragPinIdRef.current = pin.id; e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIndex(idx); }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverIndex(null);
                      const fromId = dragPinIdRef.current;
                      dragPinIdRef.current = null;
                      if (fromId == null || fromId === pin.id) return;
                      const ids = pagePins.map((p) => p.id);
                      const fromIdx = ids.indexOf(fromId);
                      if (fromIdx === -1) return;
                      ids.splice(fromIdx, 1);
                      const toIdx = ids.indexOf(pin.id);
                      ids.splice(toIdx, 0, fromId);
                      onReorderPins?.(ids);
                    }}
                    onDragEnd={() => { dragPinIdRef.current = null; setDragOverIndex(null); }}
                    onTouchStart={(e) => handleTouchStart(pin.id, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    data-testid={isThumbnail ? undefined : `pin-card-${pin.id}`}
                  >
                    <div className="relative overflow-hidden" style={{ borderRadius: (!isThumbnail && getPinDesc(pin)) ? `${borderRadius} ${borderRadius} 0 0` : borderRadius }}>
                      {brokenPinIds?.has(pin.id) ? (
                        <div className="w-full flex flex-col items-center justify-center" style={{ aspectRatio: "4/3", background: isDarkBg ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                          <AlertTriangle style={{ width: `${Math.max(16, Math.min(28, canvasWidth * 0.035))}px`, height: `${Math.max(16, Math.min(28, canvasWidth * 0.035))}px`, color: "hsl(24, 85%, 52%)", opacity: 0.7 }} />
                        </div>
                      ) : (
                        <img
                          src={pin.imagePath || pin.imageUrl || ""}
                          alt={pin.title || "Pin"}
                          className="w-full h-auto object-cover block"
                          loading="lazy"
                          draggable={false}
                          onError={() => onImageError?.(pin.id)}
                          onLoad={() => onImageLoad?.(pin.id)}
                        />
                      )}
                      {!isThumbnail && pin.approvalStatus && (
                        <div
                          className={`absolute top-[4%] right-[4%] rounded-sm flex items-center justify-center ${
                            pin.approvalStatus === "approved"
                              ? "bg-emerald-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px`, height: `${Math.max(12, Math.min(20, canvasWidth * 0.03))}px` }}
                        >
                          {pin.approvalStatus === "approved" ? (
                            <Check className="text-white" style={{ width: "65%", height: "65%" }} />
                          ) : (
                            <XIcon className="text-white" style={{ width: "65%", height: "65%" }} />
                          )}
                        </div>
                      )}
                      {isThumbnail && pin.approvalStatus && (
                        <div
                          className={`absolute top-[4%] right-[4%] rounded-sm ${
                            pin.approvalStatus === "approved" ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          style={{ width: "4px", height: "4px" }}
                        />
                      )}
                      {!isThumbnail && (
                        isMobile ? (
                          <Popover open={activePinPopover === pin.id} onOpenChange={(open) => setActivePinPopover(open ? pin.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                className="absolute inset-0 w-full h-full bg-transparent flex items-end justify-end p-1"
                                onClick={(e) => { e.stopPropagation(); }}
                                data-testid={`button-pin-actions-masonry-${pin.id}`}
                              >
                                <span className="bg-black/40 backdrop-blur-sm rounded-sm p-0.5 flex items-center justify-center">
                                  <Layers className="w-3 h-3 text-white" />
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1.5" side="top" align="center" sideOffset={4}>
                              <div className="flex gap-0.5">
                                {brokenPinIds?.has(pin.id) && (
                                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onRefetchPin?.(pin.id); setActivePinPopover(null); }} data-testid={`button-reload-pin-masonry-${pin.id}`}>
                                    <RefreshCw className="w-4 h-4 text-orange-500" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "approved" ? null : "approved"); setActivePinPopover(null); }} data-testid={`button-approve-pin-masonry-${pin.id}`}>
                                  <Check className="w-4 h-4 text-emerald-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "rejected" ? null : "rejected"); setActivePinPopover(null); }} data-testid={`button-reject-pin-masonry-${pin.id}`}>
                                  <XIcon className="w-4 h-4 text-red-500" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onAddDescription?.(pin); setActivePinPopover(null); }} data-testid={`button-add-desc-masonry-${pin.id}`}>
                                  <PenLine className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelectPin?.(pin); setActivePinPopover(null); }} data-testid={`button-detail-pin-masonry-${pin.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDeletePin?.(pin.id); setActivePinPopover(null); }} data-testid={`button-delete-pin-masonry-${pin.id}`}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className={`absolute inset-0 ${brokenPinIds?.has(pin.id) ? "bg-black/20" : "bg-black/0 group-hover:bg-black/30"} transition-colors flex items-center justify-center`}>
                            <div className={`${brokenPinIds?.has(pin.id) ? "visible" : "invisible group-hover:visible"} grid grid-cols-3 gap-1`} style={{ width: `${Math.max(90, Math.min(160, canvasWidth * 0.2))}px` }}>
                              {brokenPinIds?.has(pin.id) && (
                                <button className="col-span-3 rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onRefetchPin?.(pin.id); }} data-testid={`button-reload-pin-masonry-${pin.id}`}>
                                  <RefreshCw className="text-orange-500" style={{ width: "50%", height: "50%", maxWidth: 18, maxHeight: 18 }} />
                                </button>
                              )}
                              {(() => { const sortedIdx = allPinIds ? allPinIds.indexOf(pin.id) : -1; return sortedIdx > 0; })() ? (
                                <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onMovePin?.(pin.id, "left"); }} data-testid={`button-move-left-masonry-${pin.id}`}>
                                  <ArrowLeft style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                                </button>
                              ) : <div />}
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "approved" ? null : "approved"); }} data-testid={`button-approve-pin-masonry-${pin.id}`}>
                                <Check className="text-emerald-600" style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onToggleApproval?.(pin.id, pin.approvalStatus === "rejected" ? null : "rejected"); }} data-testid={`button-reject-pin-masonry-${pin.id}`}>
                                <XIcon className="text-red-500" style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onAddDescription?.(pin); }} data-testid={`button-add-desc-masonry-${pin.id}`}>
                                <PenLine style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onDeletePin?.(pin.id); }} data-testid={`button-delete-pin-masonry-${pin.id}`}>
                                <Trash2 className="text-red-500" style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                              <button className="rounded-sm bg-white/80 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ height: `${Math.max(26, Math.min(38, canvasWidth * 0.05))}px` }} onClick={(e) => { e.stopPropagation(); onMovePin?.(pin.id, "right"); }} data-testid={`button-move-right-masonry-${pin.id}`}>
                                <ChevronRight style={{ width: "50%", height: "50%", maxWidth: 16, maxHeight: 16 }} />
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    {!isThumbnail && getPinDesc(pin) && (
                      <div
                        className="flex items-start"
                        style={{ padding: `${Math.max(4, canvasWidth * 0.012)}px ${Math.max(3, canvasWidth * 0.01)}px`, borderBottomLeftRadius: borderRadius, borderBottomRightRadius: borderRadius, backgroundColor: "transparent", alignItems: "flex-start" }}
                      >
                        <p
                          style={{
                            fontSize: fontSizes.desc,
                            lineHeight: 1.3,
                            color: EXPORT_CARD_TEXT,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {getPinDesc(pin)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isThumbnail && project.showFooter !== false && (
          <div
            className="flex-shrink-0"
            style={{ height: `${Math.max(2, canvasWidth * 0.025)}px`, marginTop: `${Math.max(1, canvasWidth * 0.01)}px`, marginLeft: "-3%", marginRight: "-3%", marginBottom: "-3%", backgroundColor: isDarkBg ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
          />
        )}
        {!isThumbnail && (
          <>
            <div className="mt-[2%] flex-shrink-0 flex items-end justify-between gap-4">
              <div style={{ width: `${Math.max(60, canvasWidth * 0.2)}px` }}>
                <p style={{ fontSize: `${Math.max(4, Math.min(7, canvasWidth * 0.009))}px`, color: txtSecondary }}>
                  {project.designerName || ""}
                </p>
                <div className="border-b" style={{ borderColor: borderCol, marginTop: `${Math.max(4, canvasWidth * 0.012)}px`, marginBottom: `${Math.max(2, canvasWidth * 0.004)}px` }} />
                <p className="italic" style={{ fontSize: `${Math.max(3, Math.min(6, canvasWidth * 0.007))}px`, color: txtMuted }}>
                  Project Designer
                </p>
              </div>
              <div style={{ width: `${Math.max(60, canvasWidth * 0.2)}px` }}>
                <p style={{ fontSize: `${Math.max(4, Math.min(7, canvasWidth * 0.009))}px`, color: txtSecondary }}>
                  {project.clientOwnerName || ""}
                </p>
                <div className="border-b" style={{ borderColor: borderCol, marginTop: `${Math.max(4, canvasWidth * 0.012)}px`, marginBottom: `${Math.max(2, canvasWidth * 0.004)}px` }} />
                <p className="italic" style={{ fontSize: `${Math.max(3, Math.min(6, canvasWidth * 0.007))}px`, color: txtMuted }}>
                  Client
                </p>
              </div>
            </div>
            {project.showFooter !== false && (
              <div
                className="flex-shrink-0 flex items-center justify-between gap-2"
                style={{
                  marginTop: `${Math.max(4, canvasWidth * 0.01)}px`,
                  marginLeft: `-3%`,
                  marginRight: `-3%`,
                  padding: `${Math.max(3, canvasWidth * 0.007)}px 3%`,
                  backgroundColor: isDarkBg ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                }}
              >
                <p style={{ fontSize: `${Math.max(4, Math.min(7, canvasWidth * 0.009))}px`, color: txtSecondary }}>
                  created by {project.studioName || "Moodboard Studio"}
                </p>
                <div className="flex items-center gap-2">
                  <p style={{ fontSize: `${Math.max(4, Math.min(7, canvasWidth * 0.009))}px`, color: txtMuted }}>
                    {pageIndex + 1}/{totalPages}
                  </p>
                  <StudioLogo
                    src={project.studioLogoPath || brandLogoSrc}
                    alt="Logo"
                    style={{ height: `${Math.max(10, Math.min(20, canvasWidth * 0.025))}px` }}
                    className="object-contain"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CoverPage({ project, paper, coverPin }: { project: Project; paper: ReturnType<typeof getPaperStyle>; coverPin: Pin | null }) {
  const coverRef = useRef<HTMLDivElement>(null);
  const [coverWidth, setCoverWidth] = useState(640);
  const isFull = project.coverImageStyle === "full";
  const canvasBg = project.canvasBackground || "#ffffff";
  const isDarkBg = isBackgroundDark(canvasBg);
  const autoTitleColor = isDarkBg ? "#e4e4e7" : "#27272a";
  const autoDescColor = isDarkBg ? "#71717a" : "#a1a1aa";
  const fullCoverAutoTitleColor = "#e4e4e7";
  const fullCoverAutoDescColor = "rgba(255,255,255,0.6)";
  const txtPrimary = project.coverTitleColor || autoTitleColor;
  const txtDesc = project.coverDescColor || autoDescColor;
  const txtSecondary = isDarkBg ? "#a1a1aa" : "#52525b";
  const txtMuted = isDarkBg ? "#71717a" : "#a1a1aa";
  const borderCol = isDarkBg ? "#3f3f46" : "#d4d4d8";
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
        {coverPin ? (
          <img
            src={coverPin.imagePath || coverPin.imageUrl || ""}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ boxShadow: "inset 0 0 60px rgba(0,0,0,0.3)" }}
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
              <div
                className="h-0.5 bg-primary mb-[6%]"
                style={{ width: `${Math.max(16, coverWidth * 0.04)}px` }}
              />
              <h1
                className="tracking-wide leading-tight mb-[3%]"
                style={{ fontSize: `${Math.max(14, Math.min(30, coverWidth * 0.038))}px`, textShadow: "0 2px 8px rgba(0,0,0,0.3)", color: project.coverTitleColor || fullCoverAutoTitleColor, fontWeight: titleFontWeight, fontStyle: titleFontStyle, textTransform: titleTextTransform }}
              >
                {project.title || "Moodboard"}
              </h1>
              {project.descriptionAi && (
                <p
                  className="leading-relaxed mt-[2%] italic"
                  style={{ fontSize: `${Math.max(5, Math.min(9, coverWidth * 0.011))}px`, color: project.coverDescColor || fullCoverAutoDescColor }}
                >
                  {project.descriptionAi}
                </p>
              )}
              {project.clientOwnerName && (
                <p
                  className="text-white/70 mt-[5%]"
                  style={{ fontSize: `${Math.max(6, Math.min(11, coverWidth * 0.014))}px` }}
                >
                  Prepared for {project.clientOwnerName}
                  {project.clientCompany ? ` — ${project.clientCompany}` : ""}
                </p>
              )}
            </div>

            <div>
              {project.designerName && (
                <div className="mb-[6%]">
                  <p
                    className="text-white/50"
                    style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px` }}
                  >
                    Project Designer by:
                  </p>
                  <p
                    className="text-white/90 font-medium mt-[1%]"
                    style={{ fontSize: `${Math.max(5, Math.min(10, coverWidth * 0.013))}px` }}
                  >
                    {project.designerName}
                  </p>
                  <div className="border-b border-white/20 mt-[4%] mb-[2%]">
                    <div style={{ height: `${Math.max(10, Math.min(20, coverWidth * 0.025))}px` }} />
                  </div>
                  <p
                    className="text-white/40 italic"
                    style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px` }}
                  >
                    {project.signatureField || "Signature"}
                  </p>
                </div>
              )}
              <div className="w-full h-px bg-white/20 mb-[3%]" />
              <div className="flex items-end justify-between gap-2">
                <p
                  className="text-white/50"
                  style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px` }}
                >
                  {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
                <p
                  className="text-white/50 italic"
                  style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px` }}
                >
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
          {coverPin ? (
            <img
              src={coverPin.imagePath || coverPin.imageUrl || ""}
              alt="Cover"
              className="w-full h-full object-cover"
              style={{ borderRadius: `${Math.max(6, coverWidth * 0.015)}px`, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
            />
          ) : (
            <div
              className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"
              style={{ borderRadius: `${Math.max(6, coverWidth * 0.015)}px` }}
            >
              <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col justify-between py-[2%]" style={{ flex: "0.6" }}>
          <div>
            <StudioLogo
              src={project.studioLogoPath || brandLogoSrc}
              alt="Studio"
              className="object-contain mb-[8%]"
              style={{ height: `${Math.max(20, Math.min(50, coverWidth * 0.06))}px` }}
            />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              className="h-0.5 bg-primary mb-[6%]"
              style={{ width: `${Math.max(16, coverWidth * 0.04)}px` }}
            />
            <h1
              className="tracking-wide leading-tight mb-[3%]"
              style={{ fontSize: `${Math.max(14, Math.min(30, coverWidth * 0.038))}px`, color: txtPrimary, fontWeight: titleFontWeight, fontStyle: titleFontStyle, textTransform: titleTextTransform }}
            >
              {project.title || "Moodboard"}
            </h1>
            {project.descriptionAi && (
              <p
                className="leading-relaxed mt-[2%] italic"
                style={{ fontSize: `${Math.max(5, Math.min(9, coverWidth * 0.011))}px`, color: txtDesc }}
              >
                {project.descriptionAi}
              </p>
            )}
            {project.clientOwnerName && (
              <p
                className="mt-[5%]"
                style={{ fontSize: `${Math.max(6, Math.min(11, coverWidth * 0.014))}px`, color: txtSecondary }}
              >
                Prepared for {project.clientOwnerName}
                {project.clientCompany ? ` — ${project.clientCompany}` : ""}
              </p>
            )}
          </div>

          <div>
            {project.designerName && (
              <div className="mb-[6%]">
                <p
                  style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px`, color: txtMuted }}
                >
                  Project Designer by:
                </p>
                <p
                  className="font-medium mt-[1%]"
                  style={{ fontSize: `${Math.max(5, Math.min(10, coverWidth * 0.013))}px`, color: txtSecondary }}
                >
                  {project.designerName}
                </p>
                <div className="border-b mt-[4%] mb-[2%]" style={{ borderColor: borderCol }}>
                  <div style={{ height: `${Math.max(10, Math.min(20, coverWidth * 0.025))}px` }} />
                </div>
                <p
                  className="italic"
                  style={{ fontSize: `${Math.max(4, Math.min(7, coverWidth * 0.009))}px`, color: txtMuted }}
                >
                  {project.signatureField || "Signature"}
                </p>
              </div>
            )}
            <div className="w-full h-px mb-[3%]" style={{ backgroundColor: borderCol }} />
            <div className="flex items-end justify-between gap-2">
              <div>
                <p
                  style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px`, color: txtMuted }}
                >
                  {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
              <p
                className="italic"
                style={{ fontSize: `${Math.max(5, Math.min(8, coverWidth * 0.011))}px`, color: txtMuted }}
              >
                created by {project.studioName || "Moodboard Studio"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasPages({
  project,
  pins,
  activePage,
  onPageChange,
  onSelectPin,
  onDeletePin,
  onUpdatePinDescription,
  onUpdatePageDescription,
  onToggleApproval,
  onAddDescription,
  onReorderPins,
  onGenerateConceptDescription,
  isGeneratingConcept,
  brokenPinIds,
  onImageError,
  onImageLoad,
  onRefetchPin,
  isRefetchingPin,
  onOpenLightbox,
  descMode = "auto" as DescMode,
}: {
  project: Project;
  pins: Pin[];
  activePage: number;
  onPageChange: (page: number) => void;
  onSelectPin: (pin: Pin) => void;
  onDeletePin: (id: number) => void;
  onUpdatePinDescription: (pinId: number, desc: string) => void;
  onUpdatePageDescription: (pageIndex: number, data: { title: string; description: string }) => void;
  onToggleApproval: (pinId: number, status: string | null) => void;
  onAddDescription: (pin: Pin) => void;
  onReorderPins: (pinIds: number[]) => void;
  onGenerateConceptDescription: (pageIndex: number, keywords: string) => void;
  isGeneratingConcept: boolean;
  brokenPinIds?: Set<number>;
  onImageError?: (pinId: number) => void;
  onImageLoad?: (pinId: number) => void;
  onRefetchPin?: (pinId: number) => void;
  isRefetchingPin?: boolean;
  onOpenLightbox?: (pin: Pin) => void;
  descMode?: DescMode;
}) {
  const paperSize = project.paperSize || "A3";
  const orientation = project.orientation || "horizontal";
  const imageLayout = project.imageLayout || "original";
  const gridColumns = project.gridColumns || 3;
  const isLandscape = orientation === "horizontal";
  const paper = getPaperStyle(paperSize, orientation);
  const layout = getGridLayout(isLandscape, imageLayout, gridColumns, paperSize);
  const sortedPins = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
  const pages = paginateMoodboard(sortedPins, layout, pin => isDescLong(pin, descMode));
  const totalPages = Math.max(1, pages.length);
  const pageDescriptions = (project.pageDescriptions as Array<{ title: string; description: string }>) || [];

  const hasCover = project.showCover !== false;
  const totalPagesWithCover = totalPages + (hasCover ? 1 : 0);
  const isCoverPage = hasCover && activePage === 0;
  const contentPageIndex = hasCover ? activePage - 1 : activePage;
  const currentPage = Math.min(Math.max(0, contentPageIndex), totalPages - 1);
  const currentPins = pages[currentPage] || [];
  const coverPin = sortedPins[0] || null;

  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(isLandscape ? 960 : 640);
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const update = () => {
      if (element.clientWidth > 0) setPreviewWidth(element.clientWidth);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);

  const [editingPageDesc, setEditingPageDesc] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [pageDesc, setPageDesc] = useState("");
  const [conceptKeywords, setConceptKeywords] = useState("");

  useEffect(() => {
    const pd = pageDescriptions[currentPage];
    setPageTitle(pd?.title || "");
    setPageDesc(pd?.description || "");
    setEditingPageDesc(false);
  }, [currentPage]);

  useEffect(() => {
    if (activePage >= totalPagesWithCover) {
      onPageChange(Math.max(0, totalPagesWithCover - 1));
    }
  }, [activePage, totalPagesWithCover, onPageChange]);

  const handleSavePageDesc = () => {
    onUpdatePageDescription(currentPage, { title: pageTitle, description: pageDesc });
    setEditingPageDesc(false);
  };

  return (
    <div className="flex flex-col items-center gap-6" data-testid="canvas-container">
      <div
        className="rounded-lg shadow-xl border border-border/30 overflow-hidden w-full"
        style={{ maxWidth: isLandscape ? "960px" : "640px" }}
        data-testid="paper-canvas"
        ref={previewRef}
      >
        {isCoverPage ? (
          <CoverPage project={project} paper={paper} coverPin={coverPin} />
        ) : (
          <SinglePageCanvas
            project={project}
            pagePins={currentPins}
            layout={layout}
            paper={paper}
            isLandscape={isLandscape}
            pageIndex={currentPage}
            totalPages={totalPages}
            onSelectPin={onSelectPin}
            onDeletePin={onDeletePin}
            onUpdatePinDescription={onUpdatePinDescription}
            onToggleApproval={onToggleApproval}
            onAddDescription={onAddDescription}
            brokenPinIds={brokenPinIds}
            onImageError={onImageError}
            onImageLoad={onImageLoad}
            onRefetchPin={onRefetchPin}
            onReorderPins={(pagePinIds) => {
              const allSorted = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
              const beforePages = pages.slice(0, currentPage).flat();
              const afterPages = pages.slice(currentPage + 1).flat();
              onReorderPins([...beforePages.map(p => p.id), ...pagePinIds, ...afterPages.map(p => p.id)]);
            }}
            allPinIds={sortedPins.map(p => p.id)}
            onMovePin={(pinId, direction) => {
              const allIds = sortedPins.map(p => p.id);
              const idx = allIds.indexOf(pinId);
              if (idx === -1) return;
              const newIdx = direction === "left" ? idx - 1 : idx + 1;
              if (newIdx < 0) return;
              if (newIdx >= allIds.length) {
                allIds.splice(idx, 1);
                allIds.push(pinId);
              } else {
                [allIds[idx], allIds[newIdx]] = [allIds[newIdx], allIds[idx]];
              }
              onReorderPins(allIds);
            }}
            pageDescription={pageDescriptions[currentPage]}
            onOpenLightbox={onOpenLightbox}
            descMode={descMode}
          />
        )}
      </div>

      {!isCoverPage && (
      <div className="w-full" style={{ maxWidth: isLandscape ? "960px" : "640px" }}>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Page {currentPage + 1} Concept</span>
              </div>
              {!editingPageDesc ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingPageDesc(true)}
                  data-testid="button-edit-page-concept"
                >
                  <Type className="w-3.5 h-3.5 mr-1" />
                  {(pageDescriptions[currentPage]?.title || pageDescriptions[currentPage]?.description) ? "Edit Concept" : "Add Concept"}
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditingPageDesc(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSavePageDesc} data-testid="button-save-page-concept">Save</Button>
                </div>
              )}
            </div>
            {editingPageDesc ? (
              <div className="space-y-2">
                <Input
                  placeholder="Page title, e.g. Facade Concept"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  data-testid="input-page-title"
                />
                {(() => {
                  const cat = project.projectCategory || "architecture";
                  const templates = PAGE_CATEGORY_TEMPLATES[cat] || PAGE_CATEGORY_TEMPLATES.architecture || [];
                  if (templates.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1" data-testid="page-template-suggestions">
                      {templates.map((tpl) => (
                        <button
                          key={tpl}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                            pageTitle === tpl
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                          onClick={() => setPageTitle(tpl)}
                          data-testid={`button-template-${tpl.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Keywords: tropical modern, limestone, warm lighting..."
                      value={conceptKeywords}
                      onChange={(e) => setConceptKeywords(e.target.value)}
                      className="flex-1 text-xs"
                      data-testid="input-concept-keywords"
                    />
                    <Button
                      size="sm"
                      disabled={isGeneratingConcept || !conceptKeywords.trim()}
                      onClick={() => onGenerateConceptDescription(currentPage, conceptKeywords)}
                      data-testid="button-generate-concept-ai"
                      className="ai-gradient-btn"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      {isGeneratingConcept ? "..." : "AI"}
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Concept description... (type manually or generate with AI using keywords above)"
                    value={pageDesc}
                    onChange={(e) => setPageDesc(e.target.value)}
                    className="min-h-[60px] text-sm"
                    data-testid="input-page-description"
                  />
                </div>
              </div>
            ) : pageDescriptions[currentPage]?.title ? (
              <div className="text-sm">
                <p className="font-medium">{pageDescriptions[currentPage].title}</p>
                {pageDescriptions[currentPage].description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{pageDescriptions[currentPage].description}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add a title and description for the left concept column on this page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {totalPagesWithCover > 1 && (
        <div className="w-full" style={{ maxWidth: isLandscape ? "960px" : "640px" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pages
            </span>
            <span className="text-xs text-muted-foreground">
              {activePage + 1} of {totalPagesWithCover}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" data-testid="page-thumbnails">
            {hasCover && (
              <div
                onClick={() => onPageChange(0)}
                className={`flex-shrink-0 rounded-md overflow-hidden cursor-pointer border-2 transition-colors ${
                  activePage === 0
                    ? "border-primary shadow-md ring-2 ring-primary/20"
                    : "border-border/50 hover:border-primary/40"
                }`}
                style={{ width: isLandscape ? "160px" : "110px" }}
                data-testid="page-thumbnail-cover"
              >
                <div className="w-full relative" style={{ aspectRatio: paper.aspectRatio }}>
                  <ScaledPagePreview width={previewWidth} aspectRatio={paper.aspectRatio}>
                    <CoverPage project={project} paper={paper} coverPin={coverPin} />
                  </ScaledPagePreview>
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white rounded-sm px-1.5 py-0.5" style={{ fontSize: "9px" }}>
                    1
                  </div>
                </div>
              </div>
            )}
            {pages.map((pagePins, idx) => {
              const thumbIdx = hasCover ? idx + 1 : idx;
              return (
              <div
                key={idx}
                onClick={() => onPageChange(thumbIdx)}
                className={`flex-shrink-0 rounded-md overflow-visible cursor-pointer border-2 transition-colors ${
                  activePage === thumbIdx
                    ? "border-primary shadow-md ring-2 ring-primary/20"
                    : "border-border/50"
                }`}
                style={{ width: isLandscape ? "160px" : "110px" }}
                data-testid={`button-page-${thumbIdx}`}
              >
                <div className="rounded-md overflow-hidden relative">
                  <ScaledPagePreview width={previewWidth} aspectRatio={paper.aspectRatio}>
                  <SinglePageCanvas
                    project={project}
                    pagePins={pagePins}
                    layout={layout}
                    paper={paper}
                    isLandscape={isLandscape}
                    pageIndex={idx}
                    totalPages={totalPages}
                    pageDescription={pageDescriptions[idx]}
                    descMode={descMode}
                    brokenPinIds={brokenPinIds}
                  />
                  </ScaledPagePreview>
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white rounded-sm px-1.5 py-0.5" style={{ fontSize: "9px" }}>
                    {thumbIdx + 1}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileAffiliateSection() {
  const { toast } = useToast();
  const { data: affiliateData } = useQuery<{ code?: string; stats?: { clicks: number; signups: number; conversions: number } }>({
    queryKey: ["/api/affiliate/me"],
  });

  const createCode = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/affiliate/me", { label: "My Code" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/me"] });
    },
  });

  const code = affiliateData?.code;
  const referralLink = code ? `${window.location.origin}/?ref=${code}` : "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied!` });
  };

  if (!code) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full justify-start"
        onClick={() => createCode.mutate()}
        disabled={createCode.isPending}
        data-testid="button-mobile-generate-affiliate"
      >
        <Share2 className="w-4 h-4 mr-1" />
        {createCode.isPending ? "Generating..." : "Get Affiliate Code"}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Your Code</label>
        <div className="flex items-center gap-1">
          <code className="flex-1 text-sm font-mono bg-muted/50 rounded-md px-2 py-1.5 truncate" data-testid="text-mobile-affiliate-code">{code}</code>
          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(code, "Code")} data-testid="button-mobile-copy-code">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Referral Link</label>
        <div className="flex items-center gap-1">
          <code className="flex-1 text-[10px] font-mono bg-muted/50 rounded-md px-2 py-1.5 truncate" data-testid="text-mobile-affiliate-link">{referralLink}</code>
          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(referralLink, "Link")} data-testid="button-mobile-copy-link">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [approvalFilter, setApprovalFilter] = useState<"all" | "approved" | "unchecked">("all");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["description"]));
  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const settingsFormRef = useRef({
    title: "",
    studioName: "",
    designerName: "",
    projectName: "",
    descriptionRaw: "",
    descriptionEnabled: true,
    showFooter: true,
    studioWebsite: "",
    studioSocialMedia: "",
    studioContactNumber: "",
    clientCompany: "",
    clientOwnerName: "",
    clientPhone: "",
    clientEmail: "",
    clientLocation: "",
    signatureField: "",
  });
  const [settingsForm, setSettingsForm] = useState(settingsFormRef.current);
  const [failedProjectChanges, setFailedProjectChanges] = useState<Partial<Project>>({});
  const [failedPinChanges, setFailedPinChanges] = useState<Record<number, Partial<Pin>>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const activeSaveProjectRef = useRef(projectId);
  activeSaveProjectRef.current = projectId;
  const pendingProjectSaves = useIsMutating({ mutationKey: ["editor-project-save", projectId] });
  const pendingPinSaves = useIsMutating({ mutationKey: ["editor-pin-save", projectId] });
  const isSavingEdits = pendingProjectSaves + pendingPinSaves > 0;
  const hasFailedEdits = Object.keys(failedProjectChanges).length > 0 || Object.keys(failedPinChanges).length > 0;
  useEffect(() => {
    setFailedProjectChanges({}); setFailedPinChanges({}); setSavedAt(null);
  }, [projectId]);
  useEffect(() => {
    if (!isSavingEdits && !hasFailedEdits) return;
    const protectUnsaved = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectUnsaved);
    return () => window.removeEventListener("beforeunload", protectUnsaved);
  }, [isSavingEdits, hasFailedEdits]);
  const isEditingRef = useRef(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [columnSuggestion, setColumnSuggestion] = useState<{ currentCols: number; suggestedCols: number } | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [dupDeletionProgress, setDupDeletionProgress] = useState<{ current: number; total: number } | null>(null);
  const [showDescModeDialog, setShowDescModeDialog] = useState(false);
  const [showClearDescConfirm, setShowClearDescConfirm] = useState(false);
  const [descMode, setDescModeState] = useState<DescMode>(() => {
    try { return (localStorage.getItem(`descMode-${projectId}`) as DescMode) || "auto"; } catch { return "auto"; }
  });
  const setDescMode = (m: DescMode) => {
    setDescModeState(m);
    try { localStorage.setItem(`descMode-${projectId}`, m); } catch {}
  };

  const [importFields, setImportFields] = useState<Array<{ url: string; name: string }>>([
    { url: "", name: "" },
  ]);
  const directImportAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [uploadTargetPage, setUploadTargetPage] = useState<number>(-1);
  const [importTargetPage, setImportTargetPage] = useState<number>(-1);
  const [brokenPinIds, setBrokenPinIds] = useState<Set<number>>(new Set());
  const [isRefetching, setIsRefetching] = useState(false);

  const handleImageError = useCallback((pinId: number) => {
    setBrokenPinIds((prev) => {
      const next = new Set(prev);
      next.add(pinId);
      return next;
    });
  }, []);

  const handleImageLoad = useCallback((pinId: number) => {
    setBrokenPinIds((prev) => {
      if (!prev.has(pinId)) return prev;
      const next = new Set(prev);
      next.delete(pinId);
      return next;
    });
  }, []);

  const refetchSinglePin = useMutation({
    mutationFn: async (pinId: number) => {
      const res = await apiRequest("POST", `/api/pins/${pinId}/refetch-image`, {});
      return res.json();
    },
    onSuccess: (data: { success: boolean; pin?: Pin; newUrl?: string; message?: string }, pinId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
        setBrokenPinIds((prev) => { const next = new Set(prev); next.delete(pinId); return next; });
        toast({ title: "Image refreshed successfully" });
      } else {
        toast({ title: "Could not find working image", description: "The image may no longer be available on Pinterest", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to refresh image", variant: "destructive" });
    },
  });

  const refetchAllBroken = useCallback(async () => {
    if (brokenPinIds.size === 0) return;
    setIsRefetching(true);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/refetch-broken`, { pinIds: Array.from(brokenPinIds) });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      setBrokenPinIds(new Set());
      if (data.fixed > 0) {
        toast({ title: `${data.fixed} image(s) refreshed`, description: data.failed > 0 ? `${data.failed} could not be fixed` : undefined });
      } else {
        toast({ title: "No images could be refreshed", description: "The images may no longer be available", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to refresh images", variant: "destructive" });
    } finally {
      setIsRefetching(false);
    }
  }, [brokenPinIds, projectId, toast]);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: projectId > 0,
  });

  useEffect(() => {
    if (project && !isEditingRef.current) {
      const newForm = {
        title: project.title || "",
        studioName: project.studioName || "",
        designerName: project.designerName || "",
        projectName: project.projectName || "",
        descriptionRaw: project.descriptionRaw || "",
        descriptionEnabled: project.descriptionEnabled ?? true,
        showFooter: project.showFooter ?? true,
        studioWebsite: project.studioWebsite || "",
        studioSocialMedia: project.studioSocialMedia || "",
        studioContactNumber: project.studioContactNumber || "",
        clientCompany: project.clientCompany || "",
        clientOwnerName: project.clientOwnerName || "",
        clientPhone: project.clientPhone || "",
        clientEmail: project.clientEmail || "",
        clientLocation: project.clientLocation || "",
        signatureField: project.signatureField || "",
      };
      settingsFormRef.current = newForm;
      setSettingsForm(newForm);
    }
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "share") {
      setShowShare(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (action === "export") {
      setShowExport(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [projectId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiRequest("POST", "/api/uploads/image", formData);
      const data = await res.json();
      if (data.url) {
        updateProject.mutate({ studioLogoPath: data.url });
        toast({ title: "Logo uploaded" });
      }
    } catch {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const [isImportPending, setIsImportPending] = useState(() => {
    return typeof window !== "undefined" && window.location.search.includes("importing=1");
  });
  const [importPollCount, setImportPollCount] = useState(0);

  const { data: pins = [], isLoading: pinsLoading } = useQuery<Pin[]>({
    queryKey: ["/api/projects", projectId, "pins"],
    enabled: projectId > 0,
    refetchInterval: isImportPending ? 3000 : false,
  });

  const duplicatePinGroups = findDuplicatePins(pins);
  const duplicateCount = Array.from(duplicatePinGroups.values()).reduce((s, g) => s + g.length - 1, 0);

  useEffect(() => {
    if (isImportPending) {
      if (pins.length > 0) {
        setIsImportPending(false);
        setImportPollCount(0);
      } else {
        setImportPollCount((c) => c + 1);
        if (importPollCount > 40) {
          setIsImportPending(false);
          setImportPollCount(0);
        }
      }
    }
  }, [pins.length, isImportPending, importPollCount]);

  const { pushSnapshot, undo: undoAction, redo: redoAction, canUndo, canRedo, undoCount, redoCount } = useUndoRedo();

  const restorePins = useMutation({
    mutationFn: async (snapshot: any[]) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/restore-pins`, { snapshot });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
    },
  });

  const handleUndo = useCallback(() => {
    const snapshot = undoAction(pins);
    if (snapshot) {
      restorePins.mutate(snapshot);
      toast({ title: `Undo (${undoCount - 1} left)` });
    }
  }, [pins, undoAction, restorePins, toast, undoCount]);

  const handleRedo = useCallback(() => {
    const snapshot = redoAction(pins);
    if (snapshot) {
      restorePins.mutate(snapshot);
      toast({ title: `Redo (${redoCount - 1} left)` });
    }
  }, [pins, redoAction, restorePins, toast, redoCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo && !restorePins.isPending) handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo && !restorePins.isPending) handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        if (canRedo && !restorePins.isPending) handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, handleUndo, handleRedo, restorePins.isPending]);

  const updateProject = useMutation({
    mutationKey: ["editor-project-save", projectId],
    scope: { id: `editor-project-save-${projectId}` },
    mutationFn: async (data: Partial<Project>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, data);
      return res.json();
    },
    onSuccess: (_result, data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      if (activeSaveProjectRef.current !== projectId) return;
      setFailedProjectChanges(previous => {
        const remaining = { ...previous };
        for (const key of Object.keys(data)) delete remaining[key as keyof Project];
        return remaining;
      });
      setSavedAt(new Date());
    },
    onError: (_error, data) => {
      if (activeSaveProjectRef.current === projectId) setFailedProjectChanges(previous => ({ ...previous, ...data }));
    },
  });

  const handleImageLayoutChange = useCallback((newLayout: string) => {
    updateProject.mutate({ imageLayout: newLayout });
    const isPortraitLayout = newLayout === "portrait_3_5" || newLayout === "portrait_9_16";
    if (isPortraitLayout && project) {
      const currentCols = project.gridColumns || 3;
      const nextCols = currentCols + 1;
      if (nextCols <= 5) {
        const isLand = (project.orientation || "horizontal") === "horizontal";
        const pSize = project.paperSize || "A3";
        const nextLayout = getGridLayout(isLand, newLayout, nextCols, pSize);
        if (nextLayout.rows >= 2) {
          setColumnSuggestion({ currentCols, suggestedCols: nextCols });
        }
      }
    }
  }, [updateProject, project]);

  const generateDescription = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/generate-description`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: "Description generated" });
    },
    onError: () => {
      toast({ title: "Failed to generate description", variant: "destructive" });
    },
  });

  const generateAllPinDescriptions = useMutation({
    mutationFn: async (mode: "short" | "long") => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/generate-all-pin-descriptions`, { mode });
      return res.json();
    },
    onSuccess: (data: { updated: number; total: number; failed?: Array<{ id: number; title: string }> }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      toast({
        title: `${data.updated} of ${data.total} image descriptions generated`,
        description: data.failed?.length
          ? `Could not read: ${data.failed.slice(0, 5).map(pin => pin.title).join(", ")}${data.failed.length > 5 ? ` and ${data.failed.length - 5} more` : ""}. Previous descriptions were kept; retry these images individually.`
          : undefined,
        variant: data.failed?.length ? "destructive" : "default",
      });
    },
    onError: () => {
      toast({ title: "Failed to generate descriptions", variant: "destructive" });
    },
  });

  const clearAllDescriptions = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/pin-descriptions`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      toast({ title: "All descriptions cleared" });
    },
    onError: () => {
      toast({ title: "Failed to clear descriptions", variant: "destructive" });
    },
  });

  const [scrapePreview, setScrapePreview] = useState<{
    isPinterestBoard: boolean;
    imageCount: number;
    boardUrl: string;
    cacheKey: string;
    thumbnails: string[];
  } | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string>("");
  const [scrapeCount, setScrapeCount] = useState(0);
  const [scrapeThumbnails, setScrapeThumbnails] = useState<string[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scrapeElapsed, setScrapeElapsed] = useState(0);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [lastScrapeUrl, setLastScrapeUrl] = useState<string>("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrapeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (scrapeTimerRef.current) {
      clearInterval(scrapeTimerRef.current);
      scrapeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback((progressKey: string) => {
    stopPolling();
    setScrapeElapsed(0);
    let consecutiveFailures = 0;
    scrapeTimerRef.current = setInterval(() => {
      setScrapeElapsed((prev) => prev + 1);
    }, 1000);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiRequest("GET", `/api/scrape-progress/${progressKey}`);
        const data = await res.json();
        consecutiveFailures = 0;

        setScrapeCount(data.imageCount || 0);
        setScrapeStatus(data.message || "");
        if (data.thumbnails?.length > 0) {
          setScrapeThumbnails(data.thumbnails);
        }

        if (data.status === "done") {
          stopPolling();
          setIsScraping(false);
          if (data.imageCount > 0) {
            setScrapePreview({
              isPinterestBoard: true,
              imageCount: data.imageCount,
              boardUrl: data.boardUrl || "",
              cacheKey: data.cacheKey || "",
              thumbnails: data.thumbnails || [],
            });
          } else {
            toast({ title: "No images found", description: "Could not extract images from this Pinterest board.", variant: "destructive" });
          }
        } else if (data.status === "error") {
          stopPolling();
          setIsScraping(false);
          setScrapeError(data.error || "Failed to scan board. Please try again.");
        }
      } catch (_e) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          stopPolling();
          setIsScraping(false);
          setScrapeError("We could not retrieve import progress. Please try again; the scan may still be running.");
        }
      }
    }, 1500);
  }, [stopPolling, toast]);

  const scrapePreviewMutation = useMutation({
    mutationFn: async (url: string) => {
      setIsScraping(true);
      setScrapeCount(0);
      setScrapeStatus("Connecting to Pinterest...");
      setScrapeThumbnails([]);
      setScrapeError(null);
      setScrapeElapsed(0);
      setLastScrapeUrl(url);
      const res = await apiRequest("POST", "/api/scrape-preview", { url });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (!data.isPinterestBoard) {
        setIsScraping(false);
        importUrls.mutate(importFields.filter((f) => f.url.trim()));
        return;
      }
      if (data.scraping && data.progressKey) {
        startPolling(data.progressKey);
      } else if (data.imageCount > 0) {
        setIsScraping(false);
        setScrapePreview(data);
      } else {
        setIsScraping(false);
        toast({ title: "No images found", description: "Could not extract images from this Pinterest board.", variant: "destructive" });
      }
    },
    onError: () => {
      setIsScraping(false);
      setScrapeStatus("");
      setScrapeError("Failed to connect to Pinterest. Please check the URL and try again.");
    },
  });

  const confirmImport = useMutation({
    mutationFn: async ({ cacheKey, boardUrl }: { cacheKey: string; boardUrl: string }) => {
      setIsConfirming(true);
      const res = await apiRequest("POST", `/api/projects/${projectId}/import-confirmed`, { cacheKey, boardUrl });
      return res.json();
    },
    onSuccess: (data: { imported: number; total: number; errors: string[] }) => {
      setIsConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      setShowImport(false);
      setImportFields([{ url: "", name: "" }]);
      setScrapePreview(null);
      toast({ title: `${data.imported} image(s) imported successfully` });
    },
    onError: () => {
      setIsConfirming(false);
      toast({ title: "Failed to import. Please try again.", variant: "destructive" });
    },
  });

  const importUrls = useMutation({
    mutationFn: async (fields: Array<{ url: string; name: string }>) => {
      const urls = fields.map((f) => f.url).filter(Boolean);
      const names = fields.reduce<Record<string, string>>((acc, f) => {
        if (f.url && f.name) acc[f.url] = f.name;
        return acc;
      }, {});
      const fingerprint = JSON.stringify({ projectId, urls, names });
      if (directImportAttemptRef.current?.fingerprint !== fingerprint) directImportAttemptRef.current = { fingerprint, key: crypto.randomUUID() };
      const res = await apiRequest("POST", `/api/projects/${projectId}/import`, { urls, names }, { "Idempotency-Key": directImportAttemptRef.current.key });
      return res.json();
    },
    onSuccess: (data: { imported: number; total: number; errors: string[] }) => {
      directImportAttemptRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      if (data.errors?.length > 0 && data.imported === 0) {
        toast({ title: "Import failed", description: data.errors[0], variant: "destructive" });
      } else if (data.errors?.length > 0) {
        setShowImport(false);
        setImportFields([{ url: "", name: "" }]);
        toast({ title: `${data.imported} of ${data.total} images imported`, description: data.errors[0] });
      } else {
        setShowImport(false);
        setImportFields([{ url: "", name: "" }]);
        toast({ title: `${data.imported} image(s) imported successfully` });
      }
    },
    onError: () => {
      toast({ title: "Failed to import. Check your URLs and try again.", variant: "destructive" });
    },
  });

  const computeSlotAwarePages = useCallback((pinsList: Pin[], layout: ReturnType<typeof getGridLayout>, dm: DescMode = "auto") =>
    paginateMoodboard(pinsList, layout, pin => isDescLong(pin, dm)), []);

  const getPageInsertPosition = useCallback((targetPage: number) => {
    if (targetPage < 0 || !project) return pins.length;
    const sortedPins = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
    const layout = getGridLayout(
      (project.orientation || "horizontal") === "horizontal",
      project.imageLayout || "original",
      project.gridColumns || 3,
      project.paperSize || "A3"
    );
    const pagesList = computeSlotAwarePages(sortedPins, layout, descMode);
    const hasCover = project.showCover !== false;
    const contentPage = hasCover ? targetPage - 1 : targetPage;
    if (contentPage < 0) return 0;
    if (contentPage >= pagesList.length) return sortedPins.length;
    const targetPg = pagesList[contentPage];
    if (!targetPg || targetPg.length === 0) return sortedPins.length;
    const lastPin = targetPg[targetPg.length - 1];
    const lastIdx = sortedPins.indexOf(lastPin);
    return lastIdx + 1;
  }, [pins, project, computeSlotAwarePages]);

  const addPinRaw = useMutation({
    mutationFn: async (data: { imageUrl: string; title?: string; targetPage?: number }) => {
      const position = data.targetPage !== undefined && data.targetPage >= 0
        ? getPageInsertPosition(data.targetPage)
        : pins.length;
      const res = await apiRequest("POST", `/api/projects/${projectId}/pins`, {
        projectId,
        imageUrl: data.imageUrl,
        title: data.title || "Imported Image",
        position,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
    },
  });

  const addPin = {
    ...addPinRaw,
    mutate: (data: { imageUrl: string; title?: string; targetPage?: number }) => {
      pushSnapshot(pins);
      addPinRaw.mutate(data);
    },
  };

  const updatePin = useMutation({
    mutationKey: ["editor-pin-save", projectId],
    scope: { id: `editor-pin-save-${projectId}` },
    mutationFn: async ({ pinId, data }: { pinId: number; data: Partial<Pin> }) => {
      const res = await apiRequest("PATCH", `/api/pins/${pinId}`, data);
      return res.json();
    },
    onSuccess: (_result, { pinId, data }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      if (activeSaveProjectRef.current !== projectId) return;
      setFailedPinChanges(previous => {
        const next = { ...previous }, remaining = { ...next[pinId] };
        for (const key of Object.keys(data)) delete remaining[key as keyof Pin];
        if (Object.keys(remaining).length) next[pinId] = remaining;
        else delete next[pinId];
        return next;
      });
      setSavedAt(new Date());
    },
    onError: (_error, { pinId, data }) => {
      if (activeSaveProjectRef.current === projectId) setFailedPinChanges(previous => ({ ...previous, [pinId]: { ...previous[pinId], ...data } }));
    },
  });

  const deletePinRaw = useMutation({
    scope: { id: `editor-pin-save-${projectId}` },
    mutationFn: async (pinId: number) => {
      await apiRequest("DELETE", `/api/pins/${pinId}`);
    },
    onSuccess: (_result, pinId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      setSelectedPin(null);
      setFailedPinChanges(previous => { const next = { ...previous }; delete next[pinId]; return next; });
    },
  });

  const deletePin = {
    ...deletePinRaw,
    mutate: (pinId: number) => {
      pushSnapshot(pins);
      deletePinRaw.mutate(pinId);
    },
  };

  const reorderPins = useMutation({
    mutationFn: async (pinIds: number[]) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/reorder-pins`, { pinIds });
      return res.json();
    },
    onMutate: async (pinIds: number[]) => {
      await queryClient.cancelQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      const previous = queryClient.getQueryData<Pin[]>(["/api/projects", projectId, "pins"]);
      if (previous) {
        const pinMap = new Map(previous.map((p) => [p.id, p]));
        const optimistic = pinIds.map((id, idx) => ({ ...pinMap.get(id)!, position: idx })).filter(Boolean);
        queryClient.setQueryData(["/api/projects", projectId, "pins"], optimistic);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/projects", projectId, "pins"], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
    },
  });

  const handleShuffle = useCallback(() => {
    pushSnapshot(pins);
    const sorted = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
    const shuffled = [...sorted];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    reorderPins.mutate(shuffled.map((p) => p.id));
    toast({ title: "Images shuffled" });
  }, [pins, reorderPins, toast, pushSnapshot]);

  const handleMovePin = useCallback((pinId: number, direction: "up" | "down") => {
    pushSnapshot(pins);
    const sorted = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
    const idx = sorted.findIndex((p) => p.id === pinId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    reorderPins.mutate(sorted.map((p) => p.id));
  }, [pins, reorderPins, pushSnapshot]);

  const handleUpdatePageDescription = useCallback((pageIndex: number, data: { title: string; description: string }) => {
    const existing = (project?.pageDescriptions as Array<{ title: string; description: string }>) || [];
    const updated = [...existing];
    while (updated.length <= pageIndex) {
      updated.push({ title: "", description: "" });
    }
    updated[pageIndex] = data;
    updateProject.mutate({ pageDescriptions: updated });
  }, [project, updateProject]);

  const handleUpdatePinDescription = useCallback((pinId: number, desc: string) => {
    pushSnapshot(pins);
    updatePin.mutate({ pinId, data: { descriptionCustomInput: desc } });
  }, [updatePin, pins, pushSnapshot]);

  const handleToggleApproval = useCallback((pinId: number, status: string | null) => {
    pushSnapshot(pins);
    updatePin.mutate({ pinId, data: { approvalStatus: status } });
  }, [updatePin, pins, pushSnapshot]);

  const [descDialogPin, setDescDialogPin] = useState<Pin | null>(null);
  const [descDialogText, setDescDialogText] = useState("");

  const generatePinDescription = useMutation({
    mutationFn: async (pinId: number) => {
      const res = await apiRequest("POST", `/api/pins/${pinId}/generate-description`);
      return res.json();
    },
    onSuccess: (data: Pin) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pins"] });
      if (data.descriptionAi) {
        setDescDialogText(data.descriptionAi);
      }
      toast({ title: "Description generated" });
    },
    onError: () => {
      toast({ title: "Failed to generate description", variant: "destructive" });
    },
  });

  const handleOpenDescDialog = useCallback((pin: Pin) => {
    setDescDialogPin(pin);
    setDescDialogText(pin.descriptionCustomInput || "");
  }, []);

  const handleSaveDescDialog = useCallback(() => {
    if (descDialogPin) {
      pushSnapshot(pins);
      updatePin.mutate({ pinId: descDialogPin.id, data: { descriptionCustomInput: descDialogText } });
      setDescDialogPin(null);
    }
  }, [descDialogPin, descDialogText, updatePin, pins, pushSnapshot]);

  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);

  const handleGenerateConceptDescription = useCallback(async (pageIndex: number, keywords: string) => {
    if (!project) return;
    setIsGeneratingConcept(true);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/generate-concept`, { keywords, pageIndex });
      const data = await res.json();
      if (data.description) {
        const existing = (project.pageDescriptions as Array<{ title: string; description: string }>) || [];
        const updated = [...existing];
        while (updated.length <= pageIndex) {
          updated.push({ title: "", description: "" });
        }
        updated[pageIndex] = { title: updated[pageIndex]?.title || "", description: data.description };
        updateProject.mutate({ pageDescriptions: updated });
        toast({ title: "Concept description generated" });
      }
    } catch {
      toast({ title: "Failed to generate concept description", variant: "destructive" });
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [project, projectId, updateProject, toast]);

  const leadStatusOptions = [
    { value: "hot", label: "Hot", icon: Flame, color: "text-red-500" },
    { value: "warm", label: "Warm", icon: Sun, color: "text-amber-500" },
    { value: "cold", label: "Cold", icon: Snowflake, color: "text-blue-500" },
  ];

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const currentLead = leadStatusOptions.find((l) => l.value === project.leadStatus) || leadStatusOptions[1];
  const CurrentLeadIcon = currentLead.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/40" style={{ background: 'hsl(var(--card) / 0.6)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}>
        <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowMobileSidebar(true)}
              data-testid="button-mobile-sidebar"
              aria-label="Open editor settings"
              className="sm:hidden"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowLeftPanel((v) => !v)}
              data-testid="button-toggle-panel"
              className="hidden sm:inline-flex"
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="flex items-center gap-1.5 min-w-0">
              <a
                href="/"
                onClick={(e) => { e.preventDefault(); navigate("/"); }}
                className="shrink-0 cursor-pointer"
                title="Moodboard Studio"
                data-testid="link-logo-home"
              >
                <BrandLogo className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg" />
              </a>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-semibold truncate max-w-[100px] sm:max-w-none" data-testid="text-editor-title">
                  {project.title}
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-none hidden sm:block">
                  {project.studioName || "Moodboard Studio"} &middot; {project.designerName || "Designer"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <Select
              value={project.leadStatus || "warm"}
              onValueChange={(value) => updateProject.mutate({ leadStatus: value })}
            >
              <SelectTrigger className="w-9 sm:w-[100px]" data-testid="select-lead-status" aria-label="Lead status">
                <div className="flex items-center gap-1.5">
                  <CurrentLeadIcon className={`w-3.5 h-3.5 ${currentLead.color}`} />
                  <span className="text-xs hidden sm:inline">{currentLead.label}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {leadStatusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-1.5">
                      <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowShare(true)}
              className="sm:hidden"
              data-testid="button-share-mobile"
              aria-label="Share project"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowShare(true)}
              className="hidden sm:inline-flex"
              data-testid="button-share"
            >
              <Share2 className="w-4 h-4 mr-1" />
              <span className="text-sm">Share</span>
            </Button>
            <Button
              size="icon"
              onClick={() => setShowExport(true)}
              className="sm:hidden"
              data-testid="button-export-mobile"
              aria-label="Export PDF"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setShowExport(true)}
              className="hidden sm:inline-flex"
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-1" />
              <span className="text-sm">Export PDF</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border/30 px-3 sm:px-4 py-1 text-xs" role="status" aria-live="polite" data-testid="editor-save-status">
          {isSavingEdits ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : hasFailedEdits ? <><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-destructive">Some edits were not saved.</span></> : savedAt ? <><Check className="w-3 h-3" /><span title={`Last saved edit: ${savedAt.toLocaleTimeString()}`}>Saved</span></> : <span className="text-muted-foreground">Edits save automatically when you finish a field.</span>}
          {hasFailedEdits && <Button variant="ghost" size="sm" disabled={isSavingEdits} className="h-6 px-2 text-xs" data-testid="button-retry-save" onClick={() => {
            if (Object.keys(failedProjectChanges).length) updateProject.mutate({ ...failedProjectChanges });
            for (const [pinId, data] of Object.entries(failedPinChanges)) updatePin.mutate({ pinId: Number(pinId), data: { ...data } });
          }}><RefreshCw className="w-3 h-3 mr-1" />Retry saving</Button>}
        </div>
      </header>

      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent
          side="left"
          className="flex h-[100dvh] max-h-[100dvh] w-[min(360px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col gap-0 p-0 sm:hidden"
          data-testid="mobile-sidebar-sheet"
        >
          <SheetHeader className="shrink-0 border-b border-border bg-background/95 px-4 py-3 pr-12 text-left backdrop-blur-sm">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Editor settings
            </SheetTitle>
            <SheetDescription className="text-xs">
              Adjust your moodboard and cover
            </SheetDescription>
          </SheetHeader>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onFocus={() => { isEditingRef.current = true; }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                isEditingRef.current = false;
              }
            }}
          >
            <div className="space-y-1 p-3 pb-8">
              <SidebarSection title="Description" icon={FileText} id="description" openSections={openSections} onToggle={toggleSection}>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Keywords</label>
                  <Textarea
                    value={settingsForm.descriptionRaw}
                    onChange={(e) => setSettingsForm({ ...settingsForm, descriptionRaw: e.target.value })}
                    onBlur={() => updateProject.mutate({ descriptionRaw: settingsForm.descriptionRaw })}
                    placeholder="tropical modern, limestone, warm lighting"
                    className="min-h-[80px] text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full justify-start ai-gradient-btn"
                  onClick={() => generateDescription.mutate()}
                  disabled={generateDescription.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {generateDescription.isPending ? "Generating..." : "Generate AI Description"}
                </Button>
                {project.descriptionAi && (
                  <div className="p-2 rounded-md bg-muted/50">
                    <p className="text-xs leading-relaxed text-muted-foreground">{project.descriptionAi}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Show Description</span>
                  <Switch
                    checked={settingsForm.descriptionEnabled}
                    onCheckedChange={(checked) => {
                      setSettingsForm({ ...settingsForm, descriptionEnabled: checked });
                      updateProject.mutate({ descriptionEnabled: checked });
                    }}
                  />
                </div>
              </SidebarSection>

              <SidebarSection title="Layout" icon={LayoutGrid} id="layout" openSections={openSections} onToggle={toggleSection}>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Paper Size</label>
                   <Select value={project.paperSize || "A3"} onValueChange={(v) => updateProject.mutate({ paperSize: v })}>
                     <SelectTrigger className="text-sm" aria-label="Paper size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="A3">A3</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Orientation</label>
                   <Select value={project.orientation || "horizontal"} onValueChange={(v) => updateProject.mutate({ orientation: v })}>
                     <SelectTrigger className="text-sm" aria-label="Orientation"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horizontal">Landscape</SelectItem>
                      <SelectItem value="vertical">Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Image Layout</label>
                   <Select value={project.imageLayout || "original"} onValueChange={handleImageLayoutChange}>
                     <SelectTrigger className="text-sm" aria-label="Image layout"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Original (Masonry)</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="portrait_3_5">Portrait 3:5</SelectItem>
                      <SelectItem value="portrait_9_16">Portrait 9:16</SelectItem>
                       <SelectItem value="landscape_5_3">Landscape 5:3</SelectItem>
                      <SelectItem value="landscape_16_9">Landscape 16:9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Columns</label>
                  <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="column-selector-mobile-sidebar">
                    {[3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        variant={(project.gridColumns || 3) === n ? "default" : "ghost"}
                        className="flex-1"
                        onClick={() => updateProject.mutate({ gridColumns: n })}
                        data-testid={`button-mobile-columns-${n}`}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
                 <div>
                   <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Font Size</label>
                   <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="font-size-selector-mobile-sidebar">
                     {([["small", "S"], ["normal", "M"], ["large", "L"]] as const).map(([val, label]) => (
                       <Button
                         key={val}
                         size="sm"
                         variant={(project.descriptionFontSize || "normal") === val ? "default" : "ghost"}
                         className="flex-1"
                         onClick={() => updateProject.mutate({ descriptionFontSize: val })}
                         data-testid={`button-mobile-fontsize-${val}`}
                       >
                         {label}
                       </Button>
                     ))}
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Font Family</label>
                   <Select
                     value={project.fontFamily || "Montserrat"}
                     onValueChange={(value) => updateProject.mutate({ fontFamily: value })}
                   >
                     <SelectTrigger className="w-full text-sm" data-testid="select-mobile-font-family" aria-label="Font family">
                       <span className="truncate" style={{ fontFamily: getFontCss(project.fontFamily || "Montserrat") }}>
                         {FONT_FAMILIES.find(f => f.value === (project.fontFamily || "Montserrat"))?.label || "Montserrat"}
                       </span>
                     </SelectTrigger>
                     <SelectContent>
                       {FONT_FAMILIES.map((font) => (
                         <SelectItem key={font.value} value={font.value}>
                           <span style={{ fontFamily: font.css }}>{font.label}</span>
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Background Color</label>
                   <div className="grid grid-cols-8 gap-1" data-testid="canvas-bg-selector-mobile-sidebar">
                     {[
                       { color: "#ffffff", label: "White" },
                       { color: "#fefcf9", label: "Snow" },
                       { color: "#faf6f1", label: "Cream" },
                       { color: "#f5ebe0", label: "Linen" },
                       { color: "#ede0d0", label: "Ivory" },
                       { color: "#e6d5c3", label: "Sand" },
                       { color: "#dcc8b0", label: "Bisque" },
                       { color: "#d4c4b0", label: "Khaki" },
                       { color: "#c9b99a", label: "Wheat" },
                       { color: "#b5a48e", label: "Tan" },
                       { color: "#a0896e", label: "Sienna" },
                       { color: "#8b7355", label: "Umber" },
                       { color: "#6b5744", label: "Mocha" },
                       { color: "#5c4033", label: "Brown" },
                       { color: "#3b3026", label: "Espresso" },
                       { color: "#1a1410", label: "Dark" },
                     ].map((bg) => (
                       <button
                         key={bg.color}
                         type="button"
                         className={`w-full aspect-square rounded-md border-2 transition-all ${
                           (project.canvasBackground || "#ffffff") === bg.color
                             ? "border-primary scale-110"
                             : "border-border"
                         }`}
                         style={{ backgroundColor: bg.color }}
                         onClick={() => updateProject.mutate({ canvasBackground: bg.color })}
                         title={bg.label}
                         aria-label={`${bg.label} background`}
                         data-testid={`button-mobile-bg-${bg.label.toLowerCase()}`}
                       />
                     ))}
                   </div>
                   <div className="relative mt-1">
                     <input
                       type="color"
                       value={project.canvasBackground || "#ffffff"}
                       onChange={(e) => updateProject.mutate({ canvasBackground: e.target.value })}
                       className="absolute inset-0 h-7 w-full cursor-pointer opacity-0"
                       aria-label="Custom background color"
                       data-testid="input-mobile-bg-custom-color"
                     />
                     <div
                       className="h-7 w-full rounded-md border-2 border-border"
                       style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                       aria-hidden="true"
                     />
                   </div>
                 </div>
              </SidebarSection>

              <SidebarSection title="Project" icon={Building2} id="studio" openSections={openSections} onToggle={toggleSection}>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Studio Name</label>
                  <Input
                    value={settingsForm.studioName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, studioName: e.target.value })}
                    onBlur={() => updateProject.mutate({ studioName: settingsForm.studioName })}
                    className="text-sm"
                    data-testid="input-mobile-studio-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Designer Name</label>
                  <Input
                    value={settingsForm.designerName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, designerName: e.target.value })}
                    onBlur={() => updateProject.mutate({ designerName: settingsForm.designerName })}
                    className="text-sm"
                    data-testid="input-mobile-designer-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Project Title</label>
                  <Input
                    value={settingsForm.title}
                    onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                    onBlur={() => updateProject.mutate({ title: settingsForm.title })}
                    className="text-sm"
                    data-testid="input-mobile-project-title"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Studio Logo</label>
                  <div className="flex items-center gap-2">
                    {project.studioLogoPath ? (
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
                        <img src={project.studioLogoPath} alt="Studio logo" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-md border border-dashed border-border bg-muted flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" disabled={isUploadingLogo} asChild>
                          <span>
                            <Upload className="mr-1 h-4 w-4" />
                            {isUploadingLogo ? "Uploading..." : "Upload"}
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          data-testid="input-mobile-logo-upload"
                        />
                      </label>
                      {project.studioLogoPath && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateProject.mutate({ studioLogoPath: null })}
                          data-testid="button-mobile-remove-logo"
                          aria-label="Remove studio logo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Project Name</label>
                  <Input
                    value={settingsForm.projectName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, projectName: e.target.value })}
                    onBlur={() => updateProject.mutate({ projectName: settingsForm.projectName })}
                    className="text-sm"
                    placeholder="e.g. Tropical Modern Villa"
                    data-testid="input-mobile-project-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Website</label>
                  <Input
                    value={settingsForm.studioWebsite}
                    onChange={(e) => setSettingsForm({ ...settingsForm, studioWebsite: e.target.value })}
                    onBlur={() => updateProject.mutate({ studioWebsite: settingsForm.studioWebsite })}
                    className="text-sm"
                    placeholder="www.yourstudio.com"
                    data-testid="input-mobile-studio-website"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Social Media</label>
                  <Input
                    value={settingsForm.studioSocialMedia}
                    onChange={(e) => setSettingsForm({ ...settingsForm, studioSocialMedia: e.target.value })}
                    onBlur={() => updateProject.mutate({ studioSocialMedia: settingsForm.studioSocialMedia })}
                    className="text-sm"
                    placeholder="@yourstudio"
                    data-testid="input-mobile-studio-social"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Contact Number</label>
                  <Input
                    value={settingsForm.studioContactNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, studioContactNumber: e.target.value })}
                    onBlur={() => updateProject.mutate({ studioContactNumber: settingsForm.studioContactNumber })}
                    className="text-sm"
                    placeholder="+62 xxx xxxx xxxx"
                    data-testid="input-mobile-studio-contact"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Show Footer</span>
                  <Switch
                    checked={settingsForm.showFooter}
                    onCheckedChange={(checked) => {
                      setSettingsForm({ ...settingsForm, showFooter: checked });
                      updateProject.mutate({ showFooter: checked });
                    }}
                    data-testid="switch-mobile-show-footer"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cover Page</span>
                  <Switch
                    checked={project.showCover !== false}
                    onCheckedChange={(checked) => updateProject.mutate({ showCover: checked })}
                    data-testid="switch-mobile-show-cover"
                  />
                </div>
                {project.showCover !== false && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Cover Style</label>
                      <div className="flex gap-1">
                        <Button
                          variant={(project.coverImageStyle || "rounded") === "rounded" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateProject.mutate({ coverImageStyle: "rounded" })}
                          data-testid="button-mobile-cover-rounded"
                        >
                          Rounded
                        </Button>
                        <Button
                          variant={project.coverImageStyle === "full" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateProject.mutate({ coverImageStyle: "full" })}
                          data-testid="button-mobile-cover-full"
                        >
                          Full
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-t pt-2 mt-0.5">Cover Typography</p>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Title Style</label>
                      <div className="flex gap-1">
                        {(["bold","regular","italic"] as const).map(w => (
                          <button key={w} onClick={() => updateProject.mutate({ coverTitleWeight: w })}
                            className={`flex-1 text-xs py-1.5 rounded-lg border capitalize transition-colors ${(project.coverTitleWeight || "bold") === w ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                            data-testid={`button-mobile-cover-title-weight-${w}`}
                          >{w}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Title Case</label>
                      <div className="flex gap-1">
                        {([["uppercase","AA"],["lowercase","aa"],["none","Aa"]] as const).map(([val, label]) => (
                          <button key={val} onClick={() => updateProject.mutate({ coverTitleTransform: val })}
                            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${(project.coverTitleTransform || "uppercase") === val ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                            data-testid={`button-mobile-cover-title-transform-${val}`}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Title Color</label>
                        <div className="flex items-center gap-1.5">
                          <input type="color" value={project.coverTitleColor || (isBackgroundDark(project.canvasBackground || "#ffffff") ? "#e4e4e7" : "#27272a")}
                            onChange={(e) => updateProject.mutate({ coverTitleColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-border" data-testid="input-mobile-cover-title-color" />
                          {project.coverTitleColor && (
                            <button onClick={() => updateProject.mutate({ coverTitleColor: null })} className="text-[10px] text-muted-foreground hover:text-foreground">Auto</button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Desc Color</label>
                        <div className="flex items-center gap-1.5">
                          <input type="color" value={project.coverDescColor || (isBackgroundDark(project.canvasBackground || "#ffffff") ? "#71717a" : "#a1a1aa")}
                            onChange={(e) => updateProject.mutate({ coverDescColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-border" data-testid="input-mobile-cover-desc-color" />
                          {project.coverDescColor && (
                            <button onClick={() => updateProject.mutate({ coverDescColor: null })} className="text-[10px] text-muted-foreground hover:text-foreground">Auto</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </SidebarSection>

              <SidebarSection title="Client" icon={User} id="client" openSections={openSections} onToggle={toggleSection}>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Company</label>
                  <Input
                    value={settingsForm.clientCompany}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clientCompany: e.target.value })}
                    onBlur={() => updateProject.mutate({ clientCompany: settingsForm.clientCompany })}
                    className="text-sm"
                    placeholder="Client company name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Owner</label>
                  <Input
                    value={settingsForm.clientOwnerName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clientOwnerName: e.target.value })}
                    onBlur={() => updateProject.mutate({ clientOwnerName: settingsForm.clientOwnerName })}
                    className="text-sm"
                    placeholder="Client's name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Phone</label>
                  <Input
                    value={settingsForm.clientPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clientPhone: e.target.value })}
                    onBlur={() => updateProject.mutate({ clientPhone: settingsForm.clientPhone })}
                    className="text-sm"
                    placeholder="+62 xxx xxxx xxxx"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Email</label>
                  <Input
                    value={settingsForm.clientEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clientEmail: e.target.value })}
                    onBlur={() => updateProject.mutate({ clientEmail: settingsForm.clientEmail })}
                    className="text-sm"
                    placeholder="client@email.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Location</label>
                  <Input
                    value={settingsForm.clientLocation}
                    onChange={(e) => setSettingsForm({ ...settingsForm, clientLocation: e.target.value })}
                    onBlur={() => updateProject.mutate({ clientLocation: settingsForm.clientLocation })}
                    className="text-sm"
                    placeholder="Bali, Indonesia"
                    data-testid="input-mobile-client-location"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Signature Label</label>
                  <Input
                    value={settingsForm.signatureField}
                    onChange={(e) => setSettingsForm({ ...settingsForm, signatureField: e.target.value })}
                    onBlur={() => updateProject.mutate({ signatureField: settingsForm.signatureField })}
                    className="text-sm"
                    placeholder="Signature"
                    data-testid="input-mobile-signature-label"
                  />
                </div>
              </SidebarSection>

              <SidebarSection title="AI Tools" icon={Sparkles} id="ai" openSections={openSections} onToggle={toggleSection}>
                <Button
                  size="sm"
                  className="w-full justify-start ai-gradient-btn"
                  onClick={() => setShowDescModeDialog(true)}
                  disabled={generateAllPinDescriptions.isPending}
                  data-testid="button-mobile-generate-all-descriptions"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {generateAllPinDescriptions.isPending ? "Describing images..." : "AI Describe All Images"}
                </Button>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description Position</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      className={`flex items-center justify-center gap-1 rounded-lg border text-xs py-1.5 transition-colors ${descMode === "below" ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                      onClick={() => setDescMode("below")}
                      data-testid="button-mobile-desc-pos-below"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                      Below
                    </button>
                    <button
                      className={`flex items-center justify-center gap-1 rounded-lg border text-xs py-1.5 transition-colors ${descMode === "beside" ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                      onClick={() => setDescMode("beside")}
                      data-testid="button-mobile-desc-pos-beside"
                    >
                      <Columns className="w-3.5 h-3.5" />
                      Beside
                    </button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => setShowClearDescConfirm(true)}
                  disabled={clearAllDescriptions.isPending}
                  data-testid="button-mobile-clear-all-descriptions"
                >
                  <Eraser className="w-4 h-4 mr-1" />
                  {clearAllDescriptions.isPending ? "Clearing..." : "Clear All Descriptions"}
                </Button>
                <Button
                  size="sm"
                  className="w-full justify-start ai-gradient-btn"
                  onClick={() => generateDescription.mutate()}
                  disabled={generateDescription.isPending}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  {generateDescription.isPending ? "Generating..." : "AI Cover Description"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowDuplicates(true)}
                  data-testid="button-mobile-check-duplicates"
                >
                  <ScanSearch className="w-4 h-4 mr-1" />
                  Check Duplicates
                  {duplicateCount > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {duplicateCount}
                    </span>
                  )}
                </Button>
              </SidebarSection>

              <SidebarSection title="Affiliate" icon={Share2} id="affiliate-mobile" openSections={openSections} onToggle={toggleSection}>
                <MobileAffiliateSection />
              </SidebarSection>

              <div className="pt-2 border-t border-border mt-2">
                <div className="text-xs text-muted-foreground space-y-0.5 px-1">
                  <p>{pins.length} image{pins.length !== 1 ? "s" : ""}</p>
                  <p>{project.paperSize || "A3"} &middot; {(project.orientation || "horizontal") === "horizontal" ? "Landscape" : "Portrait"}</p>
                  <p>{project.gridColumns || 3} columns</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex overflow-hidden">
        {(() => {
          const paperSize = project.paperSize || "A3";
          const orientation = project.orientation || "horizontal";
          const imageLayout = project.imageLayout || "original";
          const gridColumns = project.gridColumns || 3;
          const isLandscapeSidebar = orientation === "horizontal";
          const layoutSidebar = getGridLayout(isLandscapeSidebar, imageLayout, gridColumns, paperSize);
          const totalPages = Math.max(1, Math.ceil(pins.length / layoutSidebar.perPage));

          return (
            <aside
              className="hidden sm:flex shrink-0 flex-col border-r border-border bg-muted/30 overflow-hidden sticky top-0 self-start"
              style={{
                width: showLeftPanel ? 360 : 48,
                height: 'calc(100vh - 49px)',
                transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              data-testid="left-panel"
            >
              {!showLeftPanel ? (
                <div className="flex flex-col items-center gap-1 py-2">
                  {[
                    { icon: FileText, id: "description", label: "Description" },
                    { icon: LayoutGrid, id: "layout", label: "Layout" },
                    { icon: Building2, id: "studio", label: "Project" },
                    { icon: User, id: "client", label: "Client" },
                    { icon: Sparkles, id: "ai", label: "AI" },
                  ].map((item) => {
                    const isActive = openSections.has(item.id);
                    return (
                      <button
                        key={item.id}
                        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-300 ${
                          isActive
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => { setShowLeftPanel(true); setOpenSections((prev) => new Set(prev).add(item.id)); }}
                        title={item.label}
                        data-testid={`sidebar-icon-${item.id}`}
                      >
                        <item.icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="overflow-y-auto overflow-x-hidden flex-1 min-h-0"
                  style={{ width: 360, maxHeight: 'calc(100vh - 49px)' }}
                  onFocus={() => { isEditingRef.current = true; }}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      isEditingRef.current = false;
                    }
                  }}
                >
                  <div className="p-4 space-y-2">
                    <SidebarSection title="Description" icon={FileText} id="description" openSections={openSections} onToggle={toggleSection}>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Keywords</label>
                        <Textarea
                          value={settingsForm.descriptionRaw}
                          onChange={(e) => setSettingsForm({ ...settingsForm, descriptionRaw: e.target.value })}
                          onBlur={() => updateProject.mutate({ descriptionRaw: settingsForm.descriptionRaw })}
                          placeholder="tropical modern, limestone, warm lighting"
                          className="min-h-[80px] text-sm"
                          data-testid="input-description-raw"
                        />
                      </div>
                      <Button
                        className="w-full justify-start ai-gradient-btn"
                        onClick={() => generateDescription.mutate()}
                        disabled={generateDescription.isPending}
                        data-testid="button-generate-description"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {generateDescription.isPending ? "Generating..." : "Generate AI Description"}
                      </Button>
                      {project.descriptionAi && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs leading-relaxed text-muted-foreground">{project.descriptionAi}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Show Description</span>
                        <Switch
                          checked={settingsForm.descriptionEnabled}
                          onCheckedChange={(checked) => {
                            setSettingsForm({ ...settingsForm, descriptionEnabled: checked });
                            updateProject.mutate({ descriptionEnabled: checked });
                          }}
                          data-testid="switch-show-description"
                        />
                      </div>
                    </SidebarSection>

                    <SidebarSection title="Layout" icon={LayoutGrid} id="layout" openSections={openSections} onToggle={toggleSection}>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Paper Size</label>
                        <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="paper-size-selector">
                          {["A4", "A3", "A2"].map((size) => (
                            <Button
                              key={size}
                              variant={(project.paperSize || "A3") === size ? "default" : "ghost"}
                              className="flex-1"
                              onClick={() => updateProject.mutate({ paperSize: size })}
                              data-testid={`button-paper-${size}`}
                            >
                              {size}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Orientation</label>
                        <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="orientation-selector">
                          {([["horizontal", "Landscape"], ["vertical", "Portrait"]] as const).map(([val, label]) => (
                            <Button
                              key={val}
                              variant={(project.orientation || "horizontal") === val ? "default" : "ghost"}
                              className="flex-1"
                              onClick={() => updateProject.mutate({ orientation: val })}
                              data-testid={`button-orientation-${val}`}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Image Format</label>
                        <Select
                          value={project.imageLayout || "original"}
                          onValueChange={handleImageLayoutChange}
                        >
                          <SelectTrigger className="w-full" data-testid="select-image-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="original">Original (Masonry)</SelectItem>
                            <SelectItem value="square">Square (1:1)</SelectItem>
                            <SelectItem value="portrait_3_5">Portrait (3:5)</SelectItem>
                            <SelectItem value="portrait_9_16">Portrait (9:16)</SelectItem>
                            <SelectItem value="landscape_5_3">Landscape (5:3)</SelectItem>
                            <SelectItem value="landscape_16_9">Landscape (16:9)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Columns</label>
                        <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="column-selector">
                          {[3, 4, 5].map((n) => (
                            <Button
                              key={n}
                              variant={(project.gridColumns || 3) === n ? "default" : "ghost"}
                              className="flex-1"
                              onClick={() => updateProject.mutate({ gridColumns: n })}
                              data-testid={`button-columns-${n}`}
                            >
                              {n}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Font Size</label>
                        <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="font-size-selector">
                          {([["small", "S"], ["normal", "M"], ["large", "L"]] as const).map(([val, label]) => (
                            <Button
                              key={val}
                              variant={(project.descriptionFontSize || "normal") === val ? "default" : "ghost"}
                              className="flex-1"
                              onClick={() => updateProject.mutate({ descriptionFontSize: val })}
                              data-testid={`button-fontsize-${val}`}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Font Family</label>
                        <Select
                          value={project.fontFamily || "Montserrat"}
                          onValueChange={(value) => updateProject.mutate({ fontFamily: value })}
                        >
                          <SelectTrigger className="w-full" data-testid="select-font-family">
                            <span className="text-sm truncate" style={{ fontFamily: getFontCss(project.fontFamily || "Montserrat") }}>
                              {FONT_FAMILIES.find(f => f.value === (project.fontFamily || "Montserrat"))?.label || "Montserrat"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_FAMILIES.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                <span style={{ fontFamily: font.css }}>{font.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Background Color</label>
                        <div className="grid grid-cols-8 gap-1" data-testid="canvas-bg-selector">
                          {[
                            { color: "#ffffff", label: "White" },
                            { color: "#fefcf9", label: "Snow" },
                            { color: "#faf6f1", label: "Cream" },
                            { color: "#f5ebe0", label: "Linen" },
                            { color: "#ede0d0", label: "Ivory" },
                            { color: "#e6d5c3", label: "Sand" },
                            { color: "#dcc8b0", label: "Bisque" },
                            { color: "#d4c4b0", label: "Khaki" },
                            { color: "#c9b99a", label: "Wheat" },
                            { color: "#b5a48e", label: "Tan" },
                            { color: "#a0896e", label: "Sienna" },
                            { color: "#8b7355", label: "Umber" },
                            { color: "#6b5744", label: "Mocha" },
                            { color: "#5c4033", label: "Brown" },
                            { color: "#3b3026", label: "Espresso" },
                            { color: "#1a1410", label: "Dark" },
                          ].map((bg) => (
                            <button
                              key={bg.color}
                              className={`w-full aspect-square rounded-md border-2 transition-all ${
                                (project.canvasBackground || "#ffffff") === bg.color
                                  ? "border-primary scale-110"
                                  : "border-border"
                              }`}
                              style={{ backgroundColor: bg.color }}
                              onClick={() => updateProject.mutate({ canvasBackground: bg.color })}
                              title={bg.label}
                              data-testid={`button-bg-${bg.label.toLowerCase()}`}
                            />
                          ))}
                        </div>
                        <div className="relative mt-1">
                          <input
                            type="color"
                            value={project.canvasBackground || "#ffffff"}
                            onChange={(e) => updateProject.mutate({ canvasBackground: e.target.value })}
                            className="absolute inset-0 w-full h-7 opacity-0 cursor-pointer"
                            data-testid="input-bg-custom-color"
                          />
                          <div
                            className="w-full h-7 rounded-md border-2 border-border"
                            style={{
                              background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
                            }}
                            title="Custom color"
                          />
                        </div>
                      </div>
                    </SidebarSection>

                    <SidebarSection title="Project" icon={Building2} id="studio" openSections={openSections} onToggle={toggleSection}>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Project Title</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.title}
                          onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                          onBlur={() => updateProject.mutate({ title: settingsForm.title })}
                          data-testid="input-project-title"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Studio Name</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.studioName}
                          onChange={(e) => setSettingsForm({ ...settingsForm, studioName: e.target.value })}
                          onBlur={() => updateProject.mutate({ studioName: settingsForm.studioName })}
                          placeholder="e.g. Markstudios Architect"
                          data-testid="input-studio-name"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Studio Logo</label>
                        <div className="flex items-center gap-2">
                          {project.studioLogoPath ? (
                            <div className="w-20 h-20 rounded-md border border-border overflow-hidden flex items-center justify-center bg-muted">
                              <img src={project.studioLogoPath} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-md border border-dashed border-border flex items-center justify-center bg-muted">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 flex items-center gap-1">
                            <label className="cursor-pointer">
                              <Button variant="outline" size="sm" disabled={isUploadingLogo} asChild>
                                <span>
                                  <Upload className="w-4 h-4 mr-1" />
                                  {isUploadingLogo ? "..." : "Upload"}
                                </span>
                              </Button>
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} data-testid="input-logo-upload" />
                            </label>
                            {project.studioLogoPath && (
                              <Button variant="ghost" size="icon" onClick={() => updateProject.mutate({ studioLogoPath: null })} data-testid="button-remove-logo">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Designer Name</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.designerName}
                          onChange={(e) => setSettingsForm({ ...settingsForm, designerName: e.target.value })}
                          onBlur={() => updateProject.mutate({ designerName: settingsForm.designerName })}
                          placeholder="e.g. John Doe"
                          data-testid="input-designer-name"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Project Name</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.projectName}
                          onChange={(e) => setSettingsForm({ ...settingsForm, projectName: e.target.value })}
                          onBlur={() => updateProject.mutate({ projectName: settingsForm.projectName })}
                          placeholder="e.g. Tropical Modern Villa"
                          data-testid="input-project-name"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Website</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.studioWebsite}
                          onChange={(e) => setSettingsForm({ ...settingsForm, studioWebsite: e.target.value })}
                          onBlur={() => updateProject.mutate({ studioWebsite: settingsForm.studioWebsite })}
                          placeholder="www.yourstudio.com"
                          data-testid="input-studio-website"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Social Media</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.studioSocialMedia}
                          onChange={(e) => setSettingsForm({ ...settingsForm, studioSocialMedia: e.target.value })}
                          onBlur={() => updateProject.mutate({ studioSocialMedia: settingsForm.studioSocialMedia })}
                          placeholder="@yourstudio"
                          data-testid="input-studio-social"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Contact Number</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.studioContactNumber}
                          onChange={(e) => setSettingsForm({ ...settingsForm, studioContactNumber: e.target.value })}
                          onBlur={() => updateProject.mutate({ studioContactNumber: settingsForm.studioContactNumber })}
                          placeholder="+62 xxx xxxx xxxx"
                          data-testid="input-studio-contact"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Show Footer</span>
                        <Switch
                          checked={settingsForm.showFooter}
                          onCheckedChange={(checked) => {
                            setSettingsForm({ ...settingsForm, showFooter: checked });
                            updateProject.mutate({ showFooter: checked });
                          }}
                          data-testid="switch-show-footer"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cover Page</span>
                        <Switch
                          checked={project.showCover !== false}
                          onCheckedChange={(checked) => updateProject.mutate({ showCover: checked })}
                          data-testid="switch-show-cover"
                        />
                      </div>
                      {project.showCover !== false && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Cover Style</label>
                            <div className="flex gap-1">
                              <Button
                                variant={(project.coverImageStyle || "rounded") === "rounded" ? "default" : "outline"}
                                onClick={() => updateProject.mutate({ coverImageStyle: "rounded" })}
                                data-testid="button-cover-rounded"
                              >
                                Rounded
                              </Button>
                              <Button
                                variant={project.coverImageStyle === "full" ? "default" : "outline"}
                                onClick={() => updateProject.mutate({ coverImageStyle: "full" })}
                                data-testid="button-cover-full"
                              >
                                Full
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-t pt-2 mt-0.5">Cover Typography</p>
                          <div>
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Title Style</label>
                            <div className="flex gap-1">
                              {(["bold","regular","italic"] as const).map(w => (
                                <button key={w} onClick={() => updateProject.mutate({ coverTitleWeight: w })}
                                  className={`flex-1 text-xs py-1.5 rounded-lg border capitalize transition-colors ${(project.coverTitleWeight || "bold") === w ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                                  data-testid={`button-cover-title-weight-${w}`}
                                >{w}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Title Case</label>
                            <div className="flex gap-1">
                              {([["uppercase","AA"],["lowercase","aa"],["none","Aa"]] as const).map(([val, label]) => (
                                <button key={val} onClick={() => updateProject.mutate({ coverTitleTransform: val })}
                                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${(project.coverTitleTransform || "uppercase") === val ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                                  data-testid={`button-cover-title-transform-${val}`}
                                >{label}</button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Title Color</label>
                              <div className="flex items-center gap-1.5">
                                <input type="color" value={project.coverTitleColor || (isBackgroundDark(project.canvasBackground || "#ffffff") ? "#e4e4e7" : "#27272a")}
                                  onChange={(e) => updateProject.mutate({ coverTitleColor: e.target.value })}
                                  className="w-8 h-8 rounded cursor-pointer border border-border" data-testid="input-cover-title-color" />
                                {project.coverTitleColor && (
                                  <button onClick={() => updateProject.mutate({ coverTitleColor: null })} className="text-[10px] text-muted-foreground hover:text-foreground">Auto</button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Desc Color</label>
                              <div className="flex items-center gap-1.5">
                                <input type="color" value={project.coverDescColor || (isBackgroundDark(project.canvasBackground || "#ffffff") ? "#71717a" : "#a1a1aa")}
                                  onChange={(e) => updateProject.mutate({ coverDescColor: e.target.value })}
                                  className="w-8 h-8 rounded cursor-pointer border border-border" data-testid="input-cover-desc-color" />
                                {project.coverDescColor && (
                                  <button onClick={() => updateProject.mutate({ coverDescColor: null })} className="text-[10px] text-muted-foreground hover:text-foreground">Auto</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </SidebarSection>

                    <SidebarSection title="Client" icon={User} id="client" openSections={openSections} onToggle={toggleSection}>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Company</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.clientCompany}
                          onChange={(e) => setSettingsForm({ ...settingsForm, clientCompany: e.target.value })}
                          onBlur={() => updateProject.mutate({ clientCompany: settingsForm.clientCompany })}
                          placeholder="Client company name"
                          data-testid="input-client-company"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Owner</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.clientOwnerName}
                          onChange={(e) => setSettingsForm({ ...settingsForm, clientOwnerName: e.target.value })}
                          onBlur={() => updateProject.mutate({ clientOwnerName: settingsForm.clientOwnerName })}
                          placeholder="Client's name"
                          data-testid="input-client-owner"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Phone</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.clientPhone}
                          onChange={(e) => setSettingsForm({ ...settingsForm, clientPhone: e.target.value })}
                          onBlur={() => updateProject.mutate({ clientPhone: settingsForm.clientPhone })}
                          placeholder="+62 xxx xxxx xxxx"
                          data-testid="input-client-phone"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Email</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.clientEmail}
                          onChange={(e) => setSettingsForm({ ...settingsForm, clientEmail: e.target.value })}
                          onBlur={() => updateProject.mutate({ clientEmail: settingsForm.clientEmail })}
                          placeholder="client@email.com"
                          data-testid="input-client-email"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Location</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.clientLocation}
                          onChange={(e) => setSettingsForm({ ...settingsForm, clientLocation: e.target.value })}
                          onBlur={() => updateProject.mutate({ clientLocation: settingsForm.clientLocation })}
                          placeholder="Bali, Indonesia"
                          data-testid="input-client-location"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 block">Signature Label</label>
                        <Input
                          className="text-sm"
                          value={settingsForm.signatureField}
                          onChange={(e) => setSettingsForm({ ...settingsForm, signatureField: e.target.value })}
                          onBlur={() => updateProject.mutate({ signatureField: settingsForm.signatureField })}
                          placeholder="Signature"
                          data-testid="input-signature-label"
                        />
                      </div>
                    </SidebarSection>

                    <SidebarSection title="AI Tools" icon={Sparkles} id="ai" openSections={openSections} onToggle={toggleSection}>
                      <Button
                        className="w-full justify-start ai-gradient-btn"
                        onClick={() => setShowDescModeDialog(true)}
                        disabled={generateAllPinDescriptions.isPending}
                        data-testid="button-generate-all-descriptions"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {generateAllPinDescriptions.isPending ? "Describing images..." : "AI Describe All Images"}
                      </Button>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description Position</label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            className={`flex items-center justify-center gap-1 rounded-lg border text-xs py-1.5 transition-colors ${descMode === "below" ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                            onClick={() => setDescMode("below")}
                            data-testid="button-desc-pos-below"
                          >
                            <AlignLeft className="w-3.5 h-3.5" />
                            Below
                          </button>
                          <button
                            className={`flex items-center justify-center gap-1 rounded-lg border text-xs py-1.5 transition-colors ${descMode === "beside" ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950" : "border-border hover:border-orange-400"}`}
                            onClick={() => setDescMode("beside")}
                            data-testid="button-desc-pos-beside"
                          >
                            <Columns className="w-3.5 h-3.5" />
                            Beside
                          </button>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => setShowClearDescConfirm(true)}
                        disabled={clearAllDescriptions.isPending}
                        data-testid="button-clear-all-descriptions"
                      >
                        <Eraser className="w-4 h-4 mr-1" />
                        {clearAllDescriptions.isPending ? "Clearing..." : "Clear All Descriptions"}
                      </Button>
                      <Button
                        className="w-full justify-start ai-gradient-btn"
                        onClick={() => generateDescription.mutate()}
                        disabled={generateDescription.isPending}
                        data-testid="button-generate-ai"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        {generateDescription.isPending ? "Generating..." : "AI Cover Description"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setShowDuplicates(true)}
                        data-testid="button-check-duplicates"
                      >
                        <ScanSearch className="w-4 h-4 mr-1" />
                        Check Duplicates
                        {duplicateCount > 0 && (
                          <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {duplicateCount}
                          </span>
                        )}
                      </Button>
                    </SidebarSection>

                    <div className="pt-2 border-t border-border mt-2">
                      <div className="text-xs text-muted-foreground space-y-0.5 px-1">
                        <p>{pins.length} image{pins.length !== 1 ? "s" : ""}</p>
                        <p>{totalPages} page{totalPages !== 1 ? "s" : ""}</p>
                        <p>{paperSize} &middot; {isLandscapeSidebar ? "Landscape" : "Portrait"}</p>
                        <p>{gridColumns} columns</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          );
        })()}

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto" style={{ height: 'calc(100vh - 49px)' }}>
        {project.descriptionEnabled && project.descriptionAi && (
          <div className="border-b border-border/50 glass-subtle px-6 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl" data-testid="text-project-description">
              {project.descriptionAi}
            </p>
          </div>
        )}

        <div className="flex-1 p-3 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-medium text-muted-foreground">
                {pins.length} image{pins.length !== 1 ? "s" : ""}
              </h2>
              {pins.length > 0 && (() => {
                const paperSize = project.paperSize || "A3";
                const orientation = project.orientation || "horizontal";
                const imageLayout = project.imageLayout || "original";
                const gridColumns = project.gridColumns || 3;
                const isLandscape = orientation === "horizontal";
                const layout = getGridLayout(isLandscape, imageLayout, gridColumns, paperSize);
                const totalPages = Math.max(1, Math.ceil(pins.length / layout.perPage));
                return (
                  <>
                    <span className="text-xs text-muted-foreground">&middot;</span>
                    <span className="text-xs text-muted-foreground">{totalPages} page{totalPages !== 1 ? "s" : ""}</span>
                    <Badge variant="secondary">{paperSize}</Badge>
                    <Badge variant="secondary" className="hidden sm:inline-flex">{isLandscape ? "Landscape" : "Portrait"}</Badge>
                    <Badge variant="secondary">{gridColumns} columns</Badge>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <div className="flex items-center gap-1 border border-border rounded-md p-0.5" data-testid="approval-filter">
                {([["all", "All"], ["approved", "Used"], ["unchecked", "Unused"]] as const).map(([val, label]) => (
                  <Button
                    key={val}
                    size="sm"
                    variant={approvalFilter === val ? "default" : "ghost"}
                    onClick={() => setApprovalFilter(val)}
                    data-testid={`button-filter-${val}`}
                  >
                    {val === "approved" && <Check className="w-3 h-3 mr-1 text-emerald-600" />}
                    {val === "unchecked" && <Filter className="w-3 h-3 mr-1" />}
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-1 border border-border rounded-md p-0.5 sm:hidden" data-testid="column-selector-mobile">
                {[3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={(project.gridColumns || 3) === n ? "default" : "ghost"}
                    className="px-2.5"
                    onClick={() => updateProject.mutate({ gridColumns: n })}
                  >
                    {n}
                  </Button>
                ))}
                <span className="text-xs text-muted-foreground px-1">col</span>
              </div>

              <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUndo}
                  disabled={!canUndo || restorePins.isPending}
                  data-testid="button-undo"
                  title={`Undo (${undoCount})`}
                   aria-label={`Undo${undoCount ? ` (${undoCount} available)` : ""}`}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRedo}
                  disabled={!canRedo || restorePins.isPending}
                  data-testid="button-redo"
                  title={`Redo (${redoCount})`}
                   aria-label={`Redo${redoCount ? ` (${redoCount} available)` : ""}`}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </div>

              {pins.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleShuffle}
                  disabled={reorderPins.isPending}
                  className="sm:hidden"
                  data-testid="button-shuffle-mobile"
                   aria-label="Shuffle images"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              )}
              {pins.length > 1 && (
                <Button
                  variant="outline"
                  onClick={handleShuffle}
                  disabled={reorderPins.isPending}
                  className="hidden sm:inline-flex"
                  data-testid="button-shuffle"
                >
                  <Shuffle className="w-4 h-4 mr-1" />
                  Shuffle
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowImport(true)}
                className="sm:hidden"
                data-testid="button-import-mobile"
                   aria-label="Import images from URL"
              >
                <Link2 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowImport(true)}
                className="hidden sm:inline-flex"
                data-testid="button-import"
              >
                <Link2 className="w-4 h-4 mr-1" />
                Import URL
              </Button>
              {brokenPinIds.size > 0 && (
                <Button
                  variant="outline"
                  onClick={refetchAllBroken}
                  disabled={isRefetching}
                  className="hidden sm:inline-flex"
                  data-testid="button-refetch-all"
                >
                  {isRefetching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Fix {brokenPinIds.size} Broken
                </Button>
              )}
              {brokenPinIds.size > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={refetchAllBroken}
                  disabled={isRefetching}
                  className="sm:hidden"
                  data-testid="button-refetch-all-mobile"
                   aria-label={`Fix ${brokenPinIds.size} broken image${brokenPinIds.size === 1 ? "" : "s"}`}
                >
                  {isRefetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowUpload(true)}
                className="sm:hidden"
                data-testid="button-upload-mobile"
                   aria-label="Upload images"
              >
                <Upload className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowUpload(true)}
                className="hidden sm:inline-flex"
                data-testid="button-upload"
              >
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => generateDescription.mutate()}
                disabled={generateDescription.isPending}
                className="sm:hidden"
                data-testid="button-generate-ai-mobile"
                   aria-label="Generate AI description"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {pinsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : pins.length === 0 && isImportPending ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="font-semibold text-lg mb-1" data-testid="text-importing-pins">
                Importing images...
              </h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                We're fetching images from your Pinterest board. This may take a moment for large boards.
              </p>
            </div>
          ) : pins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-pins">
                No images yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Import images from a Pinterest board link, upload files, or paste image URLs to start building your moodboard.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowImport(true)}>
                  <Link2 className="w-4 h-4 mr-1" />
                  Import URL
                </Button>
                <Button variant="outline" onClick={() => setShowUpload(true)}>
                  <Upload className="w-4 h-4 mr-1" />
                  Upload Images
                </Button>
              </div>
            </div>
          ) : (
            <>
              <CanvasPages
                project={project}
                pins={approvalFilter === "all" ? pins : approvalFilter === "approved" ? pins.filter(p => p.approvalStatus === "approved") : pins.filter(p => !p.approvalStatus || p.approvalStatus === "rejected")}
                activePage={activePage}
                onPageChange={setActivePage}
                onSelectPin={setSelectedPin}
                onDeletePin={(id) => deletePin.mutate(id)}
                onUpdatePinDescription={handleUpdatePinDescription}
                onUpdatePageDescription={handleUpdatePageDescription}
                onToggleApproval={handleToggleApproval}
                onAddDescription={handleOpenDescDialog}
                onReorderPins={(pinIds) => { pushSnapshot(pins); reorderPins.mutate(pinIds); }}
                onGenerateConceptDescription={handleGenerateConceptDescription}
                isGeneratingConcept={isGeneratingConcept}
                brokenPinIds={brokenPinIds}
                onImageError={handleImageError}
                onImageLoad={handleImageLoad}
                onRefetchPin={(pinId) => refetchSinglePin.mutate(pinId)}
                isRefetchingPin={refetchSinglePin.isPending}
                onOpenLightbox={(pin) => {
                  const allPins = approvalFilter === "all" ? pins : approvalFilter === "approved" ? pins.filter(p => p.approvalStatus === "approved") : pins.filter(p => !p.approvalStatus || p.approvalStatus === "rejected");
                  const idx = allPins.findIndex(p => p.id === pin.id);
                  if (idx >= 0) setLightboxIndex(idx);
                }}
                descMode={descMode}
              />

              <div className="mt-6" style={{ maxWidth: project.orientation === "horizontal" ? "960px" : "640px", margin: "24px auto 0" }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Image Descriptions & Order</span>
                    </div>
                    {(() => {
                      const sortedPins = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
                      const orderLayout = getGridLayout(
                        (project.orientation || "horizontal") === "horizontal",
                        project.imageLayout || "original",
                        project.gridColumns || 3,
                        project.paperSize || "A3"
                      );
                      const perPage = orderLayout.perPage;
                      const descLongThreshold = 60;
                      let orderPages: Pin[][] = [];
                      if (orderLayout.useGrid) {
                        let curPage: Pin[] = [];
                        let slotsUsed = 0;
                        for (const p of sortedPins) {
                          const need = (p.descriptionCustomInput && p.descriptionCustomInput.length > descLongThreshold) ? 2 : 1;
                          if (slotsUsed + need > perPage && curPage.length > 0) {
                            orderPages.push(curPage);
                            curPage = [];
                            slotsUsed = 0;
                          }
                          curPage.push(p);
                          slotsUsed += need;
                        }
                        if (curPage.length > 0) orderPages.push(curPage);
                      } else {
                        orderPages = chunkArray(sortedPins, perPage);
                      }
                      const totalPages = Math.max(1, orderPages.length);
                      return (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {sortedPins.map((pin, idx) => {
                            const currentPage = orderPages.findIndex(pg => pg.some(p => p.id === pin.id));
                            return (
                              <div
                                key={pin.id}
                                className="flex items-center gap-2 p-2 rounded-md bg-muted/30"
                                data-testid={`pin-row-${pin.id}`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    disabled={idx === 0}
                                    onClick={() => handleMovePin(pin.id, "up")}
                                    data-testid={`button-move-up-${pin.id}`}
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    disabled={idx === sortedPins.length - 1}
                                    onClick={() => handleMovePin(pin.id, "down")}
                                    data-testid={`button-move-down-${pin.id}`}
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </div>
                                <span className="text-xs text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
                                <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                                  <img
                                    src={pin.imagePath || pin.imageUrl || ""}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                                <Input
                                  placeholder="Short description..."
                                  value={pin.descriptionCustomInput || ""}
                                  onChange={(e) => handleUpdatePinDescription(pin.id, e.target.value)}
                                  className="flex-1 text-xs"
                                  data-testid={`input-pin-desc-${pin.id}`}
                                />
                                {totalPages > 1 && (
                                  <Select
                                    value={String(currentPage)}
                                    onValueChange={(val) => {
                                      const targetPage = Number(val);
                                      if (targetPage === currentPage) return;
                                      const allIds = sortedPins.map((p) => p.id);
                                      const fromIdx = allIds.indexOf(pin.id);
                                      allIds.splice(fromIdx, 1);
                                      const targetPagePins = orderPages[targetPage];
                                      let insertAt: number;
                                      if (targetPagePins && targetPagePins.length > 0) {
                                        const firstPinOfTarget = targetPagePins[0];
                                        insertAt = allIds.indexOf(firstPinOfTarget.id);
                                        if (insertAt === -1) insertAt = allIds.length;
                                      } else {
                                        insertAt = allIds.length;
                                      }
                                      allIds.splice(insertAt, 0, pin.id);
                                      reorderPins.mutate(allIds);
                                    }}
                                  >
                                    <SelectTrigger className="w-[90px] h-7 text-xs" data-testid={`select-page-${pin.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: totalPages }, (_, i) => (
                                        <SelectItem key={i} value={String(i)}>
                                          Page {i + 1}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deletePin.mutate(pin.id)}
                                  data-testid={`button-delete-pin-row-${pin.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      <Dialog open={showImport} onOpenChange={(open) => { setShowImport(open); if (!open) { setImportTargetPage(-1); setScrapePreview(null); stopPolling(); setIsScraping(false); setScrapeError(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
          {scrapeError ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">Scraping Issue</DialogTitle>
                <DialogDescription>
                  {scrapeError}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setScrapeError(null); }} data-testid="button-scrape-dismiss">
                    Dismiss
                  </Button>
                  <Button onClick={() => { setScrapeError(null); if (lastScrapeUrl) scrapePreviewMutation.mutate(lastScrapeUrl); }} data-testid="button-scrape-retry">
                    Retry
                  </Button>
                </div>
              </div>
            </>
          ) : isScraping ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">Scanning Pinterest Board</DialogTitle>
                <DialogDescription>
                  Extracting all images from the board. This process may take several minutes for large boards — please be patient.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-muted/50 rounded-md p-4 text-center">
                  <div className="text-4xl font-bold mb-1 tabular-nums" style={{ color: "hsl(24 85% 52%)" }} data-testid="text-scrape-progress-count">
                    {scrapeCount}
                  </div>
                  <p className="text-sm text-muted-foreground">images found so far</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span data-testid="text-scrape-status">{scrapeStatus}</span>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 rounded-md px-3 py-2">
                  <p className="text-xs text-orange-700 dark:text-orange-300 text-center font-medium">
                    Scraping process still in progress — do not close this window
                  </p>
                </div>
                <p className="text-xs text-center text-muted-foreground tabular-nums">
                  Elapsed: {Math.floor(scrapeElapsed / 60)}:{String(scrapeElapsed % 60).padStart(2, "0")}
                </p>
                {scrapeThumbnails.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {scrapeThumbnails.map((thumb, i) => (
                      <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                        <img src={thumb} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { stopPolling(); setIsScraping(false); setScrapePreview(null); }} data-testid="button-cancel-scrape">
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          ) : scrapePreview ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">Confirm Import</DialogTitle>
                <DialogDescription>
                  We found all images from this Pinterest board. Confirm to add them to your moodboard.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-muted/50 rounded-md p-4 text-center">
                  <div className="text-4xl font-bold mb-1" style={{ color: "hsl(24 85% 52%)" }} data-testid="text-scraped-count">
                    {scrapePreview.imageCount}
                  </div>
                  <p className="text-sm text-muted-foreground">images found and ready to import</p>
                </div>
                {scrapePreview.thumbnails.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {scrapePreview.thumbnails.map((thumb, i) => (
                      <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                        <img src={thumb} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" data-testid={`img-preview-${i}`} />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center break-all">
                  Source: {scrapePreview.boardUrl}
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setScrapePreview(null); }} data-testid="button-import-back">
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      pushSnapshot(pins);
                      confirmImport.mutate({ cacheKey: scrapePreview.cacheKey, boardUrl: scrapePreview.boardUrl });
                    }}
                    disabled={isConfirming}
                    data-testid="button-import-confirm"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Importing {scrapePreview.imageCount} images...
                      </>
                    ) : (
                      `Import ${scrapePreview.imageCount} Images`
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">Import Images</DialogTitle>
                <DialogDescription>
                  Add Pinterest boards, pin links, or image URLs. Give each a custom name.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {importFields.map((field, idx) => (
                  <div key={idx} className="flex gap-2 items-start" data-testid={`import-field-${idx}`}>
                    <div className="flex-1 space-y-1.5">
                      <Input
                        placeholder="Paste URL (Pinterest board, pin, or image URL)"
                        value={field.url}
                        onChange={(e) => {
                          const updated = [...importFields];
                          updated[idx] = { ...updated[idx], url: e.target.value };
                          setImportFields(updated);
                        }}
                        data-testid={`input-import-url-${idx}`}
                      />
                      <Input
                        placeholder="Custom name (optional)"
                        value={field.name}
                        onChange={(e) => {
                          const updated = [...importFields];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setImportFields(updated);
                        }}
                        className="text-xs"
                        data-testid={`input-import-name-${idx}`}
                      />
                    </div>
                    {importFields.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setImportFields(importFields.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-import-${idx}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setImportFields([...importFields, { url: "", name: "" }])}
                  data-testid="button-add-import-field"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Another URL
                </Button>
                {(() => {
                  const hasCover = project.showCover !== false;
                  const sortedPins = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
                  const layout = getGridLayout(
                    (project.orientation || "horizontal") === "horizontal",
                    project.imageLayout || "original",
                    project.gridColumns || 3,
                    project.paperSize || "A3"
                  );
                  const pagesList = computeSlotAwarePages(sortedPins, layout, descMode);
                  const totalContentPages = Math.max(1, pagesList.length);
                  const totalPagesWithCover = totalContentPages + (hasCover ? 1 : 0);
                  return (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Place on page</label>
                      <Select value={String(importTargetPage)} onValueChange={(v) => setImportTargetPage(Number(v))}>
                        <SelectTrigger className="w-full" data-testid="select-import-target-page">
                          <SelectValue placeholder="Last page (default)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">Last page (default)</SelectItem>
                          {Array.from({ length: totalPagesWithCover + 1 }, (_, i) => {
                            if (hasCover && i === 0) return null;
                            const label = hasCover ? `Page ${i}` : `Page ${i + 1}`;
                            const isNew = i >= totalPagesWithCover;
                            return (
                              <SelectItem key={i} value={String(i)}>
                                {isNew ? `${label} (new)` : label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowImport(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const validFields = importFields.filter((f) => f.url.trim());
                      if (validFields.length === 0) return;
                      const firstUrl = validFields[0].url.trim();
                      const isPinterestBoard = (firstUrl.match(/pinterest\.\w+\/[^/]+\/[^/]+/) || firstUrl.match(/pin\.it\//)) && !firstUrl.match(/\/pin\/\d+/);
                      if (isPinterestBoard && validFields.length === 1) {
                        scrapePreviewMutation.mutate(firstUrl);
                      } else {
                        pushSnapshot(pins);
                        importUrls.mutate(validFields);
                      }
                    }}
                    disabled={!importFields.some((f) => f.url.trim()) || importUrls.isPending || isScraping}
                    data-testid="button-import-submit"
                  >
                    {isScraping ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Scanning board...
                      </>
                    ) : importUrls.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import"
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showUpload} onOpenChange={(open) => { setShowUpload(open); if (!open) setUploadTargetPage(-1); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Upload Images</DialogTitle>
            <DialogDescription>
              Upload images from your computer to add to your moodboard.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2 space-y-3">
            {(() => {
              const hasCover = project.showCover !== false;
              const sortedPins = [...pins].sort((a, b) => (a.position || 0) - (b.position || 0));
              const layout = getGridLayout(
                (project.orientation || "horizontal") === "horizontal",
                project.imageLayout || "original",
                project.gridColumns || 3,
                project.paperSize || "A3"
              );
              const pagesList = computeSlotAwarePages(sortedPins, layout, descMode);
              const totalContentPages = Math.max(1, pagesList.length);
              const totalPagesWithCover = totalContentPages + (hasCover ? 1 : 0);
              return (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Place on page</label>
                  <Select value={String(uploadTargetPage)} onValueChange={(v) => setUploadTargetPage(Number(v))}>
                    <SelectTrigger className="w-full" data-testid="select-upload-target-page">
                      <SelectValue placeholder="Last page (default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Last page (default)</SelectItem>
                      {Array.from({ length: totalPagesWithCover + 1 }, (_, i) => {
                        if (hasCover && i === 0) return null;
                        const label = hasCover ? `Page ${i}` : `Page ${i + 1}`;
                        const isNew = i >= totalPagesWithCover;
                        return (
                          <SelectItem key={i} value={String(i)}>
                            {isNew ? `${label} (new)` : label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover-elevate"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.multiple = true;
                input.onchange = async (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (!files) return;
                  for (const file of Array.from(files)) {
                    const formData = new FormData();
                    formData.append("file", file);
                    try {
                      const res = await apiRequest("POST", "/api/uploads/image", formData);
                      const data = await res.json();
                      addPin.mutate({ imageUrl: data.url, title: file.name, targetPage: uploadTargetPage });
                    } catch {
                      toast({ title: "Upload failed", variant: "destructive" });
                    }
                  }
                  setShowUpload(false);
                  setUploadTargetPage(-1);
                  toast({ title: "Images uploaded" });
                };
                input.click();
              }}
              data-testid="upload-dropzone"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP up to 10MB each
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDescModeDialog} onOpenChange={setShowDescModeDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-desc-mode">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              AI Describe All Images
            </DialogTitle>
            <DialogDescription>
              Choose where the description appears on each image.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border hover:border-orange-500 transition-colors p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              data-testid="button-desc-mode-short"
              onClick={() => {
                setShowDescModeDialog(false);
                generateAllPinDescriptions.mutate("short");
              }}
            >
              <AlignLeft className="w-7 h-7 text-orange-500" />
              <span className="font-semibold text-sm">Below Image</span>
              <span className="text-xs text-muted-foreground text-center leading-snug">Short caption · max 3 lines · under each image</span>
            </button>
            <button
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-border hover:border-orange-500 transition-colors p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              data-testid="button-desc-mode-long"
              onClick={() => {
                setShowDescModeDialog(false);
                generateAllPinDescriptions.mutate("long");
              }}
            >
              <Columns className="w-7 h-7 text-orange-500" />
              <span className="font-semibold text-sm">Beside Image</span>
              <span className="text-xs text-muted-foreground text-center leading-snug">2–3 sentences · panel to the right</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showClearDescConfirm} onOpenChange={setShowClearDescConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all descriptions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all AI-generated and custom descriptions from every image. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => clearAllDescriptions.mutate()}
              data-testid="button-confirm-clear-descriptions"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showDuplicates && (() => {
        const dupGroups = duplicatePinGroups;
        const totalDups = duplicateCount;
        const isDeletingAll = dupDeletionProgress !== null;

        const handleDeleteAll = async () => {
          const allIds: number[] = [];
          dupGroups.forEach((group) => { group.slice(1).forEach(p => allIds.push(p.id)); });
          if (allIds.length === 0) return;
          pushSnapshot(pins);
          setDupDeletionProgress({ current: 0, total: allIds.length });
          for (let i = 0; i < allIds.length; i++) {
            await deletePinRaw.mutateAsync(allIds[i]);
            setDupDeletionProgress({ current: i + 1, total: allIds.length });
          }
          setDupDeletionProgress(null);
          setShowDuplicates(false);
        };

        return (
          <Dialog open onOpenChange={(open) => { if (!isDeletingAll) setShowDuplicates(open); }}>
            <DialogContent className="max-w-xl max-h-[80vh] flex flex-col" data-testid="dialog-duplicates">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScanSearch className="w-5 h-5 text-orange-500" />
                  Check Duplicates
                </DialogTitle>
                <DialogDescription>
                  {dupGroups.size === 0
                    ? "No duplicate images found."
                    : `Found ${dupGroups.size} duplicate group${dupGroups.size !== 1 ? "s" : ""} — ${totalDups} extra image${totalDups !== 1 ? "s" : ""}.`}
                </DialogDescription>
              </DialogHeader>

              {isDeletingAll && (
                <div className="py-6 flex flex-col items-center gap-4">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${Math.round((dupDeletionProgress!.current / dupDeletionProgress!.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Removing {dupDeletionProgress!.current} of {dupDeletionProgress!.total} duplicates…
                  </p>
                </div>
              )}

              {!isDeletingAll && dupGroups.size === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                  <Check className="w-10 h-10 text-emerald-500" />
                  <p className="text-sm font-medium">All images are unique!</p>
                </div>
              ) : !isDeletingAll ? (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {Array.from(dupGroups.values()).map((group, gi) => (
                    <div key={gi} className="border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium">{group.length} copies</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-500 hover:text-red-600 h-6 px-2"
                          data-testid={`button-delete-dups-group-${gi}`}
                          onClick={() => {
                            const toDelete = group.slice(1).map(p => p.id);
                            pushSnapshot(pins);
                            toDelete.forEach(id => deletePinRaw.mutate(id));
                          }}
                        >
                          <CopyX className="w-3 h-3 mr-1" />
                          Remove {group.length - 1} duplicate{group.length - 1 !== 1 ? "s" : ""}
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {group.map((pin, pi) => (
                          <div key={pin.id} className="relative" data-testid={`dup-pin-${pin.id}`}>
                            <img
                              src={pin.imagePath || pin.imageUrl || ""}
                              alt=""
                              className="w-16 h-16 object-cover rounded-lg border border-border"
                            />
                            {pi === 0 && (
                              <span className="absolute -top-1 -left-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full px-1 py-0.5 leading-none">
                                keep
                              </span>
                            )}
                            {pi > 0 && (
                              <button
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"
                                onClick={() => { pushSnapshot(pins); deletePinRaw.mutate(pin.id); }}
                                data-testid={`button-delete-single-dup-${pin.id}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!isDeletingAll && dupGroups.size > 0 && (
                <div className="flex justify-between pt-3 border-t border-border gap-2">
                  <Button variant="outline" onClick={() => setShowDuplicates(false)} className="flex-1">
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-delete-all-duplicates"
                    onClick={handleDeleteAll}
                  >
                    <CopyX className="w-4 h-4 mr-1.5" />
                    Remove All Duplicates ({totalDups})
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      <AlertDialog open={!!columnSuggestion} onOpenChange={(open) => { if (!open) setColumnSuggestion(null); }}>
        <AlertDialogContent data-testid="dialog-column-suggestion">
          <AlertDialogHeader>
            <AlertDialogTitle>Add a Column?</AlertDialogTitle>
            <AlertDialogDescription>
              Portrait format works better with more columns. There's enough room for{" "}
              <strong>{columnSuggestion?.suggestedCols} columns</strong> — switch from{" "}
              {columnSuggestion?.currentCols} to {columnSuggestion?.suggestedCols} columns?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setColumnSuggestion(null)}
              data-testid="button-column-suggestion-cancel"
            >
              Keep {columnSuggestion?.currentCols} Columns
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (columnSuggestion) updateProject.mutate({ gridColumns: columnSuggestion.suggestedCols });
                setColumnSuggestion(null);
              }}
              data-testid="button-column-suggestion-confirm"
            >
              Switch to {columnSuggestion?.suggestedCols} Columns
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showExport && (
        <ExportModal
          project={project}
          pins={pins}
          descMode={descMode}
          open={showExport}
          onOpenChange={setShowExport}
        />
      )}

      {showShare && (
        <ShareModal
          project={project}
          open={showShare}
          onOpenChange={setShowShare}
          onUpdate={(data) => updateProject.mutate(data)}
        />
      )}

      {selectedPin && (
        <PinDetailSheet
          pin={selectedPin}
          open={!!selectedPin}
          onOpenChange={(open) => !open && setSelectedPin(null)}
          onDelete={() => deletePin.mutate(selectedPin.id)}
          projectId={projectId}
        />
      )}

      <ImageLightbox
        pins={approvalFilter === "all" ? pins : approvalFilter === "approved" ? pins.filter(p => p.approvalStatus === "approved") : pins.filter(p => !p.approvalStatus || p.approvalStatus === "rejected")}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />

      <Dialog open={!!descDialogPin} onOpenChange={(open) => !open && setDescDialogPin(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Description</DialogTitle>
            <DialogDescription>
              Type a description or generate one using AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {descDialogPin && (
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden shrink-0">
                  <img
                    src={descDialogPin.imagePath || descDialogPin.imageUrl || ""}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{descDialogPin.title || "Image"}</p>
                  <p className="text-xs text-muted-foreground">{descDialogPin.shotType || "No type"}</p>
                </div>
              </div>
            )}
            <Textarea
              placeholder="Enter description..."
              value={descDialogText}
              onChange={(e) => setDescDialogText(e.target.value)}
              className="min-h-[80px] text-sm"
              data-testid="input-pin-desc-dialog"
            />
            <Button
              size="sm"
              className="w-full ai-gradient-btn"
              disabled={generatePinDescription.isPending}
              onClick={() => descDialogPin && generatePinDescription.mutate(descDialogPin.id)}
              data-testid="button-generate-pin-desc-ai"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {generatePinDescription.isPending ? "Generating..." : "Generate with AI"}
            </Button>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDescDialogPin(null)}>Cancel</Button>
              <Button onClick={handleSaveDescDialog} data-testid="button-save-pin-desc">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
