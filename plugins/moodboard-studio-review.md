# Moodboard Studio public submission draft

This guide accompanies the upload package at `plugins/moodboard-studio/`. It is
intentionally **outside** that directory and must not be included in the ZIP.
The package contains only `plugin.json`, `mcp.json`, and the existing brand logo.
It contains no account password, client secret, token, or private user data.

The owner has specified that public beta plugin access is free. This operational
review note is recorded in reviewer commerce details and release notes, while
public listing descriptions remain focused on functionality and limitations.
The owner also confirmed Moodboard Studio / Markstudios brand affiliation;
The portal currently offers the verified individual identity **ADWIN ADHYNATA**.
The owner has explicitly selected that identity for this draft while retaining
**Moodboard Studio** as the product name and the Markstudios brand affiliation.

The package is prepared for remote MCP review. It has not been submitted,
approved, or published. The existing personal test plugin is a separate
installation; a public portal draft must use the publisher identity selected
there rather than assuming that its personal ID is a public listing ID.

## Product represented by this package

The plugin creates and edits private architecture and interior-design boards,
adds explicitly selected HTTPS image references, inspects owned reference
images, edits captions, and exports presentation PDFs. It accesses only the
connected account's boards. A visual editor is available on moodboard.co.id.

The nine exposed tools are `list_moodboards`, `get_moodboard`,
`create_moodboard`, `update_moodboard`, `add_reference_images`,
`view_reference_image`, `update_reference`, `start_export`, and
`get_job_status`.

Do not describe this version as an image search engine, image generator,
Pinterest-board importer, public publishing tool, or board-deletion tool.
Those functions are not among its MCP operations. Server PDF uses a compact
presentation template and may differ from website theme styling. The renderer
includes every selected reference or returns an explicit error, within its
500-reference, 32 MiB normalized image, 40 MB PDF, and eight-minute job limits.
Export files expire after 24 hours; a download capability lasts 15 minutes.

## Local package checks and deterministic archive

Run from the repository root:

```sh
node script/validate-moodboard-plugin.mjs
node script/package-moodboard-plugin.mjs /workspace/artifacts/moodboard-studio-public-1.0.0.zip
```

The ZIP has fixed timestamps, permissions, file order, and stored bytes. Running
the packager again against identical source produces the same SHA-256. The
explicit upload allowlist prevents accidental inclusion of `.env`, a working
repository, credentials, reviewer instructions, and development artifacts.

`--submission` additionally requires an actual HTTPS video walkthrough URL in
`extensions.com.openai.review.demo_recording_url`. It deliberately fails while
that field is absent. A successful local check validates the documented package
shape; it does not establish portal acceptance, identity verification, reviewer
access, or approval.

The downloaded Agent Plugins 1.0.0 MCP schema currently rejects a server-level
`extensions` property, while OpenAI's current packaging documentation explicitly
requires `extensions.com.openai.auth` at that location for OAuth. This package
follows the OpenAI authentication documentation. Validate the portable MCP core
separately from that documented OpenAI extension; do not claim that the unmodified
generic MCP schema validates the extension. The upload portal remains the
authoritative final check. No secret or ad-hoc authorization header is used to
work around this schema mismatch.

## Portal preparation

1. Select the intended OpenAI organization and project. The submitting account
   needs organization-owner access or Apps Management Write.
2. Complete business or applicable publishing-identity verification. The owner
   confirmed the **Moodboard Studio / Markstudios** brand affiliation; this draft
   uses **ADWIN ADHYNATA** for `author.name` and `interface.developerName`.
   The verified individual identity was observed in the portal on 28 October 2026
   and explicitly chosen by the owner. This does not claim that Markstudios has
   separately completed business verification. Keep the product name Moodboard Studio.
3. Verify that the website, Contact, Privacy, and Terms pages identify the same
   publisher and accurately cover official ChatGPT access.
4. Prepare a dedicated sample reviewer account through the ordinary Moodboard
   sign-up flow. Do not use the owner's `markstudios` account or existing client
   projects. The reviewer must be able to sign in directly without MFA approval,
   email or SMS codes, magic links, or a private network. Keep its sample boards
   available for later reviews.
5. Run the five positive and three negative cases embedded in `plugin.json`
   using that reviewer account. The positive cases are sequential: create the
   named study, add the selected image URLs, inspect/edit a caption, adjust its
   layout and effective brief with a cover enabled, then export/download the PDF. If repeating the full sequence, use a
   clearly chosen fresh review board name or explicitly choose the existing
   review board; do not silently modify any production customer board.
6. Record a walkthrough of sign-in/consent and those cases using sample data.
   Exclude passwords, activation links, tokens, other browser tabs, and unrelated
   personal details. Host it at a real reviewer-accessible HTTPS URL, verify
   playback, and add that URL to `review.demo_recording_url`. Never use a fake
   or placeholder video link.
7. Upload the ZIP at <https://platform.openai.com/plugins> using **With MCP**.
   Reuse an existing draft if one has already been created for this publication.
8. Under MCPs, connect `https://moodboard.co.id/mcp` using OAuth and DCR. Discovery
   supplies `/authorize`, `/token`, and `/register`; the resource is exactly
   `https://moodboard.co.id/mcp`. The declared default permissions are
   `boards:read`, `boards:write`, and `exports:write`. No manually supplied API
   key, Clerk key, or fixed client secret belongs in the package.
9. Complete the portal's domain challenge by serving its exact token as plain
   text at the exact challenge URL. Do not invent a token or replace an existing
   challenge for another plugin. Reconnect/rescan and resolve automated findings.
10. Enter reviewer account credentials and sign-in instructions **only** in the
    secure Review details form. Do not commit them or put them in ZIP metadata.
    The package already imports exactly five positive and three negative cases.
11. Review the complete draft and required attestations before Submit for review.
    Approval and Publish plugin are later, separate portal actions; preparation
    and successful automated checks do not publish the integration.

## Evidence to retain before final submission

- Account-isolation verification and the native-browser OAuth callback test.
- Actual reviewer-account create/read, selected-image addition, visual inspection,
  caption/layout/brief edit, and completed PDF download. Inspect the downloaded
  A4 portrait PDF for its cover, the exact updated visible brief, both images,
  and the exact edited reference caption, not only a completed job status.
- Result of all five positive and three negative prompts, including no access to
  another account and no claim of unsupported image generation/search.
- The final ZIP SHA-256, source commit, deployment ID, tool-scan result, recording
  URL, publisher/domain verification state, and submitted version if submitted.

## Official sources checked

- <https://developers.openai.com/plugins/build/plugins>
- <https://developers.openai.com/plugins/deploy/submission>
- <https://developers.openai.com/plugins/plugin-guidelines>
- <https://developers.openai.com/plugins/guides/optimize-metadata>
- <https://agent-plugins.org/schemas/1.0.0/plugin.schema.json>
- <https://agent-plugins.org/schemas/1.0.0/mcp.schema.json>

Documentation checked on 28 October 2026. Recheck the portal's actual validation
and current requirements when submitting; the local package does not attest to
external account or publishing state.

## Prepared release evidence — 28 October 2026

- Selected publisher: portal-verified individual **ADWIN ADHYNATA**, explicitly chosen by the owner. Product name: **Moodboard Studio**; Markstudios remains the confirmed brand affiliation.
- Website and plugin beta are free; new paid checkout creation is paused before a transaction or gateway request. Existing accounts, projects, transaction history, and old-payment notifications remain intact.
- Automated suite: 110 tests passed, zero failures or skips; typecheck/build passed and hosted CI passed.
- All nine production MCP tools were exercised with real OAuth on a dedicated sample account. The five positive service workflows succeeded. Account isolation was tested; the other negative checks verify that unsupported operations are absent from the exposed contract. These checks do not claim that every negative prompt was replayed through ChatGPT.
- A two-page A4 portrait PDF was downloaded and visually/textually checked for the exact updated brief, both reference images, and the edited caption.
- Walkthrough: <https://moodboard.co.id/review/>. Direct video and example PDF are non-sensitive public review assets. The example PDF is an intentionally published static sample, separate from private expiring account exports.
- Final ZIP download: <https://moodboard.co.id/downloads/moodboard-studio-public-1.0.0.zip>.
- Reviewer credentials and access instructions are kept outside this repository/package and must be entered in the secure portal form.

The walkthrough records the website view of production MCP/OAuth operations and their PDF result, followed by a labeled service-validation receipt. It is not presented as a recording of ChatGPT prompt selection. Reviewers should replay the supplied prompts in ChatGPT to evaluate tool selection.
