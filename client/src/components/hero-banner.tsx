import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import architect from "@assets/hero-architect-woman-moodboard_1789094585229.webp";
import meeting from "@assets/hero-client-presentation-meeting_1789094585229.webp";
import coffeeshop from "@assets/hero-male-architect-coffeeshop_1789094585230.webp";

const slides = [
  { src: architect, alt: "Architect developing a moodboard in her design studio" },
  { src: meeting, alt: "Architect presenting a moodboard to clients" },
  { src: coffeeshop, alt: "Architect working on a moodboard from a coffee shop" },
];

export function HeroBanner() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const move = (step: number) => setActive(index => (index + step + slides.length) % slides.length);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive(index => (index + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, reducedMotion, active]);

  return (
    <div
      className="mb-3 sm:mb-4"
      role="region"
      aria-roledescription="carousel"
      aria-label="Moodboard Studio in action"
      data-testid="hero-banner"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setPaused(true);
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div
        className="overflow-hidden bg-muted"
        style={{ touchAction: "pan-y" }}
        onTouchStart={event => { touchStart.current = event.touches[0].clientX; }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={event => {
          if (touchStart.current === null) return;
          const distance = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(distance) > 40) {
            setPaused(true);
            move(distance < 0 ? 1 : -1);
          }
          touchStart.current = null;
        }}
      >
        <div
          className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div key={slide.src} className="w-full shrink-0" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`} aria-hidden={index !== active}>
              <img
                src={slide.src}
                alt={slide.alt}
                width={1024}
                height={341}
                className="block w-full h-auto"
                {...{ fetchpriority: index === 0 ? "high" : "auto" }}
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-3 mt-1">
        <div className="flex items-center" aria-label="Choose banner">
          {slides.map((slide, index) => (
            <button key={slide.src} type="button" className="h-11 w-11 flex items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Show banner ${index + 1}`} aria-current={index === active ? "true" : undefined} onClick={() => { setPaused(true); setActive(index); }}>
              <span className={`h-1.5 rounded-full transition-all ${index === active ? "w-6 bg-primary" : "w-2 bg-muted-foreground/40"}`} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Previous banner" onClick={() => { setPaused(true); move(-1); }}><ChevronLeft className="h-4 w-4" /></Button>
          {!reducedMotion && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused(value => !value)}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>}
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Next banner" onClick={() => { setPaused(true); move(1); }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}