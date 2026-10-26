---
name: Export caption fidelity
description: Export descriptions stay complete on opaque page-background cards with transparent captions and rasterized shadows
---
Do not copy the editor's three-line truncation into exported below-image captions.

**Why:** The user explicitly rejected masked/cropped export text and any gray/translucent caption tint. Captions should remain close to the image, while the whole card uses the page background as an opaque surface.

**How to apply:** Allow caption space to grow for the actual text, use small top padding with top-aligned text, keep the caption background transparent, and wait for font metrics before capture. Never restore a fixed maximum text height as a shortcut to preserving image space.

**html2canvas lesson:** Do not rely on CSS `box-shadow` for downloaded output. The prior export painted both the CSS shadow and a raster shadow, and the raster layer also retained an opaque card fill; html2canvas captured those as offset, stacked white edges. Before capture, measure each card after layout/fonts settle, paint only the rounded shadow(s) into a transparent canvas, erase the exact card paths from that canvas, and insert that raster layer behind the cards. Disable the card's CSS shadow for export, keep the explicit white card surface above the layer, and use a dark card-caption text color so a colored page background cannot tint or wash out captions.