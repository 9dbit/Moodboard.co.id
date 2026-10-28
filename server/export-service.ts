import type { Express } from "express";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { pool } from "./db";
import { storage } from "./storage";
import { assetPath, canUserReadAsset } from "./assets";
import { fetchRemoteImage } from "./image-recovery";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { renderMoodboardPdf, type ExportSnapshot } from "./export-renderer";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "./replit_integrations/object_storage/s3Storage";

type ExportArguments = { projectId: number; paperSize?: "A4" | "A3" | "A2"; orientation?: "horizontal" | "vertical"; idempotencyKey?: string };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
let lastCleanup = 0;
const validId = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export class ExportServiceError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ExportServiceError"; }
}

export async function initializeExportSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS export_jobs (
      id uuid PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      idempotency_key varchar(160) NOT NULL, input_hash varchar(64) NOT NULL,
      status varchar(12) NOT NULL DEFAULT 'queued', snapshot jsonb NOT NULL,
      completed integer NOT NULL DEFAULT 0, total integer NOT NULL, attempts integer NOT NULL DEFAULT 0,
      lease_until timestamptz, object_key text, filename text, page_count integer, byte_size integer, error text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', UNIQUE(user_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS export_jobs_queue_idx ON export_jobs(status,created_at);
    CREATE TABLE IF NOT EXISTS export_download_tokens (
      token_hash varchar(64) PRIMARY KEY, job_id uuid NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS export_tokens_expiry_idx ON export_download_tokens(expires_at);
  `);
}

function origin() {
  const url = new URL(process.env.SITE_URL || `http://localhost:${process.env.PORT || 5000}`);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("SITE_URL must be HTTPS for export downloads.");
  return url.origin;
}
function jobView(row: any) {
  return {
    id: row.id, projectId: row.project_id, status: row.status,
    completed: row.completed, total: row.total,
    pageCount: row.page_count || undefined, bytes: row.byte_size || undefined,
    error: row.error || undefined, expiresAt: new Date(row.expires_at).toISOString(),
  };
}

export async function startExport(userId: string, args: ExportArguments) {
  if (!userId || !Number.isSafeInteger(args.projectId) || args.projectId < 1) throw new ExportServiceError(400, "A valid owned project is required.");
  const project = await storage.getProject(args.projectId);
  if (!project || project.userId !== userId) throw new ExportServiceError(404, "Moodboard not found.");
  new ObjectStorageService().getPrivateObjectDir();
  if (args.paperSize && !["A4", "A3", "A2"].includes(args.paperSize)) throw new ExportServiceError(400, "Invalid paper size.");
  if (args.orientation && !["horizontal", "vertical"].includes(args.orientation)) throw new ExportServiceError(400, "Invalid orientation.");
  const pins = await storage.getPinsByProject(project.id);
  if (!pins.length) throw new ExportServiceError(400, "Add at least one reference image before exporting.");
  if (pins.length > 500) throw new ExportServiceError(413, "Server exports support up to 500 references. Split this board before exporting; no partial PDF was created.");
  const key = args.idempotencyKey || randomUUID();
  if (typeof key !== "string" || key.length < 1 || key.length > 160) throw new ExportServiceError(400, "Invalid export idempotency key.");
  const inputHash = hash(JSON.stringify({ projectId: project.id, paperSize: args.paperSize, orientation: args.orientation }));
  const client = await pool.connect();
  let row: any;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`export:${userId}`]);
    const existing = await client.query("SELECT * FROM export_jobs WHERE user_id=$1 AND idempotency_key=$2", [userId, key]);
    if (existing.rows[0]) {
      row = existing.rows[0];
      if (row.input_hash !== inputHash) throw new ExportServiceError(409, "This idempotency key was already used for a different export.");
      if (new Date(row.expires_at).getTime() <= Date.now()) throw new ExportServiceError(410, "This export expired. Start another export with a new idempotency key.");
    } else {
      const active = await client.query("SELECT count(*)::int AS count FROM export_jobs WHERE user_id=$1 AND status IN ('queued','running') AND expires_at>now()", [userId]);
      if (active.rows[0].count >= 2) throw new ExportServiceError(429, "Two export jobs are already active. Wait for one to finish.");
      const snapshot: ExportSnapshot = { project: { ...project, ...(args.paperSize ? { paperSize: args.paperSize } : {}), ...(args.orientation ? { orientation: args.orientation } : {}) }, pins };
      const serializedSnapshot = JSON.stringify(snapshot);
      if (Buffer.byteLength(serializedSnapshot) > 5 * 1024 * 1024) throw new ExportServiceError(413, "Export snapshot exceeds the 5 MB limit. Split the board; no partial PDF was created.");
      const filename = `${(project.title || 'moodboard').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 90) || 'moodboard'}.pdf`;
      const inserted = await client.query(`INSERT INTO export_jobs(id,user_id,project_id,idempotency_key,input_hash,snapshot,total,filename)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [randomUUID(), userId, project.id, key, inputHash, serializedSnapshot, pins.length, filename]);
      row = inserted.rows[0];
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  void processExportQueue();
  return jobView(row);
}

export async function getExportJob(userId: string, jobId: string) {
  if (!validId(jobId)) throw new ExportServiceError(404, "Export not found.");
  const { rows } = await pool.query("SELECT j.* FROM export_jobs j JOIN projects p ON p.id=j.project_id WHERE j.id=$1 AND j.user_id=$2 AND p.user_id=$2 AND j.expires_at>now()", [jobId, userId]);
  const row = rows[0];
  if (!row) throw new ExportServiceError(404, "Export not found or expired.");
  if (row.status !== "ready") return jobView(row);
  const token = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM export_download_tokens WHERE expires_at<=now()");
  await pool.query("DELETE FROM export_download_tokens WHERE job_id=$1 AND token_hash IN (SELECT token_hash FROM export_download_tokens WHERE job_id=$1 ORDER BY created_at DESC OFFSET 19)", [jobId]);
  await pool.query("INSERT INTO export_download_tokens(token_hash,job_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')", [hash(token), jobId]);
  const download = new URL(`/exports/${jobId}`, origin());
  download.searchParams.set("token", token);
  return { ...jobView(row), downloadUrl: download.href, downloadExpiresInSeconds: 900, filename: row.filename };
}

async function readSnapshotImage(userId: string, pin: ExportSnapshot["pins"][number]) {
  const source = pin.imagePath || pin.imageUrl || "";
  const objectPath = assetPath(source);
  if (objectPath) {
    if (!await canUserReadAsset(userId, objectPath)) throw new Error("One of this board's images is unavailable or no longer authorized.");
    const file = await new ObjectStorageService().getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size || 0) > 20 * 1024 * 1024) throw new Error("One of this board's images exceeds the export input limit.");
    return (await file.download())[0];
  }
  if (!source.startsWith("https://")) throw new Error("One of this board's images needs to be uploaded or repaired before export.");
  return (await fetchRemoteImage(source, 10000)).buffer;
}

async function processExportQueue() {
  if (running) return;
  running = true;
  try {
    if (Date.now() - lastCleanup > 60 * 60 * 1000) {
      const dir = new ObjectStorageService().getPrivateObjectDir().split("/").filter(Boolean);
      const prefix = [...dir.slice(1), "exports"].join("/") + "/";
      const expired = await pool.query("SELECT id,object_key FROM export_jobs WHERE expires_at<=now() ORDER BY expires_at LIMIT 20");
      for (const row of expired.rows) {
        if (row.object_key) {
          if (!row.object_key.startsWith(prefix)) continue;
          await getS3Client().send(new DeleteObjectCommand({ Bucket: dir[0], Key: row.object_key }));
        }
        await pool.query("DELETE FROM export_jobs WHERE id=$1 AND expires_at<=now()", [row.id]);
      }
      await pool.query("DELETE FROM export_download_tokens WHERE expires_at<=now()");
      lastCleanup = expired.rows.length === 20 ? 0 : Date.now();
    }
    await pool.query("UPDATE export_jobs SET status='failed',error='Export interrupted repeatedly. Start a new export.',updated_at=now() WHERE status='running' AND lease_until<now() AND attempts>=3");
    const claimed = await pool.query(`UPDATE export_jobs SET status='running',attempts=attempts+1,lease_until=now()+interval '9 minutes',updated_at=now()
      WHERE id=(SELECT id FROM export_jobs WHERE expires_at>now() AND attempts<3 AND
        (status='queued' OR (status='running' AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
    const job = claimed.rows[0];
    if (!job) return;
    try {
      const project = await storage.getProject(job.project_id);
      if (!project || project.userId !== job.user_id) throw new Error("Moodboard access has changed. Export cancelled.");
      const deadline = Date.now() + 8 * 60 * 1000;
      const result = await renderMoodboardPdf(job.snapshot, {
        signal: AbortSignal.timeout(8 * 60 * 1000),
        readImage: pin => { if (Date.now() > deadline) throw new Error("Export timed out. Select fewer references and retry."); return readSnapshotImage(job.user_id, pin); },
        onProgress: async completed => { await pool.query("UPDATE export_jobs SET completed=$2,updated_at=now() WHERE id=$1 AND status='running' AND attempts=$3", [job.id, completed, job.attempts]); },
      });
      const privateDir = new ObjectStorageService().getPrivateObjectDir().split("/").filter(Boolean);
      const bucket = privateDir.shift()!;
      const key = [...privateDir, "exports", `${job.id}.pdf`].join("/");
      await objectStorageClient.bucket(bucket).file(key).save(result.bytes, { contentType: "application/pdf" });
      await pool.query("UPDATE export_jobs SET status='ready',object_key=$2,page_count=$3,byte_size=$4,completed=total,error=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND status='running' AND attempts=$5", [job.id, key, result.pageCount, result.bytes.length, job.attempts]);
    } catch (error) {
      const message = error instanceof Error && /^(Server exports|This PDF|Export timed out|Moodboard access|One of this board)/.test(error.message)
        ? error.message : "PDF export could not finish. Check reference images and retry; no partial PDF was published.";
      await pool.query("UPDATE export_jobs SET status='failed',error=$2,lease_until=NULL,updated_at=now() WHERE id=$1 AND status='running' AND attempts=$3", [job.id, message, job.attempts]);
    }
  } catch { console.error("Export queue could not process a job."); }
  finally { running = false; }
}

/** Durable leases permit another replica to pick up interrupted jobs. */
export function startExportWorker() {
  if (timer) return;
  timer = setInterval(() => { void processExportQueue(); }, 2000);
  timer.unref();
  void processExportQueue();
}

export function registerExportRoutes(app: Express) {
  app.get("/exports/:jobId", async (req, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!validId(String(req.params.jobId)) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return void res.status(404).json({ message: "Export link is invalid or expired." });
      const { rows } = await pool.query(`SELECT j.object_key,j.filename,j.byte_size FROM export_download_tokens t
        JOIN export_jobs j ON j.id=t.job_id JOIN projects p ON p.id=j.project_id AND p.user_id=j.user_id
        WHERE t.token_hash=$1 AND j.id=$2 AND t.expires_at>now() AND j.expires_at>now() AND j.status='ready'`, [hash(token), req.params.jobId]);
      const row = rows[0];
      if (!row) return void res.status(404).json({ message: "Export link is invalid or expired." });
      const privateDir = new ObjectStorageService().getPrivateObjectDir().split("/").filter(Boolean);
      const bucket = privateDir[0];
      const safePrefix = [...privateDir.slice(1), "exports"].join("/") + "/";
      if (!row.object_key.startsWith(safePrefix)) return void res.status(404).end();
      const file = objectStorageClient.bucket(bucket).file(row.object_key);
      const ascii = row.filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`, "Content-Length": row.byte_size, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
      const stream = file.createReadStream();
      stream.on("error", () => { if (!res.headersSent) res.status(500).end(); else res.destroy(); });
      stream.pipe(res);
    } catch { if (!res.headersSent) res.status(503).json({ message: "Export download is temporarily unavailable." }); }
  });
}
