import crypto from "node:crypto";
import sharp from "sharp";
import { pool } from "./db";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { getObjectAclPolicy } from "./replit_integrations/object_storage/objectAcl";
import { deleteS3Object } from "./replit_integrations/object_storage/s3Storage";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export class AssetError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function initializeAssetSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73195024)");
    await client.query(`CREATE TABLE IF NOT EXISTS asset_upload_intents (
      id uuid PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash varchar(64) NOT NULL, declared_size integer NOT NULL, content_type text NOT NULL,
      expires_at timestamptz NOT NULL, consumed_at timestamptz
    ); CREATE INDEX IF NOT EXISTS asset_upload_intents_expiry_idx ON asset_upload_intents(expires_at)`);
    await client.query("DELETE FROM asset_upload_intents WHERE expires_at < now() - interval '1 day'");
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

/** Canonicalize references before an ownership check; encoded traversal is never an asset ID. */
export function assetPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let pathname = value.split(/[?#]/, 1)[0];
  if (/^https?:\/\//i.test(value)) {
    try { pathname = new URL(value).pathname; } catch { return null; }
  }
  if (!pathname.startsWith("/objects/")) return null;
  try { pathname = decodeURIComponent(pathname); } catch { throw new AssetError(400, "Invalid asset path"); }
  if (pathname.length > 600 || /[\\\0%?#]/.test(pathname) || pathname.split("/").slice(1).some(p => p === ".." || p === "." || !p)) {
    throw new AssetError(400, "Invalid asset path");
  }
  if (!/^\/objects\/uploads\/[A-Za-z0-9][A-Za-z0-9_./ -]*$/.test(pathname)) throw new AssetError(400, "Unsupported asset path");
  return pathname;
}

export function requireUploadMetadata(body: unknown): { name: string; size: number; contentType: string } {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.name !== "string" || !b.name.trim() || b.name.length > 255 ||
      typeof b.size !== "number" || !Number.isSafeInteger(b.size) || b.size <= 0 || b.size > MAX_IMAGE_UPLOAD_BYTES ||
      typeof b.contentType !== "string" || !IMAGE_UPLOAD_TYPES.has(b.contentType)) {
    throw new AssetError(400, "Choose a JPEG, PNG, WebP or GIF image of at most 10 MB");
  }
  return { name: b.name.trim(), size: b.size, contentType: b.contentType };
}

export async function normalizeImageUpload(buffer: Buffer, declaredType?: string) {
  if (!buffer.length || buffer.length > MAX_IMAGE_UPLOAD_BYTES) throw new AssetError(413, "Image exceeds the 10 MB upload limit");
  if (declaredType && !IMAGE_UPLOAD_TYPES.has(declaredType)) throw new AssetError(415, "Unsupported image type");
  try {
    const input = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error", animated: false });
    const metadata = await input.metadata();
    const types: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    if (!metadata.format || !types[metadata.format] || declaredType && types[metadata.format] !== declaredType) {
      throw new AssetError(415, "Image bytes do not match an allowed image format");
    }
    const result = await input.rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92 }).toBuffer({ resolveWithObject: true });
    if (result.data.length > MAX_IMAGE_UPLOAD_BYTES) throw new AssetError(413, "Normalized image exceeds the upload limit");
    return { buffer: result.data, contentType: "image/webp", width: result.info.width, height: result.info.height };
  } catch (error) {
    if (error instanceof AssetError) throw error;
    throw new AssetError(422, "Image could not be decoded; choose a valid JPEG, PNG, WebP or GIF");
  }
}

async function saveOwnedImage(userId: string, buffer: Buffer, declaredType: string | undefined, id: string) {
  const normalized = await normalizeImageUpload(buffer, declaredType);
  const dir = new ObjectStorageService().getPrivateObjectDir().split("/").filter(Boolean);
  if (dir.length < 2) throw new Error("Private object storage is not configured");
  const filename = `${id}.webp`;
  const file = objectStorageClient.bucket(dir[0]).file(`${dir.slice(1).join("/")}/uploads/${filename}`);
  await file.save(normalized.buffer, { contentType: normalized.contentType, metadata: {
    "custom:aclPolicy": JSON.stringify({ owner: userId, visibility: "private" }),
    "moodboard:validated-image": "v1",
  } });
  return { url: `/objects/uploads/${filename}`, filename, contentType: normalized.contentType, width: normalized.width, height: normalized.height };
}

/** Shared entry point for browser and MCP ingestion. Caller supplies the verified principal. */
export async function ingestOwnedImage(userId: string, buffer: Buffer, declaredType?: string) {
  if (!userId) throw new AssetError(401, "Authentication required");
  return saveOwnedImage(userId, buffer, declaredType, crypto.randomUUID());
}

/** Cleanup only fresh objects issued to this principal; legacy untagged assets are never deleted here. */
export async function deleteOwnedAsset(userId: string, pathname: string) {
  const canonical = assetPath(pathname);
  if (!canonical || !userId) throw new AssetError(403, "Asset cleanup is not authorized");
  const service = new ObjectStorageService();
  const file = await service.getObjectEntityFile(canonical);
  const [metadata] = await file.getMetadata();
  if ((await getObjectAclPolicy(file))?.owner !== userId || metadata.metadata?.["moodboard:validated-image"] !== "v1") {
    throw new AssetError(403, "Asset cleanup is not authorized");
  }
  const dir = service.getPrivateObjectDir().split("/").filter(Boolean);
  await deleteS3Object(dir[0], `${dir.slice(1).join("/")}/${canonical.slice("/objects/".length)}`);
}

export async function createUploadIntent(userId: string, metadata: unknown) {
  const { name, size, contentType } = requireUploadMetadata(metadata);
  const id = crypto.randomUUID();
  const ticket = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query("INSERT INTO asset_upload_intents(id,user_id,token_hash,declared_size,content_type,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
    [id, userId, crypto.createHash("sha256").update(ticket).digest("hex"), size, contentType, expiresAt]);
  return { id, ticket, objectPath: `/objects/uploads/${id}.webp`, metadata: { name, size, contentType } };
}

export async function consumeUploadIntent(userId: string, id: string, ticket: string, buffer: Buffer, contentType: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{64}$/.test(ticket)) throw new AssetError(404, "Upload intent not found");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM asset_upload_intents WHERE id=$1 AND user_id=$2 AND token_hash=$3 AND expires_at>now() FOR UPDATE",
      [id, userId, crypto.createHash("sha256").update(ticket).digest("hex")]);
    const intent = rows[0];
    if (!intent) throw new AssetError(404, "Upload intent not found or expired");
    if (intent.consumed_at) throw new AssetError(409, "This upload has already completed");
    if (buffer.length !== intent.declared_size || contentType !== intent.content_type) throw new AssetError(400, "Upload does not match the declared image");
    const result = await saveOwnedImage(userId, buffer, intent.content_type, id);
    await client.query("UPDATE asset_upload_intents SET consumed_at=now() WHERE id=$1", [id]);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

const referenceSql = `EXISTS(SELECT 1 FROM projects p WHERE p.user_id=$1 AND
  (regexp_replace(split_part(coalesce(p.studio_logo_path,''),'?',1),'^https?://[^/]+','')=$2 OR EXISTS(
    SELECT 1 FROM pins x WHERE x.project_id=p.id AND
    (regexp_replace(split_part(coalesce(x.image_path,''),'?',1),'^https?://[^/]+','')=$2 OR
     regexp_replace(split_part(coalesce(x.image_url,''),'?',1),'^https?://[^/]+','')=$2))))`;

export async function canUserReadAsset(userId: string, pathname: string): Promise<boolean> {
  const canonical = assetPath(pathname);
  if (!canonical || !userId) return false;
  const file = await new ObjectStorageService().getObjectEntityFile(canonical);
  const policy = await getObjectAclPolicy(file);
  if (policy) return policy.visibility === "public" || policy.owner === userId;
  // Migrated assets have no ownership metadata; original project references remain authoritative.
  const { rows } = await pool.query(`SELECT ${referenceSql} AS allowed`, [userId, canonical]);
  return rows[0]?.allowed === true;
}

/** Prevents attaching a known foreign asset URL as a way to manufacture ownership. */
export async function assertOwnedAssetReferences(userId: string, data: Record<string, unknown>) {
  for (const field of ["studioLogoPath", "imagePath", "imageUrl"]) {
    const pathname = assetPath(data[field]);
    if (pathname && !await canUserReadAsset(userId, pathname)) throw new AssetError(403, "This image does not belong to your account");
  }
}

export async function canReadSharedAsset(pathname: string, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) return false;
  const canonical = assetPath(pathname);
  if (!canonical) return false;
  const { rows } = await pool.query(`SELECT p.user_id FROM projects p WHERE p.share_token=$1
    AND (p.share_expires_at IS NULL OR p.share_expires_at>now()) AND
    (regexp_replace(split_part(coalesce(p.studio_logo_path,''),'?',1),'^https?://[^/]+','')=$2 OR EXISTS(
      SELECT 1 FROM pins x WHERE x.project_id=p.id AND
      (regexp_replace(split_part(coalesce(x.image_path,''),'?',1),'^https?://[^/]+','')=$2 OR
       regexp_replace(split_part(coalesce(x.image_url,''),'?',1),'^https?://[^/]+','')=$2))) LIMIT 1`, [token, canonical]);
  if (!rows[0]?.user_id) return false;
  const file = await new ObjectStorageService().getObjectEntityFile(canonical);
  const policy = await getObjectAclPolicy(file);
  return !policy || policy.visibility === "public" || policy.owner === rows[0].user_id;
}

export async function mayReadAsset(pathname: string, userId?: string, shareToken?: string): Promise<boolean> {
  if (userId && await canUserReadAsset(userId, pathname)) return true;
  if (shareToken && await canReadSharedAsset(pathname, shareToken)) return true;
  // Explicitly public legacy assets retain their public contract. Missing/private ACLs do not.
  const canonical = assetPath(pathname);
  if (!canonical) return false;
  const file = await new ObjectStorageService().getObjectEntityFile(canonical);
  return (await getObjectAclPolicy(file))?.visibility === "public";
}

export function sharedAssetUrl(value: unknown, token: string) {
  const pathname = assetPath(value);
  return pathname ? `${pathname}?share=${encodeURIComponent(token)}` : value;
}

export function publicSharedBoard(project: Record<string, any>, pins: Array<Record<string, any>>, token: string) {
  const projectFields = ["id", "title", "studioName", "studioLogoPath", "designerName", "projectName", "descriptionAi",
    "descriptionEnabled", "clientCompany", "clientOwnerName", "showFooter", "paperSize", "orientation", "imageLayout", "gridColumns",
    "descriptionFontSize", "fontFamily", "signatureField", "pageDescriptions", "canvasBackground", "coverImageStyle", "showCover",
    "coverTitleColor", "coverDescColor", "coverTitleWeight", "coverTitleTransform", "createdAt"];
  const pinFields = ["id", "imageUrl", "imagePath", "title", "descriptionAi", "descriptionCustomInput", "descriptionFinal", "descriptionEnabled",
    "width", "height", "dominantColors", "tags", "shotType", "approvalStatus", "position"];
  const safeProject = Object.fromEntries(projectFields.filter(k => k in project).map(k => [k, project[k]]));
  safeProject.studioLogoPath = sharedAssetUrl(safeProject.studioLogoPath, token);
  return { project: safeProject, pins: pins.map(pin => {
    const safe = Object.fromEntries(pinFields.filter(k => k in pin).map(k => [k, pin[k]]));
    safe.imagePath = sharedAssetUrl(safe.imagePath, token);
    safe.imageUrl = sharedAssetUrl(safe.imageUrl, token);
    return safe;
  }) };
}
