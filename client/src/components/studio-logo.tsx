import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { transparentLogo } from "@/lib/transparent-logo";

export function StudioLogo({ src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [processed, setProcessed] = useState<{ source: string; url: string }>();
  useEffect(() => {
    let cancelled = false;
    transparentLogo(src).then(url => {
      if (!cancelled) setProcessed({ source: src, url });
    }).catch(error => console.error("Studio logo transparency:", error));
    return () => { cancelled = true; };
  }, [src]);
  return <img {...props} src={processed?.source === src ? processed.url : src} />;
}