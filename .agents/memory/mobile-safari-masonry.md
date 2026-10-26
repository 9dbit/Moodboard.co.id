---
name: Mobile Safari masonry
description: Prevent disappearing or widely displaced cards in mobile Safari multi-column layouts
---
Do not apply an idle CSS transform or `translateZ(0)` to cards inside a fixed-height multi-column masonry container.

**Why:** Mobile Safari can fragment transformed `break-inside: avoid` children incorrectly, causing most cards to disappear or appear in distant columns.

**How to apply:** Use explicit column count/gap/fill properties and only add a transform while a card is actively being dragged. Keep resting cards untransformed.