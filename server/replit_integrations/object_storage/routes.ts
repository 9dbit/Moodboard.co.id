import express, { type Express } from "express";
import crypto from "node:crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { requireAuth } from "../../middlewares/requireAuth";
import { AssetError, assetPath, createUploadIntent, consumeUploadIntent, mayReadAsset, MAX_IMAGE_UPLOAD_BYTES } from "../../assets";

/** Existing uploadURL/objectPath clients now upload through validated image ingestion. */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();
  app.post("/api/uploads/request-url", requireAuth, async (req, res, next) => {
    try {
      const intent = await createUploadIntent(req.dbUser!.id, req.body);
      const uploadURL = `${req.protocol}://${req.get("host")}/api/uploads/direct/${intent.id}?ticket=${intent.ticket}`;
      res.set("Cache-Control", "no-store");
      res.json({ uploadURL, objectPath: intent.objectPath, metadata: intent.metadata });
    } catch (error) {
      if (error instanceof AssetError) return void res.status(error.status).json({ message: error.message });
      next(error);
    }
  });

  app.put("/api/uploads/direct/:id", requireAuth,
    express.raw({ type: () => true, limit: MAX_IMAGE_UPLOAD_BYTES }), async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body)) throw new AssetError(400, "Image bytes are required");
      const result = await consumeUploadIntent(req.dbUser!.id, String(req.params.id),
        typeof req.query.ticket === "string" ? req.query.ticket : "", req.body,
        (req.get("content-type") || "").split(";", 1)[0].toLowerCase());
      res.set({ ETag: `"${crypto.createHash("sha256").update(result.url).digest("hex")}"`, "Cache-Control": "no-store" });
      res.json(result);
    } catch (error) {
      if (error instanceof AssetError) return void res.status(error.status).json({ message: error.message });
      next(error);
    }
  });

  app.get(/^\/objects\/(.+)/, async (req, res, next) => {
    try {
      const canonical = assetPath(req.path);
      if (!canonical || !await mayReadAsset(canonical, req.dbUser?.id,
        typeof req.query.share === "string" ? req.query.share : undefined)) {
        return void res.status(404).json({ error: "Object not found" });
      }
      const file = await objectStorageService.getObjectEntityFile(canonical);
      await objectStorageService.downloadObject(file, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError || error instanceof AssetError) {
        return void res.status(404).json({ error: "Object not found" });
      }
      next(error);
    }
  });
}
