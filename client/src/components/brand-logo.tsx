import brandLogoSrc from "@/assets/images/brand-logo.png";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={brandLogoSrc}
      alt="Moodboard Studio"
      className={className}
      data-testid="img-brand-logo"
    />
  );
}

export { brandLogoSrc };
