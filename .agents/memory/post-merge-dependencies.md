---
name: Post-merge dependency recovery
description: Why a successful running workspace can still fail clean post-merge installs
---
A working dependency cache is not evidence that a clean post-merge install will pass the package firewall.

**Why:** Authentication migration setup exposed security-blocked PDF and XML dependencies that earlier cached builds had not caught. Updating only the PDF package did not repair the transitive XML dependency.

**How to apply:** Verify the actual clean install after dependency repair. Check the parent's Node engine requirements before upgrading it; do not turn dependency recovery into an unplanned runtime migration. Never bypass the security registry.