import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./middlewares/requireAuth";
import { issueActivationLink, authRateLimit } from "./auth";
import { insertProjectSchema, insertPinSchema, type Pin } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";
import multer from "multer";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import path from "path";
import crypto from "crypto";
import { fetchRemoteImage, inspectImageBuffer, optimizeImage } from "./image-recovery";
import { describeDesignImage } from "./describe-image";
const isAuthenticated = requireAuth;

const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || "moodboardstudio.id@gmail.com",
  password: process.env.ADMIN_PASSWORD
};

const adminSessions = new Map<string, { email: string; expiresAt: number }>();

function generateAdminToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const isAdminSession: RequestHandler = (req: any, res, next) => {
  const token = req.headers["x-admin-token"] as string || req.cookies?.adminToken;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ message: "Session expired" });
  }
  req.adminEmail = session.email;
  next();
};

// Administrator access always requires the separately configured admin password.
const isAdmin = isAdminSession;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

function getUserId(req: any): string {
  return req.dbUser?.id || "";
}

async function verifyProjectOwnership(projectId: number, userId: string) {
  const project = await storage.getProject(projectId);
  if (!project) return null;
  if (project.userId !== userId) return null;
  return project;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerObjectStorageRoutes(app);

  app.get("/api/me", requireAuth, (req, res) => {
    res.json(req.dbUser);
  });

  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const userProjects = await storage.getProjectsByUser(userId);
      const PAPER_RATIOS: Record<string, { w: number; h: number }> = {
        A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 }, A2: { w: 420, h: 594 },
      };
      const IMAGE_ASPECT_RATIOS: Record<string, number | null> = {
        square: 1, portrait_3_5: 3/5, portrait_9_16: 9/16,
        landscape_5_3: 5/3, landscape_16_9: 16/9, original: null,
      };
      const calcPageCount = (pinCount: number, proj: any) => {
        if (pinCount === 0) return 0;
        const ps = proj.paperSize || "A3";
        const isL = proj.orientation === "horizontal";
        const il = proj.imageLayout || "original";
        const cols = Math.max(2, Math.min(5, proj.gridColumns || 3));
        const base = PAPER_RATIOS[ps] || PAPER_RATIOS.A3;
        const pW = isL ? base.h : base.w;
        const pH = isL ? base.w : base.h;
        const ia = IMAGE_ASPECT_RATIOS[il];
        let perPage: number;
        if (ia === null || ia === undefined) {
          const cH = pH * 0.82;
          const colW = (pW * 0.76) / cols;
          const erH = colW * 1.0;
          const gE = 0.015 * pW;
          const rows = Math.max(2, Math.floor((cH + gE) / (erH + gE)));
          perPage = cols * rows;
        } else {
          const cW = pW * 0.76; const cH = pH * 0.82;
          const gF = 0.015 * pW;
          const cellW = (cW - gF * (cols - 1)) / cols;
          const cellH = cellW / ia;
          const rows = Math.max(2, Math.floor((cH + gF) / (cellH + gF)));
          perPage = cols * rows;
        }
        return Math.max(1, Math.min(30, Math.ceil(pinCount / perPage)));
      };
      const projectsWithCovers = await Promise.all(
        userProjects.map(async (project) => {
          const projectPins = await storage.getPinsByProject(project.id);
          const sortedPins = projectPins.sort((a, b) => (a.position || 0) - (b.position || 0));
          const coverImageUrl = sortedPins[0]?.imagePath || sortedPins[0]?.imageUrl || null;
          const pinCount = projectPins.length;
          const pageCount = calcPageCount(pinCount, project);
          return { ...project, coverImageUrl, pinCount, pageCount };
        })
      );
      res.json(projectsWithCovers);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const validated = insertProjectSchema.parse({
        ...req.body,
        userId,
      });
      const project = await storage.createProject(validated);
      res.json(project);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateProject(project.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      await storage.deleteProject(project.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.get("/api/projects/:id/pins", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      const projectPins = await storage.getPinsByProject(project.id);
      res.json(projectPins);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pins" });
    }
  });

  app.post("/api/projects/:id/pins", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      const validated = insertPinSchema.parse({
        ...req.body,
        projectId: project.id,
      });
      const pin = await storage.createPin(validated);
      res.json(pin);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Invalid pin data", errors: error.errors });
      }
      console.error("Error creating pin:", error);
      res.status(500).json({ message: "Failed to create pin" });
    }
  });

  app.patch("/api/pins/:id", isAuthenticated, async (req, res) => {
    try {
      const pin = await storage.getPin(parseInt((req.params.id as string)));
      if (!pin) return res.status(404).json({ message: "Not found" });
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(pin.projectId, userId);
      if (!project) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updatePin(pin.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pin" });
    }
  });

  app.delete("/api/pins/:id", isAuthenticated, async (req, res) => {
    try {
      const pin = await storage.getPin(parseInt((req.params.id as string)));
      if (!pin) return res.status(404).json({ message: "Not found" });
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(pin.projectId, userId);
      if (!project) return res.status(403).json({ message: "Forbidden" });
      await storage.deletePin(pin.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pin" });
    }
  });

  // Export image endpoints keep source bytes and recovery work on the server. This
  // avoids mobile canvas limits and gives every image the same-origin URL.
  const getOwnedPin = async (id: number, req: any): Promise<{ error: 403 | 404 } | { pin: Pin }> => {
    const pin = await storage.getPin(id);
    if (!pin) return { error: 404 as const };
    const project = await verifyProjectOwnership(pin.projectId, getUserId(req));
    if (!project) return { error: 403 as const };
    return { pin };
  };
  const readPinImage = async (pin: any): Promise<{ buffer: Buffer; contentType: string }> => {
    const source = pin.imagePath || pin.imageUrl || "";
    if (!source) throw Object.assign(new Error("Image source is missing"), { code: "missing" });
    if (source.startsWith("/objects/")) {
      if (!source.startsWith("/objects/uploads/")) throw new Error("Local image path is not allowed");
      const file = await new ObjectStorageService().getObjectEntityFile(source);
      const [metadata] = await file.getMetadata();
      const objectSize = Number(metadata.size || 0);
      if (!Number.isFinite(objectSize) || objectSize > 25 * 1024 * 1024) {
        throw new Error("Image exceeds the 25 MB recovery limit");
      }
      const [buffer] = await file.download();
      if (buffer.length > 25 * 1024 * 1024) throw new Error("Image exceeds the 25 MB recovery limit");
      return { buffer, contentType: metadata.contentType || "application/octet-stream" };
    }
    return fetchRemoteImage(source);
  };

  app.get("/api/pins/:id/image-health", isAuthenticated, async (req, res) => {
    const owned = await getOwnedPin(Number((req.params.id as string)), req);
    if ("error" in owned) return res.status(owned.error).json({ message: "Not found" });
    try {
      const { buffer } = await readPinImage(owned.pin);
      const health = await inspectImageBuffer(buffer);
      const version = crypto.createHash("sha256").update(buffer).digest("hex");
      res.json({ ...health, version });
    } catch (error: any) {
      const source = owned.pin.imagePath || owned.pin.imageUrl || "";
      res.json({ status: error?.code === "missing" || !source ? "missing" : "unreachable", message: error?.message });
    }
  });

  app.get("/api/pins/:id/image-content", isAuthenticated, async (req, res) => {
    const owned = await getOwnedPin(Number((req.params.id as string)), req);
    if ("error" in owned) return res.status(owned.error).end();
    try {
      const { buffer, contentType } = await readPinImage(owned.pin);
      const requestedVersion = typeof req.query.version === "string" ? req.query.version : "";
      const currentVersion = crypto.createHash("sha256").update(buffer).digest("hex");
      if (!requestedVersion || requestedVersion !== currentVersion) {
        return res.status(409).json({ message: "Image changed after it was checked; please retry export" });
      }
      res.set({ "Content-Type": contentType, "Content-Length": buffer.length, "Cache-Control": "private, max-age=300" });
      res.send(buffer);
    } catch {
      res.status(404).json({ message: "Image unavailable" });
    }
  });

  app.post("/api/pins/:id/image-repair", isAuthenticated, async (req, res) => {
    const owned = await getOwnedPin(Number((req.params.id as string)), req);
    if ("error" in owned) return res.status(owned.error).json({ message: "Not found" });
    try {
      const { buffer } = await readPinImage(owned.pin);
      // Sharp throws for undecodable data; do not claim a repair in that case.
      const optimized = await optimizeImage(buffer);
      const objectId = `${crypto.randomUUID()}.jpg`;
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      const parts = (privateDir.startsWith("/") ? privateDir : `/${privateDir}`).split("/").filter(Boolean);
      if (!parts[0]) throw new Error("Object storage is not configured");
      const file = objectStorageClient.bucket(parts[0]).file(`${parts.slice(1).join("/")}/uploads/${objectId}`);
      await file.save(optimized, { contentType: "image/jpeg", resumable: false });
      const url = `/objects/uploads/${objectId}`;
      const updated = await storage.updatePin(owned.pin.id, { imagePath: url, imageUrl: url });
      res.json({ pin: updated, url, metadata: await inspectImageBuffer(optimized) });
    } catch (error: any) {
      res.status(422).json({ message: "Image cannot be decoded and was not repaired", detail: error?.message });
    }
  });

  app.post("/api/projects/:id/reorder-pins", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      const { pinIds } = req.body as { pinIds: number[] };
      if (!Array.isArray(pinIds) || pinIds.length === 0) {
        return res.status(400).json({ message: "pinIds array required" });
      }
      const projectPins = await storage.getPinsByProject(project.id);
      const projectPinIds = new Set(projectPins.map((p) => p.id));
      const validPinIds = pinIds.filter((id) => projectPinIds.has(id));
      for (let i = 0; i < validPinIds.length; i++) {
        await storage.updatePin(validPinIds[i], { position: i });
      }
      const updated = await storage.getPinsByProject(project.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to reorder pins" });
    }
  });

  app.post("/api/projects/:id/restore-pins", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const { snapshot } = req.body as { snapshot: Array<{
        id?: number;
        imageUrl?: string | null;
        imagePath?: string | null;
        sourceUrl?: string | null;
        title?: string | null;
        descriptionAi?: string | null;
        descriptionCustomInput?: string | null;
        descriptionFinal?: string | null;
        descriptionEnabled?: boolean;
        approvalStatus?: string | null;
        position?: number;
        shotType?: string | null;
        note?: string | null;
        tags?: string[] | null;
        dominantColors?: string[] | null;
        width?: number | null;
        height?: number | null;
      }> };

      if (!Array.isArray(snapshot)) {
        return res.status(400).json({ message: "snapshot array required" });
      }

      const currentPins = await storage.getPinsByProject(project.id);
      const snapshotIds = new Set(snapshot.filter(s => s.id).map(s => s.id!));
      const currentIds = new Set(currentPins.map(p => p.id));

      for (const pin of currentPins) {
        if (!snapshotIds.has(pin.id)) {
          await storage.deletePin(pin.id);
        }
      }

      for (const snap of snapshot) {
        if (snap.id && currentIds.has(snap.id)) {
          const { id, ...data } = snap;
          await storage.updatePin(id, data);
        } else if (!snap.id || !currentIds.has(snap.id)) {
          await storage.createPin({
            projectId: project.id,
            imageUrl: snap.imageUrl || "",
            imagePath: snap.imagePath,
            sourceUrl: snap.sourceUrl,
            title: snap.title || "Image",
            descriptionAi: snap.descriptionAi,
            descriptionCustomInput: snap.descriptionCustomInput,
            descriptionFinal: snap.descriptionFinal,
            descriptionEnabled: snap.descriptionEnabled ?? true,
            approvalStatus: snap.approvalStatus,
            position: snap.position ?? 0,
            shotType: snap.shotType,
            note: snap.note,
            tags: snap.tags,
            dominantColors: snap.dominantColors,
            width: snap.width,
            height: snap.height,
          });
        }
      }

      const updated = await storage.getPinsByProject(project.id);
      res.json(updated);
    } catch (error) {
      console.error("Error restoring pins:", error);
      res.status(500).json({ message: "Failed to restore pins" });
    }
  });

  const getCategoryStyle = (category: string | null | undefined) => {
    const styles: Record<string, { role: string; focus: string; tone: string }> = {
      architecture: { role: "architecture and spatial design", focus: "form, structure, materiality, light, and spatial experience", tone: "poetic yet precise, evoking the dialogue between built form and human experience" },
      interior: { role: "interior design and living spaces", focus: "texture, atmosphere, comfort, material palettes, and spatial harmony", tone: "warm and evocative, celebrating the art of curated living" },
      graphic_design: { role: "graphic design and visual communication", focus: "composition, typography, color theory, visual rhythm, and brand expression", tone: "bold and articulate, honoring the craft of visual storytelling" },
      uiux: { role: "digital product design and user experience", focus: "interaction, clarity, user flow, interface aesthetics, and digital craftsmanship", tone: "clean and purposeful, celebrating intuitive design thinking" },
      painting: { role: "fine art, painting, and visual expression", focus: "color, emotion, brushwork, composition, and artistic narrative", tone: "expressive and contemplative, honoring the artist's vision" },
      fashion: { role: "fashion design and textile arts", focus: "silhouette, fabric, movement, color story, and sartorial expression", tone: "refined and evocative, celebrating the poetry of wearable art" },
      product_design: { role: "product design and industrial craft", focus: "form, function, material innovation, ergonomics, and design intent", tone: "precise yet inspired, honoring the marriage of utility and beauty" },
    };
    return styles[category || "architecture"] || styles.architecture;
  };

  app.post("/api/projects/:id/generate-description", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const projectPins = await storage.getPinsByProject(project.id);
      const pinContext = projectPins
        .map((p) => p.title || "")
        .filter(Boolean)
        .join(", ");

      const style = getCategoryStyle(project.projectCategory);
      const prompt = `You are an aesthetic copywriter specializing in ${style.role}. Write a short, elegant, aesthetic description (1-2 sentences max, keep it brief and poetic) for a moodboard cover page. Do NOT include the project name, studio name, or any labels like "Project:" or "Studio:". Just write a pure aesthetic description.

Project context: ${project.projectName || project.title}
Keywords: ${project.descriptionRaw || "design, aesthetics, visual exploration"}
Visual references: ${pinContext || "curated images"}

Your tone should be ${style.tone}. Focus on ${style.focus}. Write something short, beautiful, and evocative — like a tagline or brief curatorial note. No bullet points, no labels, just flowing prose.`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 120,
      });

      const description = completion.choices[0]?.message?.content || "";
      const updated = await storage.updateProject(project.id, { descriptionAi: description });
      res.json(updated);
    } catch (error) {
      console.error("Error generating description:", error);
      res.status(500).json({ message: "Failed to generate description. Please try again." });
    }
  });

  app.post("/api/projects/:id/generate-concept", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const { keywords, pageIndex } = req.body;
      const projectPins = await storage.getPinsByProject(project.id);
      const pinContext = projectPins
        .map((p) => p.title || "")
        .filter(Boolean)
        .slice(0, 10)
        .join(", ");

      const style = getCategoryStyle(project.projectCategory);
      const prompt = `You are an aesthetic copywriter specializing in ${style.role}. Write a short, poetic concept description (2-3 sentences max) for a section of a design moodboard.

Keywords from designer: ${keywords || "design, aesthetics"}
Visual references: ${pinContext || "curated images"}

Your tone should be ${style.tone}. Focus on ${style.focus}. Write something evocative and beautiful — no labels, no bullet points, just flowing aesthetic prose. Keep it concise.`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 150,
      });

      const description = completion.choices[0]?.message?.content || "";
      res.json({ description, pageIndex });
    } catch (error) {
      console.error("Error generating concept description:", error);
      res.status(500).json({ message: "Failed to generate concept description." });
    }
  });

  app.post("/api/projects/:id/generate-all-pin-descriptions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const mode: "short" | "long" = req.body.mode === "long" ? "long" : "short";
      const projectPins = await storage.getPinsByProject(project.id);
      const projectKeywords = project.descriptionRaw || "";
      let updated = 0;
      const failed: Array<{ id: number; title: string }> = [];

      for (const pin of projectPins) {
        try {
          const userKeywords = pin.descriptionCustomInput || projectKeywords || "";

          const { buffer } = await readPinImage(pin);
          const description = await describeDesignImage(getOpenAI(), buffer, { mode, keywords: userKeywords });
          if (description) {
            await storage.updatePin(pin.id, { descriptionAi: description, descriptionFinal: description });
            updated++;
          }
        } catch (e) {
          console.error(`Error generating description for pin ${pin.id}:`, e);
          failed.push({ id: pin.id, title: pin.title || `Image ${pin.id}` });
        }
      }

      res.json({ updated, total: projectPins.length, failed });
    } catch (error) {
      console.error("Error generating all pin descriptions:", error);
      res.status(500).json({ message: "Failed to generate descriptions." });
    }
  });

  app.delete("/api/projects/:id/pin-descriptions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });
      await storage.clearPinDescriptions(project.id);
      res.json({ message: "All descriptions cleared" });
    } catch (error) {
      console.error("Error clearing pin descriptions:", error);
      res.status(500).json({ message: "Failed to clear descriptions." });
    }
  });

  app.post("/api/pins/:id/refetch-image", isAuthenticated, async (req, res) => {
    try {
      const pin = await storage.getPin(parseInt((req.params.id as string)));
      if (!pin) return res.status(404).json({ message: "Not found" });
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(pin.projectId, userId);
      if (!project) return res.status(403).json({ message: "Forbidden" });

      const currentUrl = pin.imagePath || pin.imageUrl || "";
      if (!currentUrl) return res.status(400).json({ message: "No image URL" });

      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      const altSizes = ["originals", "orig", "736x", "564x", "474x", "236x"];
      const candidateUrls: string[] = [];

      const match = currentUrl.match(/i\.pinimg\.com\/(originals|orig|\d+x)\//);
      if (match) {
        for (const size of altSizes) {
          const alt = currentUrl.replace(/i\.pinimg\.com\/(originals|orig|\d+x)\//, `i.pinimg.com/${size}/`);
          if (alt !== currentUrl) candidateUrls.push(alt);
        }
      }
      candidateUrls.push(currentUrl);

      for (const url of candidateUrls) {
        try {
          const headRes = await fetch(url, {
            method: "HEAD",
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(8000),
            redirect: "follow",
          });
          if (headRes.ok) {
            const ct = headRes.headers.get("content-type") || "";
            if (ct.startsWith("image/")) {
              const updated = await storage.updatePin(pin.id, { imageUrl: url });
              return res.json({ success: true, pin: updated, newUrl: url });
            }
          }
        } catch {}
      }

      return res.json({ success: false, message: "Could not find a working image URL" });
    } catch (error) {
      console.error("Refetch image error:", error);
      res.status(500).json({ message: "Failed to refetch image" });
    }
  });

  app.post("/api/projects/:id/refetch-broken", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const schema = z.object({ pinIds: z.array(z.number().int().positive()).min(1) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid pin IDs", errors: parsed.error.errors });
      const { pinIds } = parsed.data;

      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const altSizes = ["originals", "orig", "736x", "564x", "474x", "236x"];
      let fixed = 0;
      let failed = 0;

      for (const pinId of pinIds) {
        const pin = await storage.getPin(pinId);
        if (!pin || pin.projectId !== project.id) { failed++; continue; }

        const currentUrl = pin.imagePath || pin.imageUrl || "";
        if (!currentUrl) { failed++; continue; }

        const candidateUrls: string[] = [];
        const match = currentUrl.match(/i\.pinimg\.com\/(originals|orig|\d+x)\//);
        if (match) {
          for (const size of altSizes) {
            const alt = currentUrl.replace(/i\.pinimg\.com\/(originals|orig|\d+x)\//, `i.pinimg.com/${size}/`);
            if (alt !== currentUrl) candidateUrls.push(alt);
          }
        }
        candidateUrls.push(currentUrl);

        let foundWorking = false;
        for (const url of candidateUrls) {
          try {
            const headRes = await fetch(url, {
              method: "HEAD",
              headers: { "User-Agent": UA },
              signal: AbortSignal.timeout(8000),
              redirect: "follow",
            });
            if (headRes.ok && (headRes.headers.get("content-type") || "").startsWith("image/")) {
              await storage.updatePin(pin.id, { imageUrl: url });
              foundWorking = true;
              fixed++;
              break;
            }
          } catch {}
        }
        if (!foundWorking) failed++;

        await new Promise((r) => setTimeout(r, 200));
      }

      res.json({ fixed, failed, total: pinIds.length });
    } catch (error) {
      console.error("Bulk refetch error:", error);
      res.status(500).json({ message: "Failed to refetch" });
    }
  });

  app.post("/api/pins/:id/generate-description", isAuthenticated, async (req, res) => {
    try {
      const pin = await storage.getPin(parseInt((req.params.id as string)));
      if (!pin) return res.status(404).json({ message: "Not found" });
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(pin.projectId, userId);
      if (!project) return res.status(403).json({ message: "Forbidden" });

      const userKeywords = pin.descriptionCustomInput || project.descriptionRaw || "";
      const { buffer } = await readPinImage(pin);
      const description = await describeDesignImage(getOpenAI(), buffer, { mode: "short", keywords: userKeywords });
      const updated = await storage.updatePin(pin.id, {
        descriptionAi: description,
        descriptionFinal: description,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error generating pin description:", error);
      res.status(500).json({ message: "Failed to generate description. Please try again." });
    }
  });

  async function scrapePinterestBoard(
    boardUrl: string,
    onProgress?: (count: number, message: string, thumbnails: string[]) => void
  ): Promise<Array<{ imageUrl: string; title: string; sourceUrl: string }>> {
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    const response = await fetch(boardUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Failed to fetch board: ${response.status}`);

    const setCookies = response.headers.getSetCookie?.() || [];
    let cookieStr = setCookies.map((c: string) => c.split(";")[0]).join("; ");
    let csrfToken = "";
    for (const c of setCookies) {
      if (c.startsWith("csrftoken=")) csrfToken = c.split("=")[1].split(";")[0];
    }

    const html = await response.text();
    const appVerMatch = html.match(/appVersion.*?"([a-f0-9]+)"/);
    const appVersion = appVerMatch ? appVerMatch[1] : "";

    let boardId = "";
    let bookmark = "";
    let sourceUrlPath = "";
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const results: Array<{ imageUrl: string; title: string; sourceUrl: string }> = [];

    const scriptRegex = /<script[^>]*>([\s\S]+?)<\/script>/g;
    let sm;
    while ((sm = scriptRegex.exec(html)) !== null) {
      try {
        const text = sm[1].trim();
        if (!text.startsWith("{") && !text.startsWith("[")) continue;
        const data = JSON.parse(text);

        const redux = data.initialReduxState || data.props?.initialReduxState;
        if (!redux) continue;

        if (redux.pins) {
          for (const pk of Object.keys(redux.pins)) {
            const pin = redux.pins[pk];
            if (pin.images?.orig && !seenIds.has(pin.id)) {
              seenIds.add(pin.id);
              seenUrls.add(pin.images.orig.url);
              results.push({
                imageUrl: pin.images.orig.url,
                title: pin.grid_title || pin.title || pin.description?.substring(0, 100) || "",
                sourceUrl: boardUrl,
              });
            }
          }
        }

        if (redux.resources?.BoardFeedResource) {
          for (const fk of Object.keys(redux.resources.BoardFeedResource)) {
            const feed = redux.resources.BoardFeedResource[fk];
            if (feed.nextBookmark) bookmark = feed.nextBookmark;
            if (feed.response?.bookmark) bookmark = bookmark || feed.response.bookmark;
            const bidMatch = fk.match(/(\d{10,})/);
            if (bidMatch) boardId = bidMatch[1];
          }
        }

        if (redux.boards) {
          for (const bk of Object.keys(redux.boards)) {
            boardId = boardId || redux.boards[bk].id;
            sourceUrlPath = redux.boards[bk].url || "";
          }
        }

        if (!boardId && redux.resources) {
          for (const rk of Object.keys(redux.resources)) {
            if (rk.includes("Board")) {
              const resource = redux.resources[rk];
              for (const subKey of Object.keys(resource)) {
                const sub = resource[subKey];
                if (sub?.data?.id) boardId = boardId || sub.data.id;
                if (sub?.nextBookmark) bookmark = bookmark || sub.nextBookmark;
                if (sub?.response?.bookmark) bookmark = bookmark || sub.response.bookmark;
              }
            }
          }
        }
      } catch (_e) {}
    }

    if (!boardId) {
      const boardIdMatch = html.match(/"board_id"\s*:\s*"?(\d{10,})"?/);
      if (boardIdMatch) boardId = boardIdMatch[1];
    }
    if (!bookmark || bookmark === "-end-") {
      const bookmarkMatch = html.match(/"bookmark"\s*:\s*"([^"]+)"/);
      if (bookmarkMatch && bookmarkMatch[1] !== "-end-") bookmark = bookmarkMatch[1];
    }

    const getThumbUrls = () => results.slice(0, 6).map(r => r.imageUrl);
    const beforePagination = results.length;
    console.log(`[Pinterest] Redux state extracted ${beforePagination} pins, boardId=${boardId}, hasBookmark=${!!bookmark && bookmark !== "-end-"}`);
    onProgress?.(results.length, `Scraping in progress — found ${results.length} images from initial page...`, getThumbUrls());

    if (boardId && (!bookmark || bookmark === "-end-")) {
      console.log(`[Pinterest] No bookmark found, attempting initial feed fetch for boardId=${boardId}`);
      try {
        const initFormData = new URLSearchParams();
        initFormData.append("source_url", sourceUrlPath || "/");
        initFormData.append("data", JSON.stringify({
          options: {
            board_id: boardId,
            add_vase: true,
            field_set_key: "react_grid_pin",
            filter_section_pins: false,
            is_react: true,
            page_size: 250,
            prepend: [],
            bookmark: "",
          },
          context: {},
        }));

        const initRes = await fetch("https://www.pinterest.com/resource/BoardFeedResource/get/", {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "X-Pinterest-AppState": "active",
            "X-APP-VERSION": appVersion,
            "X-CSRFToken": csrfToken,
            "Cookie": cookieStr,
            "Referer": boardUrl,
            "Origin": "https://www.pinterest.com",
          },
          body: initFormData.toString(),
          signal: AbortSignal.timeout(20000),
        });

        if (initRes.ok) {
          const initJson = await initRes.json();
          const items = initJson.resource_response?.data || [];
          bookmark = initJson.resource_response?.bookmark || "-end-";
          let initAdded = 0;
          for (const item of items) {
            if (item.images?.orig && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              seenUrls.add(item.images.orig.url);
              results.push({
                imageUrl: item.images.orig.url,
                title: item.grid_title || item.title || item.description?.substring(0, 100) || "",
                sourceUrl: boardUrl,
              });
              initAdded++;
            }
          }
          console.log(`[Pinterest] Initial feed fetch: added ${initAdded} pins, new bookmark=${bookmark !== "-end-"}`);

          const newCookies = initRes.headers.getSetCookie?.() || [];
          if (newCookies.length > 0) {
            const cookieMap: Record<string, string> = {};
            for (const c of cookieStr.split("; ")) {
              const [k, ...v] = c.split("=");
              cookieMap[k] = v.join("=");
            }
            for (const c of newCookies) {
              const [k, ...v] = c.split(";")[0].split("=");
              cookieMap[k] = v.join("=");
              if (k === "csrftoken") csrfToken = v.join("=");
            }
            cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
          }
        }
      } catch (e) {
        console.log(`[Pinterest] Initial feed fetch failed:`, e);
      }
    }

    if (boardId && bookmark && bookmark !== "-end-") {
      const maxPages = 500;
      let consecutiveErrors = 0;
      let rateLimitCount = 0;
      let baseDelay = 1500;
      let emptyPageCount = 0;
      let totalRateLimits = 0;

      for (let page = 0; page < maxPages; page++) {
        if (!bookmark || bookmark === "-end-") {
          console.log(`[Pinterest] Pagination complete: bookmark is ${bookmark || "null"}`);
          break;
        }
        if (consecutiveErrors >= 15) {
          console.log(`[Pinterest] Stopping: too many consecutive errors (${consecutiveErrors})`);
          break;
        }
        if (totalRateLimits >= 30) {
          console.log(`[Pinterest] Stopping: too many total rate limits (${totalRateLimits})`);
          break;
        }
        if (emptyPageCount >= 12) {
          console.log(`[Pinterest] Stopping: ${emptyPageCount} consecutive empty pages with no new pins`);
          break;
        }

        const delay = baseDelay + Math.random() * 1200;
        await new Promise((r) => setTimeout(r, delay));

        const formData = new URLSearchParams();
        formData.append("source_url", sourceUrlPath || "/");
        formData.append("data", JSON.stringify({
          options: {
            board_id: boardId,
            add_vase: true,
            field_set_key: "react_grid_pin",
            filter_section_pins: false,
            is_react: true,
            page_size: 250,
            prepend: [],
            bookmark,
          },
          context: {},
        }));

        try {
          const apiRes = await fetch("https://www.pinterest.com/resource/BoardFeedResource/get/", {
            method: "POST",
            headers: {
              "User-Agent": UA,
              "Accept": "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Requested-With": "XMLHttpRequest",
              "X-Pinterest-AppState": "active",
              "X-APP-VERSION": appVersion,
              "X-CSRFToken": csrfToken,
              "Cookie": cookieStr,
              "Referer": boardUrl,
              "Origin": "https://www.pinterest.com",
              "X-Pinterest-Source-Url": sourceUrlPath || "/",
              "X-Pinterest-PWS-Handler": "www/[username]/[slug].js",
            },
            body: formData.toString(),
            signal: AbortSignal.timeout(25000),
          });

          if (apiRes.status === 429 || apiRes.status === 403) {
            rateLimitCount++;
            totalRateLimits++;
            const rateLimitDelay = Math.min(5000 * Math.pow(2, rateLimitCount - 1), 60000);
            console.log(`[Pinterest] Rate limited (${apiRes.status}) on page ${page + 1}, waiting ${Math.round(rateLimitDelay / 1000)}s before retry (attempt ${rateLimitCount}, total: ${totalRateLimits})`);
            onProgress?.(results.length, `Scraping still in progress — waiting ${Math.round(rateLimitDelay / 1000)}s before next batch... (${results.length} images found)`, getThumbUrls());
            await new Promise((r) => setTimeout(r, rateLimitDelay));
            baseDelay = Math.min(baseDelay + 500, 6000);
            page--;
            continue;
          }
          if (apiRes.status !== 200) {
            consecutiveErrors++;
            const errorDelay = 3000 * consecutiveErrors;
            console.log(`[Pinterest] Error ${apiRes.status} on page ${page + 1}, retrying in ${errorDelay / 1000}s (error ${consecutiveErrors})`);
            onProgress?.(results.length, `Scraping still in progress — retrying... (${results.length} images found)`, getThumbUrls());
            await new Promise((r) => setTimeout(r, errorDelay));
            page--;
            continue;
          }

          consecutiveErrors = 0;
          rateLimitCount = 0;

          const newCookies = apiRes.headers.getSetCookie?.() || [];
          if (newCookies.length > 0) {
            const cookieMap: Record<string, string> = {};
            for (const c of cookieStr.split("; ")) {
              const [k, ...v] = c.split("=");
              cookieMap[k] = v.join("=");
            }
            for (const c of newCookies) {
              const [k, ...v] = c.split(";")[0].split("=");
              cookieMap[k] = v.join("=");
              if (k === "csrftoken") csrfToken = v.join("=");
            }
            cookieStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
          }

          const json = await apiRes.json();
          const items = json.resource_response?.data || [];
          bookmark = json.resource_response?.bookmark || "-end-";

          let pageAdded = 0;
          for (const item of items) {
            if (item.images?.orig && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              seenUrls.add(item.images.orig.url);
              results.push({
                imageUrl: item.images.orig.url,
                title: item.grid_title || item.title || item.description?.substring(0, 100) || "",
                sourceUrl: boardUrl,
              });
              pageAdded++;
            }
          }

          if (pageAdded === 0) {
            emptyPageCount++;
          } else {
            emptyPageCount = 0;
          }

          console.log(`[Pinterest] Page ${page + 1}: +${pageAdded} pins (total: ${results.length}, delay: ${Math.round(delay)}ms)`);
          onProgress?.(results.length, `Scraping in progress — page ${page + 1}, ${results.length} images found so far...`, getThumbUrls());
        } catch (err: any) {
          consecutiveErrors++;
          const isTimeout = err?.name === "AbortError" || err?.message?.includes("timeout");
          if (isTimeout) {
            const timeoutDelay = 3000 * consecutiveErrors;
            console.log(`[Pinterest] Timeout on page ${page + 1}, waiting ${timeoutDelay / 1000}s (error ${consecutiveErrors})`);
            await new Promise((r) => setTimeout(r, timeoutDelay));
            page--;
          } else {
            console.log(`[Pinterest] Error on page ${page + 1}: ${err?.message}`);
          }
          continue;
        }
      }
    }

    if (boardId) {
      try {
        console.log(`[Pinterest] Checking board sections for boardId=${boardId}`);
        const sectionsFormData = new URLSearchParams();
        sectionsFormData.append("source_url", sourceUrlPath || "/");
        sectionsFormData.append("data", JSON.stringify({
          options: {
            board_id: boardId,
            is_react: true,
          },
          context: {},
        }));

        const sectionsRes = await fetch("https://www.pinterest.com/resource/BoardSectionsResource/get/", {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "X-Pinterest-AppState": "active",
            "X-APP-VERSION": appVersion,
            "X-CSRFToken": csrfToken,
            "Cookie": cookieStr,
            "Referer": boardUrl,
            "Origin": "https://www.pinterest.com",
          },
          body: sectionsFormData.toString(),
          signal: AbortSignal.timeout(10000),
        });

        if (sectionsRes.ok) {
          const sectionsJson = await sectionsRes.json();
          const sections = sectionsJson.resource_response?.data || [];
          console.log(`[Pinterest] Found ${sections.length} board sections`);
          onProgress?.(results.length, `Scraping in progress — found ${sections.length} board sections to scan... (${results.length} images)`, getThumbUrls());

          for (const section of sections) {
            if (!section.id) continue;
            let sectionBookmark: string | null = "";
            let sectionPages = 0;
            let secEmptyPages = 0;

            while (sectionBookmark !== null && sectionBookmark !== "-end-" && sectionPages < 100 && secEmptyPages < 5) {
              await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

              const secFormData = new URLSearchParams();
              secFormData.append("source_url", sourceUrlPath || "/");
              secFormData.append("data", JSON.stringify({
                options: {
                  section_id: section.id,
                  is_react: true,
                  page_size: 50,
                  bookmark: sectionBookmark || undefined,
                },
                context: {},
              }));

              try {
                const secRes = await fetch("https://www.pinterest.com/resource/BoardSectionPinsResource/get/", {
                  method: "POST",
                  headers: {
                    "User-Agent": UA,
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-Pinterest-AppState": "active",
                    "X-APP-VERSION": appVersion,
                    "X-CSRFToken": csrfToken,
                    "Cookie": cookieStr,
                    "Referer": boardUrl,
                    "Origin": "https://www.pinterest.com",
                  },
                  body: secFormData.toString(),
                  signal: AbortSignal.timeout(10000),
                });

                if (secRes.status === 429 || secRes.status === 403) {
                  console.log(`[Pinterest] Rate limited on section ${section.title || section.id}, waiting 10s`);
                  onProgress?.(results.length, `Scraping still in progress — waiting before next section batch... (${results.length} images)`, getThumbUrls());
                  await new Promise((r) => setTimeout(r, 10000));
                  continue;
                }
                if (!secRes.ok) break;

                const secJson = await secRes.json();
                const secItems = secJson.resource_response?.data || [];
                sectionBookmark = secJson.resource_response?.bookmark || "-end-";

                let secAdded = 0;
                for (const item of secItems) {
                  if (item.images?.orig && !seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    seenUrls.add(item.images.orig.url);
                    results.push({
                      imageUrl: item.images.orig.url,
                      title: item.grid_title || item.title || item.description?.substring(0, 100) || "",
                      sourceUrl: boardUrl,
                    });
                    secAdded++;
                  }
                }
                sectionPages++;
                if (secAdded > 0) {
                  secEmptyPages = 0;
                  console.log(`[Pinterest] Section "${section.title || section.id}" page ${sectionPages}: +${secAdded} pins (total: ${results.length})`);
                  onProgress?.(results.length, `Scraping in progress — scanning section "${section.title || ""}"... (${results.length} images total)`, getThumbUrls());
                } else {
                  secEmptyPages++;
                }
              } catch (e) {
                console.log(`[Pinterest] Section fetch error:`, e);
                break;
              }
            }
          }
        }
      } catch (e) {
        console.log(`[Pinterest] Board sections fetch skipped:`, e);
      }
    }

    if (boardId) {
      try {
        const beforeFallback = results.length;
        const pinBlockRegex = /\{[^{}]*"id"\s*:\s*"(\d+)"[^{}]*"images"\s*:\s*\{[^{}]*"orig"\s*:\s*\{[^{}]*"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"[^{}]*\}[^{}]*\}[^{}]*"board_id"\s*:\s*"(\d+)"[^{}]*\}/g;
        let bpm;
        while ((bpm = pinBlockRegex.exec(html)) !== null) {
          const pinId = bpm[1];
          const imgUrl = bpm[2];
          const pinBoardId = bpm[3];
          if (pinBoardId === boardId && !seenIds.has(pinId) && !seenUrls.has(imgUrl)) {
            seenIds.add(pinId);
            seenUrls.add(imgUrl);
            results.push({ imageUrl: imgUrl, title: "", sourceUrl: boardUrl });
          }
        }

        const reversePinBlockRegex = /\{[^{}]*"board_id"\s*:\s*"(\d+)"[^{}]*"id"\s*:\s*"(\d+)"[^{}]*"images"\s*:\s*\{[^{}]*"orig"\s*:\s*\{[^{}]*"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"[^{}]*\}[^{}]*\}[^{}]*\}/g;
        let rpm;
        while ((rpm = reversePinBlockRegex.exec(html)) !== null) {
          const pinBoardId = rpm[1];
          const pinId = rpm[2];
          const imgUrl = rpm[3];
          if (pinBoardId === boardId && !seenIds.has(pinId) && !seenUrls.has(imgUrl)) {
            seenIds.add(pinId);
            seenUrls.add(imgUrl);
            results.push({ imageUrl: imgUrl, title: "", sourceUrl: boardUrl });
          }
        }
        const allOrigUrlRegex = /https:\/\/i\.pinimg\.com\/originals\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]+\.\w+/g;
        let urlMatch;
        while ((urlMatch = allOrigUrlRegex.exec(html)) !== null) {
          const imgUrl = urlMatch[0];
          if (!seenUrls.has(imgUrl)) {
            seenUrls.add(imgUrl);
            results.push({ imageUrl: imgUrl, title: "", sourceUrl: boardUrl });
          }
        }

        console.log(`[Pinterest] Board-scoped fallback added ${results.length - beforeFallback} images (boardId=${boardId})`);
      } catch (e) {
        console.log(`[Pinterest] Fallback scan error:`, e);
      }
    }

    console.log(`[Pinterest] Total extracted: ${results.length} pins from board`);
    return results;
  }

  async function resolvePinterestShortUrl(url: string): Promise<string> {
    if (!url.match(/pin\.it\//)) return url;
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(8000),
      });
      return response.url || url;
    } catch {
      return url;
    }
  }

  function isPinterestBoardUrl(url: string): boolean {
    if (url.match(/\/pin\/\d+/)) return false;
    if (url.match(/pinterest\.\w+\/[^/]+\/[^/]+/)) return true;
    return false;
  }

  const scrapedCache = new Map<string, { images: Array<{ imageUrl: string; title: string; sourceUrl: string }>; timestamp: number }>();
  const scrapeProgress = new Map<string, {
    status: "scraping" | "done" | "error";
    imageCount: number;
    message: string;
    thumbnails: string[];
    cacheKey?: string;
    boardUrl?: string;
    error?: string;
  }>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of scrapedCache) {
      if (now - val.timestamp > 10 * 60 * 1000) scrapedCache.delete(key);
    }
  }, 60000);

  app.post("/api/scrape-preview", isAuthenticated, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      let resolvedUrl = url.trim();
      if (resolvedUrl.match(/pin\.it\//)) {
        resolvedUrl = await resolvePinterestShortUrl(resolvedUrl);
      }

      if (!isPinterestBoardUrl(resolvedUrl)) {
        return res.json({ isPinterestBoard: false, imageCount: 0, images: [] });
      }

      const userId = getUserId(req);
      const progressKey = `${userId}_progress`;
      const cacheKey = `${userId}_${resolvedUrl}`;

      scrapeProgress.set(progressKey, {
        status: "scraping",
        imageCount: 0,
        message: "Connecting to Pinterest — this may take a few minutes for large boards...",
        thumbnails: [],
      });

      res.json({
        isPinterestBoard: true,
        progressKey,
        boardUrl: resolvedUrl,
        scraping: true,
      });

      console.log(`[Preview] Starting async scrape for: ${resolvedUrl}`);
      scrapePinterestBoard(resolvedUrl, (count, msg, thumbs) => {
        scrapeProgress.set(progressKey, {
          status: "scraping",
          imageCount: count,
          message: msg,
          thumbnails: thumbs.slice(0, 6),
        });
      }).then((images) => {
        console.log(`[Preview] Completed: ${images.length} images`);
        scrapedCache.set(cacheKey, { images, timestamp: Date.now() });
        scrapeProgress.set(progressKey, {
          status: "done",
          imageCount: images.length,
          message: `Found ${images.length} images`,
          thumbnails: images.slice(0, 6).map(img => img.imageUrl),
          cacheKey,
          boardUrl: resolvedUrl,
        });
      }).catch((error: any) => {
        console.error("[Preview] Scrape error:", error);
        scrapeProgress.set(progressKey, {
          status: "error",
          imageCount: 0,
          message: "Failed to scrape board",
          thumbnails: [],
          error: error.message || "Unknown error",
        });
      });
    } catch (error: any) {
      console.error("Scrape preview error:", error);
      res.status(500).json({ message: error.message || "Failed to scrape" });
    }
  });

  app.get("/api/scrape-progress/:key", isAuthenticated, (req, res) => {
    const progress = scrapeProgress.get((req.params.key as string));
    if (!progress) {
      return res.json({ status: "unknown", imageCount: 0, message: "No scrape in progress" });
    }
    res.json(progress);
    if (progress.status === "done" || progress.status === "error") {
      setTimeout(() => scrapeProgress.delete((req.params.key as string)), 60000);
    }
  });

  app.post("/api/projects/:id/import-confirmed", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const { cacheKey, boardUrl } = req.body;
      if (!cacheKey) return res.status(400).json({ message: "Cache key required" });

      const cached = scrapedCache.get(cacheKey);
      if (!cached) return res.status(410).json({ message: "Preview expired, please scrape again" });

      const existingPins = await storage.getPinsByProject(project.id);
      let position = existingPins.length;
      const createdPins = [];

      for (const bp of cached.images) {
        const pin = await storage.createPin({
          projectId: project.id,
          imageUrl: bp.imageUrl,
          sourceUrl: bp.sourceUrl,
          title: bp.title,
          position,
        });
        createdPins.push(pin);
        position++;
      }

      scrapedCache.delete(cacheKey);

      await storage.createSource({
        projectId: project.id,
        type: "pinterest",
        url: boardUrl || "",
        status: "completed",
        totalItems: cached.images.length,
        importedItems: createdPins.length,
      });

      res.json({
        pins: createdPins,
        imported: createdPins.length,
        total: cached.images.length,
        errors: [],
      });
    } catch (error) {
      console.error("Import confirmed error:", error);
      res.status(500).json({ message: "Failed to import" });
    }
  });

  app.post("/api/projects/:id/import", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const { urls } = req.body;
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ message: "URLs array is required" });
      }

      const existingPins = await storage.getPinsByProject(project.id);
      let position = existingPins.length;
      const createdPins = [];
      const errors: string[] = [];

      for (const rawUrl of urls) {
        let url = rawUrl.trim();
        if (!url) continue;

        try {
          if (url.match(/pin\.it\//)) {
            url = await resolvePinterestShortUrl(url);
            console.log(`Resolved pin.it URL to: ${url}`);
          }

          if (isPinterestBoardUrl(url)) {
            try {
              console.log(`Scraping Pinterest board: ${url}`);
              const boardPins = await scrapePinterestBoard(url);
              console.log(`Found ${boardPins.length} images from board`);

              if (boardPins.length === 0) {
                errors.push(`No images found in Pinterest board: ${url}`);
                continue;
              }

              for (const bp of boardPins) {
                const pin = await storage.createPin({
                  projectId: project.id,
                  imageUrl: bp.imageUrl,
                  sourceUrl: bp.sourceUrl,
                  title: bp.title,
                  position,
                });
                createdPins.push(pin);
                position++;
              }
            } catch (err: any) {
              console.error("Board scraping error:", err);
              errors.push(`Failed to import Pinterest board: ${err.message || url}`);
            }
            continue;
          }

          let imageUrl = url;
          let title = "Imported Image";
          let sourceUrl = url;

          if (url.includes("pinterest") || url.includes("pin.it")) {
            const pinMatch = url.match(/\/pin\/(\d+)/);
            if (pinMatch) {
              try {
                const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`;
                const oembedRes = await fetch(oembedUrl, {
                  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
                  signal: AbortSignal.timeout(8000),
                });
                if (oembedRes.ok) {
                  const oembedData = await oembedRes.json();
                  if (oembedData.url) {
                    imageUrl = oembedData.url;
                  } else if (oembedData.thumbnail_url) {
                    imageUrl = oembedData.thumbnail_url;
                  }
                  title = oembedData.title || oembedData.description || "Pinterest Pin";
                } else {
                  errors.push(`Could not fetch Pinterest pin: ${url}`);
                  continue;
                }
              } catch {
                errors.push(`Pinterest pin timed out or failed: ${url}`);
                continue;
              }
            } else {
              errors.push(`Unrecognized Pinterest URL format: ${url}`);
              continue;
            }
          } else {
            const urlLower = url.toLowerCase();
            if (!urlLower.startsWith("http")) {
              errors.push(`Invalid URL: ${url}`);
              continue;
            }

            const segments = url.split("/").filter(Boolean);
            const filename = segments[segments.length - 1]?.split("?")[0] || "";
            if (filename) {
              title = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
            }
          }

          const pin = await storage.createPin({
            projectId: project.id,
            imageUrl,
            sourceUrl,
            title,
            position,
          });
          createdPins.push(pin);
          position++;
        } catch (err) {
          errors.push(`Failed to import: ${url}`);
        }
      }

      await storage.createSource({
        projectId: project.id,
        type: urls.some((u: string) => u.includes("pinterest")) ? "pinterest" : "url",
        url: urls.join("\n"),
        status: "completed",
        totalItems: urls.length,
        importedItems: createdPins.length,
      });

      res.json({
        pins: createdPins,
        imported: createdPins.length,
        total: urls.length,
        errors,
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to import" });
    }
  });

  app.post("/api/projects/:id/share", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const project = await verifyProjectOwnership(parseInt((req.params.id as string)), userId);
      if (!project) return res.status(404).json({ message: "Not found" });

      const token = await storage.generateShareToken(project.id);
      res.json({ token, url: `/share/${token}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate share link" });
    }
  });

  app.get("/api/share/:token", async (req, res) => {
    try {
      const project = await storage.getProjectByShareToken((req.params.token as string));
      if (!project) return res.status(404).json({ message: "Not found or expired" });

      const projectPins = await storage.getPinsByProject(project.id);
      res.json({ project, pins: projectPins });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shared project" });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  app.post("/api/uploads/image", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      const ext = path.extname(req.file.originalname) || ".jpg";
      const objectId = `${crypto.randomUUID()}${ext}`;
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";

      const fullPath = privateDir.startsWith("/") ? privateDir : `/${privateDir}`;
      const pathParts = fullPath.split("/").filter(Boolean);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/") + `/uploads/${objectId}`;

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        resumable: false,
      });

      const publicUrl = `/objects/uploads/${objectId}`;
      res.json({ url: publicUrl, filename: objectId });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.get("/api/image-proxy", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl || !imageUrl.startsWith("https://")) {
        return res.status(400).json({ message: "Invalid URL" });
      }
      const urlObj = new URL(imageUrl);
      if (urlObj.hostname !== "i.pinimg.com" && urlObj.hostname !== "pinimg.com") {
        return res.status(403).json({ message: "Domain not allowed" });
      }
      if (!/^\/(originals|orig|\d+x)\//.test(urlObj.pathname)) {
        return res.status(403).json({ message: "Image path not allowed" });
      }
      const { buffer, contentType } = await fetchRemoteImage(imageUrl, 15000);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch {
      res.status(500).json({ message: "Failed to proxy image" });
    }
  });

  app.post("/api/admin/login", authRateLimit("admin-login", 12), async (req, res) => {
    try {
      const { email, password } = req.body;
      if (ADMIN_CREDENTIALS.password && email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        const token = generateAdminToken();
        adminSessions.set(token, { email, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        res.cookie("adminToken", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
        return res.json({ success: true, token });
      }
      return res.status(401).json({ message: "Invalid credentials" });
    } catch {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (_req, res) => {
    const token = (_req as any).cookies?.adminToken;
    if (token) adminSessions.delete(token);
    res.clearCookie("adminToken");
    res.json({ success: true });
  });

  app.get("/api/admin/check", async (req: any, res) => {
    try {
      const token = req.headers["x-admin-token"] as string || req.cookies?.adminToken;
      if (token) {
        const session = adminSessions.get(token);
        if (session && session.expiresAt >= Date.now()) {
          return res.json({ isAdmin: true, email: session.email });
        }
      }
      res.json({ isAdmin: false });
    } catch {
      res.json({ isAdmin: false });
    }
  });

  app.get("/api/admin/stats", isAdmin, async (_req, res) => {
    try {
      const totalUsers = await storage.getUserCount();
      const trialUsers = await storage.getUserCountByTier("trial");
      const liteUsers = await storage.getUserCountByTier("studio_lite");
      const proUsers = await storage.getUserCountByTier("studio_pro");
      const allProjects = await storage.getAllProjects();
      const txStats = await storage.getTransactionStats();
      const allCodes = await storage.getAllAffiliateCodes();
      const totalClicks = allCodes.reduce((s, c) => s + (c.clicks || 0), 0);
      const totalSignups = allCodes.reduce((s, c) => s + (c.signups || 0), 0);
      const totalConversions = allCodes.reduce((s, c) => s + (c.conversions || 0), 0);

      res.json({
        users: { total: totalUsers, trial: trialUsers, lite: liteUsers, pro: proUsers },
        projects: { total: allProjects.length },
        finance: txStats,
        affiliate: { totalCodes: allCodes.length, totalClicks, totalSignups, totalConversions },
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", isAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allProjects = await storage.getAllProjects();
      const usersWithDetails = allUsers.map(user => {
        const userProjects = allProjects.filter(p => p.userId === user.id);
        const clients = userProjects
          .filter(p => p.clientCompany || p.clientOwnerName || p.clientEmail)
          .map(p => ({
            projectId: p.id,
            projectName: p.title,
            clientCompany: p.clientCompany,
            clientOwnerName: p.clientOwnerName,
            clientPhone: p.clientPhone,
            clientEmail: p.clientEmail,
          }));
        return {
          ...user,
          projectCount: userProjects.length,
          clientCount: clients.length,
          clients,
        };
      });
      res.json(usersWithDetails);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users/:id/activation", isAdminSession, async (req, res) => {
    try {
      const email = z.string().trim().email().max(254).optional().parse(req.body?.email);
      const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
      const result = await issueActivationLink(String(req.params.id), email, siteUrl);
      res.set("Cache-Control", "no-store").json(result);
    } catch (error: any) {
      res.status(error.status || (error.name === "ZodError" ? 400 : 500)).json({ message: error.status ? error.message : "Unable to create an activation link. Check the account email." });
    }
  });

  app.patch("/api/admin/users/:id/extend-trial", isAdmin, async (req, res) => {
    try {
      const { days } = req.body;
      const daysToAdd = parseInt(days) || 7;
      const user = await storage.getUser((req.params.id as string));
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentExpiry = user.trialExpiresAt || new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + daysToAdd);

      const updated = await storage.updateUser(user.id, { trialExpiresAt: newExpiry });
      res.json(updated);
    } catch (error) {
      console.error("Extend trial error:", error);
      res.status(500).json({ message: "Failed to extend trial" });
    }
  });

  app.patch("/api/admin/users/:id/subscription", isAdmin, async (req, res) => {
    try {
      const { subscriptionTier } = req.body;
      const user = await storage.getUser((req.params.id as string));
      if (!user) return res.status(404).json({ message: "User not found" });
      const updated = await storage.updateUser(user.id, { subscriptionTier });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.get("/api/admin/finance", isAdmin, async (_req, res) => {
    try {
      const txs = await storage.getTransactions();
      const stats = await storage.getTransactionStats();
      res.json({ transactions: txs, stats });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch finance data" });
    }
  });

  app.get("/api/admin/settings", isAdmin, async (_req, res) => {
    try {
      const settings = await storage.getAllAdminSettings();
      const settingsMap: Record<string, string> = {};
      settings.forEach(s => { settingsMap[s.settingKey] = s.settingValue || ""; });
      res.json(settingsMap);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/admin/settings/:key", isAdmin, async (req, res) => {
    try {
      const value = await storage.getAdminSetting((req.params.key as string));
      res.json({ value: value || "" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.put("/api/admin/settings", isAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ message: "Key required" });
      const setting = await storage.setAdminSetting(key, value || "");
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.get("/api/admin/export/users", isAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const csvHeader = "ID,Email,First Name,Last Name,WhatsApp,Company,Subscription,Trial Expires,Created At\n";
      const csvRows = allUsers.map(u =>
        `"${u.id}","${u.email || ""}","${u.firstName || ""}","${u.lastName || ""}","${u.whatsappNumber || ""}","${u.companyName || ""}","${u.subscriptionTier || "trial"}","${u.trialExpiresAt || ""}","${u.createdAt || ""}"`
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=users_export.csv");
      res.send(csvHeader + csvRows);
    } catch (error) {
      res.status(500).json({ message: "Failed to export users" });
    }
  });

  app.get("/api/admin/export/clients", isAdmin, async (_req, res) => {
    try {
      const allProjects = await storage.getAllProjects();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const clientRows = allProjects
        .filter(p => p.clientCompany || p.clientOwnerName || p.clientEmail)
        .map(p => {
          const owner = userMap.get(p.userId);
          return `"${owner?.email || ""}","${owner?.companyName || owner?.firstName || ""}","${p.title}","${p.clientCompany || ""}","${p.clientOwnerName || ""}","${p.clientPhone || ""}","${p.clientEmail || ""}"`;
        });
      const csvHeader = "User Email,User Company,Project Name,Client Company,Client Name,Client Phone,Client Email\n";
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=clients_export.csv");
      res.send(csvHeader + clientRows.join("\n"));
    } catch (error) {
      res.status(500).json({ message: "Failed to export clients" });
    }
  });

  app.get("/api/admin/affiliate/codes", isAdmin, async (_req, res) => {
    try {
      const codes = await storage.getAllAffiliateCodes();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const codesWithUsers = codes.map(c => ({
        ...c,
        userName: userMap.get(c.userId)?.firstName || userMap.get(c.userId)?.email || "Unknown",
        userEmail: userMap.get(c.userId)?.email || "",
      }));
      res.json(codesWithUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch affiliate codes" });
    }
  });

  app.post("/api/admin/affiliate/codes", isAdmin, async (req: any, res) => {
    try {
      const { code, label } = req.body;
      if (!code || code.length < 3) {
        return res.status(400).json({ message: "Code must be at least 3 characters" });
      }
      const existing = await storage.getAffiliateCodeByCode(code.toUpperCase());
      if (existing) {
        return res.status(409).json({ message: "Code already taken" });
      }
      const adminId = getUserId(req);
      const created = await storage.createAffiliateCode({
        userId: adminId,
        code: code.toUpperCase(),
        label: label || null,
      });
      res.json(created);
    } catch (error) {
      res.status(500).json({ message: "Failed to create affiliate code" });
    }
  });

  app.delete("/api/admin/affiliate/codes/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteAffiliateCode(parseInt((req.params.id as string)));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete affiliate code" });
    }
  });

  app.get("/api/admin/affiliate/banners", isAdmin, async (_req, res) => {
    try {
      const banners = await storage.getAffiliateBanners();
      res.json(banners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  app.post("/api/admin/affiliate/banners", isAdmin, async (req, res) => {
    try {
      const banner = await storage.createAffiliateBanner(req.body);
      res.json(banner);
    } catch (error) {
      res.status(500).json({ message: "Failed to create banner" });
    }
  });

  app.patch("/api/admin/affiliate/banners/:id", isAdmin, async (req, res) => {
    try {
      const updated = await storage.updateAffiliateBanner(parseInt((req.params.id as string)), req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update banner" });
    }
  });

  app.delete("/api/admin/affiliate/banners/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteAffiliateBanner(parseInt((req.params.id as string)));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete banner" });
    }
  });

  app.get("/api/affiliate/track/:code", async (req, res) => {
    try {
      const { code } = req.params;
      await storage.incrementAffiliateClicks(code.toUpperCase());
      res.redirect(`/?ref=${encodeURIComponent(code.toUpperCase())}`);
    } catch {
      res.redirect("/");
    }
  });

  app.get("/api/affiliate/banners", async (_req, res) => {
    try {
      const banners = await storage.getAffiliateBanners(true);
      res.json(banners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  app.get("/api/affiliate/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const codes = await storage.getAffiliateCodesByUser(userId);
      const feePct = await storage.getAdminSetting("affiliate_fee_percentage");
      if (codes.length === 0) {
        return res.json({ code: null, stats: null, feePercentage: feePct || "10" });
      }
      const code = codes[0];
      const referrals = await storage.getAffiliateReferralsByCode(code.id);
      res.json({
        code,
        stats: {
          clicks: code.clicks || 0,
          signups: code.signups || 0,
          conversions: code.conversions || 0,
          referrals: referrals.length,
        },
        feePercentage: feePct || "10",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch affiliate info" });
    }
  });

  app.post("/api/affiliate/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const existing = await storage.getAffiliateCodesByUser(userId);
      if (existing.length > 0) {
        return res.json(existing[0]);
      }
      const label = typeof req.body.label === "string" ? req.body.label.trim() : "My Affiliate Code";
      const claims = req.dbUser;
      const userName = ((claims?.firstName as string | undefined) || (claims?.email as string | undefined) || "user").toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
      let newCode = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const codeStr = `${userName}${suffix}`;
        const existingCode = await storage.getAffiliateCodeByCode(codeStr);
        if (!existingCode) {
          newCode = await storage.createAffiliateCode({
            userId,
            code: codeStr,
            label: label || "My Affiliate Code",
            isActive: true,
          });
          break;
        }
      }
      if (!newCode) {
        return res.status(500).json({ message: "Failed to generate unique code, please try again" });
      }
      res.json(newCode);
    } catch (error) {
      res.status(500).json({ message: "Failed to create affiliate code" });
    }
  });

  app.get("/api/admin/chat-widget", async (_req, res) => {
    try {
      const script = await storage.getAdminSetting("chat_widget_script");
      res.json({ script: script || "" });
    } catch {
      res.json({ script: "" });
    }
  });

  app.get("/sitemap.xml", (req, res) => {
    const baseUrl = "https://moodboard.co.id";
    const pages = [
      { loc: "/", priority: "1.0", changefreq: "weekly" },
      { loc: "/blog", priority: "0.8", changefreq: "weekly" },
      { loc: "/faq", priority: "0.6", changefreq: "monthly" },
      { loc: "/contact", priority: "0.6", changefreq: "monthly" },
      { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
      { loc: "/terms", priority: "0.3", changefreq: "yearly" },
      { loc: "/login", priority: "0.5", changefreq: "monthly" },
    ];
    const blogSlugs = [
      "moodboard-presentasi-profesional",
      "pinterest-moodboard-instan",
      "perbandingan-platform-moodboard",
      "tips-presentasi-desain-interior",
      "moodboard-arsitektur-modern",
    ];
    const now = new Date().toISOString().split("T")[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const p of pages) {
      xml += `  <url>\n    <loc>${baseUrl}${p.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
    }
    for (const slug of blogSlugs) {
      xml += `  <url>\n    <loc>${baseUrl}/blog/${slug}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }
    xml += `</urlset>`;
    res.set("Content-Type", "application/xml");
    res.send(xml);
  });

  app.get("/robots.txt", (req, res) => {
    const txt = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /editor/\nDisallow: /profile\n\nSitemap: https://moodboard.co.id/sitemap.xml`;
    res.set("Content-Type", "text/plain");
    res.send(txt);
  });

  app.post("/api/payment/create", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const claims = req.dbUser;

      const { plan } = req.body as { plan: "lite" | "pro" };
      if (!plan || !["lite", "pro"].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan. Use 'lite' or 'pro'" });
      }

      const serverKey = await storage.getAdminSetting("payment_gateway_secret_key");
      const env = (await storage.getAdminSetting("payment_gateway_env")) || "sandbox";

      if (!serverKey) {
        return res.status(503).json({ message: "Payment gateway is not configured. Please contact the administrator." });
      }

      const planMeta = {
        lite: { name: "Studio Lite", amount: 88000, tier: "lite" },
        pro: { name: "Studio Pro", amount: 176000, tier: "pro" },
      }[plan];

      const orderId = `MOODBOARD-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`;

      const tx = await storage.createTransaction({
        userId,
        amount: planMeta.amount,
        currency: "IDR",
        status: "pending",
        paymentMethod: "12pay",
        gatewayTransactionId: orderId,
        description: `${planMeta.name} subscription`,
        metadata: { plan, tier: planMeta.tier },
      });

      const baseUrl = env === "production"
        ? "https://api.12pay.co.id"
        : "https://sandbox.12pay.co.id";

      const credential = Buffer.from(`${serverKey}:`).toString("base64");
      const siteUrl = (process.env.SITE_URL || `https://${req.get("host")}`).replace(/\/$/, "");
      const callbackUrl = `${siteUrl}/api/payment/webhook`;
      const returnUrl = `${siteUrl}/dashboard?payment=success`;

      const payload = {
        payment_type: "all",
        transaction_details: {
          order_id: orderId,
          gross_amount: planMeta.amount,
        },
        item_details: [{
          id: plan,
          price: planMeta.amount,
          quantity: 1,
          name: `${planMeta.name} — 1 Month`,
        }],
        customer_details: {
          first_name: (claims?.firstName as string | undefined) || "",
          last_name: (claims?.lastName as string | undefined) || "",
          email: (claims?.email as string | undefined) || "",
          phone: user.whatsappNumber || "",
        },
        callbacks: {
          finish: returnUrl,
          error: `${siteUrl}/dashboard?payment=failed`,
          pending: returnUrl,
        },
        notification_url: callbackUrl,
      };

      const response = await fetch(`${baseUrl}/v1/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${credential}`,
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("12Pay payment creation error:", response.status, errBody);
        await storage.updateTransaction(tx.id, { status: "failed" });
        return res.status(502).json({ message: "Payment gateway returned an error. Please try again." });
      }

      interface TwelvePayGatewayResponse {
        payment_url?: string;
        redirect_url?: string;
        token?: string;
        status_code?: string;
        status_message?: string;
      }
      const data = await response.json() as TwelvePayGatewayResponse;
      const paymentUrl = data.payment_url || data.redirect_url || data.token;

      if (!paymentUrl) {
        console.error("12Pay: no payment_url in response", data);
        await storage.updateTransaction(tx.id, { status: "failed" });
        return res.status(502).json({ message: "Could not get payment URL from gateway." });
      }

      res.json({ paymentUrl, orderId, transactionId: tx.id });
    } catch (error) {
      console.error("Payment create error:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.get("/api/payment/transactions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const txs = await storage.getTransactionsByUser(userId);
      res.json(txs);
    } catch (error) {
      console.error("Get transactions error:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/payment/webhook", async (req, res) => {
    try {
      console.log("12Pay webhook received:", JSON.stringify(req.body));
      const { order_id, transaction_status, fraud_status, signature_key, gross_amount, status_code } = req.body || {};

      if (!order_id) return res.json({ received: true });

      const serverKey = await storage.getAdminSetting("payment_gateway_secret_key");
      if (serverKey) {
        if (!signature_key) {
          console.warn("12Pay webhook: missing signature for order", order_id);
          return res.status(403).json({ message: "Missing signature" });
        }
        const crypto = await import("crypto");
        const expectedSig = crypto.createHash("sha512")
          .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
          .digest("hex");
        if (expectedSig !== signature_key) {
          console.warn("12Pay webhook: invalid signature for order", order_id);
          return res.status(403).json({ message: "Invalid signature" });
        }
      }

      const tx = await storage.getTransactionByGatewayId(order_id);
      if (!tx) {
        console.warn("12Pay webhook: transaction not found for order", order_id);
        return res.json({ received: true });
      }

      const isSuccess = transaction_status === "settlement" || transaction_status === "capture" || transaction_status === "success";
      const isFailed = transaction_status === "deny" || transaction_status === "cancel" || transaction_status === "expire" || transaction_status === "failure";
      const isFraud = fraud_status === "deny";

      if (isSuccess && !isFraud) {
        await storage.updateTransaction(tx.id, { status: "completed" });
        const meta = tx.metadata as { plan?: string; tier?: string } | null;
        const tier = meta?.tier || "lite";
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        await storage.updateUser(tx.userId, {
          subscriptionTier: tier,
          trialExpiresAt: expiresAt,
        });
        console.log(`12Pay: user ${tx.userId} upgraded to ${tier} via order ${order_id}`);
      } else if (isFailed || isFraud) {
        await storage.updateTransaction(tx.id, { status: "failed" });
        console.log(`12Pay: payment failed for order ${order_id} (${transaction_status})`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Payment webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  return httpServer;
}
