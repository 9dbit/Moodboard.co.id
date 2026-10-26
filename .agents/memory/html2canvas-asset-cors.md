---
name: html2canvas same-origin asset CORS
description: Why bundled/same-origin images appended for html2canvas export must NOT set crossOrigin
---

When building DOM `<img>` elements that will be captured by `html2canvas` (e.g. the PDF/image export in `export-modal.tsx`), do NOT set `img.crossOrigin = "anonymous"` on **same-origin** assets (bundled Vite imports served from our own origin, prefixed with `window.location.origin`).

**Why:** the Vite dev server (and our static asset serving) does not emit `Access-Control-Allow-Origin` headers. Setting `crossOrigin="anonymous"` on such an image makes the browser treat it as a failed CORS fetch and **taints the canvas**, which then throws on `toDataURL`/`toBlob` and breaks the whole export. Remote/uploaded logos (e.g. GCS object-storage URLs) DO keep `crossOrigin="anonymous"` because they are cross-origin and need CORS to avoid tainting.

**How to apply:** branch on source — uploaded `studioLogoPath` → set `crossOrigin="anonymous"`; bundled brand fallback (`brandLogoSrc`) → leave crossOrigin unset, just prefix with `window.location.origin` when the path starts with `/`.
