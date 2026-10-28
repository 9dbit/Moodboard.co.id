import { Response } from "express";
import { randomUUID } from "crypto";
import sharp from "sharp";
import type { StorageFile } from "./storageFile";
import { s3StorageClient, signS3Upload, objectKeyFromS3Url } from "./s3Storage";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export const objectStorageClient = s3StorageClient;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Configure the public S3 bucket paths (comma-separated)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Configure the private S3 bucket path."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<StorageFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: StorageFile, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Authorization is checked before this method. Active uploads are never rendered.
      let contentType = (metadata.contentType || "").split(";", 1)[0].toLowerCase();
      // Older migrated images may lack a MIME header. Decode bounded bytes to keep
      // those references usable without trusting or rendering arbitrary content.
      if (!contentType || contentType === "application/octet-stream") {
        const size = Number(metadata.size || 0);
        if (!Number.isSafeInteger(size) || size <= 0 || size > 25 * 1024 * 1024) {
          res.status(415).json({ error: "Unsupported image content" }); return;
        }
        const [bytes] = await file.download();
        if (bytes.length > 25 * 1024 * 1024) { res.status(415).json({ error: "Unsupported image content" }); return; }
        try {
          const input = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
          const image = await input.metadata();
          const types: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
          if (!image.format || !types[image.format]) throw new Error("Unsupported format");
          await input.resize({ width: 1, height: 1, fit: "inside" }).raw().toBuffer();
          contentType = types[image.format];
        } catch { res.status(415).json({ error: "Unsupported image content" }); return; }
        res.set({ "Content-Type": contentType, "Content-Length": bytes.length, "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Referrer-Policy": "no-referrer" });
        res.send(bytes); return;
      }
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType)) {
        res.status(415).json({ error: "Unsupported image content" });
        return;
      }
      // Set appropriate headers
      res.set({
        "Content-Type": contentType,
        "Content-Length": metadata.size,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Configure the private S3 bucket path."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signS3Upload(bucketName, objectName);
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<StorageFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    if (entityId.split("/").some(part => part === ".." || part.includes("\\"))) {
      throw new ObjectNotFoundError();
    }
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (/^https?:\/\//.test(rawPath)) {
      const key = objectKeyFromS3Url(rawPath);
      const { objectName } = parseObjectPath(this.getPrivateObjectDir());
      const prefix = objectName.replace(/\/$/, "") + "/";
      return key?.startsWith(prefix) ? `/objects/${key.slice(prefix.length)}` : rawPath;
    }
    return rawPath;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}
