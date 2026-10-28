import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { pool } from "./db";
import { ImportInputError, isPinterestBoardUrl, parsePinterestUrl } from "./import-network";
export type PinterestImage = {
    imageUrl: string;
    title: string;
    sourceUrl: string;
};
export type ImportProgress = {
    status: "queued" | "scraping" | "done" | "error";
    imageCount: number;
    message: string;
    thumbnails: string[];
    cacheKey?: string;
    boardUrl?: string;
    error?: string;
};
const JOB_TTL_MS = 30 * 60 * 1000;
const leaseSeconds = 90;
export async function initializeImportSchema(database: Pool = pool): Promise<void> {
    const client = await database.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(73195023)");
        await client.query(`CREATE TABLE IF NOT EXISTS moodboard_import_jobs (
    id uuid PRIMARY KEY, owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_url text NOT NULL,status text NOT NULL DEFAULT 'queued',progress jsonb NOT NULL DEFAULT '{}',
    images jsonb,run_id uuid,attempts integer NOT NULL DEFAULT 0,lease_until timestamptz,
    expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
  ); CREATE INDEX IF NOT EXISTS moodboard_import_jobs_queue_idx ON moodboard_import_jobs(status,lease_until);
  CREATE INDEX IF NOT EXISTS moodboard_import_jobs_owner_idx ON moodboard_import_jobs(owner_id,created_at);
  CREATE TABLE IF NOT EXISTS moodboard_import_receipts (
    receipt_key varchar(64) PRIMARY KEY,owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,job_id uuid,
    pin_ids integer[] NOT NULL,total integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
  );`);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
function toPin(row: Record<string, unknown>) { return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()), v])); }
const validId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
export function sanitizeImportImages(images: PinterestImage[], boardUrl: string): PinterestImage[] {
    if (images.length > 2000)
        throw new ImportInputError("A board can import up to 2000 images at a time");
    const unique = new Map<string, PinterestImage>();
    for (const p of images) {
        let url: URL;
        try {
            url = new URL(p.imageUrl);
        }
        catch {
            continue;
        }
        if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !["i.pinimg.com", "pinimg.com"].includes(url.hostname))
            continue;
        url.hash = "";
        unique.set(url.href, { imageUrl: url.href, title: String(p.title || "").slice(0, 500), sourceUrl: boardUrl });
    }
    return [...unique.values()];
}
export class ImportJobStore {
    constructor(private readonly database: Pool = pool) { }
    private async transaction<T>(run: (c: PoolClient) => Promise<T>): Promise<T> { const c = await this.database.connect(); try {
        await c.query("BEGIN");
        const r = await run(c);
        await c.query("COMMIT");
        return r;
    }
    catch (e) {
        await c.query("ROLLBACK");
        throw e;
    }
    finally {
        c.release();
    } }
    async create(ownerId: string, boardUrl: string): Promise<string> {
        boardUrl = parsePinterestUrl(boardUrl).href;
        if (!isPinterestBoardUrl(boardUrl)) throw new ImportInputError("Choose a Pinterest board URL");
        return this.transaction(async (c) => {
            await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`moodboard-import-owner:${ownerId}`]);
            const { rows } = await c.query(`SELECT count(*) FILTER(WHERE status IN ('queued','scraping') AND expires_at>now())::int active,
        count(*) FILTER(WHERE created_at>now()-interval '5 minutes')::int recent FROM moodboard_import_jobs WHERE owner_id=$1`, [ownerId]);
            if (rows[0].active >= 2 || rows[0].recent >= 8)
                throw new ImportInputError("Too many import jobs. Wait for the existing import to finish.", 429);
            const id = randomUUID();
            await c.query("INSERT INTO moodboard_import_jobs(id,owner_id,board_url,expires_at) VALUES($1,$2,$3,$4)", [id, ownerId, boardUrl, new Date(Date.now() + JOB_TTL_MS)]);
            return id;
        });
    }
    async progress(ownerId: string, id: string): Promise<ImportProgress | null> {
        if (!validId(id))
            return null;
        const { rows } = await this.database.query("SELECT status,progress,board_url,expires_at FROM moodboard_import_jobs WHERE id=$1 AND owner_id=$2", [id, ownerId]);
        const row = rows[0];
        if (!row)
            return null;
        if (new Date(row.expires_at).getTime() <= Date.now())
            return { status: "error", imageCount: 0, message: "Import preview expired. Start a new preview.", error: "Import preview expired. Start a new preview.", thumbnails: [] };
        const progress = row.progress || {};
        return { status: row.status, imageCount: progress.imageCount || 0, message: progress.message || (row.status === "queued" ? "Waiting to import Pinterest board…" : "Import in progress…"), thumbnails: Array.isArray(progress.thumbnails) ? progress.thumbnails.slice(0, 6) : [], ...(row.status === "done" ? { cacheKey: id, boardUrl: row.board_url } : {}), ...(row.status === "error" ? { error: progress.message || "The board could not be imported. Retry or upload your reference images." } : {}) };
    }
    async claim(): Promise<{
        id: string;
        owner_id: string;
        board_url: string;
        run_id: string;
    } | null> {
        return this.transaction(async (c) => {
            await c.query("UPDATE moodboard_import_jobs SET images=NULL,progress='{}' WHERE expires_at<=now() AND images IS NOT NULL");
            await c.query("DELETE FROM moodboard_import_jobs WHERE expires_at<now()-interval '1 day'");
            await c.query("UPDATE moodboard_import_jobs SET status='error',progress='{}' WHERE status IN ('queued','scraping') AND (expires_at<=now() OR attempts>=3 AND lease_until<=now())");
            const { rows } = await c.query(`SELECT id FROM moodboard_import_jobs WHERE expires_at>now() AND attempts<3
        AND (status='queued' OR status='scraping' AND lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
            if (!rows[0])
                return null;
            const runId = randomUUID();
            const result = await c.query(`UPDATE moodboard_import_jobs SET status='scraping',run_id=$2,attempts=attempts+1,
        lease_until=now()+$3*interval '1 second',updated_at=now() WHERE id=$1 RETURNING id,owner_id,board_url,run_id`, [rows[0].id, runId, leaseSeconds]);
            return result.rows[0];
        });
    }
    async heartbeat(id: string, runId: string): Promise<void> { await this.database.query("UPDATE moodboard_import_jobs SET lease_until=now()+$3*interval '1 second',updated_at=now() WHERE id=$1 AND run_id=$2 AND status='scraping'", [id, runId, leaseSeconds]); }
    async updateProgress(id: string, runId: string, count: number, message: string, thumbs: string[]): Promise<void> { await this.database.query("UPDATE moodboard_import_jobs SET progress=$3::jsonb,updated_at=now() WHERE id=$1 AND run_id=$2 AND status='scraping'", [id, runId, JSON.stringify({ imageCount: count, message: message.slice(0, 300), thumbnails: thumbs.slice(0, 6) })]); }
    async complete(id: string, runId: string, images: PinterestImage[], boardUrl: string): Promise<void> {
        const sanitized = sanitizeImportImages(images, boardUrl);
        if (Buffer.byteLength(JSON.stringify(sanitized)) > 4 * 1024 * 1024)
            throw new ImportInputError("This preview is too large. Import a smaller board or upload selected reference images.");
        await this.database.query("UPDATE moodboard_import_jobs SET status='done',images=$3::jsonb,progress=$4::jsonb,lease_until=NULL,updated_at=now() WHERE id=$1 AND run_id=$2 AND status='scraping'", [id, runId, JSON.stringify(sanitized), JSON.stringify({ imageCount: sanitized.length, message: `Found ${sanitized.length} images`, thumbnails: sanitized.slice(0, 6).map(x => x.imageUrl) })]);
    }
    async fail(id: string, runId: string, message = "The board could not be imported. Retry or upload selected reference images."): Promise<void> { await this.database.query("UPDATE moodboard_import_jobs SET status='error',lease_until=NULL,progress=$3::jsonb,updated_at=now() WHERE id=$1 AND run_id=$2 AND status='scraping'", [id, runId, JSON.stringify({ message })]); }
    async consume(ownerId: string, projectId: number, jobId: string) {
        if (!validId(jobId))
            throw new ImportInputError("Preview not found", 404);
        return this.transaction(async (c) => {
            const { rows } = await c.query("SELECT * FROM moodboard_import_jobs WHERE id=$1 AND owner_id=$2 FOR UPDATE", [jobId, ownerId]);
            const job = rows[0];
            if (!job)
                throw new ImportInputError("Preview not found", 404);
            if (job.status !== "done")
                throw new ImportInputError("The preview is not ready", 409);
            const receiptKey = createHash("sha256").update(`preview:${ownerId}:${jobId}`).digest("hex");
            const receipt = await c.query("SELECT project_id,pin_ids,total FROM moodboard_import_receipts WHERE receipt_key=$1 AND owner_id=$2", [receiptKey, ownerId]);
            if (receipt.rows[0]) {
                if (receipt.rows[0].project_id !== projectId)
                    throw new ImportInputError("This preview was already imported into another project", 409);
                return this.receiptResult(c, receipt.rows[0], true);
            }
            if (new Date(job.expires_at).getTime() <= Date.now())
                throw new ImportInputError("Preview expired. Start another preview.", 410);
            return this.insert(c, ownerId, projectId, receiptKey, jobId, job.images || [], job.board_url, "pinterest");
        });
    }
    async importDirect(ownerId: string, projectId: number, key: string, images: PinterestImage[], sourceUrl: string, sourceType: string) {
        const receiptKey = createHash("sha256").update(`direct:${ownerId}:${projectId}:${key}`).digest("hex");
        return this.transaction(async (c) => {
            await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`moodboard-import-project:${projectId}`]);
            const receipt = await c.query("SELECT project_id,pin_ids,total FROM moodboard_import_receipts WHERE receipt_key=$1 AND owner_id=$2", [receiptKey, ownerId]);
            if (receipt.rows[0])
                return this.receiptResult(c, receipt.rows[0], true);
            return this.insert(c, ownerId, projectId, receiptKey, null, images, sourceUrl, sourceType);
        });
    }
    private async receiptResult(c: PoolClient, receipt: any, alreadyImported: boolean) {
        const { rows } = await c.query("SELECT * FROM pins WHERE id=ANY($1::integer[]) AND project_id=$2 ORDER BY position", [receipt.pin_ids, receipt.project_id]);
        return { pins: rows.map(toPin), imported: receipt.pin_ids.length, total: receipt.total, errors: [] as string[], alreadyImported };
    }
    private async insert(c: PoolClient, ownerId: string, projectId: number, key: string, jobId: string | null, images: PinterestImage[], sourceUrl: string, type: string) {
        if (images.length > 2000)
            throw new ImportInputError("An import is limited to 2000 images");
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`moodboard-import-project:${projectId}`]);
        const project = await c.query("SELECT id FROM projects WHERE id=$1 AND user_id=$2 FOR UPDATE", [projectId, ownerId]);
        if (!project.rows[0])
            throw new ImportInputError("Project not found", 404);
        const existing = await c.query("SELECT image_url,image_path,position FROM pins WHERE project_id=$1", [projectId]);
        const seen = new Set<string>(existing.rows.flatMap((p: any) => [p.image_url, p.image_path].filter(Boolean)));
        let position = existing.rows.reduce((max: number, p: any) => Math.max(max, Number(p.position) || 0), -1) + 1;
        const inserted: any[] = [];
        for (const image of images) {
            if (seen.has(image.imageUrl))
                continue;
            seen.add(image.imageUrl);
            const result = await c.query("INSERT INTO pins(project_id,image_url,source_url,title,position) VALUES($1,$2,$3,$4,$5) RETURNING *", [projectId, image.imageUrl, image.sourceUrl, String(image.title || "").slice(0, 500), position++]);
            inserted.push(result.rows[0]);
        }
        await c.query("INSERT INTO sources(project_id,type,url,status,total_items,imported_items) VALUES($1,$2,$3,'completed',$4,$5)", [projectId, type, sourceUrl, images.length, inserted.length]);
        await c.query("INSERT INTO moodboard_import_receipts(receipt_key,owner_id,project_id,job_id,pin_ids,total) VALUES($1,$2,$3,$4,$5,$6)", [key, ownerId, projectId, jobId, inserted.map(x => x.id), images.length]);
        return { pins: inserted.map(toPin), imported: inserted.length, total: images.length, errors: [] as string[], alreadyImported: false };
    }
}
export const importJobs = new ImportJobStore();
type Scraper = (url: string, progress: (count: number, message: string, thumbs: string[]) => void, signal?: AbortSignal) => Promise<PinterestImage[]>;
let workerStarted = false;
/** Leased durable queue: a restart retries unfinished previews instead of losing them. */
export function startImportWorker(scraper: Scraper): () => void {
    if (workerStarted)
        return () => { };
    workerStarted = true;
    let running = false;
    let stopped = false;
    const tick = async () => {
        if (running || stopped)
            return;
        running = true;
        try {
            const job = await importJobs.claim();
            if (!job)
                return;
            const signal = AbortSignal.timeout(8 * 60 * 1000);
            const heartbeat = setInterval(() => void importJobs.heartbeat(job.id, job.run_id).catch(() => { }), 20000);
            heartbeat.unref();
            try {
                const images = await scraper(job.board_url, (n, m, t) => { void importJobs.updateProgress(job.id, job.run_id, n, m, t).catch(() => { }); }, signal);
                signal.throwIfAborted();
                await importJobs.complete(job.id, job.run_id, images, job.board_url);
            }
            catch (error) {
                await importJobs.fail(job.id, job.run_id, error instanceof ImportInputError ? error.message : signal.aborted ? "This board took too long to import. Try a smaller board or upload selected references." : undefined);
            }
            finally {
                clearInterval(heartbeat);
            }
        }
        catch (error) {
            console.error("Import worker could not process a job", error instanceof Error ? error.message : "unknown error");
        }
        finally {
            running = false;
        }
    };
    const interval = setInterval(() => void tick(), 2000);
    interval.unref();
    void tick();
    return () => { stopped = true; workerStarted = false; clearInterval(interval); };
}
