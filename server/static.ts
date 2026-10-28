import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.get("/.well-known/openai-apps-challenge", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("text/plain").sendFile(
      path.resolve(distPath, ".well-known/openai-apps-challenge"),
      { dotfiles: "allow" },
    );
  });

  app.get(["/privacy", "/privacy/"], (_req, res) => {
    res.sendFile(path.resolve(distPath, "privacy.html"));
  });

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
