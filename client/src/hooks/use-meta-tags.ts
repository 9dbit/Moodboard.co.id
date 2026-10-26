import { useEffect } from "react";

interface MetaTagsConfig {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  canonical?: string;
}

function setMetaTag(name: string, content: string, property?: boolean) {
  const attr = property ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useMetaTags(config: MetaTagsConfig) {
  useEffect(() => {
    const prev = document.title;
    document.title = config.title;

    setMetaTag("description", config.description);
    if (config.keywords) setMetaTag("keywords", config.keywords);

    const ogTitle = config.ogTitle || config.title;
    const ogDesc = config.ogDescription || config.description;
    setMetaTag("og:title", ogTitle, true);
    setMetaTag("og:description", ogDesc, true);
    setMetaTag("og:type", config.ogType || "website", true);
    if (config.ogImage) setMetaTag("og:image", config.ogImage, true);
    if (config.ogUrl) setMetaTag("og:url", config.ogUrl, true);
    setMetaTag("og:site_name", "Moodboard Studio", true);

    setMetaTag("twitter:card", "summary_large_image");
    setMetaTag("twitter:title", ogTitle);
    setMetaTag("twitter:description", ogDesc);
    if (config.ogImage) setMetaTag("twitter:image", config.ogImage);

    if (config.canonical) setCanonical(config.canonical);

    return () => {
      document.title = prev;
    };
  }, [config.title, config.description, config.keywords, config.ogTitle, config.ogDescription, config.ogImage, config.ogUrl, config.ogType, config.canonical]);
}
