import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, copyFile, writeFile } from "fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacyPolicyContent, privacyPolicyMetadata } from "../client/src/components/privacy-policy-content";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

async function prerenderPrivacy() {
  let html = await readFile("dist/public/index.html", "utf-8");
  // A regular browser keeps its interactive React page. The initial response
  // also contains the same policy for readers that do not execute JavaScript.
  const content = renderToStaticMarkup(createElement("main", {
    className: "max-w-3xl mx-auto px-6 py-12",
    lang: "en",
  },
  createElement("p", { className: "mb-6" }, createElement("a", { href: "/" }, "Moodboard Studio")),
  createElement(PrivacyPolicyContent),
  createElement("p", { className: "mt-8" }, createElement("a", { href: "/terms" }, "Terms of Service")),
  ));
  const replacements: [RegExp, string][] = [
    [/<html lang="[^"]*">/, '<html lang="en">'],
    [/<title>[^<]*<\/title>/, `<title>${escapeHtml(privacyPolicyMetadata.title)}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(privacyPolicyMetadata.description)}" />`],
    [/<meta name="keywords" content="[^"]*"\s*\/>/, `<meta name="keywords" content="${escapeHtml(privacyPolicyMetadata.keywords)}" />`],
    [/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${escapeHtml(privacyPolicyMetadata.canonical)}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(privacyPolicyMetadata.title)}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(privacyPolicyMetadata.description)}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${escapeHtml(privacyPolicyMetadata.ogUrl)}" />`],
    [/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(privacyPolicyMetadata.title)}" />`],
    [/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(privacyPolicyMetadata.description)}" />`],
    [/<div id="root"><\/div>/, `<div id="root">${content}</div>`],
  ];
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(html)) throw new Error(`Privacy prerender template is missing ${pattern}`);
    html = html.replace(pattern, () => replacement);
  }
  await writeFile("dist/public/privacy.html", html);
}

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();
  await prerenderPrivacy();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
  await mkdir("dist/assets", { recursive: true });
  for (const file of ["NotoSans-Regular.ttf", "NotoSans-LICENSE.txt"]) {
    await copyFile(`server/assets/${file}`, `dist/assets/${file}`);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
