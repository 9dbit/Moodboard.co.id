import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pin } from "@shared/schema";

interface ImageLightboxProps {
  pins: Pin[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ pins, initialIndex, open, onClose }: ImageLightboxProps) {
  const clamp = (idx: number) => Math.max(0, Math.min(idx, pins.length - 1));
  const [currentIndex, setCurrentIndex] = useState(clamp(initialIndex));
  const [flipDirection, setFlipDirection] = useState<"none" | "next" | "prev">("none");
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open && pins.length > 0) {
      setCurrentIndex(clamp(initialIndex));
    }
    setFlipDirection("none");
    setIsAnimating(false);
    if (animTimeoutRef.current) {
      clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = null;
    }
  }, [initialIndex, open, pins.length]);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (open && pins.length > 0 && currentIndex >= pins.length) {
      setCurrentIndex(pins.length - 1);
    }
  }, [open, pins.length, currentIndex]);

  const goNext = useCallback(() => {
    if (isAnimating || currentIndex >= pins.length - 1) return;
    setFlipDirection("next");
    setIsAnimating(true);
    animTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((i) => Math.min(i + 1, pins.length - 1));
      setFlipDirection("none");
      setIsAnimating(false);
      animTimeoutRef.current = null;
    }, 500);
  }, [isAnimating, currentIndex, pins.length]);

  const goPrev = useCallback(() => {
    if (isAnimating || currentIndex <= 0) return;
    setFlipDirection("prev");
    setIsAnimating(true);
    animTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((i) => Math.max(i - 1, 0));
      setFlipDirection("none");
      setIsAnimating(false);
      animTimeoutRef.current = null;
    }, 500);
  }, [isAnimating, currentIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, goNext, goPrev]);

  if (!open || pins.length === 0) return null;

  const safeIndex = clamp(currentIndex);
  const currentPin = pins[safeIndex];
  const nextPin = safeIndex < pins.length - 1 ? pins[safeIndex + 1] : null;
  const prevPin = safeIndex > 0 ? pins[safeIndex - 1] : null;
  const imgSrc = currentPin?.imagePath || currentPin?.imageUrl || "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ touchAction: "none" }}
      data-testid="lightbox-overlay"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-[102] text-white/80 hover:text-white hover:bg-white/10 rounded-full w-10 h-10"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        data-testid="button-lightbox-close"
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[102] flex items-center gap-6">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full w-12 h-12 disabled:opacity-30"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          disabled={safeIndex <= 0 || isAnimating}
          data-testid="button-lightbox-prev"
        >
          <ChevronLeft className="w-7 h-7" />
        </Button>

        <span className="text-white/60 text-sm font-medium tabular-nums" data-testid="text-lightbox-counter">
          {safeIndex + 1} / {pins.length}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full w-12 h-12 disabled:opacity-30"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          disabled={safeIndex >= pins.length - 1 || isAnimating}
          data-testid="button-lightbox-next"
        >
          <ChevronRight className="w-7 h-7" />
        </Button>
      </div>

      <div
        className="relative z-[101] lightbox-page-container"
        style={{ perspective: "1200px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {flipDirection === "next" && nextPin && (
          <div className="lightbox-page lightbox-page-flip-next">
            <img
              src={nextPin.imagePath || nextPin.imageUrl || ""}
              alt={nextPin.title || ""}
              className="lightbox-img"
              draggable={false}
            />
          </div>
        )}

        {flipDirection === "prev" && prevPin && (
          <div className="lightbox-page lightbox-page-flip-prev">
            <img
              src={prevPin.imagePath || prevPin.imageUrl || ""}
              alt={prevPin.title || ""}
              className="lightbox-img"
              draggable={false}
            />
          </div>
        )}

        <div
          className={`lightbox-page ${
            flipDirection === "next" ? "lightbox-current-exit-next" :
            flipDirection === "prev" ? "lightbox-current-exit-prev" : ""
          }`}
        >
          <img
            src={imgSrc}
            alt={currentPin?.title || ""}
            className="lightbox-img"
            draggable={false}
            data-testid="img-lightbox-current"
          />
          {currentPin?.title && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white text-sm font-medium truncate" data-testid="text-lightbox-title">
                {currentPin.title}
              </p>
              {(currentPin.descriptionAi || currentPin.descriptionCustomInput) && (
                <p className="text-white/70 text-xs mt-1 line-clamp-2">
                  {currentPin.descriptionAi || currentPin.descriptionCustomInput}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
