---
name: Export image recovery
description: Mobile-safe detection and persistent repair of images that block PDF export
---
Inspect and normalize export images on authenticated, ownership-checked server endpoints. Keep only health metadata and same-origin content URLs in the browser.

**Why:** Decoding and retaining full-resolution data URLs for a large project can exhaust mobile-browser memory, and image metadata alone can incorrectly accept truncated files.

**How to apply:** Use low-concurrency preflight checks with a real pixel decode, identify content by a hash/version, persist optimized JPEG replacements, and make deletion explicit and confirmed. Cancel stale attempts and always remove temporary export DOM.

For pinned DNS connections, preserve Node's single-address and `all: true` lookup contracts.

**Why:** Node 20's automatic address-family selection requests an address array; a scalar callback yields `ERR_INVALID_IP_ADDRESS: undefined`, making valid Pinterest images appear unreachable.

**How to apply:** Verify actual remote downloads as well as DNS callback unit tests whenever changing outbound image transport. Keep validated-IP pinning intact.