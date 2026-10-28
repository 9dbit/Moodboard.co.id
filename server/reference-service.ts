import { z } from "zod";
import sharp from "sharp";
import { pool } from "./db";
import { hashToken } from "./auth-crypto";
import { assetPath, canUserReadAsset } from "./assets";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { fetchRemoteImage } from "./image-recovery";

export class ReferenceServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const referencePatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  descriptionFinal: z.string().max(6000).optional(),
  descriptionEnabled: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Provide at least one reference change");
const selectedColumns = "x.id,x.project_id,x.title,x.description_final,x.description_ai,x.description_custom_input,x.description_enabled,x.position,x.width,x.height,x.image_path,x.image_url";
function state(pin: any) {
  return {
    title: String(pin.title || ""),
    caption: String(pin.descriptionFinal ?? pin.description_final ?? pin.caption ?? "") || String(pin.descriptionAi ?? pin.description_ai ?? "") || String(pin.descriptionCustomInput ?? pin.description_custom_input ?? ""),
    enabled: pin.descriptionEnabled ?? pin.description_enabled ?? true,
    position: Number(pin.position || 0),
  };
}
/** Hash only the editable reference state exposed by get_moodboard. */
export function getReferenceVersion(pin: unknown) { return hashToken(JSON.stringify(state(pin))); }
function view(pin: any) {
  const normalized = state(pin);
  return { id: pin.id, projectId: pin.project_id ?? pin.projectId, title: normalized.title,
    caption: normalized.caption, descriptionEnabled: normalized.enabled, position: normalized.position,
    version: getReferenceVersion(pin), width: pin.width || undefined, height: pin.height || undefined };
}
function validateIds(userId: string, projectId: number, pinId: number) {
  if (!userId || !Number.isSafeInteger(projectId) || projectId < 1 || !Number.isSafeInteger(pinId) || pinId < 1) {
    throw new ReferenceServiceError(404, "Reference not found");
  }
}

export async function viewReferenceImage(userId: string, projectId: number, pinId: number) {
  validateIds(userId, projectId, pinId);
  const { rows } = await pool.query(`SELECT ${selectedColumns} FROM pins x JOIN projects p ON p.id=x.project_id WHERE p.id=$1 AND p.user_id=$2 AND x.id=$3`, [projectId, userId, pinId]);
  const pin = rows[0];
  if (!pin) throw new ReferenceServiceError(404, "Reference not found");
  const source = pin.image_path || pin.image_url || "";
  const local = assetPath(source);
  let bytes: Buffer;
  if (local) {
    if (!await canUserReadAsset(userId, local)) throw new ReferenceServiceError(404, "Reference image is unavailable");
    const file = await new ObjectStorageService().getObjectEntityFile(local);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size || 0) > 20 * 1024 * 1024) throw new ReferenceServiceError(413, "Repair this large image in the website before viewing it");
    bytes = (await file.download())[0];
  } else {
    if (!source.startsWith("https://")) throw new ReferenceServiceError(422, "Upload or repair this reference image in the website first");
    try { bytes = (await fetchRemoteImage(source, 10000)).buffer; }
    catch { throw new ReferenceServiceError(422, "Reference image could not be fetched safely; upload or repair it in the website"); }
  }
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new ReferenceServiceError(413, "Image exceeds the preview input limit");
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error", animated: false }).metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif", "avif"].includes(metadata.format)) throw new Error("Unsupported image bytes");
    const image = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error", animated: false }).rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (image.data.length > 2 * 1024 * 1024) throw new Error("Preview output too large");
    return { reference: { ...view(pin), width: image.info.width, height: image.info.height },
      image: { type: "image" as const, mimeType: "image/jpeg" as const, data: image.data.toString("base64") } };
  } catch { throw new ReferenceServiceError(422, "Reference image bytes could not be decoded as a supported raster image"); }
}

export async function updateReference(userId: string, projectId: number, pinId: number, expectedVersion: string, patch: unknown) {
  validateIds(userId, projectId, pinId);
  if (!/^[a-f0-9]{64}$/.test(expectedVersion)) throw new ReferenceServiceError(400, "Read the current reference version before editing");
  const fields = referencePatchSchema.parse(patch);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const project = (await client.query("SELECT id FROM projects WHERE id=$1 AND user_id=$2 FOR UPDATE", [projectId, userId])).rows[0];
    if (!project) throw new ReferenceServiceError(404, "Reference not found");
    const pin = (await client.query(`SELECT ${selectedColumns} FROM pins x WHERE x.id=$1 AND x.project_id=$2 FOR UPDATE`, [pinId, projectId])).rows[0];
    if (!pin) throw new ReferenceServiceError(404, "Reference not found");
    const current = state(pin);
    const requestedAlreadyApplied = (fields.title === undefined || fields.title === current.title)
      && (fields.descriptionFinal === undefined || fields.descriptionFinal === (pin.description_final || ""))
      && (fields.descriptionEnabled === undefined || fields.descriptionEnabled === current.enabled);
    if (getReferenceVersion(pin) !== expectedVersion) {
      if (!requestedAlreadyApplied) throw new ReferenceServiceError(409, "This reference changed. Read its current version before applying edits");
      await client.query("COMMIT");
      return { reference: view(pin) };
    }
    const columns: Record<string, string> = { title: "title", descriptionFinal: "description_final", descriptionEnabled: "description_enabled" };
    const entries = Object.entries(fields);
    const changed = (await client.query(`UPDATE pins SET ${entries.map(([key], i) => `${columns[key]}=$${i + 3}`).join(",")} WHERE id=$1 AND project_id=$2 RETURNING *`, [pinId, projectId, ...entries.map(([, value]) => value)])).rows[0];
    await client.query("UPDATE projects SET updated_at=greatest(clock_timestamp(),coalesce(updated_at,clock_timestamp())+interval '1 millisecond') WHERE id=$1", [projectId]);
    await client.query("COMMIT");
    return { reference: view(changed) };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
