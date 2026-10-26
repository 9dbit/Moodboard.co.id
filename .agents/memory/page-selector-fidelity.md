---
name: Page selector fidelity
description: Why page thumbnails must preserve the main preview's responsive layout
---
Page selector thumbnails are miniature previews, not simplified navigation illustrations.

**Why:** The user reported missing descriptions and different cover colors as bugs. Replacing text with bars or inheriting the app's dark theme does not meet the expected fidelity.

**How to apply:** Preserve actual content, page colors, and line wrapping at the current main preview width before reducing its visual size. A fixed desktop render width can still differ from the mobile preview.