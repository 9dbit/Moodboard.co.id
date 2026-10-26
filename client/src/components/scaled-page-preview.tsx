import { useEffect, useRef, useState, type ReactNode } from "react";

// Render at the main canvas width before scaling, so text wrapping and layout match.
export function ScaledPagePreview({ width, aspectRatio, children }: {
  width: number;
  aspectRatio: string | number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumbnailWidth, setThumbnailWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.setAttribute("inert", "");
    const observer = new ResizeObserver(() => setThumbnailWidth(element.clientWidth));
    observer.observe(element);
    setThumbnailWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="relative w-full overflow-hidden pointer-events-none" style={{ aspectRatio }}>
      <div style={{ width, transform: `scale(${thumbnailWidth / width})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}